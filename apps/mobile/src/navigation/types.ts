export type RootStackParamList = {
  Setup: undefined;
  CloudAuth: { returnTo: 'Setup' | 'BusinessProfileSettings' };
  Dashboard: undefined;
  GetPaid: undefined;
  Invoices: undefined;
  Products: undefined;
  Reports: undefined;
  RuntimeQA: undefined;
  BusinessHealthSnapshot: undefined;
  MonthlyBusinessReview: undefined;
  StatementBatch: undefined;
  InventoryReorderAssistant: undefined;
  DailyClosingReport: undefined;
  ComplianceReports: undefined;
  BusinessProfileSettings: undefined;
  CountryPackageStore: undefined;
  OrbitHelper: { screenContext?: string } | undefined;
  Upgrade: undefined;
  Feedback: undefined;
  TaxSetup: undefined;
  PinManagement: { mode: 'enable' | 'change' | 'disable' };
  BackupRestore: undefined;
  FounderNote: undefined;
  Customers: undefined;
  CustomerForm: { customerId?: string } | undefined;
  CustomerDetail: { customerId: string };
  TransactionForm:
    | {
        customerId?: string;
        type?: 'credit' | 'payment';
        transactionId?: string;
        promiseId?: string;
        invoiceId?: string;
        amount?: number;
      }
    | undefined;
  InvoiceForm: { customerId?: string; invoiceId?: string } | undefined;
  InvoicePreview: { invoiceId: string };
  StatementPreview: { customerId: string };
};
