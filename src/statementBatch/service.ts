import {
  getBusinessSettings,
  getCustomerLedger,
  searchCustomerSummaries,
} from '../database';
import type { BusinessSettings, CustomerLedger, CustomerSummary } from '../database';
import {
  buildCustomerStatementDocument,
  buildStatementPdfFileName,
  generateAndSavePdfFromStructuredDocument,
  getBuiltInDocumentTemplate,
  getPreferredDocumentTemplateKey,
  loadDocumentTemplateForBusiness,
} from '../documents';
import type { DocumentDateRange } from '../documents';
import {
  getActiveProBrandTheme,
  getSubscriptionStatus,
  resolveDocumentFeatureGates,
} from '../monetization';
import type {
  StatementBatchCandidate,
  StatementBatchGenerationResult,
  StatementBatchGenerationSummary,
  StatementBatchOptions,
  StatementBatchPreview,
} from './types';

type StatementBatchSource = {
  businessProfile: BusinessSettings;
  documentTemplate: Awaited<ReturnType<typeof loadDocumentTemplateForBusiness>>;
  selectedTemplateKey: Awaited<ReturnType<typeof getPreferredDocumentTemplateKey>>;
  documentGates: ReturnType<typeof resolveDocumentFeatureGates>;
  proBrandTheme: Awaited<ReturnType<typeof getActiveProBrandTheme>>;
};

export async function buildStatementBatchPreview(
  options: StatementBatchOptions
): Promise<StatementBatchPreview> {
  validateBatchOptions(options);
  const customerSummaries = await loadCandidateSummaries(options);
  const candidates: StatementBatchCandidate[] = [];

  for (const customer of customerSummaries) {
    const ledger = await getCustomerLedger(customer.id);
    const transactionCountInRange = ledger.transactions.filter((transaction) =>
      isDateInRange(transaction.effectiveDate, options.dateRange)
    ).length;
    const includedReceivable = Math.max(ledger.balance, 0);
    const hasActivity = transactionCountInRange > 0;
    const hasOutstanding = ledger.balance > 0;
    const threshold = options.balanceThreshold ?? 0;

    let status: StatementBatchCandidate['status'] = 'ready';
    let skipReason: string | undefined;

    if (options.selectionMode === 'activity_in_range' && !hasActivity) {
      status = 'skipped';
      skipReason = 'No activity in selected range.';
    }

    if (options.selectionMode === 'all_outstanding' && !hasOutstanding) {
      status = 'skipped';
      skipReason = 'No outstanding balance.';
    }

    if (options.selectionMode === 'balance_above_threshold' && ledger.balance < threshold) {
      status = 'skipped';
      skipReason = `Balance is below ${threshold}.`;
    }

    if (!hasActivity && !hasOutstanding) {
      status = 'skipped';
      skipReason = 'No activity or balance to include.';
    }

    candidates.push({
      customer,
      transactionCountInRange,
      balance: ledger.balance,
      includedReceivable,
      reason: buildCandidateReason(options, ledger, transactionCountInRange),
      status,
      skipReason,
    });
  }

  const readyCandidates = candidates.filter((candidate) => candidate.status === 'ready');

  return {
    options,
    candidates,
    readyCount: readyCandidates.length,
    skippedCount: candidates.length - readyCandidates.length,
    totalReceivableIncluded: readyCandidates.reduce(
      (sum, candidate) => sum + candidate.includedReceivable,
      0
    ),
    generatedAt: new Date().toISOString(),
  };
}

