export type DailyClosingReport = {
  schemaVersion: 1;
  reportDate: string;
  generatedAt: string;
  business: {
    businessName: string;
    currency: string;
    countryCode: string;
    stateCode: string;
  };
  totals: {
    openingReceivable: number;
    closingReceivable: number;
    creditGiven: number;
    paymentReceived: number;
    netLedgerMovement: number;
    transactionCount: number;
    invoiceSales: number;
    invoiceTax: number;
    invoiceCount: number;
    newCustomers: number;
    remindersSent: number;
    promisesDue: number;
    promisesFulfilled: number;
    promisesMissed: number;
    lowStockProducts: number;
    outstandingCustomersAtClose: number;
  };
  ledgerEntries: DailyClosingLedgerEntry[];
  invoices: DailyClosingInvoiceRow[];
  topOutstandingCustomers: DailyClosingOutstandingCustomer[];
  lowStockProducts: DailyClosingLowStockProduct[];
};

export type DailyClosingLedgerEntry = {
  id: string;
  customerId: string;
  customerName: string;
  type: 'credit' | 'payment';
  amount: number;
  note: string | null;
  effectiveDate: string;
  createdAt: string;
};

export type DailyClosingInvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
};

export type DailyClosingOutstandingCustomer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

export type DailyClosingLowStockProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
};

export type DailyClosingExportFormat = 'json' | 'csv';

export type SavedDailyClosingReportExport = {
  fileName: string;
  uri: string;
  directoryUri: string;
  format: DailyClosingExportFormat;
  mimeType: string;
  exportedAt: string;
  report: DailyClosingReport;
};
