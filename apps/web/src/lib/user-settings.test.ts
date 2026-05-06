import { describe, expect, it } from 'vitest';

import { DEFAULT_WEB_USER_SETTINGS, normalizeWebUserSettings } from './user-settings';

describe('web user settings', () => {
  it('normalizes missing settings to safe defaults', () => {
    expect(normalizeWebUserSettings({})).toEqual(DEFAULT_WEB_USER_SETTINGS);
  });

  it('accepts valid personal preferences from Firestore field names', () => {
    const normalized = normalizeWebUserSettings({
      dashboard_view: 'reports_first',
      table_density: 'compact',
      rows_per_page: 50,
      default_date_range: 'last_30_days',
      default_customer_filter: 'follow_up',
      default_invoice_filter: 'overdue',
      balance_privacy_mode: true,
      larger_text: true,
      reduced_motion: true,
      default_export_format: 'both',
      updated_at: '2026-05-02T00:00:00.000Z',
    });

    expect(normalized).toMatchObject({
      dashboardView: 'reports_first',
      tableDensity: 'compact',
      rowsPerPage: 50,
      defaultDateRange: 'last_30_days',
      defaultCustomerFilter: 'follow_up',
      defaultInvoiceFilter: 'overdue',
      balancePrivacyMode: true,
      largerText: true,
      reducedMotion: true,
      defaultExportFormat: 'both',
      updatedAt: '2026-05-02T00:00:00.000Z',
    });
  });

  it('rejects invalid values without throwing', () => {
    const normalized = normalizeWebUserSettings({
      dashboard_view: 'bad',
      table_density: 'tiny',
      rows_per_page: 999,
      default_date_range: 'forever',
      default_customer_filter: 'unknown',
      default_invoice_filter: 'lost',
      default_export_format: 'docx',
    });

    expect(normalized).toEqual(DEFAULT_WEB_USER_SETTINGS);
  });
});
