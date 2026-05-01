import { BackupValidationError } from './errors';
import { measurePerformanceSync } from '../performance/timing';
import type { BackupRecordCounts, OrbitLedgerBackup, RestoreBackupPlan } from './types';
import { parseOrbitLedgerBackupJson, validateOrbitLedgerBackup } from './validation';

const MAX_SAFE_RESTORE_RECORDS = 50000;

export function prepareFullReplaceRestorePlan(source: string | OrbitLedgerBackup): RestoreBackupPlan {
  return measurePerformanceSync('restore_validation', 'Restore validation', () => {
    const backup = typeof source === 'string'
      ? parseOrbitLedgerBackupJson(source)
      : validateOrbitLedgerBackup(source);
    if (!backup.data.businessSettings) {
      throw new BackupValidationError('This backup is missing the business profile needed to restore.');
    }
    const recordCounts = backup.metadata.recordCounts ?? buildBackupRecordCounts(backup);
    const totalRecords = countRestoreRecords(recordCounts);
    if (totalRecords > MAX_SAFE_RESTORE_RECORDS) {
      throw new BackupValidationError(
        'This backup is too large to restore safely on this device. Please contact support before restoring it.'
      );
    }

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
  });
}

function countRestoreRecords(recordCounts: BackupRecordCounts): number {
  return Object.values(recordCounts).reduce((total, value) => total + value, 0);
}

function buildBackupRecordCounts(backup: OrbitLedgerBackup): BackupRecordCounts {
  return {
    customers: backup.data.customers.length,
    transactions: backup.data.transactions.length,
    paymentReminders: backup.data.paymentReminders.length,
    paymentPromises: backup.data.paymentPromises.length,
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
