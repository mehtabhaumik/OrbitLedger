import type { BackupRecordCounts, OrbitLedgerBackup } from './types';
import { ORBIT_LEDGER_BACKUP_APP_NAME, ORBIT_LEDGER_BACKUP_FORMAT_VERSION } from './types';

export function buildBackupMetadata(
  businessName: string | null,
  exportedAt = new Date().toISOString(),
  recordCounts?: BackupRecordCounts
): OrbitLedgerBackup['metadata'] {
  const fileName = buildBackupFileName(businessName, exportedAt);

  return {
    appName: ORBIT_LEDGER_BACKUP_APP_NAME,
    backup_format_version: ORBIT_LEDGER_BACKUP_FORMAT_VERSION,
    exportedAt,
    fileName,
    businessName,
    recordCounts,
  };
}

export function buildBackupFileName(
  businessName: string | null,
  exportedAt = new Date().toISOString()
): string {
  const datePart = exportedAt
    .slice(0, 16)
    .replace('T', '_')
    .replace(/:/g, '-');
  const businessPart = fileNamePart(businessName ?? '', 'Business');

  return `OrbitLedger_Backup_${businessPart}_${datePart}.json`;
}

export function serializeOrbitLedgerBackup(backup: OrbitLedgerBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

function fileNamePart(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');

  return sanitized || fallback;
}
