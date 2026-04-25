export type MonthlyReviewCustomer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  paymentsReceived: number;
  creditGiven: number;
  invoiceSales: number;
  lastPaymentAt: string | null;
  oldestCreditAt: string | null;
  latestActivityAt: string | null;
};

export type MonthlyReviewActionItem = {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  target:
    | 'get_paid'
    | 'customers'
    | 'statement_batch'
    | 'reorder_assistant'
    | 'backup'
    | 'compliance'
    | 'daily_closing';
};

export type MonthlyBusinessReview = {
  schemaVersion: 1;
  generatedAt: string;
  month: {
    monthKey: string;
    label: string;
    startDate: string;
    endDate: string;
    previousMonthKey: string;
    previousLabel: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  business: {
    businessName: string;
    currency: string;
    countryCode: string;
    stateCode: string;
  };
  totals: {
    monthEndReceivable: number;
    previousMonthEndReceivable: number;
    receivableChange: number;
    paymentsReceived: number;
    previousPaymentsReceived: number;
    paymentsChange: number;
    creditGiven: number;
    previousCreditGiven: number;
    creditChange: number;
    invoiceSales: number;
    previousInvoiceSales: number;
    salesChange: number;
    invoiceTax: number;
    previousInvoiceTax: number;
    taxChange: number;
    netReceivableMovement: number;
    newCustomers: number;
    activeCustomers: number;
    remindersSent: number;
    missedPaymentPromises: number;
    lowStockCount: number;
  };
  actionItems: MonthlyReviewActionItem[];
  topCustomersByPayments: MonthlyReviewCustomer[];
  topCustomersBySales: MonthlyReviewCustomer[];
  highestDues: MonthlyReviewCustomer[];
  slowPayingCustomers: MonthlyReviewCustomer[];
  improvedCustomers: MonthlyReviewCustomer[];
};

export type MonthlyReviewExportFormat = 'json' | 'csv';

export type SavedMonthlyReviewExport = {
  fileName: string;
  uri: string;
  directoryUri: string;
  format: MonthlyReviewExportFormat;
  mimeType: string;
  exportedAt: string;
  review: MonthlyBusinessReview;
};
