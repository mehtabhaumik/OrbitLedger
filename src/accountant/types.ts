import type {
  BusinessSettings,
  ComplianceReportType,
  InvoiceWithItems,
  LedgerTransaction,
} from '../database';
import type { ComplianceReportData } from '../compliance';

export type AccountantExportFormat = 'json' | 'csv';

export type AccountantExportOptions = {
  format: AccountantExportFormat;
};

export type AccountantTransactionExportRow = LedgerTransaction & {
  customerName: string | null;
};

export type AccountantComplianceSummary = {
  reportType: ComplianceReportType;
  data: ComplianceReportData;
};

export type AccountantIntegrationPayload = {
  schemaVersion: 1;
  appName: 'Orbit Ledger by Rudraix';
  exportedAt: string;
  business: BusinessSettings | null;
  data: {
    transactions: AccountantTransactionExportRow[];
    invoices: InvoiceWithItems[];
    complianceSummaries: AccountantComplianceSummary[];
  };
  futureIntegration: {
    apiReady: true;
    directIntegrationsEnabled: false;
  };
};

export type AccountantExportFile = {
  fileName: string;
  uri: string;
  directoryUri: string;
  format: AccountantExportFormat;
  mimeType: string;
  exportedAt: string;
  payload: AccountantIntegrationPayload;
};
