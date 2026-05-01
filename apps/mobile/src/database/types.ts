import type {
  OrbitBusinessStorageMode,
  OrbitSyncMetadata,
  OrbitSyncStatus,
  OrbitWorkspaceLink,
} from '@orbit-ledger/contracts';
import type { PaymentAllocationStrategy } from '@orbit-ledger/core';

export type TaxMode = 'not_configured' | 'manual' | 'exempt';

export type TaxProfileSource = 'none' | 'local' | 'remote';

export type StoredTaxProfileSource = 'manual' | 'remote' | 'seed';

export type TaxPackSource = 'remote' | 'manual';

export type CountryPackageSource = 'remote' | 'manual';

export type DocumentTemplateType = 'invoice' | 'statement';

export type ComplianceReportType = 'tax_summary' | 'sales_summary' | 'dues_summary';

export type TransactionType = 'credit' | 'payment';

export type PaymentReminderTone = 'polite' | 'firm' | 'final';

export type PaymentPromiseStatus = 'open' | 'fulfilled' | 'missed' | 'cancelled';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceDocumentState = 'draft' | 'created' | 'revised' | 'cancelled';
export type InvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

export type CustomerTimelineNoteKind = 'note' | 'dispute';

export type SyncStatus = OrbitSyncStatus;

export type SyncMetadata = OrbitSyncMetadata;

export type AppFeatureToggles = {
  invoices: boolean;
  inventory: boolean;
  tax: boolean;
};

export type BusinessSettings = SyncMetadata &
  OrbitWorkspaceLink & {
  id: string;
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
  taxMode: TaxMode;
  taxProfileVersion: string | null;
  taxProfileSource: TaxProfileSource;
  taxLastSyncedAt: string | null;
  taxSetupRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaveBusinessSettingsInput = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri?: string | null;
  authorizedPersonName: string;
  authorizedPersonTitle: string;
  signatureUri?: string | null;
  taxMode?: TaxMode;
  taxProfileVersion?: string | null;
  taxProfileSource?: TaxProfileSource;
  taxLastSyncedAt?: string | null;
  taxSetupRequired?: boolean;
  storageMode?: OrbitBusinessStorageMode;
  workspaceId?: string | null;
  syncEnabled?: boolean;
  lastSyncedAt?: string | null;
  serverRevision?: number;
};

