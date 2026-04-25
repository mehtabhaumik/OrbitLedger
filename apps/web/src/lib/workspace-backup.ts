'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  type WriteBatch,
  writeBatch,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';

export const WEB_WORKSPACE_BACKUP_VERSION = 1;

type BackupCollectionName =
  | 'customers'
  | 'transactions'
  | 'products'
  | 'invoices'
  | 'invoice_items';

export type WebWorkspaceBackup = {
  backup_format_version: number;
  exported_at: string;
  workspace: {
    profile: Record<string, unknown>;
  };
  entities: Record<BackupCollectionName, Array<Record<string, unknown> & { id: string }>>;
  notes: {
    browser_lock_included: false;
  };
};

const COLLECTIONS: BackupCollectionName[] = [
  'customers',
  'transactions',
  'products',
  'invoices',
  'invoice_items',
];

export async function exportWorkspaceBackup(workspaceId: string): Promise<WebWorkspaceBackup> {
  const firestore = getWebFirestore();
  const workspaceSnapshot = await getDoc(doc(firestore, 'workspaces', workspaceId));
  if (!workspaceSnapshot.exists()) {
    throw new Error('Workspace profile could not be loaded for backup.');
  }

  const entitySnapshots = await Promise.all(
    COLLECTIONS.map((name) => getDocs(collection(firestore, 'workspaces', workspaceId, name)))
  );

  return {
    backup_format_version: WEB_WORKSPACE_BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    workspace: {
      profile: workspaceSnapshot.data(),
    },
    entities: {
      customers: entitySnapshots[0].docs.map(mapEntry),
      transactions: entitySnapshots[1].docs.map(mapEntry),
      products: entitySnapshots[2].docs.map(mapEntry),
      invoices: entitySnapshots[3].docs.map(mapEntry),
      invoice_items: entitySnapshots[4].docs.map(mapEntry),
    },
    notes: {
      browser_lock_included: false,
    },
  };
}

export function parseWorkspaceBackup(raw: string): WebWorkspaceBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file format is not supported.');
  }

  const backup = parsed as Partial<WebWorkspaceBackup>;
  if (backup.backup_format_version !== WEB_WORKSPACE_BACKUP_VERSION) {
    throw new Error('Backup format version is not supported.');
  }

  if (!backup.workspace?.profile || !backup.entities) {
    throw new Error('Backup file is missing required workspace data.');
  }

  return backup as WebWorkspaceBackup;
}

export async function restoreWorkspaceBackup(
  workspaceId: string,
  backup: WebWorkspaceBackup
): Promise<void> {
  const firestore = getWebFirestore();
  const currentWorkspace = await getDoc(doc(firestore, 'workspaces', workspaceId));
  if (!currentWorkspace.exists()) {
    throw new Error('Current workspace could not be loaded before restore.');
  }

  const batches: WriteBatch[] = [];
  let batch = writeBatch(firestore);
  let operations = 0;

  function pushOperation(callback: (target: WriteBatch) => void) {
    callback(batch);
    operations += 1;
    if (operations >= 400) {
      batches.push(batch);
      batch = writeBatch(firestore);
      operations = 0;
    }
  }

  for (const collectionName of COLLECTIONS) {
    const snapshot = await getDocs(collection(firestore, 'workspaces', workspaceId, collectionName));
    for (const entry of snapshot.docs) {
      pushOperation((target) => target.delete(entry.ref));
    }
  }

  pushOperation((target) =>
    target.set(
      doc(firestore, 'workspaces', workspaceId),
      {
        ...currentWorkspace.data(),
        ...backup.workspace.profile,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
  );

  for (const collectionName of COLLECTIONS) {
    for (const record of backup.entities[collectionName] ?? []) {
      const { id, ...payload } = record;
      pushOperation((target) =>
        target.set(doc(firestore, 'workspaces', workspaceId, collectionName, id), payload)
      );
    }
  }

  if (operations > 0 || batches.length === 0) {
    batches.push(batch);
  }

  for (const targetBatch of batches) {
    await targetBatch.commit();
  }
}

function mapEntry(entry: { id: string; data(): Record<string, unknown> }) {
  return {
    id: entry.id,
    ...entry.data(),
  };
}
