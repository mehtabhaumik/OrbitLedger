import type { SyncMetadata, SyncStatus } from '../database';

export type SyncEntityName =
  | 'business_settings'
  | 'customers'
  | 'transactions'
  | 'tax_profiles'
  | 'products'
  | 'invoices'
  | 'invoice_items';

export type SyncConnectionState = 'not_configured' | 'offline' | 'ready' | 'syncing' | 'error';

export type SyncRecordPointer = SyncMetadata & {
  entity: SyncEntityName;
  localId: string;
};

export type SyncStatusSummary = {
  state: SyncConnectionState;
  pendingChanges: number;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
};

export type SyncPushResult = {
  pushed: number;
  conflicts: SyncRecordPointer[];
  completedAt: string;
};

export type SyncPullResult = {
  pulled: number;
  latestRemoteCursor: string | null;
  completedAt: string;
};

export type SyncMarkInput = {
  entity: SyncEntityName;
  localId: string;
  syncId: string;
  status: SyncStatus;
  lastModified: string;
};

export interface OrbitLedgerSyncService {
  getStatus(): Promise<SyncStatusSummary>;
  listPendingChanges(): Promise<SyncRecordPointer[]>;
  pushPendingChanges(changes: SyncRecordPointer[]): Promise<SyncPushResult>;
  pullRemoteChanges(cursor?: string | null): Promise<SyncPullResult>;
  markRecords(syncMarks: SyncMarkInput[]): Promise<void>;
}
