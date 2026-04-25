import type {
  OrbitSyncConnectionState,
  OrbitSyncConflictRecord,
  OrbitSyncEntityName,
  OrbitSyncMetadata,
  OrbitSyncStatus,
} from '@orbit-ledger/contracts';
import type { SyncConflictInput, SyncOverview, SyncPendingRecord } from '@orbit-ledger/sync';

export type SyncEntityName = OrbitSyncEntityName;

export type SyncConnectionState = OrbitSyncConnectionState;

export type SyncRecordPointer = OrbitSyncMetadata & {
  entity: SyncEntityName;
  localId: string;
};

export type SyncPendingChange = SyncPendingRecord;

export type SyncConflict = OrbitSyncConflictRecord;

export type SyncConflictCreateInput = SyncConflictInput;

export type SyncStatusSummary = {
  state: SyncConnectionState;
  pendingChanges: number;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  conflictCount: number;
  workspaceId: string | null;
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
  status: OrbitSyncStatus;
  lastModified: string;
  serverRevision?: number;
};

export interface OrbitLedgerSyncService {
  getStatus(): Promise<SyncStatusSummary>;
  listPendingChanges(): Promise<SyncRecordPointer[]>;
  getOverview(): Promise<SyncOverview>;
  listConflicts(): Promise<SyncConflict[]>;
  pushPendingChanges(changes: SyncRecordPointer[]): Promise<SyncPushResult>;
  pullRemoteChanges(cursor?: string | null): Promise<SyncPullResult>;
  markRecords(syncMarks: SyncMarkInput[]): Promise<void>;
  recordConflict(input: SyncConflictCreateInput): Promise<SyncConflict>;
}
