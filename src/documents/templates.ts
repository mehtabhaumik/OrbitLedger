import type { BusinessSettings, DocumentTemplate, DocumentTemplateType } from '../database';
import { getDocumentTemplate } from '../database';
import { mapBusinessToDocumentTemplateLookup } from '../mapping';
import type {
  DocumentLayout,
  DocumentLayoutNode,
  DocumentLayoutRole,
  DocumentTableColumn,
  DocumentTableRole,
  DocumentTemplateConfig,
} from './types';

const sectionRoles: DocumentLayoutRole[] = [
  'business_identity',
  'customer_identity',
  'statement_metadata',
  'invoice_metadata',
  'transaction_table',
  'invoice_item_table',
  'summary',
  'invoice_summary',
  'tax_placeholder',
  'footer',
];

const tableRoles: DocumentTableRole[] = ['transaction_table', 'invoice_item_table'];

export async function loadDocumentTemplateForBusiness(
  businessProfile: BusinessSettings,
  templateType: DocumentTemplateType
): Promise<DocumentTemplate | null> {
  return getDocumentTemplate(mapBusinessToDocumentTemplateLookup(businessProfile, templateType));
}

export function applyDocumentTemplate(
  layout: DocumentLayout,
  template: DocumentTemplate | DocumentTemplateConfig | null | undefined
): DocumentLayout {
  const config = parseDocumentTemplateConfig(template);
  if (!config) {
    return layout;
  }

  const sections = applySectionOrder(
    layout.sections
      .filter((section) => !config.hiddenRoles?.includes(section.role))
      .map((section) => applyNodeTemplate(section, config)),
    config.sectionOrder
  );

  return {
    ...layout,
    title: cleanString(config.title) ?? layout.title,
    version:
      typeof config.layoutVersion === 'number' && Number.isFinite(config.layoutVersion)
        ? config.layoutVersion
        : layout.version,
    page: {
      size: config.page?.size === 'A4' ? config.page.size : layout.page.size,
      orientation:
        config.page?.orientation === 'portrait' ? config.page.orientation : layout.page.orientation,
      margin:
        config.page?.margin === 'compact' || config.page?.margin === 'standard'
          ? config.page.margin
          : layout.page.margin,
    },
    sections,
  };
}

export function parseDocumentTemplateConfig(
  template: DocumentTemplate | DocumentTemplateConfig | null | undefined
): DocumentTemplateConfig | null {
  if (!template) {
    return null;
  }

  const rawConfig = isDocumentTemplateRecord(template)
    ? parseStoredConfig(template.templateConfigJson)
    : template;

  if (!isRecord(rawConfig)) {
    return null;
  }

  return normalizeDocumentTemplateConfig(rawConfig);
}

function applyNodeTemplate(
  section: DocumentLayoutNode,
  config: DocumentTemplateConfig
): DocumentLayoutNode {
  const sectionTitle = cleanString(config.sectionTitles?.[section.role]) ?? section.title;
  const taxTitle =
    section.role === 'tax_placeholder'
      ? cleanString(config.taxLabels?.taxSectionTitle) ?? sectionTitle
      : sectionTitle;

  if (section.type === 'section') {
    return {
      ...section,
      title: taxTitle,
    };
  }

  const configuredColumns = tableRoles.includes(section.role)
    ? config.tableColumns?.[section.role]
    : undefined;
  const columns = sanitizeColumns(configuredColumns, section.columns);

  return {
    ...section,
    title: taxTitle ?? section.title,
    columns: applyTaxColumnLabel(section.role, columns, config),
  };
}

function applyTaxColumnLabel(
  role: DocumentTableRole,
  columns: DocumentTableColumn[],
  config: DocumentTemplateConfig
): DocumentTableColumn[] {
  const taxColumnLabel = cleanString(config.taxLabels?.taxColumnLabel);
  if (role !== 'invoice_item_table' || !taxColumnLabel) {
    return columns;
  }

  return columns.map((column) =>
    column.key === 'taxRate'
      ? {
          ...column,
          label: taxColumnLabel,
        }
      : column
  );
}

