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
export const WEB_WORKSPACE_BACKUP_MAX_RECORDS = 50000;

type BackupCollectionName =
  | 'customers'
  | 'transactions'
  | 'products'
  | 'invoices'
  | 'invoice_items'
  | 'payment_allocations';

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

export type WebWorkspaceBackupSummary = {
  businessName: string;
  exportedAt: string;
  totalRecords: number;
  counts: Record<BackupCollectionName, number>;
  browserLockIncluded: false;
};

export type RestoreWorkspaceBackupOptions = {
  expectedOwnerId?: string;
  onProgress?: (message: string) => void;
};

const COLLECTIONS: BackupCollectionName[] = [
  'customers',
  'transactions',
  'products',
  'invoices',
  'invoice_items',
  'payment_allocations',
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
      payment_allocations: entitySnapshots[5].docs.map(mapEntry),
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

  if (typeof backup.exported_at !== 'string' || Number.isNaN(Date.parse(backup.exported_at))) {
    throw new Error('Backup exported timestamp is invalid.');
  }

  if (!backup.notes || backup.notes.browser_lock_included !== false) {
    throw new Error('Backup security notes are invalid.');
  }

  for (const collectionName of COLLECTIONS) {
    const collectionEntries = backup.entities[collectionName];
    if (!Array.isArray(collectionEntries)) {
      throw new Error(`Backup entity list for ${collectionName} is invalid.`);
    }

    for (const entry of collectionEntries) {
      if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim()) {
        throw new Error(`Backup contains an invalid record in ${collectionName}.`);
      }
    }
  }

  const totalRecords = countWorkspaceBackupRecords(backup as WebWorkspaceBackup);
  if (totalRecords > WEB_WORKSPACE_BACKUP_MAX_RECORDS) {
    throw new Error('This backup is too large to restore safely from the browser.');
  }

  return backup as WebWorkspaceBackup;
}

export function summarizeWorkspaceBackup(backup: WebWorkspaceBackup): WebWorkspaceBackupSummary {
  return {
    businessName: getWorkspaceBackupBusinessName(backup),
    exportedAt: backup.exported_at,
    totalRecords: countWorkspaceBackupRecords(backup),
    counts: {
      customers: backup.entities.customers.length,
      transactions: backup.entities.transactions.length,
      products: backup.entities.products.length,
      invoices: backup.entities.invoices.length,
      invoice_items: backup.entities.invoice_items.length,
      payment_allocations: backup.entities.payment_allocations.length,
    },
    browserLockIncluded: backup.notes.browser_lock_included,
  };
}

export function validateWorkspaceBackupOwner(
  backup: WebWorkspaceBackup,
  expectedOwnerId?: string
): void {
  const backupOwnerId = String(backup.workspace.profile.owner_uid ?? '');
  if (expectedOwnerId && backupOwnerId && backupOwnerId !== expectedOwnerId) {
    throw new Error('This backup belongs to a different account.');
  }
}

export async function restoreWorkspaceBackup(
  workspaceId: string,
  backup: WebWorkspaceBackup,
  options: RestoreWorkspaceBackupOptions = {}
): Promise<void> {
  const firestore = getWebFirestore();
  const currentWorkspace = await getDoc(doc(firestore, 'workspaces', workspaceId));
  if (!currentWorkspace.exists()) {
    throw new Error('Current workspace could not be loaded before restore.');
  }
  const currentOwnerId = String(currentWorkspace.data().owner_uid ?? '');
  if (options.expectedOwnerId && currentOwnerId !== options.expectedOwnerId) {
    throw new Error('This account does not own the current workspace.');
  }
  validateWorkspaceBackupOwner(backup, options.expectedOwnerId);

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
    options.onProgress?.(`Clearing ${formatCollectionName(collectionName)}...`);
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
        owner_uid: currentOwnerId,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
  );

  for (const collectionName of COLLECTIONS) {
    options.onProgress?.(`Restoring ${formatCollectionName(collectionName)}...`);
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
    options.onProgress?.('Saving restored records...');
    await targetBatch.commit();
  }
  options.onProgress?.('Restore complete.');
}

function mapEntry(entry: { id: string; data(): Record<string, unknown> }) {
  return {
    id: entry.id,
    ...entry.data(),
  };
}

function formatCollectionName(name: BackupCollectionName) {
  return name.replace(/_/g, ' ');
}

function getWorkspaceBackupBusinessName(backup: WebWorkspaceBackup): string {
  const profile = backup.workspace.profile;
  const businessName = profile.business_name ?? profile.businessName ?? profile.name;
  return typeof businessName === 'string' && businessName.trim()
    ? businessName.trim()
    : 'Business name not saved';
}

function countWorkspaceBackupRecords(backup: WebWorkspaceBackup): number {
  return COLLECTIONS.reduce(
    (total, collectionName) => total + backup.entities[collectionName].length,
    0
  );
}
