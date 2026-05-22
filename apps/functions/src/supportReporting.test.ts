import { describe, expect, it } from 'vitest';

import {
  buildOfficeSupportReportAuditRecord,
  humanizeOfficeSupportReportType,
  normalizeOfficeSupportReportAction,
  normalizeOfficeSupportReportType,
} from './index';

describe('support reporting helpers', () => {
  it('normalizes export actions and report types strictly', () => {
    expect(normalizeOfficeSupportReportAction('download_csv')).toBe('download_csv');
    expect(normalizeOfficeSupportReportAction('print_report')).toBe('print_report');
    expect(normalizeOfficeSupportReportAction('email_report')).toBeNull();

    expect(normalizeOfficeSupportReportType('ticket_registry')).toBe('ticket_registry');
    expect(normalizeOfficeSupportReportType('audit_trail')).toBe('audit_trail');
    expect(normalizeOfficeSupportReportType('unknown')).toBeNull();
  });

  it('builds audit records for support report export and print actions', () => {
    const record = buildOfficeSupportReportAuditRecord({
      workspaceId: 'workspace-1',
      supportCaseId: 'CASE-2001',
      ticketId: 'ticket-1',
      queueId: 'billing',
      action: 'download_csv',
      reportType: 'audit_trail',
      reportTitle: null,
      generatedAt: '2026-05-22T12:00:00.000Z',
      generatedBy: 'finance@example.com',
      adminRole: 'finance_admin',
      actorUid: 'admin-1',
      actorEmail: 'finance@example.com',
      filters: ['Case CASE-2001', 'Status Pending customer'],
      rowCount: 4,
      createdAt: '2026-05-22T12:01:00.000Z',
    });

    expect(record).toMatchObject({
      action: 'support_report_download_csv',
      kind: 'exported',
      report_type: 'audit_trail',
      report_title: humanizeOfficeSupportReportType('audit_trail'),
      report_generated_by: 'finance@example.com',
      report_row_count: 4,
      queue_id: 'billing',
      support_case_id: 'CASE-2001',
      ticket_id: 'ticket-1',
    });
  });
});
