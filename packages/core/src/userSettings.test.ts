import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ORBIT_LEDGER_USER_SETTINGS,
  normalizeOrbitLedgerUserSettings,
  serializeOrbitLedgerUserSettings,
} from './userSettings';

describe('shared Orbit Ledger user settings', () => {
  it('normalizes empty settings to the shared defaults', () => {
    expect(normalizeOrbitLedgerUserSettings({})).toEqual(DEFAULT_ORBIT_LEDGER_USER_SETTINGS);
  });

  it('accepts camelCase and stored snake_case values', () => {
    expect(
      normalizeOrbitLedgerUserSettings({
        dashboardView: 'reports_first',
        table_density: 'compact',
        rows_per_page: 50,
        defaultDateRange: 'this_quarter',
        default_customer_filter: 'follow_up',
        defaultInvoiceFilter: 'overdue',
        balance_privacy_mode: true,
        largerText: true,
        reduced_motion: true,
        default_export_format: 'both',
        updated_at: '2026-05-03T00:00:00.000Z',
      })
    ).toEqual({
      dashboardView: 'reports_first',
      tableDensity: 'compact',
      rowsPerPage: 50,
      defaultDateRange: 'this_quarter',
      defaultCustomerFilter: 'follow_up',
      defaultInvoiceFilter: 'overdue',
      balancePrivacyMode: true,
      largerText: true,
      reducedMotion: true,
      defaultExportFormat: 'both',
      updatedAt: '2026-05-03T00:00:00.000Z',
    });
  });

  it('rejects unsupported values consistently for mobile and web', () => {
    expect(
      normalizeOrbitLedgerUserSettings({
        dashboard_view: 'admin_screen',
        table_density: 'tiny',
        rows_per_page: 999,
        default_date_range: 'forever',
        default_customer_filter: 'unknown',
        default_invoice_filter: 'deleted',
        balance_privacy_mode: 'yes',
        larger_text: 1,
        reduced_motion: 'true',
        default_export_format: 'docx',
      })
    ).toEqual(DEFAULT_ORBIT_LEDGER_USER_SETTINGS);
  });

  it('serializes the cloud/local storage shape from the same normalized settings', () => {
    expect(
      serializeOrbitLedgerUserSettings(
        normalizeOrbitLedgerUserSettings({
          dashboardView: 'classic_summary',
          rowsPerPage: 10,
          defaultExportFormat: 'csv',
        })
      )
    ).toMatchObject({
      dashboard_view: 'classic_summary',
      rows_per_page: 10,
      default_export_format: 'csv',
    });
  });
});
