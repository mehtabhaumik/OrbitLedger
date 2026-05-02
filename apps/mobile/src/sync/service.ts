import type { OrbitSyncConflictRecord, OrbitSyncEntityName, OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import type { SyncConflictInput, SyncOverview, SyncPendingRecord } from '@orbit-ledger/sync';
import { getSyncStrategy } from '@orbit-ledger/sync';

import { getCurrentCloudUser } from '../cloud/auth';
import {
  fetchWorkspaceDataset,
  getWorkspaceDataState,
  markWorkspaceDataState,
  upsertWorkspaceEntity,
} from '../cloud/workspaceData';
import { getCloudWorkspace, updateCloudWorkspaceProfile } from '../cloud/workspaces';
import { getDatabase } from '../database';
import { createEntityId } from '../database/utils';
import type {
  OrbitLedgerSyncService,
  SyncConflict,
  SyncConflictCreateInput,
  SyncMarkInput,
  SyncPullResult,
  SyncPushResult,
  SyncRecordPointer,
  SyncStatusSummary,
} from './types';

const SYNC_TABLES: Record<OrbitSyncEntityName, string> = {
  business_settings: 'business_settings',
  customers: 'customers',
  transactions: 'transactions',
  products: 'products',
  invoices: 'invoices',
  invoice_items: 'invoice_items',
  payment_allocations: 'payment_allocations',
  payment_reversals: 'payment_reversals',
  tax_profiles: 'tax_profiles',
};

const WORKSPACE_SYNC_ORDER: OrbitSyncEntityName[] = [
  'business_settings',
  'customers',
  'products',
  'invoices',
  'invoice_items',
  'payment_allocations',
  'payment_reversals',
  'transactions',
];

type SyncRow = {
  id: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision?: number;
};

type PendingSyncRow = Omit<SyncRow, 'sync_status'> & {
  sync_status: 'pending' | 'conflict';
};

type ConflictRow = {
  id: string;
  entity_name: OrbitSyncEntityName;
  record_id: string;
  workspace_id: string | null;
  reason: OrbitSyncConflictRecord['reason'];
  local_last_modified: string | null;
  remote_last_modified: string | null;
  payload_json: string;
  created_at: string;
  resolved_at: string | null;
};

type BusinessSettingsSyncRow = {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  country_code: string;
  state_code: string;
  logo_uri: string | null;
  authorized_person_name: string;
  authorized_person_title: string;
  signature_uri: string | null;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
  workspace_id: string | null;
  sync_enabled: number;
  last_synced_at: string | null;
};

type CustomerSyncRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  opening_balance: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type TransactionSyncRow = {
  id: string;
  customer_id: string;
  type: 'credit' | 'payment';
  amount: number;
  note: string | null;
  payment_mode: string | null;
  payment_details_json: string | null;
  payment_clearance_status: string | null;
  payment_attachments_json: string | null;
  effective_date: string;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type ProductSyncRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  unit: string;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type InvoiceSyncRow = {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  document_state: string;
  payment_status: string;
  version_number: number;
  latest_version_id: string | null;
  latest_snapshot_hash: string | null;
  notes: string | null;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type InvoiceItemSyncRow = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  tax_rate: number;
  total: number;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type PaymentAllocationSyncRow = {
  id: string;
  transaction_id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision: number;
};

type SyncWorkspaceContext = {
  workspaceId: string;
  lastSyncedAt: string | null;
};

export async function getSyncOverview(): Promise<SyncOverview> {
  const db = await getDatabase();
  const business = await db.getFirstAsync<{
    workspace_id: string | null;
    sync_enabled: number;
    last_synced_at: string | null;
  }>('SELECT workspace_id, sync_enabled, last_synced_at FROM business_settings WHERE id = ? LIMIT 1', 'primary');

  const pending = await countPendingRecords();
  const conflicts = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM sync_conflicts WHERE resolved_at IS NULL"
  );

  let connectionState: SyncOverview['connectionState'] = 'not_configured';
  if (business?.sync_enabled && business.workspace_id) {
    connectionState = pending > 0 ? 'syncing' : 'ready';
  }

  return {
    workspaceId: business?.workspace_id ?? null,
    connectionState,
    pendingRecordCount: pending,
    conflictCount: conflicts?.total ?? 0,
    lastSyncedAt: business?.last_synced_at ?? null,
  };
}

export async function listPendingSyncChanges(limit = 200): Promise<SyncPendingRecord[]> {
  const db = await getDatabase();
  const all: SyncPendingRecord[] = [];

  for (const [entityName, tableName] of Object.entries(SYNC_TABLES) as Array<
    [OrbitSyncEntityName, string]
  >) {
    const rows = await db.getAllAsync<PendingSyncRow>(
      `SELECT id, sync_id, last_modified, sync_status, server_revision
       FROM ${tableName}
       WHERE sync_status != 'synced'
       ORDER BY last_modified ASC
       LIMIT ?`,
      limit
    );

    all.push(
      ...rows.map((row) => ({
        entityName,
        recordId: row.id,
        syncId: row.sync_id || row.id,
        lastModified: row.last_modified,
        syncStatus: row.sync_status,
        serverRevision: row.server_revision ?? 0,
      }))
    );
  }

  return all.sort((left, right) => left.lastModified.localeCompare(right.lastModified)).slice(0, limit);
}

export async function listSyncConflicts(): Promise<SyncConflict[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConflictRow>(
    `SELECT * FROM sync_conflicts
     WHERE resolved_at IS NULL
     ORDER BY created_at DESC`
  );

  return rows.map(mapConflictRow);
}

export async function recordSyncConflict(input: SyncConflictCreateInput): Promise<SyncConflict> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  const id = createEntityId('scf');

  await db.runAsync(
    `INSERT INTO sync_conflicts (
      id,
      entity_name,
      record_id,
      workspace_id,
      reason,
      local_last_modified,
      remote_last_modified,
      payload_json,
      created_at,
      resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    id,
    input.entityName,
    input.recordId,
    input.workspaceId,
    input.reason,
    input.localLastModified,
    input.remoteLastModified,
    input.payloadJson,
    createdAt
  );

  return {
    id,
    entityName: input.entityName,
    recordId: input.recordId,
    workspaceId: input.workspaceId,
    reason: input.reason,
    localLastModified: input.localLastModified,
    remoteLastModified: input.remoteLastModified,
    payloadJson: input.payloadJson,
    createdAt,
    resolvedAt: null,
  };
}

export async function markSyncRecords(syncMarks: SyncMarkInput[]): Promise<void> {
  const db = await getDatabase();

  for (const mark of syncMarks) {
    const tableName = SYNC_TABLES[mark.entity];
    await db.runAsync(
      `UPDATE ${tableName}
       SET sync_id = ?,
        sync_status = ?,
        last_modified = ?,
        server_revision = COALESCE(?, server_revision + CASE
          WHEN ? = 'synced' THEN 1
          ELSE 0
        END)
       WHERE id = ?`,
      mark.syncId,
      mark.status,
      mark.lastModified,
      mark.serverRevision ?? null,
      mark.status,
      mark.localId
    );
  }
}

export function createOrbitLedgerSyncService(): OrbitLedgerSyncService {
  return {
    async getStatus(): Promise<SyncStatusSummary> {
      const overview = await getSyncOverview();
      return {
        state: overview.connectionState,
        pendingChanges: overview.pendingRecordCount,
        lastSuccessfulSyncAt: overview.lastSyncedAt,
        lastError: overview.conflictCount > 0 ? 'Sync conflicts need review.' : null,
        conflictCount: overview.conflictCount,
        workspaceId: overview.workspaceId,
      };
    },
    async getOverview() {
      return getSyncOverview();
    },
    async listPendingChanges(): Promise<SyncRecordPointer[]> {
      const rows = await listPendingSyncChanges();
      return rows.map((row) => ({
        entity: row.entityName,
        localId: row.recordId,
        syncId: row.syncId,
        lastModified: row.lastModified,
        syncStatus: row.syncStatus,
        serverRevision: row.serverRevision,
      }));
    },
    async listConflicts() {
      return listSyncConflicts();
    },
    async pushPendingChanges(changes): Promise<SyncPushResult> {
      return pushPendingChangesToWorkspace(changes);
    },
    async pullRemoteChanges(): Promise<SyncPullResult> {
      return pullRemoteWorkspaceChanges();
    },
    async markRecords(syncMarks) {
      return markSyncRecords(syncMarks);
    },
    async recordConflict(input: SyncConflictInput) {
      return recordSyncConflict(input);
    },
  };
}

export async function runWorkspaceSync(): Promise<{
  pushed: number;
  pulled: number;
  conflicts: SyncRecordPointer[];
  completedAt: string;
}> {
  const service = createOrbitLedgerSyncService();
  const pendingChanges = await service.listPendingChanges();
  const pushResult = await service.pushPendingChanges(pendingChanges);
  const pullResult = await service.pullRemoteChanges();

  return {
    pushed: pushResult.pushed,
    pulled: pullResult.pulled,
    conflicts: pushResult.conflicts,
    completedAt: pullResult.completedAt,
  };
}

async function countPendingRecords(): Promise<number> {
  const db = await getDatabase();
  let total = 0;

  for (const tableName of Object.values(SYNC_TABLES)) {
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${tableName} WHERE sync_status != 'synced'`
    );
    total += row?.total ?? 0;
  }

  return total;
}

