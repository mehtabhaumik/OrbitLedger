import type { ComplianceReport, ComplianceReportType } from '../database';

export type ComplianceDateRange = {
  from?: string;
  to?: string;
};

export type GenerateComplianceReportInput = {
  reportType: ComplianceReportType;
  dateRange?: ComplianceDateRange;
  persist?: boolean;
};

export type ComplianceReportLabels = {
  taxName: string;
  taxRate: string;
  taxableSales: string;
  taxAmount: string;
  totalAmount: string;
  salesSummary: string;
  duesSummary: string;
};

export type ComplianceNumberFormat = {
  locale: string | null;
  currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  decimalPlaces: number;
};

export type ComplianceReportRules = {
  excludedInvoiceStatuses: string[];
  topOutstandingCustomerLimit: number;
};

export type ComplianceRuleContext = {
  countryPackage: {
    id: string;
    version: string;
  } | null;
  taxPack: {
    id: string;
    version: string;
    taxType: string;
  } | null;
  complianceConfig: {
    id: string;
    version: string;
  } | null;
  labels: ComplianceReportLabels;
  numberFormat: ComplianceNumberFormat;
  reportRules: ComplianceReportRules;
};

export type ComplianceReportMetadata = {
  appName: 'Orbit Ledger by Rudraix';
  reportType: ComplianceReportType;
  countryCode: string;
  regionCode: string;
  generatedAt: string;
  currency: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  scopeNote: string;
  labels: ComplianceReportLabels;
  numberFormat: ComplianceNumberFormat;
  countryPackage: ComplianceRuleContext['countryPackage'];
  taxPack: ComplianceRuleContext['taxPack'];
  complianceConfig: ComplianceRuleContext['complianceConfig'];
};

export type ComplianceTaxSummaryData = {
  metadata: ComplianceReportMetadata & { reportType: 'tax_summary' };
  totals: {
    invoiceCount: number;
    taxableSales: number;
    taxAmount: number;
    totalAmount: number;
  };
  taxByRate: Array<{
    taxRate: number;
    itemCount: number;
    taxableAmount: number;
    taxAmount: number;
    totalAmount: number;
  }>;
};

export type ComplianceSalesSummaryData = {
  metadata: ComplianceReportMetadata & { reportType: 'sales_summary' };
  totals: {
    invoiceCount: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  };
  byStatus: Array<{
    status: string;
    invoiceCount: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
  }>;
};

export type ComplianceDuesSummaryData = {
  metadata: ComplianceReportMetadata & { reportType: 'dues_summary' };
  totals: {
    activeCustomers: number;
    archivedCustomers: number;
    customersWithDues: number;
    customersWithAdvance: number;
    totalReceivable: number;
    totalAdvance: number;
    netBalance: number;
  };
  topOutstandingCustomers: Array<{
    customerId: string;
    name: string;
    phone: string | null;
    balance: number;
    latestActivityAt: string;
  }>;
};

export type ComplianceReportData =
  | ComplianceTaxSummaryData
  | ComplianceSalesSummaryData
  | ComplianceDuesSummaryData;

export type GeneratedComplianceReport = {
  data: ComplianceReportData;
  savedReport: ComplianceReport | null;
};
