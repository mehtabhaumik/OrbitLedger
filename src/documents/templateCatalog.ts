import type { BusinessSettings, DocumentTemplateType } from '../database';
import { getDatabase } from '../database';
import type {
  DocumentTemplateConfig,
  DocumentTemplateKey,
  DocumentTemplateRuntime,
  DocumentTemplateTier,
  InvoiceCountryFormat,
  InvoiceTemplateKey,
  StatementTemplateKey,
} from './types';

type AppPreferenceRow = {
  key: string;
  value: string;
  updated_at: string;
};

export type DocumentTemplateCatalogItem = DocumentTemplateRuntime & {
  documentType: DocumentTemplateType;
  countryCode: 'IN' | 'US' | 'GB' | 'GENERIC';
  config: DocumentTemplateConfig;
};

const TEMPLATE_SELECTION_KEY_PREFIX = 'document_template_selection';

const invoiceCatalog: Record<InvoiceTemplateKey, DocumentTemplateCatalogItem> = {
  IN_GST_STANDARD_FREE: {
    key: 'IN_GST_STANDARD_FREE',
    documentType: 'invoice',
    countryCode: 'IN',
    tier: 'free',
    label: 'India GST Standard',
    description: 'Classic GST tax invoice with GSTIN, HSN/SAC, CGST/SGST/IGST and amount in words.',
    visualStyle: 'classic_tax',
    countryFormat: 'india_gst',
    config: invoiceConfig({
      title: 'Tax Invoice',
      key: 'IN_GST_STANDARD_FREE',
      label: 'India GST Standard',
      tier: 'free',
      visualStyle: 'classic_tax',
      countryFormat: 'india_gst',
      locale: 'en-IN',
      taxLabel: 'GST',
      taxRegistrationLabel: 'GSTIN',
      columns: [
        { key: 'name', label: 'Description', align: 'left' },
        { key: 'hsnSac', label: 'HSN/SAC', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Rate', align: 'right' },
        { key: 'taxableValue', label: 'Taxable value', align: 'right' },
        { key: 'taxRate', label: 'GST', align: 'right' },
        { key: 'cgst', label: 'CGST', align: 'right' },
        { key: 'sgst', label: 'SGST', align: 'right' },
        { key: 'igst', label: 'IGST', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
  IN_GST_LETTERHEAD_PRO: {
    key: 'IN_GST_LETTERHEAD_PRO',
    documentType: 'invoice',
    countryCode: 'IN',
    tier: 'pro',
    label: 'India GST Letterhead',
    description: 'Premium GST letterhead with branding, GSTIN focus, signature and polished totals.',
    visualStyle: 'premium_letterhead',
    countryFormat: 'india_gst',
    config: invoiceConfig({
      title: 'Tax Invoice',
      key: 'IN_GST_LETTERHEAD_PRO',
      label: 'India GST Letterhead',
      tier: 'pro',
      visualStyle: 'premium_letterhead',
      countryFormat: 'india_gst',
      locale: 'en-IN',
      taxLabel: 'GST',
      taxRegistrationLabel: 'GSTIN',
      columns: [
        { key: 'name', label: 'Item / Service', align: 'left' },
        { key: 'hsnSac', label: 'HSN/SAC', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'taxableValue', label: 'Taxable', align: 'right' },
        { key: 'taxRate', label: 'GST', align: 'right' },
        { key: 'cgst', label: 'CGST', align: 'right' },
        { key: 'sgst', label: 'SGST', align: 'right' },
        { key: 'igst', label: 'IGST', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
  US_SALES_STANDARD_FREE: {
    key: 'US_SALES_STANDARD_FREE',
    documentType: 'invoice',
    countryCode: 'US',
    tier: 'free',
    label: 'US Sales Standard',
    description: 'Modern sales invoice with taxable subtotal, sales tax and item descriptions.',
    visualStyle: 'modern_minimal',
    countryFormat: 'us_sales_tax',
    config: invoiceConfig({
      title: 'Sales Invoice',
      key: 'US_SALES_STANDARD_FREE',
      label: 'US Sales Standard',
      tier: 'free',
      visualStyle: 'modern_minimal',
      countryFormat: 'us_sales_tax',
      locale: 'en-US',
      taxLabel: 'Sales tax',
      taxRegistrationLabel: 'Seller permit',
      columns: [
        { key: 'name', label: 'Description', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Unit price', align: 'right' },
        { key: 'taxableValue', label: 'Taxable amount', align: 'right' },
        { key: 'taxRate', label: 'Sales tax', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
  US_SALES_PRO: {
    key: 'US_SALES_PRO',
    documentType: 'invoice',
    countryCode: 'US',
    tier: 'pro',
    label: 'US Sales Pro',
    description: 'Premium sales invoice with branding, seller permit field and strong totals panel.',
    visualStyle: 'premium_letterhead',
    countryFormat: 'us_sales_tax',
    config: invoiceConfig({
      title: 'Sales Invoice',
      key: 'US_SALES_PRO',
      label: 'US Sales Pro',
      tier: 'pro',
      visualStyle: 'premium_letterhead',
      countryFormat: 'us_sales_tax',
      locale: 'en-US',
      taxLabel: 'Sales tax',
      taxRegistrationLabel: 'Seller permit',
      columns: [
        { key: 'name', label: 'Item / Service', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Rate', align: 'right' },
        { key: 'taxAmount', label: 'Sales tax', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
  UK_VAT_STANDARD_FREE: {
    key: 'UK_VAT_STANDARD_FREE',
    documentType: 'invoice',
    countryCode: 'GB',
    tier: 'free',
    label: 'UK VAT Standard',
    description: 'Full VAT invoice structure with VAT number, tax point and net/VAT/gross totals.',
    visualStyle: 'classic_tax',
    countryFormat: 'uk_vat',
    config: invoiceConfig({
      title: 'VAT Invoice',
      key: 'UK_VAT_STANDARD_FREE',
      label: 'UK VAT Standard',
      tier: 'free',
      visualStyle: 'classic_tax',
      countryFormat: 'uk_vat',
      locale: 'en-GB',
      taxLabel: 'VAT',
      taxRegistrationLabel: 'VAT reg no.',
      columns: [
        { key: 'name', label: 'Description', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Unit price', align: 'right' },
        { key: 'taxableValue', label: 'Net', align: 'right' },
        { key: 'taxRate', label: 'VAT', align: 'right' },
        { key: 'taxAmount', label: 'VAT amount', align: 'right' },
        { key: 'total', label: 'Gross', align: 'right' },
      ],
    }),
  },
  UK_VAT_LETTERHEAD_PRO: {
    key: 'UK_VAT_LETTERHEAD_PRO',
    documentType: 'invoice',
    countryCode: 'GB',
    tier: 'pro',
    label: 'UK VAT Letterhead',
    description: 'Premium UK VAT invoice with logo, VAT number highlight, signature and refined totals.',
    visualStyle: 'premium_letterhead',
    countryFormat: 'uk_vat',
    config: invoiceConfig({
      title: 'VAT Invoice',
      key: 'UK_VAT_LETTERHEAD_PRO',
      label: 'UK VAT Letterhead',
      tier: 'pro',
      visualStyle: 'premium_letterhead',
      countryFormat: 'uk_vat',
      locale: 'en-GB',
      taxLabel: 'VAT',
      taxRegistrationLabel: 'VAT reg no.',
      columns: [
        { key: 'name', label: 'Item / Service', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'taxableValue', label: 'Net', align: 'right' },
        { key: 'taxRate', label: 'VAT', align: 'right' },
        { key: 'taxAmount', label: 'VAT', align: 'right' },
        { key: 'total', label: 'Gross', align: 'right' },
      ],
    }),
  },
  GENERIC_INVOICE_STANDARD_FREE: {
    key: 'GENERIC_INVOICE_STANDARD_FREE',
    documentType: 'invoice',
    countryCode: 'GENERIC',
    tier: 'free',
    label: 'Standard Invoice',
    description: 'Clean general invoice for countries without a specific local template yet.',
    visualStyle: 'modern_minimal',
    countryFormat: 'generic_tax',
    config: invoiceConfig({
      title: 'Invoice',
      key: 'GENERIC_INVOICE_STANDARD_FREE',
      label: 'Standard Invoice',
      tier: 'free',
      visualStyle: 'modern_minimal',
      countryFormat: 'generic_tax',
      taxLabel: 'Tax',
      taxRegistrationLabel: 'Tax ID',
      columns: [
        { key: 'name', label: 'Description', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Price', align: 'right' },
        { key: 'taxRate', label: 'Tax', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
  GENERIC_INVOICE_LETTERHEAD_PRO: {
    key: 'GENERIC_INVOICE_LETTERHEAD_PRO',
    documentType: 'invoice',
    countryCode: 'GENERIC',
    tier: 'pro',
    label: 'Premium Letterhead',
    description: 'Premium general invoice with richer branding and signature treatment.',
    visualStyle: 'premium_letterhead',
    countryFormat: 'generic_tax',
    config: invoiceConfig({
      title: 'Invoice',
      key: 'GENERIC_INVOICE_LETTERHEAD_PRO',
      label: 'Premium Letterhead',
      tier: 'pro',
      visualStyle: 'premium_letterhead',
      countryFormat: 'generic_tax',
      taxLabel: 'Tax',
      taxRegistrationLabel: 'Tax ID',
      columns: [
        { key: 'name', label: 'Item / Service', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'taxableValue', label: 'Taxable', align: 'right' },
        { key: 'taxAmount', label: 'Tax', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    }),
  },
};

const statementCatalog: Record<StatementTemplateKey, DocumentTemplateCatalogItem> = {
  IN_STATEMENT_STANDARD_FREE: statementItem('IN_STATEMENT_STANDARD_FREE', 'IN', 'free', 'India Statement Standard', 'Balance-forward customer statement for Indian ledger dues.', 'en-IN'),
  IN_STATEMENT_LETTERHEAD_PRO: statementItem('IN_STATEMENT_LETTERHEAD_PRO', 'IN', 'pro', 'India Statement Letterhead', 'Premium branded statement with stronger account summary and signature.', 'en-IN'),
  US_STATEMENT_STANDARD_FREE: statementItem('US_STATEMENT_STANDARD_FREE', 'US', 'free', 'US Statement Standard', 'Balance-forward statement for US customers and payments.', 'en-US'),
  US_STATEMENT_LETTERHEAD_PRO: statementItem('US_STATEMENT_LETTERHEAD_PRO', 'US', 'pro', 'US Statement Letterhead', 'Premium branded US customer statement.', 'en-US'),
  UK_STATEMENT_STANDARD_FREE: statementItem('UK_STATEMENT_STANDARD_FREE', 'GB', 'free', 'UK Statement Standard', 'Balance-forward statement for UK accounts.', 'en-GB'),
  UK_STATEMENT_LETTERHEAD_PRO: statementItem('UK_STATEMENT_LETTERHEAD_PRO', 'GB', 'pro', 'UK Statement Letterhead', 'Premium branded UK statement with professional account summary.', 'en-GB'),
  GENERIC_STATEMENT_STANDARD_FREE: statementItem('GENERIC_STATEMENT_STANDARD_FREE', 'GENERIC', 'free', 'Statement Standard', 'Clean balance-forward customer statement.', undefined),
  GENERIC_STATEMENT_LETTERHEAD_PRO: statementItem('GENERIC_STATEMENT_LETTERHEAD_PRO', 'GENERIC', 'pro', 'Statement Letterhead', 'Premium branded customer statement.', undefined),
};

export function getBuiltInDocumentTemplateCatalog(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType
): DocumentTemplateCatalogItem[] {
  const countryCode = normalizeSupportedCountry(businessSettings.countryCode);
  const catalog = templateType === 'invoice' ? Object.values(invoiceCatalog) : Object.values(statementCatalog);
  const countryItems = catalog.filter((template) => template.countryCode === countryCode);
  const fallbackItems = catalog.filter((template) => template.countryCode === 'GENERIC');

  return countryItems.length ? countryItems : fallbackItems;
}

export function getBuiltInDocumentTemplate(
  key: DocumentTemplateKey
): DocumentTemplateCatalogItem | null {
  return invoiceCatalog[key as InvoiceTemplateKey] ?? statementCatalog[key as StatementTemplateKey] ?? null;
}

export async function getPreferredDocumentTemplateKey(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType,
  isPro: boolean
): Promise<DocumentTemplateKey> {
  const stored = await getPreference(buildTemplateSelectionKey(businessSettings, templateType));
  const catalog = getBuiltInDocumentTemplateCatalog(businessSettings, templateType);
  const storedItem = stored ? catalog.find((item) => item.key === stored) : null;
  if (storedItem && canUseTemplate(storedItem, isPro)) {
    return storedItem.key;
  }

  return getDefaultDocumentTemplate(businessSettings, templateType, isPro).key;
}

export async function savePreferredDocumentTemplateKey(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType,
  key: DocumentTemplateKey
): Promise<void> {
  await setPreference(buildTemplateSelectionKey(businessSettings, templateType), key);
}

export function getDefaultDocumentTemplate(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType,
  isPro: boolean
): DocumentTemplateCatalogItem {
  const catalog = getBuiltInDocumentTemplateCatalog(businessSettings, templateType);
  const targetTier: DocumentTemplateTier = isPro ? 'pro' : 'free';
  return catalog.find((template) => template.tier === targetTier) ?? catalog[0];
}

export function canUseTemplate(template: DocumentTemplateCatalogItem, isPro: boolean): boolean {
  return template.tier === 'free' || isPro;
}

function invoiceConfig(input: {
  title: string;
  key: InvoiceTemplateKey;
  label: string;
  tier: DocumentTemplateTier;
  visualStyle: DocumentTemplateRuntime['visualStyle'];
  countryFormat: InvoiceCountryFormat;
  locale?: string;
  taxLabel: string;
  taxRegistrationLabel: string;
  columns: NonNullable<DocumentTemplateConfig['tableColumns']>['invoice_item_table'];
}): DocumentTemplateConfig {
  return {
    layoutVersion: 2,
    title: input.title,
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

function statementItem(
  key: StatementTemplateKey,
  countryCode: DocumentTemplateCatalogItem['countryCode'],
  tier: DocumentTemplateTier,
  label: string,
  description: string,
  locale?: string
): DocumentTemplateCatalogItem {
  const visualStyle = tier === 'pro' ? 'account_letterhead' : 'balance_forward';
  return {
    key,
    documentType: 'statement',
    countryCode,
    tier,
    label,
    description,
    visualStyle,
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
        transaction_table: [
          { key: 'date', label: 'Date', align: 'left' },
          { key: 'description', label: 'Details', align: 'left' },
          { key: 'credit', label: 'Credit / Charges', align: 'right' },
          { key: 'payment', label: 'Payments', align: 'right' },
          { key: 'runningBalance', label: 'Balance', align: 'right' },
        ],
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

function normalizeSupportedCountry(countryCode: string): DocumentTemplateCatalogItem['countryCode'] {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN' || normalized === 'US' || normalized === 'GB') {
    return normalized;
  }
  return 'GENERIC';
}

function buildTemplateSelectionKey(
  businessSettings: BusinessSettings,
  templateType: DocumentTemplateType
): string {
  return `${TEMPLATE_SELECTION_KEY_PREFIX}:${businessSettings.countryCode.trim().toUpperCase()}:${templateType}`;
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT * FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}
