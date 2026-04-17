import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import type { StructuredDocument } from '../types';
import { buildPdfHtml } from './html';

export type GeneratedPdf = {
  uri: string;
  numberOfPages: number;
  fileName: string;
  isTemporary: boolean;
};

export type SavedPdf = GeneratedPdf & {
  fileName: string;
  savedUri: string;
  directoryUri: string;
  historyEntry: GeneratedDocumentHistoryEntry;
};

export type GeneratedDocumentHistoryEntry = {
  id: string;
  documentKind: StructuredDocument['kind'];
  customerName: string;
  statementDate: string;
  fileName: string;
  uri: string;
  numberOfPages: number;
  createdAt: string;
};

const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const DOCUMENTS_DIRECTORY_NAME = 'orbit-ledger';
const STATEMENTS_DIRECTORY_NAME = 'statements';
const TEMP_DIRECTORY_NAME = 'temp-pdf';
const HISTORY_FILE_NAME = 'document-history.json';
const TEMP_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DOCUMENT_HISTORY_LIMIT = 20;

export async function generatePdfFromStructuredDocument(
  document: StructuredDocument,
  fileName = buildStatementPdfFileName(document)
): Promise<GeneratedPdf> {
  try {
    cleanupTemporaryGeneratedPdfs();

    const html = await buildPdfHtml(document);
    const result = await Print.printToFileAsync({
      html,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      margins: {
        top: 28,
        right: 28,
        bottom: 28,
        left: 28,
      },
    });

    const printFile = new File(result.uri);
    const cachedFile = movePdfToTemporaryCache(printFile, uniqueTemporaryFileName(fileName));

    return {
      uri: cachedFile.uri,
      numberOfPages: result.numberOfPages,
      fileName: cachedFile.name,
      isTemporary: true,
    };
  } catch {
    throw new Error('PDF could not be generated.');
  }
}

export async function generateAndSavePdfFromStructuredDocument(
  document: StructuredDocument,
  fileName = buildStatementPdfFileName(document)
): Promise<SavedPdf> {
  const pdf = await generatePdfFromStructuredDocument(document, fileName);
  return saveGeneratedPdfToDevice(pdf, fileName, document);
}

export function buildStatementPdfFileName(document: StructuredDocument): string {
  if (document.kind === 'invoice') {
    return buildInvoicePdfFileName(document);
  }

  const customerName = fileNamePart(document.data.customerIdentity.name, 'Customer');
  if (document.data.kind !== 'customer_statement') {
    return `OrbitLedger_${customerName}_Document_${currentDatePart()}.pdf`;
  }

  const range = document.data.metadata.dateRange;
  const rangePart =
    range.from === range.to
      ? fileNamePart(range.from, currentDatePart())
      : `${fileNamePart(range.from, currentDatePart())}_to_${fileNamePart(
          range.to,
          currentDatePart()
        )}`;

  return `OrbitLedger_${customerName}_Statement_${rangePart}.pdf`;
}

export function buildInvoicePdfFileName(document: StructuredDocument): string {
  if (document.data.kind !== 'invoice') {
    return buildStatementPdfFileName(document);
  }

  const customerName = fileNamePart(document.data.customerIdentity.name, 'Customer');
  const invoiceNumber = fileNamePart(document.data.metadata.invoiceNumber, 'Invoice');
  return `OrbitLedger_${customerName}_Invoice_${invoiceNumber}.pdf`;
}

export function saveGeneratedPdfToDevice(
  pdf: GeneratedPdf,
  fileName: string,
  document?: StructuredDocument
): SavedPdf {
  try {
    const normalizedFileName = ensurePdfExtension(fileName);
    const statementsDirectory = getStatementsDirectory();
    const sourceFile = new File(pdf.uri);
    if (!sourceFile.exists) {
      throw new Error('Generated PDF file is missing.');
    }

    const savedFile = new File(statementsDirectory, normalizedFileName);
    if (savedFile.exists) {
      savedFile.delete();
    }

    sourceFile.copy(savedFile);
    deleteTemporaryFileIfNeeded(sourceFile);

    const historyEntry = createHistoryEntry(savedFile, normalizedFileName, pdf.numberOfPages, document);
    recordGeneratedDocument(historyEntry);

    return {
      ...pdf,
      uri: savedFile.uri,
      fileName: normalizedFileName,
      savedUri: savedFile.uri,
      directoryUri: statementsDirectory.uri,
      historyEntry,
      isTemporary: false,
    };
  } catch {
    throw new Error('PDF could not be saved locally.');
  }
}

export function cleanupTemporaryGeneratedPdfs(maxAgeMs = TEMP_FILE_MAX_AGE_MS): number {
  try {
    const temporaryDirectory = getTemporaryPdfDirectory();
    const cutoff = Date.now() - maxAgeMs;
    let removedCount = 0;

    for (const item of temporaryDirectory.list()) {
      if (!(item instanceof File) || !item.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      const info = item.info();
      const modifiedAt = info.modificationTime ?? info.creationTime ?? 0;
      if (modifiedAt > 0 && modifiedAt < cutoff) {
        item.delete();
        removedCount += 1;
      }
    }

    return removedCount;
  } catch {
    return 0;
  }
}

export function getGeneratedDocumentHistory(): GeneratedDocumentHistoryEntry[] {
  try {
    const historyFile = getDocumentHistoryFile();
    if (!historyFile.exists) {
      return [];
    }

    const parsed = JSON.parse(historyFile.textSync());
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isGeneratedDocumentHistoryEntry);
  } catch {
    return [];
  }
}