export async function generateStatementBatch(
  preview: StatementBatchPreview,
  onProgress?: (result: StatementBatchGenerationResult) => void
): Promise<StatementBatchGenerationSummary> {
  const source = await loadStatementBatchSource();
  const results: StatementBatchGenerationResult[] = [];

  for (const candidate of preview.candidates) {
    if (candidate.status !== 'ready') {
      const result: StatementBatchGenerationResult = {
        customerId: candidate.customer.id,
        customerName: candidate.customer.name,
        status: 'skipped',
        message: candidate.skipReason ?? 'Skipped by batch rules.',
      };
      results.push(result);
      onProgress?.(result);
      continue;
    }

    const generatingResult: StatementBatchGenerationResult = {
      customerId: candidate.customer.id,
      customerName: candidate.customer.name,
      status: 'generating',
      message: 'Generating statement PDF.',
    };
    onProgress?.(generatingResult);

    try {
      const ledger = await getCustomerLedger(candidate.customer.id);
      const document = buildCustomerStatementDocument({
        businessProfile: source.businessProfile,
        customer: ledger.customer,
        transactions: ledger.transactions,
        dateRange: preview.options.dateRange,
        documentOptions: {
          includeCustomBranding: source.documentGates.includeCustomBranding,
          pdfStyle: source.documentGates.pdfStyle,
          proTheme: source.documentGates.pdfStyle === 'advanced' ? source.proBrandTheme : null,
          gatedPremiumFeatures: source.documentGates.lockedFeatures.map((access) => access.feature),
          documentTemplate:
            getBuiltInDocumentTemplate(source.selectedTemplateKey)?.config ?? source.documentTemplate,
        },
      });
      const fileName = buildStatementPdfFileName(document);
      const savedPdf = await generateAndSavePdfFromStructuredDocument(document, fileName);
      const result: StatementBatchGenerationResult = {
        customerId: candidate.customer.id,
        customerName: candidate.customer.name,
        status: 'generated',
        fileName: savedPdf.fileName,
        uri: savedPdf.uri,
        savedPdf,
        message: `${savedPdf.fileName} saved locally.`,
      };
      results.push(result);
      onProgress?.(result);
    } catch {
      const result: StatementBatchGenerationResult = {
        customerId: candidate.customer.id,
        customerName: candidate.customer.name,
        status: 'failed',
        message: 'Statement could not be generated for this customer.',
      };
      results.push(result);
      onProgress?.(result);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    dateRange: preview.options.dateRange,
    generated: results.filter((result) => result.status === 'generated').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}

export function buildStatementBatchRange(key: 'this_month' | 'last_month'): DocumentDateRange {
  const now = new Date();
  const target = new Date(now);
  if (key === 'last_month') {
    target.setMonth(target.getMonth() - 1);
  }

  const start = new Date(target.getFullYear(), target.getMonth(), 1);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);

  return {
    from: formatDateInput(start),
    to: formatDateInput(end),
  };
}

async function loadStatementBatchSource(): Promise<StatementBatchSource> {
  const [businessProfile, subscriptionStatus, proBrandTheme] = await Promise.all([
    getBusinessSettings(),
    getSubscriptionStatus(),
    getActiveProBrandTheme(),
  ]);

  if (!businessProfile) {
    throw new Error('Business profile is required before generating statements.');
  }

  const [documentTemplate, selectedTemplateKey] = await Promise.all([
    loadDocumentTemplateForBusiness(businessProfile, 'statement'),
    getPreferredDocumentTemplateKey(businessProfile, 'statement', subscriptionStatus.isPro),
  ]);

  return {
    businessProfile,
    documentTemplate,
    selectedTemplateKey,
    documentGates: resolveDocumentFeatureGates(subscriptionStatus),
    proBrandTheme,
  };
}

async function loadCandidateSummaries(options: StatementBatchOptions): Promise<CustomerSummary[]> {
  if (options.selectionMode === 'selected_customers') {
    const selectedIds = new Set(options.selectedCustomerIds ?? []);
    if (selectedIds.size === 0) {
      return [];
    }

    const customers = await searchCustomerSummaries({ limit: 500 });
    return customers.filter((customer) => selectedIds.has(customer.id));
  }

  if (options.selectionMode === 'all_outstanding') {
    return searchCustomerSummaries({ filter: 'outstanding', limit: 500 });
  }

  return searchCustomerSummaries({ limit: 500 });
}

function validateBatchOptions(options: StatementBatchOptions): void {
  if (options.dateRange.from > options.dateRange.to) {
    throw new Error('Statement batch date range is invalid.');
  }

  if (
    options.selectionMode === 'balance_above_threshold' &&
    (options.balanceThreshold === undefined || options.balanceThreshold < 0)
  ) {
    throw new Error('Enter a valid balance threshold.');
  }
}

function buildCandidateReason(
  options: StatementBatchOptions,
  ledger: CustomerLedger,
  transactionCountInRange: number
): string {
  if (options.selectionMode === 'activity_in_range') {
    return `${transactionCountInRange} entries in range.`;
  }

  if (options.selectionMode === 'balance_above_threshold') {
    return `Balance ${ledger.balance.toFixed(2)} meets threshold.`;
  }

  if (options.selectionMode === 'selected_customers') {
    return transactionCountInRange > 0
      ? `${transactionCountInRange} entries in range.`
      : 'Selected manually.';
  }

  return 'Outstanding balance included.';
}

function isDateInRange(value: string, range: DocumentDateRange): boolean {
  return value >= range.from && value <= range.to;
}

function formatDateInput(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}
