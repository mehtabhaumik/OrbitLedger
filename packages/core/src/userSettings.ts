export type OrbitLedgerDashboardView = 'daily_command' | 'classic_summary' | 'reports_first';
export type OrbitLedgerTableDensity = 'comfortable' | 'compact';
export type OrbitLedgerDateRangePreference =
  | 'this_month'
  | 'last_30_days'
  | 'this_quarter'
  | 'this_year';
export type OrbitLedgerCustomerFilterPreference = 'all' | 'due' | 'follow_up' | 'inactive';
export type OrbitLedgerInvoiceFilterPreference =
  | 'all'
  | 'created'
  | 'revised'
  | 'unpaid'
  | 'overdue'
  | 'paid';
export type OrbitLedgerExportFormatPreference = 'pdf' | 'csv' | 'both';

export type OrbitLedgerUserSettings = {
  dashboardView: OrbitLedgerDashboardView;
  tableDensity: OrbitLedgerTableDensity;
  rowsPerPage: number;
  defaultDateRange: OrbitLedgerDateRangePreference;
  defaultCustomerFilter: OrbitLedgerCustomerFilterPreference;
  defaultInvoiceFilter: OrbitLedgerInvoiceFilterPreference;
  balancePrivacyMode: boolean;
  largerText: boolean;
  reducedMotion: boolean;
  defaultExportFormat: OrbitLedgerExportFormatPreference;
  updatedAt: string | null;
};

export type OrbitLedgerUserSettingsStorageShape = Partial<{
  dashboardView: unknown;
  dashboard_view: unknown;
  tableDensity: unknown;
  table_density: unknown;
  rowsPerPage: unknown;
  rows_per_page: unknown;
  defaultDateRange: unknown;
  default_date_range: unknown;
  defaultCustomerFilter: unknown;
  default_customer_filter: unknown;
  defaultInvoiceFilter: unknown;
  default_invoice_filter: unknown;
  balancePrivacyMode: unknown;
  balance_privacy_mode: unknown;
  largerText: unknown;
  larger_text: unknown;
  reducedMotion: unknown;
  reduced_motion: unknown;
  defaultExportFormat: unknown;
  default_export_format: unknown;
  updatedAt: unknown;
  updated_at: unknown;
}>;

export const DEFAULT_ORBIT_LEDGER_USER_SETTINGS: OrbitLedgerUserSettings = {
  dashboardView: 'daily_command',
  tableDensity: 'comfortable',
  rowsPerPage: 25,
  defaultDateRange: 'this_month',
  defaultCustomerFilter: 'all',
  defaultInvoiceFilter: 'all',
  balancePrivacyMode: false,
  largerText: false,
  reducedMotion: false,
  defaultExportFormat: 'pdf',
  updatedAt: null,
};

export function normalizeOrbitLedgerUserSettings(
  input: OrbitLedgerUserSettingsStorageShape | null | undefined
): OrbitLedgerUserSettings {
  const raw = input ?? {};
  return {
    dashboardView: normalizeChoice(
      raw.dashboardView ?? raw.dashboard_view,
      ['daily_command', 'classic_summary', 'reports_first'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.dashboardView
    ),
    tableDensity: normalizeChoice(
      raw.tableDensity ?? raw.table_density,
      ['comfortable', 'compact'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.tableDensity
    ),
    rowsPerPage: normalizeRowsPerPage(raw.rowsPerPage ?? raw.rows_per_page),
    defaultDateRange: normalizeChoice(
      raw.defaultDateRange ?? raw.default_date_range,
      ['this_month', 'last_30_days', 'this_quarter', 'this_year'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.defaultDateRange
    ),
    defaultCustomerFilter: normalizeChoice(
      raw.defaultCustomerFilter ?? raw.default_customer_filter,
      ['all', 'due', 'follow_up', 'inactive'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.defaultCustomerFilter
    ),
    defaultInvoiceFilter: normalizeChoice(
      raw.defaultInvoiceFilter ?? raw.default_invoice_filter,
      ['all', 'created', 'revised', 'unpaid', 'overdue', 'paid'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.defaultInvoiceFilter
    ),
    balancePrivacyMode: normalizeBoolean(raw.balancePrivacyMode ?? raw.balance_privacy_mode),
    largerText: normalizeBoolean(raw.largerText ?? raw.larger_text),
    reducedMotion: normalizeBoolean(raw.reducedMotion ?? raw.reduced_motion),
    defaultExportFormat: normalizeChoice(
      raw.defaultExportFormat ?? raw.default_export_format,
      ['pdf', 'csv', 'both'],
      DEFAULT_ORBIT_LEDGER_USER_SETTINGS.defaultExportFormat
    ),
    updatedAt: normalizeUpdatedAt(raw.updatedAt ?? raw.updated_at),
  };
}

export function serializeOrbitLedgerUserSettings(settings: OrbitLedgerUserSettings) {
  const normalized = normalizeOrbitLedgerUserSettings(settings);
  return {
    dashboard_view: normalized.dashboardView,
    table_density: normalized.tableDensity,
    rows_per_page: normalized.rowsPerPage,
    default_date_range: normalized.defaultDateRange,
    default_customer_filter: normalized.defaultCustomerFilter,
    default_invoice_filter: normalized.defaultInvoiceFilter,
    balance_privacy_mode: normalized.balancePrivacyMode,
    larger_text: normalized.largerText,
    reduced_motion: normalized.reducedMotion,
    default_export_format: normalized.defaultExportFormat,
  };
}

function normalizeChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeRowsPerPage(value: unknown) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 25;
  if ([10, 25, 50, 100].includes(numeric)) {
    return numeric;
  }
  return DEFAULT_ORBIT_LEDGER_USER_SETTINGS.rowsPerPage;
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeUpdatedAt(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}
