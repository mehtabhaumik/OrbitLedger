import type { CountryPackageWithComponents } from '../database';
import type {
  ComplianceNumberFormat,
  ComplianceReportLabels,
  ComplianceReportRules,
  ComplianceRuleContext,
} from './types';

const defaultLabels: ComplianceReportLabels = {
  taxName: 'Tax',
  taxRate: 'Tax rate',
  taxableSales: 'Taxable sales',
  taxAmount: 'Tax amount',
  totalAmount: 'Total amount',
  salesSummary: 'Sales summary',
  duesSummary: 'Dues summary',
};

const defaultNumberFormat: ComplianceNumberFormat = {
  locale: null,
  currencyDisplay: 'symbol',
  decimalPlaces: 2,
};

const defaultReportRules: ComplianceReportRules = {
  excludedInvoiceStatuses: ['cancelled'],
  topOutstandingCustomerLimit: 10,
};

type ParsedComplianceConfig = {
  labels?: Partial<ComplianceReportLabels>;
  numberFormat?: Partial<ComplianceNumberFormat>;
  reportRules?: Partial<ComplianceReportRules>;
};

export const defaultComplianceRuleContext: ComplianceRuleContext = {
  countryPackage: null,
  taxPack: null,
  complianceConfig: null,
  labels: defaultLabels,
  numberFormat: defaultNumberFormat,
  reportRules: defaultReportRules,
};

export function buildComplianceRuleContext(
  countryPackage: CountryPackageWithComponents | null
): ComplianceRuleContext {
  if (!countryPackage) {
    return defaultComplianceRuleContext;
  }

  const parsedConfig = parseComplianceConfig(countryPackage.complianceConfig.configJson);

  return {
    countryPackage: {
      id: countryPackage.id,
      version: countryPackage.version,
    },
    taxPack: {
      id: countryPackage.taxPack.id,
      version: countryPackage.taxPack.version,
      taxType: countryPackage.taxPack.taxType,
    },
    complianceConfig: {
      id: countryPackage.complianceConfig.id,
      version: countryPackage.complianceConfig.version,
    },
    labels: {
      ...defaultLabels,
      ...parsedConfig.labels,
    },
    numberFormat: {
      ...defaultNumberFormat,
      ...parsedConfig.numberFormat,
    },
    reportRules: {
      ...defaultReportRules,
      ...parsedConfig.reportRules,
    },
  };
}

function parseComplianceConfig(value: string): ParsedComplianceConfig {
  const parsed = parseJsonObject(value);
  if (!parsed) {
    return {};
  }

  return {
    labels: parseLabels(parsed.labels ?? parsed.taxLabels),
    numberFormat: parseNumberFormat(parsed.numberFormat),
    reportRules: parseReportRules(parsed.reports ?? parsed.reportRules),
  };
}

function parseLabels(value: unknown): Partial<ComplianceReportLabels> {
  if (!isRecord(value)) {
    return {};
  }

  return {
    taxName: cleanString(value.taxName) ?? cleanString(value.taxLabel),
    taxRate: cleanString(value.taxRate) ?? cleanString(value.taxRateLabel),
    taxableSales: cleanString(value.taxableSales) ?? cleanString(value.taxableSalesLabel),
    taxAmount: cleanString(value.taxAmount) ?? cleanString(value.taxAmountLabel),
    totalAmount: cleanString(value.totalAmount) ?? cleanString(value.totalAmountLabel),
    salesSummary: cleanString(value.salesSummary) ?? cleanString(value.salesSummaryTitle),
    duesSummary: cleanString(value.duesSummary) ?? cleanString(value.duesSummaryTitle),
  };
}

function parseNumberFormat(value: unknown): Partial<ComplianceNumberFormat> {
  if (!isRecord(value)) {
    return {};
  }

  const currencyDisplay = value.currencyDisplay;
  const decimalPlaces =
    typeof value.decimalPlaces === 'number' && Number.isFinite(value.decimalPlaces)
      ? Math.min(Math.max(Math.trunc(value.decimalPlaces), 0), 4)
      : undefined;

  return {
    locale: cleanString(value.locale) ?? null,
    currencyDisplay:
      currencyDisplay === 'symbol' ||
      currencyDisplay === 'narrowSymbol' ||
      currencyDisplay === 'code' ||
      currencyDisplay === 'name'
        ? currencyDisplay
        : undefined,
    decimalPlaces,
  };
}

function parseReportRules(value: unknown): Partial<ComplianceReportRules> {
  if (!isRecord(value)) {
    return {};
  }

  return {
    excludedInvoiceStatuses: parseStringList(value.excludedInvoiceStatuses),
    topOutstandingCustomerLimit:
      typeof value.topOutstandingCustomerLimit === 'number' &&
      Number.isFinite(value.topOutstandingCustomerLimit)
        ? Math.min(Math.max(Math.trunc(value.topOutstandingCustomerLimit), 1), 50)
        : undefined,
  };
}

function parseStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const cleaned = value
    .map((item) => cleanString(item))
    .filter((item): item is string => Boolean(item));

  return cleaned.length ? cleaned : undefined;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