async function pushPendingChangesToWorkspace(
  changes: SyncRecordPointer[]
): Promise<SyncPushResult> {
  const workspace = await getSyncWorkspaceContext();
  if (!workspace) {
    return {
      pushed: 0,
      conflicts: [],
      completedAt: new Date().toISOString(),
    };
  }

  const db = await getDatabase();
  const conflicts: SyncRecordPointer[] = [];
  const syncMarks: SyncMarkInput[] = [];
  const orderedChanges = sortSyncChanges(changes);

  for (const change of orderedChanges) {
    try {
      if (change.entity === 'business_settings') {
        const row = await db.getFirstAsync<BusinessSettingsSyncRow>(
          `SELECT id, business_name, owner_name, phone, email, address, currency, country_code,
                  state_code, logo_uri, authorized_person_name, authorized_person_title,
                  signature_uri, sync_id, last_modified, sync_status, server_revision,
                  workspace_id, sync_enabled, last_synced_at
             FROM business_settings
            WHERE id = ?
            LIMIT 1`,
          change.localId
        );

        if (!row || !row.workspace_id || row.sync_enabled !== 1) {
          continue;
        }

        const updatedWorkspace = await updateCloudWorkspaceProfile(
          row.workspace_id,
          {
            businessName: row.business_name,
            ownerName: row.owner_name,
            phone: row.phone,
            email: row.email,
            address: row.address,
            currency: row.currency,
            countryCode: row.country_code,
            stateCode: row.state_code,
            logoUri: row.logo_uri,
            authorizedPersonName: row.authorized_person_name,
            authorizedPersonTitle: row.authorized_person_title,
            signatureUri: row.signature_uri,
          },
          row.server_revision ?? 0
        );

        await db.runAsync(
          `UPDATE business_settings
              SET sync_id = ?,
                  sync_status = 'synced',
                  last_modified = ?,
                  server_revision = ?,
                  last_synced_at = ?
            WHERE id = ?`,
          row.sync_id || row.id,
          updatedWorkspace.updatedAt,
          updatedWorkspace.serverRevision,
          updatedWorkspace.updatedAt,
          row.id
        );

        continue;
      }

      if (!isWorkspaceEntity(change.entity)) {
        continue;
      }

      const localRow = await getLocalRowForWorkspaceEntity(db, change.entity, change.localId);
      if (!localRow) {
        continue;
      }

      const result = await upsertWorkspaceEntity({
        workspaceId: workspace.workspaceId,
        entity: change.entity,
        recordId: change.syncId || change.localId,
        expectedServerRevision: change.serverRevision ?? 0,
        payload: buildWorkspacePayload(change.entity, localRow),
      });

      syncMarks.push({
        entity: change.entity,
        localId: change.localId,
        syncId: result.recordId,
        status: 'synced',
        lastModified: result.lastModified,
        serverRevision: result.serverRevision,
      });
    } catch (error) {
      const reason =
        getSyncStrategy(change.entity) === 'revision_protected'
          ? 'server_revision_mismatch'
          : 'apply_failed';

      await recordSyncConflict({
        entityName: change.entity,
        recordId: change.localId,
        workspaceId: workspace.workspaceId,
        reason,
        localLastModified: change.lastModified,
        remoteLastModified: null,
        payloadJson: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown sync error',
        }),
      });

      conflicts.push(change);
    }
  }

  if (syncMarks.length) {
    await markSyncRecords(syncMarks);
    const latestSyncedAt = syncMarks[syncMarks.length - 1]?.lastModified ?? new Date().toISOString();
    await persistLastSyncedAt(latestSyncedAt);
    await markWorkspaceDataState(workspace.workspaceId, 'full_dataset');
  }

  return {
    pushed: syncMarks.length,
    conflicts,
    completedAt: new Date().toISOString(),
  };
}

