import type { CustomerSummary } from '../database';
import type { DocumentDateRange } from '../documents';
import type { SavedPdf } from '../documents';

export type StatementBatchRangeKey = 'this_month' | 'last_month' | 'custom';

export type StatementBatchSelectionMode =
  | 'all_outstanding'
  | 'activity_in_range'
  | 'selected_customers'
  | 'balance_above_threshold';

export type StatementBatchOptions = {
  dateRange: DocumentDateRange;
  selectionMode: StatementBatchSelectionMode;
  selectedCustomerIds?: string[];
  balanceThreshold?: number;
};

export type StatementBatchCandidate = {
  customer: CustomerSummary;
  transactionCountInRange: number;
  balance: number;
  includedReceivable: number;
  reason: string;
  status: 'ready' | 'skipped';
  skipReason?: string;
};

export type StatementBatchPreview = {
  options: StatementBatchOptions;
  candidates: StatementBatchCandidate[];
  readyCount: number;
  skippedCount: number;
  totalReceivableIncluded: number;
  generatedAt: string;
};

export type StatementBatchGenerationStatus = 'pending' | 'generating' | 'generated' | 'skipped' | 'failed';

export type StatementBatchGenerationResult = {
  customerId: string;
  customerName: string;
  status: StatementBatchGenerationStatus;
  fileName?: string;
  uri?: string;
  savedPdf?: SavedPdf;
  message: string;
};

export type StatementBatchGenerationSummary = {
  generatedAt: string;
  dateRange: DocumentDateRange;
  generated: number;
  skipped: number;
  failed: number;
  results: StatementBatchGenerationResult[];
};