export type Customer = SyncMetadata & {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DueAgingBucket = 'none' | 'less_than_7' | 'seven_to_thirty' | 'thirty_plus';

export type CustomerBehaviorKind =
  | 'new_customer'
  | 'settled'
  | 'pays_on_time'
  | 'delayed_payments'
  | 'no_recent_payment'
  | 'high_outstanding_balance'
  | 'advance_balance';

export type CustomerInsightTone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral' | 'tax';

export type CustomerPaymentInsight = {
  dueAgingBucket: DueAgingBucket;
  dueAgingLabel: string;
  dueAgingHelper: string;
  oldestDueAt: string | null;
  daysOutstanding: number | null;
  behaviorKind: CustomerBehaviorKind;
  behaviorLabel: string;
  behaviorHelper: string;
  behaviorTone: CustomerInsightTone;
  lastPaymentAt: string | null;
  paymentCount: number;
  totalCredit: number;
  totalPayment: number;
};

export type CustomerSummary = Customer & {
  balance: number;
  latestActivityAt: string;
  insight: CustomerPaymentInsight;
};

export type CustomerSummaryFilter = 'all' | 'outstanding' | 'recent_activity' | 'archived';

export type SearchCustomerSummariesOptions = {
  query?: string;
  limit?: number;
  filter?: CustomerSummaryFilter;
  recentSince?: string;
};

export type AddCustomerInput = {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  openingBalance?: number;
};

export type UpdateCustomerInput = Partial<AddCustomerInput>;

export type LedgerTransaction = SyncMetadata & {
  id: string;
  customerId: string;
  type: TransactionType;
  amount: number;
  note: string | null;
  effectiveDate: string;
  createdAt: string;
};

export type AddTransactionInput = {
  customerId: string;
  type: TransactionType;
  amount: number;
  note?: string | null;
  effectiveDate?: string;
  allocationStrategy?: PaymentAllocationStrategy;
  invoiceId?: string | null;
};

export type UpdateTransactionInput = {
  type?: TransactionType;
  amount?: number;
  note?: string | null;
  effectiveDate?: string;
};

export type CustomerLedger = {
  customer: Customer;
  openingBalance: number;
  transactions: LedgerTransaction[];
  balance: number;
};

export type CustomerTimelineNote = SyncMetadata & {
  id: string;
  customerId: string;
  kind: CustomerTimelineNoteKind;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type AddCustomerTimelineNoteInput = {
  customerId: string;
  kind: CustomerTimelineNoteKind;
  body: string;
};

export type PaymentReminder = SyncMetadata & {
  id: string;
  customerId: string;
  tone: PaymentReminderTone;
  message: string;
  balanceAtSend: number;
  sharedVia: string;
  createdAt: string;
};

export type AddPaymentReminderInput = {
  customerId: string;
  tone: PaymentReminderTone;
  message: string;
  balanceAtSend: number;
  sharedVia?: string;
};

export type PaymentPromise = SyncMetadata & {
  id: string;
  customerId: string;
  promisedAmount: number;
  promisedDate: string;
  note: string | null;
  status: PaymentPromiseStatus;
  createdAt: string;
  updatedAt: string;
};

export type AddPaymentPromiseInput = {
  customerId: string;
  promisedAmount: number;
  promisedDate: string;
  note?: string | null;
};

export type UpdatePaymentPromiseInput = Partial<AddPaymentPromiseInput> & {
  status?: PaymentPromiseStatus;
};

export type PaymentPromiseWithCustomer = PaymentPromise & {
  customerName: string;
  customerPhone: string | null;
  currentBalance: number;
};

export type CollectionCustomer = TopDueCustomer & {
  oldestCreditAt: string | null;
};

export type DashboardSummary = {
  totalReceivable: number;
  customersWithOutstandingBalance: number;
  todayEntries: number;
  recentPaymentsReceived: number;
  followUpCustomerCount: number;
  recentActivityCount: number;
  previousActivityCount: number;
};

export type TopDueCustomer = Pick<CustomerSummary, 'id' | 'name' | 'balance' | 'latestActivityAt'> & {
  phone?: string | null;
  lastPaymentAt: string | null;
  lastReminderAt: string | null;
  insight: CustomerPaymentInsight;
};

export type RecentTransaction = LedgerTransaction & {
  customerName: string;
};

export type ReportTrend = {
  current: number;
  previous: number;
  change: number;
};

export type TopReportCustomer = {
  id: string;
  name: string;
  totalSales: number;
  totalCredit: number;
  balance: number;
  latestActivityAt: string;
};

export type ReportsSummary = {
  totalSales: number;
  totalCredit: number;
  invoiceCount: number;
  creditEntryCount: number;
  salesTrend: ReportTrend;
  creditTrend: ReportTrend;
  topCustomers: TopReportCustomer[];
};

export type Invoice = SyncMetadata & {
  id: string;
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  versionNumber: number;
  latestVersionId: string | null;
  latestSnapshotHash: string | null;
  notes: string | null;
  createdAt: string;
};

export type InvoiceItem = SyncMetadata & {
  id: string;
  invoiceId: string;
  productId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  total: number;
};

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
};

export type PaymentAllocation = SyncMetadata & {
  id: string;
  transactionId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  createdAt: string;
};

export type AddInvoiceItemInput = {
  productId?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  price: number;
  taxRate?: number;
};

export type AddInvoiceInput = {
  customerId?: string | null;
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string | null;
  status?: InvoiceStatus;
  documentState?: InvoiceDocumentState;
  paymentStatus?: InvoicePaymentStatus;
  revisionReason?: string | null;
  notes?: string | null;
  items: AddInvoiceItemInput[];
};

export type UpdateInvoiceInput = {
  customerId?: string | null;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string | null;
  status?: InvoiceStatus;
  documentState?: InvoiceDocumentState;
  paymentStatus?: InvoicePaymentStatus;
  revisionReason?: string | null;
  notes?: string | null;
  items: AddInvoiceItemInput[];
};

export type InvoiceListOptions = {
  customerId?: string | null;
  status?: InvoiceStatus;
  documentState?: InvoiceDocumentState;
  paymentStatus?: InvoicePaymentStatus;
  limit?: number;
};

export type InvoiceVersion = SyncMetadata & {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  versionNumber: number;
  reason: string;
  createdAt: string;
  customerId: string | null;
  issueDate: string;
  dueDate: string | null;
  documentState: Exclude<InvoiceDocumentState, 'draft'>;
  paymentStatus: InvoicePaymentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  snapshotHash: string;
  itemsJson: string;
};

export type TaxProfile = SyncMetadata & {
  id: string;
  countryCode: string;
  stateCode: string;
  taxType: string;
  taxRulesJson: string;
  version: string;
  lastUpdated: string;
  source: StoredTaxProfileSource;
};

export type SaveTaxProfileInput = {
  countryCode: string;
  stateCode?: string | null;
  taxType: string;
  taxRulesJson: string | Record<string, unknown>;
  version: string;
  lastUpdated?: string;
  source?: StoredTaxProfileSource;
};

export type TaxProfileLookup = {
  countryCode: string;
  stateCode?: string | null;
  taxType: string;
};

export type TaxPack = {
  id: string;
  countryCode: string;
  regionCode: string;
  taxType: string;
  rulesJson: string;
  version: string;
  lastUpdated: string;
  source: TaxPackSource;
  isActive: boolean;
};

export type SaveTaxPackInput = {
  countryCode: string;
  regionCode?: string | null;
  taxType: string;
  rulesJson: string | Record<string, unknown>;
  version: string;
  lastUpdated?: string;
  source?: TaxPackSource;
  isActive?: boolean;
};

export type TaxPackLookup = {
  countryCode: string;
  regionCode?: string | null;
  taxType: string;
};

export type DocumentTemplate = {
  id: string;
  countryCode: string;
  templateType: DocumentTemplateType;
  templateConfigJson: string;
  version: string;
};

export type SaveDocumentTemplateInput = {
  countryCode: string;
  templateType: DocumentTemplateType;
  templateConfigJson: string | Record<string, unknown>;
  version: string;
};

export type DocumentTemplateLookup = {
  countryCode: string;
  regionCode?: string | null;
  templateType: DocumentTemplateType;
  version?: string;
};

export type ComplianceConfig = {
  id: string;
  countryCode: string;
  regionCode: string;
  configJson: string;
  version: string;
  lastUpdated: string;
  source: CountryPackageSource;
  isActive: boolean;
};

export type SaveComplianceConfigInput = {
  countryCode: string;
  regionCode?: string | null;
  configJson: string | Record<string, unknown>;
  version: string;
  lastUpdated?: string;
  source?: CountryPackageSource;
  isActive?: boolean;
};

export type ComplianceConfigLookup = {
  countryCode: string;
  regionCode?: string | null;
  version?: string;
};

export type CountryPackage = {
  id: string;
  countryCode: string;
  regionCode: string;
  packageName: string;
  version: string;
  taxPackId: string;
  complianceConfigId: string;
  installedAt: string;
  source: CountryPackageSource;
  isActive: boolean;
};

export type CountryPackageTemplate = {
  countryPackageId: string;
  documentTemplateId: string;
  templateType: DocumentTemplateType;
};

export type CountryPackageWithComponents = CountryPackage & {
  taxPack: TaxPack;
  templates: DocumentTemplate[];
  complianceConfig: ComplianceConfig;
};

export type CountryPackageLookup = {
  countryCode: string;
  regionCode?: string | null;
  version?: string;
};

export type InstallCountryPackageInput = {
  countryCode: string;
  regionCode?: string | null;
  packageName: string;
  version: string;
  source?: CountryPackageSource;
  taxPack: SaveTaxPackInput;
  templates: SaveDocumentTemplateInput[];
  complianceConfig: SaveComplianceConfigInput;
};

export type ComplianceReport = {
  id: string;
  countryCode: string;
  reportType: ComplianceReportType;
  generatedAt: string;
  reportDataJson: string;
};

export type SaveComplianceReportInput = {
  countryCode: string;
  reportType: ComplianceReportType;
  generatedAt?: string;
  reportDataJson: string | Record<string, unknown>;
};

export type ListComplianceReportsOptions = {
  countryCode?: string;
  reportType?: ComplianceReportType;
  limit?: number;
};

export type Product = SyncMetadata & {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  unit: string;
  createdAt: string;
};

export type AddProductInput = {
  name: string;
  price: number;
  stockQuantity?: number;
  unit: string;
};

export type UpdateProductInput = Partial<AddProductInput>;

export type ProductListOptions = {
  query?: string;
  limit?: number;
};

export type AppSecurity = {
  id: string;
  pinEnabled: boolean;
  pinHash: string | null;
  updatedAt: string;
};

export type AppSecurityRow = {
  id: string;
  pin_enabled: number;
  pin_hash: string | null;
  updated_at: string;
};

export type AppPreferenceRow = {
  key: string;
  value: string;
  updated_at: string;
};

export type TaxProfileRow = {
  id: string;
  country_code: string;
  state_code: string;
  tax_type: string;
  tax_rules_json: string;
  version: string;
  last_updated: string;
  source: StoredTaxProfileSource;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
};

export type TaxPackRow = {
  id: string;
  country_code: string;
  region_code: string;
  tax_type: string;
  rules_json: string;
  version: string;
  last_updated: string;
  source: TaxPackSource;
  is_active: number;
};

export type DocumentTemplateRow = {
  id: string;
  country_code: string;
  template_type: DocumentTemplateType;
  template_config_json: string;
  version: string;
};

export type ComplianceConfigRow = {
  id: string;
  country_code: string;
  region_code: string;
  config_json: string;
  version: string;
  last_updated: string;
  source: CountryPackageSource;
  is_active: number;
};

export type CountryPackageRow = {
  id: string;
  country_code: string;
  region_code: string;
  package_name: string;
  version: string;
  tax_pack_id: string;
  compliance_config_id: string;
  installed_at: string;
  source: CountryPackageSource;
  is_active: number;
};

export type CountryPackageTemplateRow = {
  country_package_id: string;
  document_template_id: string;
  template_type: DocumentTemplateType;
};

export type ComplianceReportRow = {
  id: string;
  country_code: string;
  report_type: ComplianceReportType;
  generated_at: string;
  report_data_json: string;
};

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  unit: string;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
};

