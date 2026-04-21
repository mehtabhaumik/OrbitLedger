import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { buildPerformanceReport, serializePerformanceReport } from './timing';
import type { PerformanceReport } from './timing';

export type SavedPerformanceReport = {
  fileName: string;
  uri: string;
  directoryUri: string;
  generatedAt: string;
  report: PerformanceReport;
};

const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const PERFORMANCE_DIRECTORY_NAME = 'performance';
const PERFORMANCE_MIME_TYPE = 'application/json';

export async function savePerformanceReport(): Promise<SavedPerformanceReport> {
  const report = buildPerformanceReport();
  const fileName = buildPerformanceReportFileName(report.generatedAt);

  try {
    const directory = getPerformanceDirectory();
    const file = new File(directory, fileName);
    if (file.exists) {
      file.delete();
    }

    file.write(serializePerformanceReport(report));

    return {
      fileName,
      uri: file.uri,
      directoryUri: directory.uri,
      generatedAt: report.generatedAt,
      report,
    };
  } catch {
    throw new Error('Performance report could not be saved locally.');
  }
}

export async function sharePerformanceReport(): Promise<SavedPerformanceReport> {
  const savedReport = await savePerformanceReport();
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return savedReport;
  }

  await Sharing.shareAsync(savedReport.uri, {
    mimeType: PERFORMANCE_MIME_TYPE,
    dialogTitle: savedReport.fileName,
  });

  return savedReport;
}

function getPerformanceDirectory(): Directory {
  const directory = new Directory(Paths.document, DOCUMENTS_DIRECTORY_NAME, PERFORMANCE_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function buildPerformanceReportFileName(generatedAt: string): string {
  const datePart = generatedAt
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 16);

  return `OrbitLedger_Performance_${datePart}.json`;
}

