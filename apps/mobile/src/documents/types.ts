import type {
  BusinessSettings,
  Customer,
  DocumentTemplate,
  InvoiceWithItems,
  LedgerTransaction,
  TransactionType,
} from '../database';

export type DocumentKind = 'customer_statement' | 'invoice';

export type DocumentTemplateRole = 'statement' | 'invoice';

export type DocumentRenderTarget = 'structured';

export type DocumentPdfStyle = 'basic' | 'advanced';

export type DocumentTemplateTier = 'free' | 'pro';

export type InvoiceTemplateKey =
  | 'IN_GST_STANDARD_FREE'
  | 'IN_GST_LETTERHEAD_PRO'
  | 'US_SALES_STANDARD_FREE'
  | 'US_SALES_PRO'
  | 'UK_VAT_STANDARD_FREE'
  | 'UK_VAT_LETTERHEAD_PRO'
  | 'GENERIC_INVOICE_STANDARD_FREE'
  | 'GENERIC_INVOICE_LETTERHEAD_PRO';

export type StatementTemplateKey =
  | 'IN_STATEMENT_STANDARD_FREE'
  | 'IN_STATEMENT_LETTERHEAD_PRO'
  | 'US_STATEMENT_STANDARD_FREE'
  | 'US_STATEMENT_LETTERHEAD_PRO'
  | 'UK_STATEMENT_STANDARD_FREE'
  | 'UK_STATEMENT_LETTERHEAD_PRO'
  | 'GENERIC_STATEMENT_STANDARD_FREE'
  | 'GENERIC_STATEMENT_LETTERHEAD_PRO';

export type DocumentTemplateKey = InvoiceTemplateKey | StatementTemplateKey;

export type InvoiceCountryFormat = 'india_gst' | 'us_sales_tax' | 'uk_vat' | 'generic_tax';

export type InvoiceVisualStyle =
  | 'classic_tax'
  | 'modern_minimal'
  | 'product_retail'
  | 'service'
  | 'compact_counter'
  | 'premium_letterhead';

export type StatementVisualStyle = 'balance_forward' | 'account_letterhead';

export type DocumentTemplateRuntime = {
  key: DocumentTemplateKey;
  label: string;
  tier: DocumentTemplateTier;
  visualStyle: InvoiceVisualStyle | StatementVisualStyle;
  countryFormat?: InvoiceCountryFormat;
  description: string;
};

export type DocumentProTheme = {
  key: string;
  label: string;
  accentColor: string;
  surfaceColor: string;
  lineColor: string;
  textColor: string;
};

export type DocumentDateRange = {
  from: string;
  to: string;
};

export type DocumentMoney = {
  amount: number;
  currency: string;
  formatted: string;
};

export type DocumentImageAsset = {
  uri: string;
  alt: string;
};

export type BusinessIdentityBlock = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  countryCode: string;
  stateCode: string;
  logo: DocumentImageAsset | null;
  taxRegistrationNumber: string | null;
};

