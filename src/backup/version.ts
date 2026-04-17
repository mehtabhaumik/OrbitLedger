import { BackupValidationError } from './errors';

export const CURRENT_BACKUP_FORMAT_VERSION = 2 as const;
export const SUPPORTED_BACKUP_FORMAT_VERSIONS = [CURRENT_BACKUP_FORMAT_VERSION] as const;

export type SupportedBackupFormatVersion = (typeof SUPPORTED_BACKUP_FORMAT_VERSIONS)[number];

export function getBackupFormatVersion(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const rawMetadata = metadata as {
    backup_format_version?: unknown;
    formatVersion?: unknown;
  };
  const version = rawMetadata.backup_format_version ?? rawMetadata.formatVersion;

  return typeof version === 'number' && Number.isInteger(version) ? version : null;
}

export function isSupportedBackupFormatVersion(
  version: unknown
): version is SupportedBackupFormatVersion {
  return SUPPORTED_BACKUP_FORMAT_VERSIONS.includes(version as SupportedBackupFormatVersion);
}

export function assertSupportedBackupFormatVersion(version: unknown): void {
  if (isSupportedBackupFormatVersion(version)) {
    return;
  }

  throw new BackupValidationError(
    'This backup was created with a version of Orbit Ledger that this app cannot restore yet.',
    `Unsupported backup_format_version: ${String(version)}; supported versions: ${SUPPORTED_BACKUP_FORMAT_VERSIONS.join(', ')}`
  );
}
