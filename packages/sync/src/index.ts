import type {
  OrbitSyncConflictReason,
  OrbitSyncConnectionState,
  OrbitSyncEntityName,
} from '@orbit-ledger/contracts';

export const APPEND_SAFE_SYNC_ENTITIES: OrbitSyncEntityName[] = [
  'transactions',
  'payment_allocations',
];

export const REVISION_PROTECTED_SYNC_ENTITIES: OrbitSyncEntityName[] = [
  'business_settings',
  'customers',
  'tax_profiles',
  'products',
  'invoices',
  'invoice_items',
];

export type SyncEntityStrategy = 'append_safe' | 'revision_protected';

export type SyncPendingRecord = {
  entityName: OrbitSyncEntityName;
  recordId: string;
  syncId: string;
  lastModified: string;
  syncStatus: 'pending' | 'conflict';
  serverRevision: number;
};

export type SyncOverview = {
  workspaceId: string | null;
  connectionState: OrbitSyncConnectionState;
  pendingRecordCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
};

export type SyncConflictInput = {
  entityName: OrbitSyncEntityName;
  recordId: string;
  workspaceId: string | null;
  reason: OrbitSyncConflictReason;
  localLastModified: string | null;
  remoteLastModified: string | null;
  payloadJson: string;
};

export function getSyncStrategy(entityName: OrbitSyncEntityName): SyncEntityStrategy {
  if (APPEND_SAFE_SYNC_ENTITIES.includes(entityName)) {
    return 'append_safe';
  }

  return 'revision_protected';
}

export function isAppendSafeSyncEntity(entityName: OrbitSyncEntityName): boolean {
  return getSyncStrategy(entityName) === 'append_safe';
}
