import type {
  AppSecurity,
  BusinessSettings,
  ComplianceConfig,
  ComplianceReport,
  CountryPackage,
  CountryPackageTemplate,
  Customer,
  DocumentTemplate,
  Invoice,
  InvoiceItem,
  LedgerTransaction,
  PaymentReminder,
  PaymentPromise,
  Product,
  TaxPack,
  TaxProfile,
} from '../database';
import type { GeneratedDocumentHistoryEntry } from '../documents';
import { CURRENT_BACKUP_FORMAT_VERSION } from './version';

export const ORBIT_LEDGER_BACKUP_APP_NAME = 'Orbit Ledger by Rudraix';
export const ORBIT_LEDGER_BACKUP_FORMAT_VERSION = CURRENT_BACKUP_FORMAT_VERSION;

export type OrbitLedgerBackupMetadata = {
  appName: typeof ORBIT_LEDGER_BACKUP_APP_NAME;
  backup_format_version: typeof ORBIT_LEDGER_BACKUP_FORMAT_VERSION;
  formatVersion?: typeof ORBIT_LEDGER_BACKUP_FORMAT_VERSION;
  exportedAt: string;
  fileName: string;
  businessName?: string | null;
  recordCounts?: BackupRecordCounts;
};

export type BackupRecordCounts = {
  customers: number;
  transactions: number;
  paymentReminders: number;
  paymentPromises: number;
  taxProfiles: number;
  taxPacks: number;
  documentTemplates: number;
  complianceConfigs: number;
  countryPackages: number;
  countryPackageTemplates: number;
  complianceReports: number;
  products: number;
  invoices: number;
  invoiceItems: number;
  appPreferences: number;
  documentHistory: number;
};

export type BackupAppPreference = {
  key: string;
  value: string;
  updatedAt: string;
};

export type OrbitLedgerBackupData = {
  businessSettings: BusinessSettings | null;
  customers: Customer[];
  transactions: LedgerTransaction[];
  paymentReminders: PaymentReminder[];
  paymentPromises: PaymentPromise[];
  taxProfiles: TaxProfile[];
  taxPacks: TaxPack[];
  documentTemplates: DocumentTemplate[];
  complianceConfigs: ComplianceConfig[];
  countryPackages: CountryPackage[];
  countryPackageTemplates: CountryPackageTemplate[];
  complianceReports: ComplianceReport[];
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  appPreferences: BackupAppPreference[];
  documentHistory: GeneratedDocumentHistoryEntry[];
  appSecurity: AppSecurity | null;
  extensions?: Record<string, unknown>;
};

export type OrbitLedgerBackup = {
  metadata: OrbitLedgerBackupMetadata;
  data: OrbitLedgerBackupData;
};

export type CreateBackupResult = {
  backup: OrbitLedgerBackup;
  json: string;
  fileName: string;
};

export type RestoreBackupMode = 'replace';

export type RestoreBackupPlan = {
  mode: RestoreBackupMode;
  backup: OrbitLedgerBackup;
  preparedAt: string;
  businessName: string | null;
  recordCounts: BackupRecordCounts;
  customersToRestore: number;
  transactionsToRestore: number;
  appSecurityToRestore: boolean;
};

export type RestoreBackupSummary = {
  mode: RestoreBackupMode;
  restoredAt: string;
  businessSettingsRestored: boolean;
  recordCounts: BackupRecordCounts;
  customersRestored: number;
  transactionsRestored: number;
  invoicesRestored: number;
  productsRestored: number;
  taxPacksRestored: number;
  countryPackagesRestored: number;
  appPreferencesRestored: number;
  appSecurityRestored: boolean;
};

export type BackupRestorePreview = {
  fileName: string;
  fileUri: string;
  fileSize: number | null;
  appName: string;
  backupFormatVersion: number;
  exportedAt: string;
  businessName: string | null;
  customers: number;
  transactions: number;
  paymentReminders: number;
  paymentPromises: number;
  taxProfiles: number;
  taxPacks: number;
  documentTemplates: number;
  complianceConfigs: number;
  countryPackages: number;
  countryPackageTemplates: number;
  complianceReports: number;
  products: number;
  invoices: number;
  invoiceItems: number;
  appPreferences: number;
  documentHistory: number;
  includesSecurity: boolean;
};

export type SelectedBackupForRestore = {
  backup: OrbitLedgerBackup;
  preview: BackupRestorePreview;
};