function sanitizeColumns(
  configuredColumns: DocumentTableColumn[] | undefined,
  fallbackColumns: DocumentTableColumn[]
): DocumentTableColumn[] {
  if (!configuredColumns?.length) {
    return fallbackColumns;
  }

  const cleanedColumns = configuredColumns
    .filter((column) => isDocumentColumnKey(column.key))
    .map((column): DocumentTableColumn => {
      const align: DocumentTableColumn['align'] = column.align === 'right' ? 'right' : 'left';

      return {
        key: column.key,
        label: cleanString(column.label) ?? String(column.key),
        align,
      };
    });

  return cleanedColumns.length ? cleanedColumns : fallbackColumns;
}

function applySectionOrder(
  sections: DocumentLayoutNode[],
  requestedOrder: DocumentLayoutRole[] | undefined
): DocumentLayoutNode[] {
  const order = requestedOrder?.filter((role) => sectionRoles.includes(role)) ?? [];
  if (!order.length) {
    return sections;
  }

  const rank = new Map(order.map((role, index) => [role, index]));
  return [...sections].sort((first, second) => {
    const firstRank = rank.get(first.role) ?? Number.MAX_SAFE_INTEGER;
    const secondRank = rank.get(second.role) ?? Number.MAX_SAFE_INTEGER;

    if (firstRank !== secondRank) {
      return firstRank - secondRank;
    }

    return sections.indexOf(first) - sections.indexOf(second);
  });
}

function normalizeDocumentTemplateConfig(raw: Record<string, unknown>): DocumentTemplateConfig {
  const config: DocumentTemplateConfig = {};

  const title = cleanString(raw.title);
  if (title) {
    config.title = title;
  }

  if (typeof raw.layoutVersion === 'number' && Number.isFinite(raw.layoutVersion)) {
    config.layoutVersion = raw.layoutVersion;
  }

  if (isRecord(raw.page)) {
    config.page = {
      size: raw.page.size === 'A4' ? 'A4' : undefined,
      orientation: raw.page.orientation === 'portrait' ? 'portrait' : undefined,
      margin:
        raw.page.margin === 'compact' || raw.page.margin === 'standard'
          ? raw.page.margin
          : undefined,
    };
  }

  if (isRecord(raw.sectionTitles)) {
    config.sectionTitles = normalizeRoleStringMap(raw.sectionTitles);
  }

  if (isRecord(raw.tableColumns)) {
    config.tableColumns = normalizeTableColumns(raw.tableColumns);
  }

  if (Array.isArray(raw.hiddenRoles)) {
    config.hiddenRoles = raw.hiddenRoles.filter(isDocumentLayoutRole);
  }

  if (Array.isArray(raw.sectionOrder)) {
    config.sectionOrder = raw.sectionOrder.filter(isDocumentLayoutRole);
  }

  if (isRecord(raw.taxLabels)) {
    config.taxLabels = {
      taxSectionTitle: cleanString(raw.taxLabels.taxSectionTitle),
      taxBreakdownTitle: cleanString(raw.taxLabels.taxBreakdownTitle),
      taxColumnLabel: cleanString(raw.taxLabels.taxColumnLabel),
      taxSummaryLabel: cleanString(raw.taxLabels.taxSummaryLabel),
      taxRegistrationLabel: cleanString(raw.taxLabels.taxRegistrationLabel),
    };
  }

  applyLegacyLabels(raw, config);

  if (isRecord(raw.numberFormat)) {
    const currencyDisplay = raw.numberFormat.currencyDisplay;
    config.numberFormat = {
      locale: cleanString(raw.numberFormat.locale),
      currencyDisplay:
        currencyDisplay === 'symbol' ||
        currencyDisplay === 'narrowSymbol' ||
        currencyDisplay === 'code' ||
        currencyDisplay === 'name'
          ? currencyDisplay
          : undefined,
    };
  }

  if (isRecord(raw.metadata)) {
    config.metadata = raw.metadata;
  }

  return config;
}