async function pullRemoteWorkspaceChanges(): Promise<SyncPullResult> {
  const workspace = await getSyncWorkspaceContext();
  if (!workspace) {
    return {
      pulled: 0,
      latestRemoteCursor: null,
      completedAt: new Date().toISOString(),
    };
  }

  const dataset = await fetchWorkspaceDataset(workspace.workspaceId);
  const db = await getDatabase();
  let pulled = 0;

  await db.withTransactionAsync(async () => {
    pulled += await applyRemoteCustomers(db, workspace.workspaceId, dataset.customers);
    pulled += await applyRemoteProducts(db, workspace.workspaceId, dataset.products);
    pulled += await applyRemoteInvoices(db, workspace.workspaceId, dataset.invoices);
    pulled += await applyRemoteInvoiceItems(db, workspace.workspaceId, dataset.invoice_items);
    pulled += await applyRemotePaymentAllocations(db, workspace.workspaceId, dataset.payment_allocations);
    pulled += await applyRemotePaymentReversals(db, workspace.workspaceId, dataset.payment_reversals);
    pulled += await applyRemoteTransactions(db, workspace.workspaceId, dataset.transactions);
  });

  const latestRemoteCursor = new Date().toISOString();
  await persistLastSyncedAt(latestRemoteCursor);
  if (pulled > 0 || (await getWorkspaceDataState(workspace.workspaceId)) !== 'full_dataset') {
    await markWorkspaceDataState(workspace.workspaceId, 'full_dataset');
  }

  return {
    pulled,
    latestRemoteCursor,
    completedAt: latestRemoteCursor,
  };
}

