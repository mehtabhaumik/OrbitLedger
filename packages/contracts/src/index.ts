export type OrbitBusinessStorageMode = 'local_only' | 'synced';

export type OrbitSyncStatus = 'pending' | 'synced' | 'conflict';

export type OrbitWorkspaceDataState = 'profile_only' | 'full_dataset';

export type OrbitEntityType =
  | 'freelancer_individual'
  | 'sole_proprietorship'
  | 'partnership_firm'
  | 'llp'
  | 'company'
  | 'nonprofit_charity';

export type OrbitCompanySubtype =
  | 'private_limited'
  | 'one_person_company'
  | 'public_limited'
  | 'other_company';

export type OrbitNonprofitSubtype =
  | 'charitable_trust'
  | 'registered_society'
  | 'section_8_company'
  | 'ngo_voluntary_organization'
  | 'religious_charitable_institution'
  | 'other_nonprofit';

export type OrbitEntitySubtype = OrbitCompanySubtype | OrbitNonprofitSubtype;

export type OrbitEntityVerificationStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'needs_updates'
  | 'rejected';

export type OrbitEntityComplianceFlags = {
  gstRegistered: boolean;
  donationReceiptsEnabled: boolean;
  has12A12AB: boolean;
  has80G: boolean;
  receivesForeignContribution: boolean;
  hasFcra: boolean;
  acceptsCsrFunding: boolean;
  hasUdyam: boolean;
};

export type OrbitEntityProfileIdentity = {
  entityType: OrbitEntityType;
  entitySubtype: OrbitEntitySubtype | null;
  entityVerificationStatus: OrbitEntityVerificationStatus;
  complianceFlags: OrbitEntityComplianceFlags;
  cin?: string | null;
  llpin?: string | null;
  registeredOfficeAddress?: string | null;
  principalPlaceOfBusiness?: string | null;
  additionalPlacesOfBusiness?: string[] | null;
  nonprofitRegistrationNumber?: string | null;
  nonprofitRegistrationAuthority?: string | null;
  ngoDarpanId?: string | null;
  taxExemption12A12ABNumber?: string | null;
  taxDeduction80GNumber?: string | null;
  fcraRegistrationNumber?: string | null;
  csrRegistrationNumber?: string | null;
};

export type OnlinePaymentProvider = 'razorpay';

export type OnlinePaymentProviderMode = 'test' | 'live';

export type OnlinePaymentSettingsStatus =
  | 'not_connected'
  | 'test_mode'
  | 'ready_for_verification'
  | 'active'
  | 'disabled';

export type ProviderBackedPaymentStatus =
  | 'pending'
  | 'checkout_opened'
  | 'payment_initiated'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'needs_review';

export type AllocationDerivedInvoicePaymentStatus =
  | 'unpaid'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'refunded'
  | 'needs_review';

export type LivePaymentEventSource =
  | 'provider_webhook'
  | 'trusted_backend_verification';

export type LivePaymentEventVerificationStatus =
  | 'verified'
  | 'rejected'
  | 'duplicate'
  | 'needs_review';

export type LivePaymentNotificationKind =
  | 'payment_received'
  | 'payment_failed'
  | 'payment_needs_review'
  | 'payment_refunded';

export type LivePaymentAuditAction =
  | 'event_received'
  | 'event_rejected'
  | 'duplicate_ignored'
  | 'payment_applied'
  | 'payment_review_required'
  | 'payment_refunded';

