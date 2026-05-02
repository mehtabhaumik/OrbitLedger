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
  legalName?: string | null;
  ownerName: string;
  contactPerson?: string | null;
  businessType?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  placeOfSupply?: string | null;
  defaultTaxTreatment?: string | null;
  defaultPaymentTerms?: string | null;
  defaultDueDays?: number | null;
  defaultTaxRate?: number | null;
  defaultInvoiceTemplate?: string | null;
  defaultStatementTemplate?: string | null;
  defaultLanguage?: string | null;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri: string | null;
  authorizedPersonName: string;
  authorizedPersonTitle: string;
  signatureUri: string | null;
  paymentInstructions: {
    upiId?: string | null;
    paymentPageUrl?: string | null;
    paymentNote?: string | null;
    bankAccountName?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankIfsc?: string | null;
    bankBranch?: string | null;
    bankRoutingNumber?: string | null;
    bankSortCode?: string | null;
    bankIban?: string | null;
    bankSwift?: string | null;
  };
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
  | 'invoice_items'
  | 'payment_allocations';

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