async function getSyncWorkspaceContext(): Promise<SyncWorkspaceContext | null> {
  const cloudUser = getCurrentCloudUser();
  if (!cloudUser) {
    return null;
  }

  const db = await getDatabase();
  const settings = await db.getFirstAsync<{
    workspace_id: string | null;
    sync_enabled: number;
    last_synced_at: string | null;
  }>('SELECT workspace_id, sync_enabled, last_synced_at FROM business_settings WHERE id = ? LIMIT 1', 'primary');

  if (!settings?.workspace_id || settings.sync_enabled !== 1) {
    return null;
  }

  return {
    workspaceId: settings.workspace_id,
    lastSyncedAt: settings.last_synced_at ?? null,
  };
}

async function persistLastSyncedAt(lastSyncedAt: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE business_settings
        SET last_synced_at = ?,
            sync_status = 'synced'
      WHERE id = ?`,
    lastSyncedAt,
    'primary'
  );
}

function sortSyncChanges(changes: SyncRecordPointer[]) {
  const rank = new Map(WORKSPACE_SYNC_ORDER.map((entity, index) => [entity, index]));
  return [...changes].sort((left, right) => {
    const leftRank = rank.get(left.entity) ?? 999;
    const rightRank = rank.get(right.entity) ?? 999;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.lastModified.localeCompare(right.lastModified);
  });
}

function isWorkspaceEntity(
  entity: OrbitSyncEntityName
): entity is 'customers' | 'transactions' | 'products' | 'invoices' | 'invoice_items' | 'payment_allocations' | 'payment_reversals' {
  return (
    entity === 'customers' ||
    entity === 'transactions' ||
    entity === 'products' ||
    entity === 'invoices' ||
    entity === 'invoice_items' ||
    entity === 'payment_allocations' ||
    entity === 'payment_reversals'
  );
}

async function getLocalRowForWorkspaceEntity(
  db: Awaited<ReturnType<typeof getDatabase>>,
  entity: 'customers' | 'transactions' | 'products' | 'invoices' | 'invoice_items' | 'payment_allocations' | 'payment_reversals',
  localId: string
): Promise<Record<string, unknown> | null> {
  const tableName = SYNC_TABLES[entity];
  return db.getFirstAsync<Record<string, unknown>>(`SELECT * FROM ${tableName} WHERE id = ? LIMIT 1`, localId);
}

function buildWorkspacePayload(entity: OrbitSyncEntityName, row: Record<string, unknown>) {
  switch (entity) {
    case 'customers':
      return {
        name: row.name,
        phone: row.phone ?? null,
        address: row.address ?? null,
        notes: row.notes ?? null,
        opening_balance: row.opening_balance ?? 0,
        is_archived: Number(row.is_archived ?? 0) === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_modified: row.last_modified,
      };
    case 'transactions':
      return {
        customer_id: row.customer_id,
        type: row.type,
        amount: row.amount,
        note: row.note ?? null,
        payment_mode: row.payment_mode ?? null,
        payment_details_json: row.payment_details_json ?? null,
        payment_clearance_status: row.payment_clearance_status ?? null,
        payment_attachments_json: row.payment_attachments_json ?? null,
        effective_date: row.effective_date,
        created_at: row.created_at,
        last_modified: row.last_modified,
      };
    case 'products':
      return {
        name: row.name,
        price: row.price,
        stock_quantity: row.stock_quantity,
        unit: row.unit,
        created_at: row.created_at,
        last_modified: row.last_modified,
      };
    case 'invoices':
      return {
        customer_id: row.customer_id ?? null,
        invoice_number: row.invoice_number,
        issue_date: row.issue_date,
        due_date: row.due_date ?? null,
        subtotal: row.subtotal,
        tax_amount: row.tax_amount,
        total_amount: row.total_amount,
        paid_amount: row.paid_amount ?? 0,
        status: row.status,
        document_state: row.document_state,
        payment_status: row.payment_status,
        version_number: row.version_number,
        latest_version_id: row.latest_version_id ?? null,
        latest_snapshot_hash: row.latest_snapshot_hash ?? null,
        notes: row.notes ?? null,
        created_at: row.created_at,
        last_modified: row.last_modified,
      };
    case 'invoice_items':
      return {
        invoice_id: row.invoice_id,
        product_id: row.product_id ?? null,
        name: row.name,
        description: row.description ?? null,
        quantity: row.quantity,
        price: row.price,
        tax_rate: row.tax_rate,
        total: row.total,
        last_modified: row.last_modified,
      };
    case 'payment_allocations':
      return {
        transaction_id: row.transaction_id,
        invoice_id: row.invoice_id,
        customer_id: row.customer_id,
        amount: row.amount,
        created_at: row.created_at,
        last_modified: row.last_modified,
      };
    case 'payment_reversals':
      {
        const { sync_id: _syncId, sync_status: _syncStatus, server_revision: _serverRevision, ...payload } = row;
        return payload;
      }
    default:
      throw new Error(`Unsupported workspace payload entity: ${entity}`);
  }
}

async function getExistingLocalSyncRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  entity: 'customers' | 'transactions' | 'products' | 'invoices' | 'invoice_items' | 'payment_allocations' | 'payment_reversals',
  remoteId: string
) {
  const tableName = SYNC_TABLES[entity];
  return db.getFirstAsync<{
    id: string;
    sync_id: string;
    last_modified: string;
    sync_status: 'pending' | 'synced' | 'conflict';
    server_revision: number;
  }>(
    `SELECT id, sync_id, last_modified, sync_status, server_revision
       FROM ${tableName}
      WHERE sync_id = ? OR id = ?
      LIMIT 1`,
    remoteId,
    remoteId
  );
}

async function shouldSkipRemoteApply(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  entity: 'customers' | 'transactions' | 'products' | 'invoices' | 'invoice_items' | 'payment_allocations' | 'payment_reversals',
  remoteRecord: { id: string; last_modified: string; server_revision: number }
) {
  const existing = await getExistingLocalSyncRow(db, entity, remoteRecord.id);
  if (!existing) {
    return false;
  }

  if (existing.sync_status === 'synced') {
    return false;
  }

  if (
    existing.last_modified !== remoteRecord.last_modified ||
    existing.server_revision !== remoteRecord.server_revision
  ) {
    await recordSyncConflict({
      entityName: entity,
      recordId: existing.id,
      workspaceId,
      reason: 'server_revision_mismatch',
      localLastModified: existing.last_modified,
      remoteLastModified: remoteRecord.last_modified,
      payloadJson: JSON.stringify(remoteRecord),
    });
    return true;
  }

  return false;
}

async function applyRemoteCustomers(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['customers']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'customers', record)) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO customers (
          id, name, phone, address, notes, opening_balance, is_archived, created_at, updated_at,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          address = excluded.address,
          notes = excluded.notes,
          opening_balance = excluded.opening_balance,
          is_archived = excluded.is_archived,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      record.name,
      record.phone ?? null,
      record.address ?? null,
      record.notes ?? null,
      record.opening_balance ?? 0,
      record.is_archived ? 1 : 0,
      record.created_at,
      record.updated_at,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemoteTransactions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['transactions']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'transactions', record)) {
      continue;
    }

    const customerExists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE id = ? LIMIT 1',
      record.customer_id
    );
    if (!customerExists) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO transactions (
          id, customer_id, type, amount, note, payment_mode, payment_details_json,
          payment_clearance_status, payment_attachments_json, effective_date, created_at,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          customer_id = excluded.customer_id,
          type = excluded.type,
          amount = excluded.amount,
          note = excluded.note,
          payment_mode = excluded.payment_mode,
          payment_details_json = excluded.payment_details_json,
          payment_clearance_status = excluded.payment_clearance_status,
          payment_attachments_json = excluded.payment_attachments_json,
          effective_date = excluded.effective_date,
          created_at = excluded.created_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      record.customer_id,
      record.type,
      record.amount,
      record.note ?? null,
      record.payment_mode ?? null,
      record.payment_details_json ?? null,
      record.payment_clearance_status ?? null,
      record.payment_attachments_json ?? null,
      record.effective_date,
      record.created_at,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemoteProducts(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['products']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'products', record)) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO products (
          id, name, price, stock_quantity, unit, created_at,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          price = excluded.price,
          stock_quantity = excluded.stock_quantity,
          unit = excluded.unit,
          created_at = excluded.created_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      record.name,
      record.price,
      record.stock_quantity,
      record.unit,
      record.created_at,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemoteInvoices(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['invoices']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'invoices', record)) {
      continue;
    }

    const customerId = record.customer_id ?? null;
    if (customerId) {
      const customerExists = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM customers WHERE id = ? LIMIT 1',
        customerId
      );
      if (!customerExists) {
        continue;
      }
    }

    await db.runAsync(
      `INSERT INTO invoices (
          id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount,
          total_amount, paid_amount, status, document_state, payment_status, version_number, latest_version_id,
          latest_snapshot_hash, notes, created_at, sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          customer_id = excluded.customer_id,
          invoice_number = excluded.invoice_number,
          issue_date = excluded.issue_date,
          due_date = excluded.due_date,
          subtotal = excluded.subtotal,
          tax_amount = excluded.tax_amount,
          total_amount = excluded.total_amount,
          paid_amount = excluded.paid_amount,
          status = excluded.status,
          document_state = excluded.document_state,
          payment_status = excluded.payment_status,
          version_number = excluded.version_number,
          latest_version_id = excluded.latest_version_id,
          latest_snapshot_hash = excluded.latest_snapshot_hash,
          notes = excluded.notes,
          created_at = excluded.created_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      customerId,
      record.invoice_number,
      record.issue_date,
      record.due_date ?? null,
      record.subtotal,
      record.tax_amount,
      record.total_amount,
      record.paid_amount ?? 0,
      record.status,
      record.document_state ?? legacyDocumentState(record.status),
      record.payment_status ?? legacyPaymentStatus(record.status),
      record.version_number ?? (record.status === 'draft' ? 0 : 1),
      record.latest_version_id ?? null,
      record.latest_snapshot_hash ?? null,
      record.notes ?? null,
      record.created_at,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemoteInvoiceItems(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['invoice_items']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'invoice_items', record)) {
      continue;
    }

    const invoiceExists = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM invoices WHERE id = ? LIMIT 1',
      record.invoice_id
    );
    if (!invoiceExists) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO invoice_items (
          id, invoice_id, product_id, name, description, quantity, price, tax_rate, total,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          invoice_id = excluded.invoice_id,
          product_id = excluded.product_id,
          name = excluded.name,
          description = excluded.description,
          quantity = excluded.quantity,
          price = excluded.price,
          tax_rate = excluded.tax_rate,
          total = excluded.total,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      record.invoice_id,
      record.product_id ?? null,
      record.name,
      record.description ?? null,
      record.quantity,
      record.price,
      record.tax_rate,
      record.total,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemotePaymentAllocations(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['payment_allocations']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'payment_allocations', record)) {
      continue;
    }

    const [transactionExists, invoiceExists, customerExists] = await Promise.all([
      db.getFirstAsync<{ id: string }>('SELECT id FROM transactions WHERE id = ? LIMIT 1', record.transaction_id),
      db.getFirstAsync<{ id: string }>('SELECT id FROM invoices WHERE id = ? LIMIT 1', record.invoice_id),
      db.getFirstAsync<{ id: string }>('SELECT id FROM customers WHERE id = ? LIMIT 1', record.customer_id),
    ]);
    if (!transactionExists || !invoiceExists || !customerExists) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO payment_allocations (
          id, transaction_id, invoice_id, customer_id, amount, created_at,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          transaction_id = excluded.transaction_id,
          invoice_id = excluded.invoice_id,
          customer_id = excluded.customer_id,
          amount = excluded.amount,
          created_at = excluded.created_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      record.transaction_id,
      record.invoice_id,
      record.customer_id,
      record.amount,
      record.created_at,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

async function applyRemotePaymentReversals(
  db: Awaited<ReturnType<typeof getDatabase>>,
  workspaceId: string,
  records: Awaited<ReturnType<typeof fetchWorkspaceDataset>>['payment_reversals']
) {
  let applied = 0;
  for (const record of records) {
    if (await shouldSkipRemoteApply(db, workspaceId, 'payment_reversals', record)) {
      continue;
    }

    await db.runAsync(
      `INSERT INTO payment_reversals (
          id, original_transaction_id, reversal_transaction_id, allocation_id, invoice_id, customer_id,
          amount, allocation_amount, balance_delta, reason, source, reference, created_at,
          sync_id, last_modified, sync_status, server_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET
          original_transaction_id = excluded.original_transaction_id,
          reversal_transaction_id = excluded.reversal_transaction_id,
          allocation_id = excluded.allocation_id,
          invoice_id = excluded.invoice_id,
          customer_id = excluded.customer_id,
          amount = excluded.amount,
          allocation_amount = excluded.allocation_amount,
          balance_delta = excluded.balance_delta,
          reason = excluded.reason,
          source = excluded.source,
          reference = excluded.reference,
          created_at = excluded.created_at,
          sync_id = excluded.sync_id,
          last_modified = excluded.last_modified,
          sync_status = 'synced',
          server_revision = excluded.server_revision`,
      record.id,
      stringOrNull(record.original_transaction_id),
      stringOrNull(record.reversal_transaction_id),
      stringOrNull(record.allocation_id),
      stringOrNull(record.invoice_id),
      stringOrNull(record.customer_id),
      Number(record.amount ?? 0),
      Number(record.allocation_amount ?? 0),
      Number(record.balance_delta ?? 0),
      stringOrNull(record.reason),
      stringOrNull(record.source),
      stringOrNull(record.reference),
      stringOrNull(record.created_at) ?? record.last_modified,
      record.id,
      record.last_modified,
      record.server_revision
    );
    applied += 1;
  }
  return applied;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function legacyDocumentState(status: string): 'draft' | 'created' | 'revised' | 'cancelled' {
  if (status === 'draft') {
    return 'draft';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'created';
}

function legacyPaymentStatus(status: string): 'unpaid' | 'partially_paid' | 'paid' | 'overdue' {
  if (status === 'paid') {
    return 'paid';
  }

  if (status === 'overdue') {
    return 'overdue';
  }

  return 'unpaid';
}

function mapConflictRow(row: ConflictRow): SyncConflict {
  return {
    id: row.id,
    entityName: row.entity_name,
    recordId: row.record_id,
    workspaceId: row.workspace_id,
    reason: row.reason,
    localLastModified: row.local_last_modified,
    remoteLastModified: row.remote_last_modified,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
