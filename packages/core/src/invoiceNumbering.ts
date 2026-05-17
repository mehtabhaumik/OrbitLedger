export type InvoiceNumberCountryCode = 'IN' | 'US' | 'GB' | 'CA' | 'AU' | string;

export type InvoiceNumberFormatStyle =
  | 'smart_company_fy_sequence'
  | 'custom_prefix_year_sequence';

export type InvoiceNumberSeparator = '/' | '-';

export type InvoiceNumberSettings = {
  style?: InvoiceNumberFormatStyle | null;
  customPrefix?: string | null;
  separator?: InvoiceNumberSeparator | null;
  sequencePadding?: number | null;
  financialYearStartMonth?: number | null;
  maxLength?: number | null;
};

export type InvoiceNumberCountryRules = {
  countryCode: string;
  separator: InvoiceNumberSeparator;
  sequencePadding: number;
  maxLength: number;
  financialYearStartMonth: number;
  yearBasis: 'financial_year_start' | 'calendar_year';
};

export type SmartInvoiceNumberInput = {
  businessName: string;
  workspaceId: string;
  issueDate: string;
  sequenceNumber: number;
  countryCode?: InvoiceNumberCountryCode | null;
  settings?: InvoiceNumberSettings | null;
};

export type SmartInvoiceNumberResult = {
  invoiceNumber: string;
  companyCode: string;
  yearCode: string;
  fiscalYear: string;
  sequenceNumber: number;
  countryCode: string;
  separator: InvoiceNumberSeparator;
  formatStyle: InvoiceNumberFormatStyle;
};

export type InvoiceNumberMigrationRecord = {
  id: string;
  invoiceNumber?: string | null;
  invoiceNumberKey?: string | null;
  documentState?: string | null;
  status?: string | null;
  isArchived?: boolean | null;
};

export type InvoiceNumberDuplicateGroup = {
  invoiceNumberKey: string;
  invoiceNumber: string;
  invoiceIds: string[];
};

export type InvoiceNumberMigrationPlan = {
  totalInvoices: number;
  missingKeyInvoiceIds: string[];
  duplicateGroups: InvoiceNumberDuplicateGroup[];
};

const DEFAULT_RULES: InvoiceNumberCountryRules = {
  countryCode: 'GENERIC',
  separator: '/',
  sequencePadding: 4,
  maxLength: 24,
  financialYearStartMonth: 1,
  yearBasis: 'calendar_year',
};

const COUNTRY_RULES: Record<string, InvoiceNumberCountryRules> = {
  IN: {
    countryCode: 'IN',
    separator: '/',
    sequencePadding: 4,
    maxLength: 16,
    financialYearStartMonth: 4,
    yearBasis: 'financial_year_start',
  },
  GB: {
    countryCode: 'GB',
    separator: '/',
    sequencePadding: 4,
    maxLength: 24,
    financialYearStartMonth: 4,
    yearBasis: 'financial_year_start',
  },
  AU: {
    countryCode: 'AU',
    separator: '/',
    sequencePadding: 4,
    maxLength: 24,
    financialYearStartMonth: 7,
    yearBasis: 'financial_year_start',
  },
  US: {
    countryCode: 'US',
    separator: '/',
    sequencePadding: 4,
    maxLength: 24,
    financialYearStartMonth: 1,
    yearBasis: 'calendar_year',
  },
  CA: {
    countryCode: 'CA',
    separator: '/',
    sequencePadding: 4,
    maxLength: 24,
    financialYearStartMonth: 1,
    yearBasis: 'calendar_year',
  },
};

export function getInvoiceNumberCountryRules(countryCode?: InvoiceNumberCountryCode | null): InvoiceNumberCountryRules {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  return COUNTRY_RULES[normalizedCountryCode] ?? {
    ...DEFAULT_RULES,
    countryCode: normalizedCountryCode,
  };
}

