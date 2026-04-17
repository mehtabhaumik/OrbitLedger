export type RootStackParamList = {
  Setup: undefined;
  Dashboard: undefined;
  Invoices: undefined;
  Products: undefined;
  Reports: undefined;
  ComplianceReports: undefined;
  BusinessProfileSettings: undefined;
  CountryPackageStore: undefined;
  OrbitHelper: { screenContext?: string } | undefined;
  Upgrade: undefined;
  Feedback: undefined;
  TaxSetup: undefined;
  PinManagement: { mode: 'enable' | 'change' | 'disable' };
  BackupRestore: undefined;
  Customers: undefined;
  CustomerForm: { customerId?: string } | undefined;
  CustomerDetail: { customerId: string };
  TransactionForm:
    | { customerId?: string; type?: 'credit' | 'payment'; transactionId?: string }
    | undefined;
  InvoiceForm: { customerId?: string; invoiceId?: string } | undefined;
  InvoicePreview: { invoiceId: string };
  StatementPreview: { customerId: string };
};
