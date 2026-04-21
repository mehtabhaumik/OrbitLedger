import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { BackupFileReadError, BackupValidationError } from './errors';
import { measurePerformance } from '../performance';
import { prepareFullReplaceRestorePlan } from './restorePlan';
import { createOrbitLedgerBackup } from './service';
import type { CreateBackupResult, SelectedBackupForRestore } from './types';
import { parseOrbitLedgerBackupJson } from './validation';

export type SavedBackupFile = CreateBackupResult & {
  uri: string;
  directoryUri: string;
  size: number | null;
  savedAt: string;
};

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const BACKUPS_DIRECTORY_NAME = 'backups';
const BACKUP_MIME_TYPE = 'application/json';

export async function createAndSaveOrbitLedgerBackup(): Promise<SavedBackupFile> {
  return measurePerformance('backup_export', 'Backup export', async () => {
    const backupResult = await createOrbitLedgerBackup();

    try {
      const backupsDirectory = getBackupsDirectory();
      const backupFile = new File(backupsDirectory, backupResult.fileName);
      if (backupFile.exists) {
        backupFile.delete();
      }

      backupFile.write(backupResult.json);
      const info = backupFile.info();

      return {
        ...backupResult,
        uri: backupFile.uri,
        directoryUri: backupsDirectory.uri,
        size: info.size ?? null,
        savedAt: new Date().toISOString(),
      };
    } catch {
      throw new Error('Backup file could not be saved locally.');
    }
  });
}

export async function shareOrbitLedgerBackupFile(backupFile: SavedBackupFile): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(backupFile.uri);
  if (!file.exists) {
    throw new Error('Saved backup file could not be found.');
  }

  await Sharing.shareAsync(backupFile.uri, {
    mimeType: BACKUP_MIME_TYPE,
    dialogTitle: backupFile.fileName,
  });
}

export async function pickAndValidateOrbitLedgerBackupFile(): Promise<SelectedBackupForRestore | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    throw new BackupValidationError('No backup file was selected.');
  }

  let rawBackupJson: string;

  try {
    const file = new File(asset.uri);
    rawBackupJson = await file.text();
  } catch (error) {
    throw new BackupFileReadError(
      'Orbit Ledger could not open this backup file. Please choose the file again.',
      error instanceof Error ? error.message : String(error)
    );
  }

  const backup = parseOrbitLedgerBackupJson(rawBackupJson);
  const plan = prepareFullReplaceRestorePlan(backup);

  return {
    backup: plan.backup,
    preview: {
      fileName: asset.name || backup.metadata.fileName,
      fileUri: asset.uri,
      fileSize: asset.size ?? null,
      appName: backup.metadata.appName,
      backupFormatVersion: backup.metadata.backup_format_version,
      exportedAt: backup.metadata.exportedAt,
      businessName: plan.businessName,
      customers: plan.recordCounts.customers,
      transactions: plan.recordCounts.transactions,
      paymentReminders: plan.recordCounts.paymentReminders,
      paymentPromises: plan.recordCounts.paymentPromises,
      taxProfiles: plan.recordCounts.taxProfiles,
      taxPacks: plan.recordCounts.taxPacks,
      documentTemplates: plan.recordCounts.documentTemplates,
      complianceConfigs: plan.recordCounts.complianceConfigs,
      countryPackages: plan.recordCounts.countryPackages,
      countryPackageTemplates: plan.recordCounts.countryPackageTemplates,
      complianceReports: plan.recordCounts.complianceReports,
      products: plan.recordCounts.products,
      invoices: plan.recordCounts.invoices,
      invoiceItems: plan.recordCounts.invoiceItems,
      appPreferences: plan.recordCounts.appPreferences,
      documentHistory: plan.recordCounts.documentHistory,
      includesSecurity: plan.appSecurityToRestore,
    },
  };
}

function getBackupsDirectory(): Directory {
  const directory = new Directory(Paths.document, DOCUMENTS_DIRECTORY_NAME, BACKUPS_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}