export type OnlinePaymentSettings = {
  provider: OnlinePaymentProvider;
  mode: OnlinePaymentProviderMode;
  status: OnlinePaymentSettingsStatus;
  enabled: boolean;
  currency: string;
  workspaceId: string;
  providerAccountLabel?: string | null;
  providerAccountLast4?: string | null;
  webhookVerifiedAt?: string | null;
  paymentLinksEnabled: boolean;
  automaticReconciliationEnabled: boolean;
  liveNotificationsEnabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

export type OnlinePaymentProviderServerConfig = {
  provider: OnlinePaymentProvider;
  mode: OnlinePaymentProviderMode;
  workspaceId: string;
  keyIdSecretName: string;
  keySecretSecretName: string;
  webhookSecretName: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type PaymentCapabilitySettings = {
  manualInstructionsEnabled: boolean;
  manualInstructionsSource: 'workspace_payment_instructions';
  onlinePayments: OnlinePaymentSettings | null;
};

export type LivePaymentLink = {
  id: string;
  workspaceId: string;
  invoiceId: string;
  invoiceVersionId: string | null;
  customerId: string | null;
  provider: OnlinePaymentProvider;
  providerPaymentLinkId: string;
  publicPaymentUrl: string;
  amount: number;
  currency: string;
  status: ProviderBackedPaymentStatus;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string | null;
};

export type LivePaymentEvent = {
  id: string;
  workspaceId: string;
  provider: OnlinePaymentProvider;
  source: LivePaymentEventSource;
  providerEventId: string;
  providerPaymentId?: string | null;
  providerPaymentLinkId?: string | null;
  invoiceId?: string | null;
  invoiceVersionId?: string | null;
  customerId?: string | null;
  amount: number;
  currency: string;
  providerStatus: ProviderBackedPaymentStatus;
  verificationStatus: LivePaymentEventVerificationStatus;
  idempotencyKey: string;
  receivedAt: string;
  verifiedAt: string | null;
  rawEventPath: string | null;
  auditEntryId: string | null;
};

export type LivePaymentAllocationSummary = {
  invoiceId: string;
  invoiceVersionId: string | null;
  invoiceTotal: number;
  capturedAmount: number;
  refundedAmount: number;
  needsReviewAmount: number;
  dueDate: string | null;
  today: string;
  status: AllocationDerivedInvoicePaymentStatus;
};

export type LivePaymentNotification = {
  id: string;
  workspaceId: string;
  kind: LivePaymentNotificationKind;
  source: 'orbit_ledger_state';
  invoiceId: string | null;
  invoiceVersionId: string | null;
  customerId: string | null;
  paymentEventId: string;
  amount: number;
  currency: string;
  title: string;
  message: string;
  deepLinkPath: string;
  createdAt: string;
  readAt: string | null;
};

export type LivePaymentAuditEntry = {
  id: string;
  workspaceId: string;
  action: LivePaymentAuditAction;
  paymentEventId: string;
  invoiceId: string | null;
  invoiceVersionId: string | null;
  customerId: string | null;
  actor: 'system';
  source: LivePaymentEventSource;
  provider: OnlinePaymentProvider;
  providerEventId: string;
  idempotencyKey: string;
  amount: number;
  currency: string;
  message: string;
  createdAt: string;
};

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
  town?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  cin?: string | null;
  llpin?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  registeredOfficeAddress?: string | null;
  principalPlaceOfBusiness?: string | null;
  additionalPlacesOfBusiness?: string[] | null;
  nonprofitRegistrationNumber?: string | null;
  nonprofitRegistrationAuthority?: string | null;
  ngoDarpanId?: string | null;
  taxExemption12A12ABNumber?: string | null;
  taxDeduction80GNumber?: string | null;
  fcraRegistrationNumber?: string | null;
  csrRegistrationNumber?: string | null;
  placeOfSupply?: string | null;
  entityType?: OrbitEntityType | null;
  entitySubtype?: OrbitEntitySubtype | null;
  entityVerificationStatus?: OrbitEntityVerificationStatus | null;
  entityComplianceFlags?: OrbitEntityComplianceFlags | null;
  defaultTaxTreatment?: string | null;
  defaultPaymentTerms?: string | null;
  defaultDueDays?: number | null;
  defaultTaxRate?: number | null;
  defaultInvoiceTemplate?: string | null;
  defaultStatementTemplate?: string | null;
  defaultInvoiceNotes?: string | null;
  defaultRecurringEmailSubject?: string | null;
  defaultRecurringEmailBody?: string | null;
  defaultRecurringEmailIncludePaymentLink?: boolean | null;
  defaultRecurringEmailAttachPdf?: boolean | null;
  defaultRecurringEmailCurrentMonthOnly?: boolean | null;
  defaultRecurringEmailSendDayBehavior?: 'same_day' | 'custom_day' | null;
  defaultRecurringEmailDay?: number | null;
  invoiceNumberPrefix?: string | null;
  invoiceNumberSeparator?: '/' | '-' | null;
  invoiceNumberPadding?: number | null;
  invoiceNumberNextSequence?: number | null;
  invoiceNumberLastValue?: string | null;
  documentFilenameFormat?: string | null;
  documentFooterPreference?: string | null;
  documentBrandHeaderColor?: string | null;
  documentBrandBackgroundColor?: string | null;
  documentBrandFontColor?: string | null;
  reminderStyle?: string | null;
  overdueAlertTiming?: string | null;
  followUpCadenceDays?: number | null;
  paymentNoticeTone?: string | null;
  urgentPaymentStampDefault?: boolean | null;
  backupReminderFrequency?: string | null;
  whatsappReminderTemplate?: string | null;
  emailReminderTemplate?: string | null;
  paymentThankYouTemplate?: string | null;
  bouncedPaymentTemplate?: string | null;
  defaultLanguage?: string | null;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri: string | null;
  documentWatermarkType?: 'none' | 'text' | 'logo' | 'image' | null;
  documentWatermarkText?: string | null;
  documentWatermarkImageUri?: string | null;
  documentWatermarkOpacity?: number | null;
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
  | 'payment_allocations'
  | 'payment_reversals';

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
