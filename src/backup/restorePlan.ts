import { BackupValidationError } from './errors';
import type { BackupRecordCounts, OrbitLedgerBackup, RestoreBackupPlan } from './types';
import { parseOrbitLedgerBackupJson, validateOrbitLedgerBackup } from './validation';

export function prepareFullReplaceRestorePlan(source: string | OrbitLedgerBackup): RestoreBackupPlan {
  const backup = typeof source === 'string'
    ? parseOrbitLedgerBackupJson(source)
    : validateOrbitLedgerBackup(source);
  if (!backup.data.businessSettings) {
    throw new BackupValidationError('This backup is missing the business profile needed to restore.');
  }
  const recordCounts = backup.metadata.recordCounts ?? buildBackupRecordCounts(backup);

  return {
    mode: 'replace',
    backup,
    preparedAt: new Date().toISOString(),
    businessName: backup.metadata.businessName ?? backup.data.businessSettings?.businessName ?? null,
    recordCounts,
    customersToRestore: recordCounts.customers,
    transactionsToRestore: recordCounts.transactions,
    appSecurityToRestore: backup.data.appSecurity !== null,
  };
}

function buildBackupRecordCounts(backup: OrbitLedgerBackup): BackupRecordCounts {
  return {
    customers: backup.data.customers.length,
    transactions: backup.data.transactions.length,
    taxProfiles: backup.data.taxProfiles.length,
    taxPacks: backup.data.taxPacks.length,
    documentTemplates: backup.data.documentTemplates.length,
    complianceConfigs: backup.data.complianceConfigs.length,
    countryPackages: backup.data.countryPackages.length,
    countryPackageTemplates: backup.data.countryPackageTemplates.length,
    complianceReports: backup.data.complianceReports.length,
    products: backup.data.products.length,
    invoices: backup.data.invoices.length,
    invoiceItems: backup.data.invoiceItems.length,
    appPreferences: backup.data.appPreferences.length,
    documentHistory: backup.data.documentHistory.length,
  };
}
