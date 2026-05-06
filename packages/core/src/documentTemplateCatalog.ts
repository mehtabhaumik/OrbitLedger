export type SharedDocumentTemplateType = 'invoice' | 'statement';
export type SharedDocumentTemplateTier = 'free' | 'pro';
export type SharedDocumentTemplateCountryCode = 'IN' | 'US' | 'GB' | 'GENERIC';
export type SharedInvoiceCountryFormat = 'india_gst' | 'us_sales_tax' | 'uk_vat' | 'generic_tax';
export type SharedDocumentVisualStyle =
  | 'classic_tax'
  | 'modern_minimal'
  | 'premium_letterhead'
  | 'balance_forward'
  | 'account_letterhead';

export type SharedDocumentTemplateColumn = {
  key: string;
  label: string;
  align: 'left' | 'right';
};

export type SharedDocumentTemplateConfig = {
  layoutVersion: 2;
  title: string;
  page: {
    size: 'A4';
    orientation: 'portrait';
    margin: 'compact' | 'standard';
  };
  sectionTitles: Record<string, string>;
  tableColumns: Record<string, SharedDocumentTemplateColumn[]>;
  sectionOrder: string[];
  taxLabels?: {
    taxSectionTitle: string;
    taxBreakdownTitle: string;
    taxColumnLabel: string;
    taxSummaryLabel: string;
    taxRegistrationLabel: string;
  };
  numberFormat: {
    locale?: string;
    currencyDisplay: 'symbol';
  };
  metadata: {
    templateKey: SharedDocumentTemplateKey;
    templateLabel: string;
    templateTier: SharedDocumentTemplateTier;
    visualStyle: SharedDocumentVisualStyle;
    countryFormat?: SharedInvoiceCountryFormat;
    statementMode?: 'balance_forward';
    description: string;
  };
};

export type SharedDocumentTemplate = {
  key: SharedDocumentTemplateKey;
  role: SharedDocumentTemplateType;
  documentType: SharedDocumentTemplateType;
  countryCode: SharedDocumentTemplateCountryCode;
  tier: SharedDocumentTemplateTier;
  label: string;
  description: string;
  visualStyle: SharedDocumentVisualStyle;
  countryFormat?: SharedInvoiceCountryFormat;
  taxLabel: string;
  taxRegistrationLabel: string;
  locale?: string;
  columns: SharedDocumentTemplateColumn[];
  config: SharedDocumentTemplateConfig;
};

export type SharedInvoiceTemplateKey =
  | 'IN_CLEAN_BASIC_FREE'
  | 'IN_GST_STANDARD_FREE'
  | 'IN_SIMPLE_SERVICE_FREE'
  | 'IN_MODERN_BUSINESS_PRO'
  | 'IN_RETAIL_GST_PRO'
  | 'IN_GST_LETTERHEAD_PRO'
  | 'IN_COMPACT_TABLE_PRO'
  | 'IN_PAYMENT_FOCUSED_PRO'
  | 'IN_BRANDED_ADVANCED_PRO'
  | 'US_SALES_STANDARD_FREE'
  | 'US_SALES_PRO'
  | 'UK_VAT_STANDARD_FREE'
  | 'UK_VAT_LETTERHEAD_PRO'
  | 'GENERIC_INVOICE_STANDARD_FREE'
  | 'GENERIC_SIMPLE_SERVICE_FREE'
  | 'GENERIC_MODERN_BUSINESS_PRO'
  | 'GENERIC_INVOICE_LETTERHEAD_PRO'
  | 'GENERIC_COMPACT_TABLE_PRO'
  | 'GENERIC_PAYMENT_FOCUSED_PRO'
  | 'GENERIC_BRANDED_ADVANCED_PRO';

export type SharedStatementTemplateKey =
  | 'IN_STATEMENT_STANDARD_FREE'
  | 'IN_STATEMENT_LETTERHEAD_PRO'
  | 'US_STATEMENT_STANDARD_FREE'
  | 'US_STATEMENT_LETTERHEAD_PRO'
  | 'UK_STATEMENT_STANDARD_FREE'
  | 'UK_STATEMENT_LETTERHEAD_PRO'
  | 'GENERIC_STATEMENT_STANDARD_FREE'
  | 'GENERIC_STATEMENT_LETTERHEAD_PRO';