export function buildSmartInvoiceNumber(input: SmartInvoiceNumberInput): SmartInvoiceNumberResult {
  const countryRules = getInvoiceNumberCountryRules(input.countryCode);
  const separator = normalizeSeparator(input.settings?.separator) ?? countryRules.separator;
  const sequencePadding = clampInteger(input.settings?.sequencePadding, 3, 8, countryRules.sequencePadding);
  const maxLength = clampInteger(input.settings?.maxLength, 8, 40, countryRules.maxLength);
  const financialYearStartMonth = clampInteger(
    input.settings?.financialYearStartMonth,
    1,
    12,
    countryRules.financialYearStartMonth
  );
  const sequenceNumber = Math.max(1, Math.floor(Number(input.sequenceNumber) || 1));
  const customPrefix = normalizeInvoicePrefix(input.settings?.customPrefix);
  const formatStyle: InvoiceNumberFormatStyle = customPrefix
    ? 'custom_prefix_year_sequence'
    : 'smart_company_fy_sequence';
  const companyCode = customPrefix ?? buildCompanyInvoiceCode(input.businessName, input.workspaceId);
  const yearInfo = buildInvoiceYearInfo(
    input.issueDate,
    countryRules.yearBasis,
    financialYearStartMonth
  );
  const sequenceCode = String(sequenceNumber).padStart(sequencePadding, '0');
  let invoiceNumber = [companyCode, yearInfo.yearCode, sequenceCode].join(separator);

  if (invoiceNumber.length > maxLength) {
    const allowedPrefixLength = Math.max(2, maxLength - yearInfo.yearCode.length - sequenceCode.length - 2);
    invoiceNumber = [companyCode.slice(0, allowedPrefixLength), yearInfo.yearCode, sequenceCode].join(separator);
  }

  return {
    invoiceNumber,
    companyCode,
    yearCode: yearInfo.yearCode,
    fiscalYear: yearInfo.fiscalYear,
    sequenceNumber,
    countryCode: countryRules.countryCode,
    separator,
    formatStyle,
  };
}

export function buildCompanyInvoiceCode(
  businessName: string,
  workspaceId: string,
  maxLetters = 3
): string {
  const words = businessName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const compactName = words.join('');
  const letters =
    words.length >= 2
      ? words.map((word) => word[0]).join('').slice(0, maxLetters)
      : compactName.slice(0, maxLetters);
  const fallbackLetters = letters || 'INV';
  const hash = stableBase36Hash(`${workspaceId}:${compactName || businessName}`).slice(0, 2);
  return `${fallbackLetters}${hash}`.slice(0, Math.max(4, maxLetters + 2));
}

export function normalizeInvoicePrefix(value?: string | null): string | null {
  const cleaned = value
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (!cleaned || cleaned === 'AUTO') {
    return null;
  }
  return cleaned;
}

export function normalizeInvoiceNumberKey(value?: string | null): string {
  return (value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

export function buildInvoiceNumberMigrationPlan(
  records: InvoiceNumberMigrationRecord[]
): InvoiceNumberMigrationPlan {
  const activeRecords = records.filter((record) => {
    const state = (record.documentState ?? record.status ?? '').trim().toLowerCase();
    return state !== 'cancelled';
  });
  const missingKeyInvoiceIds = activeRecords
    .filter((record) => {
      const invoiceNumber = normalizeInvoiceNumberKey(record.invoiceNumber);
      return invoiceNumber && record.invoiceNumberKey !== invoiceNumber;
    })
    .map((record) => record.id);
  const groups = new Map<string, { invoiceNumber: string; invoiceIds: string[] }>();

  for (const record of activeRecords) {
    const key = normalizeInvoiceNumberKey(record.invoiceNumberKey || record.invoiceNumber);
    if (!key) {
      continue;
    }
    const existing = groups.get(key) ?? {
      invoiceNumber: record.invoiceNumber?.trim() || key,
      invoiceIds: [],
    };
    existing.invoiceIds.push(record.id);
    groups.set(key, existing);
  }

  return {
    totalInvoices: records.length,
    missingKeyInvoiceIds,
    duplicateGroups: Array.from(groups.entries())
      .filter(([, group]) => group.invoiceIds.length > 1)
      .map(([invoiceNumberKey, group]) => ({
        invoiceNumberKey,
        invoiceNumber: group.invoiceNumber,
        invoiceIds: group.invoiceIds,
      })),
  };
}

function buildInvoiceYearInfo(
  issueDate: string,
  yearBasis: InvoiceNumberCountryRules['yearBasis'],
  financialYearStartMonth: number
) {
  const date = parseInvoiceDate(issueDate);
  const calendarYear = date.getUTCFullYear();
  const financialYearStart =
    date.getUTCMonth() + 1 >= financialYearStartMonth ? calendarYear : calendarYear - 1;
  const basisYear = yearBasis === 'financial_year_start' ? financialYearStart : calendarYear;
  return {
    yearCode: String(basisYear % 100).padStart(2, '0'),
    fiscalYear:
      yearBasis === 'financial_year_start'
        ? `${financialYearStart}-${financialYearStart + 1}`
        : `${calendarYear}`,
  };
}

function parseInvoiceDate(issueDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issueDate);
  if (!match) {
    return new Date();
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function normalizeCountryCode(countryCode?: InvoiceNumberCountryCode | null): string {
  const normalized = countryCode?.trim().toUpperCase() || 'IN';
  return normalized === 'UK' ? 'GB' : normalized;
}

function normalizeSeparator(value?: string | null): InvoiceNumberSeparator | null {
  return value === '-' || value === '/' ? value : null;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(numberValue)));
}

function stableBase36Hash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(2, '0');
}