function applyLegacyLabels(raw: Record<string, unknown>, config: DocumentTemplateConfig): void {
  if (!isRecord(raw.labels)) {
    return;
  }

  const templateType = cleanString(raw.template);
  if (templateType === 'invoice') {
    const taxLabel = cleanString(raw.labels.tax);
    if (taxLabel) {
      config.taxLabels = {
        ...config.taxLabels,
        taxColumnLabel: config.taxLabels?.taxColumnLabel ?? taxLabel,
        taxSummaryLabel: config.taxLabels?.taxSummaryLabel ?? taxLabel,
      };
      config.tableColumns = {
        ...config.tableColumns,
        invoice_item_table: config.tableColumns?.invoice_item_table ?? [
          { key: 'name', label: 'Item', align: 'left' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'taxRate', label: taxLabel, align: 'right' },
          { key: 'total', label: cleanString(raw.labels.total) ?? 'Total', align: 'right' },
        ],
      };
    }
  }

  if (templateType === 'statement') {
    const creditLabel = cleanString(raw.labels.credit);
    const paymentLabel = cleanString(raw.labels.payment);
    const balanceLabel = cleanString(raw.labels.balance);
    if (creditLabel || paymentLabel || balanceLabel) {
      config.tableColumns = {
        ...config.tableColumns,
        transaction_table: config.tableColumns?.transaction_table ?? [
          { key: 'date', label: 'Date', align: 'left' },
          { key: 'description', label: 'Description', align: 'left' },
          { key: 'credit', label: creditLabel ?? 'Credit', align: 'right' },
          { key: 'payment', label: paymentLabel ?? 'Payment', align: 'right' },
          { key: 'runningBalance', label: balanceLabel ?? 'Running Balance', align: 'right' },
        ],
      };
    }
  }
}

function normalizeRoleStringMap(value: Record<string, unknown>): DocumentTemplateConfig['sectionTitles'] {
  const titles: NonNullable<DocumentTemplateConfig['sectionTitles']> = {};

  for (const [role, title] of Object.entries(value)) {
    if (isDocumentLayoutRole(role)) {
      const cleanedTitle = cleanString(title);
      if (cleanedTitle) {
        titles[role] = cleanedTitle;
      }
    }
  }

  return titles;
}

function normalizeTableColumns(value: Record<string, unknown>): DocumentTemplateConfig['tableColumns'] {
  const tables: NonNullable<DocumentTemplateConfig['tableColumns']> = {};

  for (const [role, columns] of Object.entries(value)) {
    if (!isDocumentTableRole(role) || !Array.isArray(columns)) {
      continue;
    }

    const normalizedColumns = columns
      .filter(isRecord)
      .map((column) => {
        const key = typeof column.key === 'string' ? column.key : '';
        const label = cleanString(column.label);

        if (!key || !label || !isDocumentColumnKey(key)) {
          return null;
        }

        const align: DocumentTableColumn['align'] = column.align === 'right' ? 'right' : 'left';
        return {
          key: key as DocumentTableColumn['key'],
          label,
          align,
        };
      })
      .filter((column): column is DocumentTableColumn => column !== null);

    if (normalizedColumns.length) {
      tables[role] = normalizedColumns;
    }
  }

  return tables;
}

function isDocumentColumnKey(value: unknown): value is DocumentTableColumn['key'] {
  return (
    typeof value === 'string' &&
    [
      'transactionId',
      'date',
      'description',
      'type',
      'credit',
      'payment',
      'runningBalance',
      'itemId',
      'name',
      'quantity',
      'price',
      'taxRate',
      'hsnSac',
      'taxableValue',
      'taxAmount',
      'cgst',
      'sgst',
      'igst',
      'total',
    ].includes(value)
  );
}

function isDocumentTemplateRecord(value: unknown): value is DocumentTemplate {
  return isRecord(value) && typeof value.templateConfigJson === 'string';
}

function parseStoredConfig(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isDocumentLayoutRole(value: unknown): value is DocumentLayoutRole {
  return typeof value === 'string' && sectionRoles.includes(value as DocumentLayoutRole);
}

function isDocumentTableRole(value: unknown): value is DocumentTableRole {
  return typeof value === 'string' && tableRoles.includes(value as DocumentTableRole);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