export type SharedDocumentTemplateKey = SharedInvoiceTemplateKey | SharedStatementTemplateKey;

const invoiceTemplates: SharedDocumentTemplate[] = [
  invoiceTemplate('IN_CLEAN_BASIC_FREE', 'IN', 'free', 'Clean Basic', 'Simple everyday invoice for quick service and trading work with clear totals and no heavy formatting.', 'modern_minimal', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxRate', 'GST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_GST_STANDARD_FREE', 'IN', 'free', 'India GST Standard', 'Classic India invoice wording with GSTIN, HSN/SAC, CGST/SGST/IGST and amount in words.', 'classic_tax', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Description', 'left'],
    ['hsnSac', 'HSN/SAC', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxableValue', 'Taxable value', 'right'],
    ['taxRate', 'GST', 'right'],
    ['cgst', 'CGST', 'right'],
    ['sgst', 'SGST', 'right'],
    ['igst', 'IGST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_SIMPLE_SERVICE_FREE', 'IN', 'free', 'Simple Service Invoice', 'A clean free service invoice with compact line items, tax, notes, and payment instructions.', 'modern_minimal', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'GST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_MODERN_BUSINESS_PRO', 'IN', 'pro', 'Modern Business', 'Polished Pro invoice for growing businesses with stronger identity, cleaner spacing, and branded totals.', 'premium_letterhead', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'GST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_RETAIL_GST_PRO', 'IN', 'pro', 'Retail GST', 'Pro retail layout with quantity, rate, GST split, and a compact total suitable for product-heavy invoices.', 'classic_tax', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Product', 'left'],
    ['hsnSac', 'HSN/SAC', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxRate', 'GST', 'right'],
    ['cgst', 'CGST', 'right'],
    ['sgst', 'SGST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_GST_LETTERHEAD_PRO', 'IN', 'pro', 'Professional Letterhead', 'Premium India letterhead with branding, GSTIN focus, signature and polished totals.', 'premium_letterhead', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['hsnSac', 'HSN/SAC', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxRate', 'GST', 'right'],
    ['cgst', 'CGST', 'right'],
    ['sgst', 'SGST', 'right'],
    ['igst', 'IGST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_COMPACT_TABLE_PRO', 'IN', 'pro', 'Compact Table', 'Dense Pro layout for longer invoices where rows must stay readable and page count should stay low.', 'classic_tax', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxRate', 'GST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('IN_PAYMENT_FOCUSED_PRO', 'IN', 'pro', 'Payment-focused Invoice', 'Collection-ready Pro invoice with payment link, manual payment details, and amount due highlighted.', 'premium_letterhead', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'GST', 'right'],
    ['total', 'Amount due', 'right'],
  ]),
  invoiceTemplate('IN_BRANDED_ADVANCED_PRO', 'IN', 'pro', 'Branded Advanced', 'Highest-polish Pro invoice with premium branding, signature area, payment section, and refined tax summary.', 'premium_letterhead', 'india_gst', 'GST', 'GSTIN', 'en-IN', [
    ['name', 'Item / Service', 'left'],
    ['description', 'Details', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'GST', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('US_SALES_STANDARD_FREE', 'US', 'free', 'US Sales Standard', 'Modern sales invoice with taxable subtotal, sales tax and item descriptions.', 'modern_minimal', 'us_sales_tax', 'Sales tax', 'Seller permit', 'en-US', [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Unit price', 'right'],
    ['taxableValue', 'Taxable amount', 'right'],
    ['taxRate', 'Sales tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('US_SALES_PRO', 'US', 'pro', 'US Sales Pro', 'Premium sales invoice with branding, seller permit field and strong totals panel.', 'premium_letterhead', 'us_sales_tax', 'Sales tax', 'Seller permit', 'en-US', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxAmount', 'Sales tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('UK_VAT_STANDARD_FREE', 'GB', 'free', 'UK VAT Standard', 'UK VAT invoice wording with VAT number, tax point and net/VAT/gross totals.', 'classic_tax', 'uk_vat', 'VAT', 'VAT reg no.', 'en-GB', [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Unit price', 'right'],
    ['taxableValue', 'Net', 'right'],
    ['taxRate', 'VAT', 'right'],
    ['taxAmount', 'VAT amount', 'right'],
    ['total', 'Gross', 'right'],
  ]),
  invoiceTemplate('UK_VAT_LETTERHEAD_PRO', 'GB', 'pro', 'UK VAT Letterhead', 'Premium UK invoice wording with logo, VAT number highlight, signature and refined totals.', 'premium_letterhead', 'uk_vat', 'VAT', 'VAT reg no.', 'en-GB', [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Net', 'right'],
    ['taxRate', 'VAT', 'right'],
    ['taxAmount', 'VAT', 'right'],
    ['total', 'Gross', 'right'],
  ]),
  invoiceTemplate('GENERIC_INVOICE_STANDARD_FREE', 'GENERIC', 'free', 'Standard Invoice', 'Clean general invoice for countries without a specific local template yet.', 'modern_minimal', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Description', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Price', 'right'],
    ['taxRate', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_SIMPLE_SERVICE_FREE', 'GENERIC', 'free', 'Simple Service Invoice', 'Clean service invoice with notes, tax, and payment instructions for unsupported country packs.', 'modern_minimal', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_MODERN_BUSINESS_PRO', 'GENERIC', 'pro', 'Modern Business', 'Polished Pro invoice with cleaner spacing, branded totals, and stronger business identity.', 'premium_letterhead', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_INVOICE_LETTERHEAD_PRO', 'GENERIC', 'pro', 'Professional Letterhead', 'Premium general invoice with richer branding and signature treatment.', 'premium_letterhead', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_COMPACT_TABLE_PRO', 'GENERIC', 'pro', 'Compact Table', 'Dense Pro invoice for longer documents where readable rows and lower page count matter.', 'classic_tax', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item', 'left'],
    ['quantity', 'Qty', 'right'],
    ['price', 'Rate', 'right'],
    ['taxRate', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
  invoiceTemplate('GENERIC_PAYMENT_FOCUSED_PRO', 'GENERIC', 'pro', 'Payment-focused Invoice', 'Collection-ready Pro invoice with a stronger amount-due and payment details section.', 'premium_letterhead', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item / Service', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxableValue', 'Taxable', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Amount due', 'right'],
  ]),
  invoiceTemplate('GENERIC_BRANDED_ADVANCED_PRO', 'GENERIC', 'pro', 'Branded Advanced', 'Highest-polish Pro invoice with premium branding, signature area, and payment section.', 'premium_letterhead', 'generic_tax', 'Tax', 'Tax ID', undefined, [
    ['name', 'Item / Service', 'left'],
    ['description', 'Details', 'left'],
    ['quantity', 'Qty', 'right'],
    ['taxAmount', 'Tax', 'right'],
    ['total', 'Total', 'right'],
  ]),
];

const statementTemplates: SharedDocumentTemplate[] = [
  statementTemplate('IN_STATEMENT_STANDARD_FREE', 'IN', 'free', 'India Statement Standard', 'Balance-forward customer statement for Indian ledger dues.', 'en-IN'),
  statementTemplate('IN_STATEMENT_LETTERHEAD_PRO', 'IN', 'pro', 'India Statement Letterhead', 'Premium branded statement with stronger account summary and signature.', 'en-IN'),
  statementTemplate('US_STATEMENT_STANDARD_FREE', 'US', 'free', 'US Statement Standard', 'Balance-forward statement for US customers and payments.', 'en-US'),
  statementTemplate('US_STATEMENT_LETTERHEAD_PRO', 'US', 'pro', 'US Statement Letterhead', 'Premium branded US customer statement.', 'en-US'),
  statementTemplate('UK_STATEMENT_STANDARD_FREE', 'GB', 'free', 'UK Statement Standard', 'Balance-forward statement for UK accounts.', 'en-GB'),
  statementTemplate('UK_STATEMENT_LETTERHEAD_PRO', 'GB', 'pro', 'UK Statement Letterhead', 'Premium branded UK statement with professional account summary.', 'en-GB'),
  statementTemplate('GENERIC_STATEMENT_STANDARD_FREE', 'GENERIC', 'free', 'Statement Standard', 'Clean balance-forward customer statement.', undefined),
  statementTemplate('GENERIC_STATEMENT_LETTERHEAD_PRO', 'GENERIC', 'pro', 'Statement Letterhead', 'Premium branded customer statement.', undefined),
];

const templateCatalog = [...invoiceTemplates, ...statementTemplates];

export function getSharedDocumentTemplateCatalog(input: {
  countryCode: string;
  templateType: SharedDocumentTemplateType;
}): SharedDocumentTemplate[] {
  const countryCode = normalizeSharedTemplateCountry(input.countryCode);
  const catalog = templateCatalog.filter((template) => template.documentType === input.templateType);
  const countryItems = catalog.filter((template) => template.countryCode === countryCode);
  const fallbackItems = catalog.filter((template) => template.countryCode === 'GENERIC');
  return countryItems.length ? countryItems : fallbackItems;
}

export function getSharedDocumentTemplates(input?: {
  templateType?: SharedDocumentTemplateType;
}): SharedDocumentTemplate[] {
  if (!input?.templateType) {
    return [...templateCatalog];
  }
  return templateCatalog.filter((template) => template.documentType === input.templateType);
}

export function getSharedDocumentTemplate(key: string | null | undefined): SharedDocumentTemplate | null {
  if (!key) {
    return null;
  }
  return templateCatalog.find((template) => template.key === key) ?? null;
}

export function getDefaultSharedDocumentTemplate(
  input: { countryCode: string; templateType: SharedDocumentTemplateType },
  isPro: boolean
): SharedDocumentTemplate {
  const catalog = getSharedDocumentTemplateCatalog(input);
  const targetTier: SharedDocumentTemplateTier = isPro ? 'pro' : 'free';
  return catalog.find((template) => template.tier === targetTier) ?? catalog[0];
}

export function getAccessibleSharedDocumentTemplate(
  input: { countryCode: string; templateType: SharedDocumentTemplateType; key?: string | null },
  isPro: boolean
): SharedDocumentTemplate {
  const catalog = getSharedDocumentTemplateCatalog(input);
  const selected = input.key ? catalog.find((template) => template.key === input.key) : null;
  if (selected && canUseSharedDocumentTemplate(selected, isPro)) {
    return selected;
  }
  return getDefaultSharedDocumentTemplate(input, isPro);
}

export function canUseSharedDocumentTemplate(template: SharedDocumentTemplate, isPro: boolean): boolean {
  return template.tier === 'free' || isPro;
}

export function normalizeSharedTemplateCountry(countryCode: string): SharedDocumentTemplateCountryCode {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN' || normalized === 'US' || normalized === 'GB') {
    return normalized;
  }
  return 'GENERIC';
}

function invoiceTemplate(
  key: SharedInvoiceTemplateKey,
  countryCode: SharedDocumentTemplateCountryCode,
  tier: SharedDocumentTemplateTier,
  label: string,
  description: string,
  visualStyle: SharedDocumentVisualStyle,
  countryFormat: SharedInvoiceCountryFormat,
  taxLabel: string,
  taxRegistrationLabel: string,
  locale: string | undefined,
  rawColumns: Array<[string, string, 'left' | 'right']>
): SharedDocumentTemplate {
  const columns = rawColumns.map(([columnKey, columnLabel, align]) => ({ key: columnKey, label: columnLabel, align }));
  return {
    key,
    role: 'invoice',
    documentType: 'invoice',
    countryCode,
    tier,
    label,
    description,
    visualStyle,
    countryFormat,
    taxLabel,
    taxRegistrationLabel,
    locale,
    columns,
    config: buildInvoiceConfig({
      countryFormat,
      columns,
      key,
      label,
      locale,
      taxLabel,
      taxRegistrationLabel,
      tier,
      visualStyle,
    }),
  };
}

function statementTemplate(
  key: SharedStatementTemplateKey,
  countryCode: SharedDocumentTemplateCountryCode,
  tier: SharedDocumentTemplateTier,
  label: string,
  description: string,
  locale: string | undefined
): SharedDocumentTemplate {
  const visualStyle: SharedDocumentVisualStyle = tier === 'pro' ? 'account_letterhead' : 'balance_forward';
  const columns = [
    { key: 'date', label: 'Date', align: 'left' as const },
    { key: 'description', label: 'Details', align: 'left' as const },
    { key: 'credit', label: 'Credit / Charges', align: 'right' as const },
    { key: 'payment', label: 'Payments', align: 'right' as const },
    { key: 'runningBalance', label: 'Balance', align: 'right' as const },
  ];
  return {
    key,
    role: 'statement',
    documentType: 'statement',
    countryCode,
    tier,
    label,
    description,
    visualStyle,
    taxLabel: 'Tax',
    taxRegistrationLabel: 'Tax ID',
    locale,
    columns,
    config: {
      layoutVersion: 2,
      title: 'Statement of Account',
      page: {
        size: 'A4',
        orientation: 'portrait',
        margin: tier === 'pro' ? 'standard' : 'compact',
      },
      sectionTitles: {
        customer_identity: 'Statement For',
        statement_metadata: 'Statement Period',
        transaction_table: 'Account Activity',
        summary: 'Account Summary',
        tax_placeholder: 'Statement Note',
      },
      tableColumns: {
        transaction_table: columns,
      },
      sectionOrder: [
        'business_identity',
        'statement_metadata',
        'customer_identity',
        'summary',
        'transaction_table',
        'tax_placeholder',
        'footer',
      ],
      numberFormat: {
        locale,
        currencyDisplay: 'symbol',
      },
      metadata: {
        templateKey: key,
        templateLabel: label,
        templateTier: tier,
        visualStyle,
        statementMode: 'balance_forward',
        description,
      },
    },
  };
}

function buildInvoiceConfig(input: {
  key: SharedInvoiceTemplateKey;
  label: string;
  tier: SharedDocumentTemplateTier;
  visualStyle: SharedDocumentVisualStyle;
  countryFormat: SharedInvoiceCountryFormat;
  locale?: string;
  taxLabel: string;
  taxRegistrationLabel: string;
  columns: SharedDocumentTemplateColumn[];
}): SharedDocumentTemplateConfig {
  return {
    layoutVersion: 2,
    title: invoiceTitleForCountryFormat(input.countryFormat),
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: input.visualStyle === 'premium_letterhead' ? 'standard' : 'compact',
    },
    sectionTitles: {
      customer_identity: input.countryFormat === 'india_gst' ? 'Buyer Details' : 'Bill To',
      invoice_metadata: input.countryFormat === 'uk_vat' ? 'VAT Invoice Details' : 'Invoice Details',
      invoice_item_table: input.countryFormat === 'india_gst' ? 'Taxable Items / Services' : 'Items / Services',
      invoice_summary: input.countryFormat === 'uk_vat' ? 'Net / VAT / Gross Total' : 'Totals',
      tax_placeholder: input.countryFormat === 'india_gst' ? 'GST Details' : 'Tax Details',
    },
    tableColumns: {
      invoice_item_table: input.columns,
    },
    sectionOrder: [
      'business_identity',
      'invoice_metadata',
      'customer_identity',
      'invoice_item_table',
      'invoice_summary',
      'tax_placeholder',
      'footer',
    ],
    taxLabels: {
      taxSectionTitle: input.countryFormat === 'india_gst' ? 'GST Details' : 'Tax Details',
      taxBreakdownTitle: input.countryFormat === 'india_gst' ? 'GST Breakdown' : 'Tax Breakdown',
      taxColumnLabel: input.taxLabel,
      taxSummaryLabel: input.taxLabel,
      taxRegistrationLabel: input.taxRegistrationLabel,
    },
    numberFormat: {
      locale: input.locale,
      currencyDisplay: 'symbol',
    },
    metadata: {
      templateKey: input.key,
      templateLabel: input.label,
      templateTier: input.tier,
      visualStyle: input.visualStyle,
      countryFormat: input.countryFormat,
      description: input.label,
    },
  };
}

function invoiceTitleForCountryFormat(countryFormat: SharedInvoiceCountryFormat): string {
  switch (countryFormat) {
    case 'india_gst':
      return 'Tax Invoice';
    case 'us_sales_tax':
      return 'Sales Invoice';
    case 'uk_vat':
      return 'VAT Invoice';
    default:
      return 'Invoice';
  }
}
