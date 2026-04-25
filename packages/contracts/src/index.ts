export type OrbitBusinessStorageMode = 'local_only' | 'synced';

export type OrbitSyncStatus = 'pending' | 'synced' | 'conflict';

export type OrbitWorkspaceDataState = 'profile_only' | 'full_dataset';

export type OrbitSyncMetadata = {
  syncId: string;
  lastModified: string;
  syncStatus: OrbitSyncStatus;
  serverRevision: number;
};

export type OrbitWorkspaceLink = {
  workspaceId: string | null;
  storageMode: OrbitBusinessStorageMode;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
};

export type OrbitCloudUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type OrbitWorkspaceSummary = {
  workspaceId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri: string | null;
  authorizedPersonName: string;
  authorizedPersonTitle: string;
  signatureUri: string | null;
  createdAt: string;
  updatedAt: string;
  serverRevision: number;
  dataState: OrbitWorkspaceDataState;
};

export type OrbitSyncEntityName =
  | 'business_settings'
  | 'customers'
  | 'transactions'
  | 'tax_profiles'
  | 'products'
  | 'invoices'
  | 'invoice_items';

export type OrbitSyncConnectionState =
  | 'not_configured'
  | 'offline'
  | 'ready'
  | 'syncing'
  | 'error';

export type OrbitSyncConflictReason =
  | 'server_revision_mismatch'
  | 'workspace_missing'
  | 'record_missing'
  | 'apply_failed';

export type OrbitSyncConflictRecord = {
  id: string;
  entityName: OrbitSyncEntityName;
  recordId: string;
  workspaceId: string | null;
  reason: OrbitSyncConflictReason;
  localLastModified: string | null;
  remoteLastModified: string | null;
  payloadJson: string;
  createdAt: string;
  resolvedAt: string | null;
};