export type BusinessSettingsRow = {
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
  tax_mode: TaxMode;
  tax_profile_version: string | null;
  tax_profile_source: TaxProfileSource;
  tax_last_synced_at: string | null;
  tax_setup_required: number;
  storage_mode: OrbitBusinessStorageMode;
  workspace_id: string | null;
  sync_enabled: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision: number;
};

export type CustomerRow = {
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
  sync_status: SyncStatus;
  server_revision?: number;
};

export type LedgerTransactionRow = {
  id: string;
  customer_id: string;
  type: TransactionType;
  amount: number;
  note: string | null;
  effective_date: string;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type RecentTransactionRow = LedgerTransactionRow & {
  customer_name: string;
};

export type PaymentReminderRow = {
  id: string;
  customer_id: string;
  tone: PaymentReminderTone;
  message: string;
  balance_at_send: number;
  shared_via: string;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type CustomerTimelineNoteRow = {
  id: string;
  customer_id: string;
  kind: CustomerTimelineNoteKind;
  body: string;
  created_at: string;
  updated_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type PaymentPromiseRow = {
  id: string;
  customer_id: string;
  promised_amount: number;
  promised_date: string;
  note: string | null;
  status: PaymentPromiseStatus;
  created_at: string;
  updated_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type PaymentPromiseWithCustomerRow = PaymentPromiseRow & {
  customer_name: string;
  customer_phone: string | null;
  current_balance: number;
};

export type InvoiceRow = {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  document_state: InvoiceDocumentState;
  payment_status: InvoicePaymentStatus;
  version_number: number;
  latest_version_id: string | null;
  latest_snapshot_hash: string | null;
  notes: string | null;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type PaymentAllocationRow = {
  id: string;
  transaction_id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  created_at: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type InvoiceVersionRow = {
  id: string;
  invoice_id: string;
  invoice_number: string;
  version_number: number;
  reason: string;
  created_at: string;
  customer_id: string | null;
  issue_date: string;
  due_date: string | null;
  document_state: Exclude<InvoiceDocumentState, 'draft'>;
  payment_status: InvoicePaymentStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  snapshot_hash: string;
  items_json: string;
  sync_id: string;
  last_modified: string;
  sync_status: SyncStatus;
  server_revision?: number;
};

export type InvoiceItemRow = {
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
  sync_status: SyncStatus;
  server_revision?: number;
};