export function replaceGeneratedDocumentHistory(
  entries: GeneratedDocumentHistoryEntry[]
): void {
  try {
    const historyFile = getDocumentHistoryFile();
    const nextHistory = entries
      .filter(isGeneratedDocumentHistoryEntry)
      .slice(0, DOCUMENT_HISTORY_LIMIT);
    historyFile.write(JSON.stringify(nextHistory, null, 2));
  } catch {
    throw new Error('Generated document history could not be restored.');
  }
}

export async function openPrintPreview(document: StructuredDocument): Promise<void> {
  const html = await buildPdfHtml(document);
  await Print.printAsync({
    html,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    margins: {
      top: 28,
      right: 28,
      bottom: 28,
      left: 28,
    },
  });
}

export async function openGeneratedPdf(pdf: GeneratedPdf): Promise<void> {
  try {
    await Linking.openURL(pdf.uri);
  } catch {
    throw new Error('PDF could not be opened on this device.');
  }
}

export async function printGeneratedPdf(pdf: GeneratedPdf): Promise<void> {
  await Print.printAsync({
    uri: pdf.uri,
    margins: {
      top: 28,
      right: 28,
      bottom: 28,
      left: 28,
    },
  });
}

export async function shareGeneratedPdf(pdf: GeneratedPdf, title: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });
}

function ensurePdfExtension(fileName: string): string {
  const normalizedName = fileNamePart(fileName.replace(/\.pdf$/i, ''), 'Statement');
  return `${normalizedName}.pdf`;
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

function currentDatePart(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDocumentRootDirectory(): Directory {
  const directory = new Directory(Paths.document, DOCUMENTS_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function getStatementsDirectory(): Directory {
  const directory = new Directory(getDocumentRootDirectory(), STATEMENTS_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function getTemporaryPdfDirectory(): Directory {
  const directory = new Directory(Paths.cache, DOCUMENTS_DIRECTORY_NAME, TEMP_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function getDocumentHistoryFile(): File {
  return new File(getDocumentRootDirectory(), HISTORY_FILE_NAME);
}

function movePdfToTemporaryCache(sourceFile: File, fileName: string): File {
  if (!sourceFile.exists) {
    throw new Error('Print output was not created.');
  }

  const temporaryFile = new File(getTemporaryPdfDirectory(), ensurePdfExtension(fileName));
  if (temporaryFile.exists) {
    temporaryFile.delete();
  }

  sourceFile.copy(temporaryFile);
  if (sourceFile.uri !== temporaryFile.uri) {
    try {
      sourceFile.delete();
    } catch {
      // The PDF has already been copied into Orbit Ledger's temp cache.
    }
  }
  return temporaryFile;
}

function deleteTemporaryFileIfNeeded(file: File): void {
  try {
    if (file.uri.includes(`/${DOCUMENTS_DIRECTORY_NAME}/${TEMP_DIRECTORY_NAME}/`) && file.exists) {
      file.delete();
    }
  } catch {
    // Temporary cleanup should not make a completed save fail.
  }
}

function uniqueTemporaryFileName(fileName: string): string {
  const baseName = fileNamePart(fileName.replace(/\.pdf$/i, ''), 'Statement');
  return `${baseName}_${Date.now()}.pdf`;
}

function createHistoryEntry(
  savedFile: File,
  fileName: string,
  numberOfPages: number,
  document?: StructuredDocument
): GeneratedDocumentHistoryEntry {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    documentKind: document?.kind ?? 'customer_statement',
    customerName: document?.data.customerIdentity.name ?? 'Customer',
    statementDate: document
      ? document.data.kind === 'customer_statement'
        ? document.data.metadata.statementDate
        : document.data.metadata.issueDate
      : currentDatePart(),
    fileName,
    uri: savedFile.uri,
    numberOfPages,
    createdAt: now,
  };
}

function recordGeneratedDocument(entry: GeneratedDocumentHistoryEntry): void {
  try {
    const historyFile = getDocumentHistoryFile();
    const history = getGeneratedDocumentHistory();
    const nextHistory = [
      entry,
      ...history.filter((item) => item.uri !== entry.uri),
    ].slice(0, DOCUMENT_HISTORY_LIMIT);
    historyFile.write(JSON.stringify(nextHistory, null, 2));
  } catch {
    // History is useful but should not block the completed export.
  }
}

function isGeneratedDocumentHistoryEntry(value: unknown): value is GeneratedDocumentHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<GeneratedDocumentHistoryEntry>;
  return (
    (entry.documentKind === 'customer_statement' || entry.documentKind === 'invoice') &&
    typeof entry.id === 'string' &&
    typeof entry.customerName === 'string' &&
    typeof entry.statementDate === 'string' &&
    typeof entry.fileName === 'string' &&
    typeof entry.uri === 'string' &&
    typeof entry.numberOfPages === 'number' &&
    typeof entry.createdAt === 'string'
  );
}
