import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  createAccountantIntegrationPayload,
  serializeAccountantPayloadAsCsv,
  serializeAccountantPayloadAsJson,
} from './service';
import type { AccountantExportFile, AccountantExportOptions } from './types';

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const ACCOUNTANT_EXPORTS_DIRECTORY_NAME = 'accountant-exports';

export async function createAndSaveAccountantExport(
  options: AccountantExportOptions
): Promise<AccountantExportFile> {
  const payload = await createAccountantIntegrationPayload();
  const exportedAt = payload.exportedAt;
  const fileName = buildAccountantExportFileName(
    payload.business?.businessName ?? null,
    exportedAt,
    options.format
  );
  const contents =
    options.format === 'json'
      ? serializeAccountantPayloadAsJson(payload)
      : serializeAccountantPayloadAsCsv(payload);
  const mimeType = options.format === 'json' ? 'application/json' : 'text/csv';

  try {
    const directory = getAccountantExportsDirectory();
    const file = new File(directory, fileName);
    if (file.exists) {
      file.delete();
    }

    file.write(contents);

    return {
      fileName,
      uri: file.uri,
      directoryUri: directory.uri,
      format: options.format,
      mimeType,
      exportedAt,
      payload,
    };
  } catch {
    throw new Error('Accountant export could not be saved locally.');
  }
}

export async function shareAccountantExport(
  options: AccountantExportOptions
): Promise<AccountantExportFile> {
  const exportFile = await createAndSaveAccountantExport(options);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(exportFile.uri);
  if (!file.exists) {
    throw new Error('Saved accountant export could not be found.');
  }

  await Sharing.shareAsync(exportFile.uri, {
    mimeType: exportFile.mimeType,
    dialogTitle: exportFile.fileName,
  });

  return exportFile;
}

export function buildAccountantExportFileName(
  businessName: string | null,
  exportedAt = new Date().toISOString(),
  format: AccountantExportOptions['format'] = 'json'
): string {
  const datePart = exportedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);
  const businessPart = fileNamePart(businessName ?? 'Business', 'Business');

  return `OrbitLedger_Accountant_${businessPart}_${datePart}.${format}`;
}

function getAccountantExportsDirectory(): Directory {
  const directory = new Directory(
    Paths.document,
    DOCUMENTS_DIRECTORY_NAME,
    ACCOUNTANT_EXPORTS_DIRECTORY_NAME
  );
  directory.create({ idempotent: true, intermediates: true });
  return directory;
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
