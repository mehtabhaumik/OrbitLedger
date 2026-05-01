import type {
  AppSecurity,
  AppSecurityRow,
  BusinessSettings,
  BusinessSettingsRow,
  ComplianceConfig,
  ComplianceConfigRow,
  ComplianceReport,
  ComplianceReportRow,
  CountryPackage,
  CountryPackageRow,
  Customer,
  CustomerTimelineNote,
  CustomerTimelineNoteRow,
  CustomerRow,
  DocumentTemplate,
  DocumentTemplateRow,
  Invoice,
  InvoiceItem,
  InvoiceItemRow,
  InvoiceRow,
  InvoiceVersion,
  InvoiceVersionRow,
  LedgerTransaction,
  LedgerTransactionRow,
  PaymentReminder,
  PaymentReminderRow,
  PaymentPromise,
  PaymentPromiseRow,
  PaymentPromiseWithCustomer,
  PaymentPromiseWithCustomerRow,
  PaymentAllocation,
  PaymentAllocationRow,
  Product,
  ProductRow,
  RecentTransaction,
  RecentTransactionRow,
  TaxProfile,
  TaxProfileRow,
  TaxPack,
  TaxPackRow,
} from './types';

export function mapAppSecurity(row: AppSecurityRow): AppSecurity {
  return {
    id: row.id,
    pinEnabled: row.pin_enabled === 1,
    pinHash: row.pin_hash,
    updatedAt: row.updated_at,
  };
}

export function mapBusinessSettings(row: BusinessSettingsRow): BusinessSettings {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
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
    taxMode: row.tax_mode,
    taxProfileVersion: row.tax_profile_version,
    taxProfileSource: row.tax_profile_source,
    taxLastSyncedAt: row.tax_last_synced_at,
    taxSetupRequired: row.tax_setup_required === 1,
    storageMode: row.storage_mode,
    workspaceId: row.workspace_id,
    syncEnabled: row.sync_enabled === 1,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    openingBalance: row.opening_balance,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCustomerTimelineNote(row: CustomerTimelineNoteRow): CustomerTimelineNote {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    customerId: row.customer_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransaction(row: LedgerTransactionRow): LedgerTransaction {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    customerId: row.customer_id,
    type: row.type,
    amount: row.amount,
    note: row.note,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
  };
}

export function mapRecentTransaction(row: RecentTransactionRow): RecentTransaction {
  return {
    ...mapTransaction(row),
    customerName: row.customer_name,
  };
}

export function mapPaymentReminder(row: PaymentReminderRow): PaymentReminder {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    customerId: row.customer_id,
    tone: row.tone,
    message: row.message,
    balanceAtSend: row.balance_at_send,
    sharedVia: row.shared_via,
    createdAt: row.created_at,
  };
}

export function mapPaymentPromise(row: PaymentPromiseRow): PaymentPromise {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    customerId: row.customer_id,
    promisedAmount: row.promised_amount,
    promisedDate: row.promised_date,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPaymentPromiseWithCustomer(
  row: PaymentPromiseWithCustomerRow
): PaymentPromiseWithCustomer {
  return {
    ...mapPaymentPromise(row),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    currentBalance: row.current_balance,
  };
}

export function mapTaxProfile(row: TaxProfileRow): TaxProfile {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    countryCode: row.country_code,
    stateCode: row.state_code,
    taxType: row.tax_type,
    taxRulesJson: row.tax_rules_json,
    version: row.version,
    lastUpdated: row.last_updated,
    source: row.source,
  };
}

export function mapTaxPack(row: TaxPackRow): TaxPack {
  return {
    id: row.id,
    countryCode: row.country_code,
    regionCode: row.region_code,
    taxType: row.tax_type,
    rulesJson: row.rules_json,
    version: row.version,
    lastUpdated: row.last_updated,
    source: row.source,
    isActive: row.is_active === 1,
  };
}

export function mapDocumentTemplate(row: DocumentTemplateRow): DocumentTemplate {
  return {
    id: row.id,
    countryCode: row.country_code,
    templateType: row.template_type,
    templateConfigJson: row.template_config_json,
    version: row.version,
  };
}

export function mapComplianceConfig(row: ComplianceConfigRow): ComplianceConfig {
  return {
    id: row.id,
    countryCode: row.country_code,
    regionCode: row.region_code,
    configJson: row.config_json,
    version: row.version,
    lastUpdated: row.last_updated,
    source: row.source,
    isActive: row.is_active === 1,
  };
}

export function mapCountryPackage(row: CountryPackageRow): CountryPackage {
  return {
    id: row.id,
    countryCode: row.country_code,
    regionCode: row.region_code,
    packageName: row.package_name,
    version: row.version,
    taxPackId: row.tax_pack_id,
    complianceConfigId: row.compliance_config_id,
    installedAt: row.installed_at,
    source: row.source,
    isActive: row.is_active === 1,
  };
}

export function mapComplianceReport(row: ComplianceReportRow): ComplianceReport {
  return {
    id: row.id,
    countryCode: row.country_code,
    reportType: row.report_type,
    generatedAt: row.generated_at,
    reportDataJson: row.report_data_json,
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    name: row.name,
    price: row.price,
    stockQuantity: row.stock_quantity,
    unit: row.unit,
    createdAt: row.created_at,
  };
}

export function mapInvoice(row: InvoiceRow): Invoice {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    customerId: row.customer_id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    status: row.status,
    documentState: row.document_state,
    paymentStatus: row.payment_status,
    versionNumber: row.version_number,
    latestVersionId: row.latest_version_id,
    latestSnapshotHash: row.latest_snapshot_hash,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapPaymentAllocation(row: PaymentAllocationRow): PaymentAllocation {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    transactionId: row.transaction_id,
    invoiceId: row.invoice_id,
    customerId: row.customer_id,
    amount: row.amount,
    createdAt: row.created_at,
  };
}

export function mapInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    invoiceId: row.invoice_id,
    productId: row.product_id,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    price: row.price,
    taxRate: row.tax_rate,
    total: row.total,
  };
}

export function mapInvoiceVersion(row: InvoiceVersionRow): InvoiceVersion {
  return {
    ...mapSyncMetadata(row),
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    versionNumber: row.version_number,
    reason: row.reason,
    createdAt: row.created_at,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    documentState: row.document_state,
    paymentStatus: row.payment_status,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    notes: row.notes,
    snapshotHash: row.snapshot_hash,
    itemsJson: row.items_json,
  };
}

function mapSyncMetadata(row: {
  sync_id: string;
  last_modified: string;
  sync_status: 'pending' | 'synced' | 'conflict';
  server_revision?: number;
}) {
  return {
    syncId: row.sync_id,
    lastModified: row.last_modified,
    syncStatus: row.sync_status,
    serverRevision: row.server_revision ?? 0,
  };
}