export type CustomerIdentityBlock = {
  customerId: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export type StatementMetadataBlock = {
  statementDate: string;
  dateRange: DocumentDateRange;
  currency: string;
};

export type StatementTransactionRow = {
  transactionId: string;
  date: string;
  description: string;
  type: TransactionType;
  credit: DocumentMoney | null;
  payment: DocumentMoney | null;
  runningBalance: DocumentMoney;
};

export type StatementSummaryBlock = {
  openingBalance: DocumentMoney;
  totalCredit: DocumentMoney;
  totalPayment: DocumentMoney;
  finalBalance: DocumentMoney;
  amountDue: DocumentMoney;
  dueMessage: string;
  lastTransactionDate: string | null;
};

export type InvoiceMetadataBlock = {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  status: string;
};

export type InvoiceItemTableRow = {
  itemId: string;
  name: string;
  description: string | null;
  quantity: number;
  price: DocumentMoney;
  taxRate: string;
  hsnSac: string;
  taxableValue: DocumentMoney;
  taxAmount: DocumentMoney;
  cgst: DocumentMoney | null;
  sgst: DocumentMoney | null;
  igst: DocumentMoney | null;
  total: DocumentMoney;
};

export type InvoiceSummaryBlock = {
  subtotal: DocumentMoney;
  taxAmount: DocumentMoney;
  totalAmount: DocumentMoney;
  amountInWords: string;
};

export type DocumentTaxBreakdownRow = {
  label: string;
  amount: DocumentMoney;
};

export type DocumentTaxPlaceholderBlock = {
  taxSection: {
    status: 'configured' | 'not_configured';
    message: string;
  };
  taxColumnLabel?: string;
  taxSummaryLabel?: string;
  taxRegistrationLabel?: string;
  placeOfSupply?: string | null;
  taxPointLabel?: string;
  taxPointDate?: string | null;
  taxBreakdown: {
    rows: DocumentTaxBreakdownRow[];
    message: string;
  };
  taxRegistrationNumber: string | null;
};

export type DocumentFooterBlock = {
  authorizedPersonName: string;
  designation: string;
  signature: DocumentImageAsset | null;
};

export type CustomerStatementData = {
  kind: 'customer_statement';
  businessIdentity: BusinessIdentityBlock;
  customerIdentity: CustomerIdentityBlock;
  metadata: StatementMetadataBlock;
  transactions: StatementTransactionRow[];
  summary: StatementSummaryBlock;
  taxPlaceholder: DocumentTaxPlaceholderBlock;
  footer: DocumentFooterBlock;
  rendering: {
    pdfStyle: DocumentPdfStyle;
    customBrandingIncluded: boolean;
    proTheme: DocumentProTheme | null;
    template: DocumentTemplateRuntime;
    gatedPremiumFeatures: string[];
  };
  source: {
    businessId: string;
    customerId: string;
    transactionIds: string[];
    generatedAt: string;
  };
};

export type InvoiceDocumentData = {
  kind: 'invoice';
  businessIdentity: BusinessIdentityBlock;
  customerIdentity: CustomerIdentityBlock;
  metadata: InvoiceMetadataBlock;
  items: InvoiceItemTableRow[];
  summary: InvoiceSummaryBlock;
  taxPlaceholder: DocumentTaxPlaceholderBlock;
  footer: DocumentFooterBlock;
  rendering: {
    pdfStyle: DocumentPdfStyle;
    customBrandingIncluded: boolean;
    proTheme: DocumentProTheme | null;
    template: DocumentTemplateRuntime;
    gatedPremiumFeatures: string[];
  };
  source: {
    businessId: string;
    customerId: string | null;
    invoiceId: string;
    invoiceItemIds: string[];
    generatedAt: string;
  };
};

export type DocumentData = CustomerStatementData | InvoiceDocumentData;

export type DocumentSectionRole =
  | 'business_identity'
  | 'customer_identity'
  | 'statement_metadata'
  | 'invoice_metadata'
  | 'summary'
  | 'invoice_summary'
  | 'tax_placeholder'
  | 'footer';

export type DocumentTableRole = 'transaction_table' | 'invoice_item_table';

export type DocumentLayoutRole = DocumentSectionRole | DocumentTableRole;

export type DocumentTemplateConfig = {
  layoutVersion?: number;
  title?: string;
  page?: Partial<DocumentLayout['page']>;
  sectionTitles?: Partial<Record<DocumentLayoutRole, string>>;
  tableColumns?: Partial<Record<DocumentTableRole, DocumentTableColumn[]>>;
  hiddenRoles?: DocumentLayoutRole[];
  sectionOrder?: DocumentLayoutRole[];
  taxLabels?: {
    taxSectionTitle?: string;
    taxBreakdownTitle?: string;
    taxColumnLabel?: string;
    taxSummaryLabel?: string;
    taxRegistrationLabel?: string;
  };
  numberFormat?: {
    locale?: string;
    currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  };
  metadata?: Record<string, unknown>;
};

export type DocumentLayoutNode =
  | {
      id: string;
      type: 'section';
      role: DocumentSectionRole;
      title?: string;
      data:
        | BusinessIdentityBlock
        | CustomerIdentityBlock
        | StatementMetadataBlock
        | StatementSummaryBlock
        | InvoiceMetadataBlock
        | InvoiceSummaryBlock
        | DocumentTaxPlaceholderBlock
        | DocumentFooterBlock;
    }
  | {
      id: string;
      type: 'table';
      role: DocumentTableRole;
      title: string;
      columns: DocumentTableColumn[];
      rows: StatementTransactionRow[] | InvoiceItemTableRow[];
    };

export type DocumentTableColumn = {
  key: keyof StatementTransactionRow | keyof InvoiceItemTableRow;
  label: string;
  align: 'left' | 'right';
};

export type DocumentLayout = {
  id: string;
  kind: DocumentKind;
  title: string;
  version: number;
  page: {
    size: 'A4';
    orientation: 'portrait';
    margin: 'compact' | 'standard';
  };
  sections: DocumentLayoutNode[];
};

export type StructuredDocument<TData = DocumentData> = {
  id: string;
  kind: DocumentKind;
  renderTarget: DocumentRenderTarget;
  title: string;
  version: number;
  data: TData;
  layout: DocumentLayout;
};

export type CustomerStatementInput = {
  businessProfile: BusinessSettings;
  customer: Customer;
  transactions: LedgerTransaction[];
  statementDate?: string;
  dateRange?: Partial<DocumentDateRange>;
  locale?: string;
  documentOptions?: {
    includeCustomBranding?: boolean;
    pdfStyle?: DocumentPdfStyle;
    proTheme?: DocumentProTheme | null;
    gatedPremiumFeatures?: string[];
    documentTemplate?: DocumentTemplate | DocumentTemplateConfig | null;
    taxRegistrationNumber?: string | null;
    taxColumnLabel?: string;
    taxSummaryLabel?: string;
    taxRegistrationLabel?: string;
    taxSectionMessage?: string;
    taxBreakdownMessage?: string;
    taxBreakdownMode?: 'india_intra_state' | 'india_inter_state' | 'us_sales_tax' | 'uk_vat' | 'generic';
    placeOfSupply?: string | null;
    taxPointLabel?: string;
    taxPointDate?: string | null;
  };
};

export type InvoiceDocumentInput = {
  businessProfile: BusinessSettings;
  customer?: Customer | null;
  invoice: InvoiceWithItems;
  locale?: string;
  documentOptions?: {
    includeCustomBranding?: boolean;
    pdfStyle?: DocumentPdfStyle;
    proTheme?: DocumentProTheme | null;
    gatedPremiumFeatures?: string[];
    documentTemplate?: DocumentTemplate | DocumentTemplateConfig | null;
    taxRegistrationNumber?: string | null;
    taxColumnLabel?: string;
    taxSummaryLabel?: string;
    taxRegistrationLabel?: string;
    taxSectionMessage?: string;
    taxBreakdownMessage?: string;
    taxBreakdownMode?: 'india_intra_state' | 'india_inter_state' | 'us_sales_tax' | 'uk_vat' | 'generic';
    placeOfSupply?: string | null;
    taxPointLabel?: string;
    taxPointDate?: string | null;
  };
};
