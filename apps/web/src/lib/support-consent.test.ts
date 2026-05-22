import { describe, expect, it } from 'vitest';

import {
  parseWebSupportCaseCustomerStatus,
  supportCaseCustomerFollowUp,
  supportCaseCustomerStatusLabel,
} from './support-consent';

describe('web support consent helpers', () => {
  it('maps support case statuses to customer-friendly labels and follow-up copy', () => {
    expect(supportCaseCustomerStatusLabel('resolved')).toBe('Resolved');
    expect(supportCaseCustomerStatusLabel('reopened')).toBe('Reopened');
    expect(supportCaseCustomerStatusLabel('waiting_on_customer')).toBe('Waiting for your reply');
    expect(supportCaseCustomerStatusLabel('open')).toBe('In review');
    expect(supportCaseCustomerFollowUp('resolved')).toContain('marked resolved');
    expect(supportCaseCustomerFollowUp('reopened')).toContain('back in review');
    expect(supportCaseCustomerFollowUp('waiting_on_customer')).toContain('needs one more detail');
  });

  it('parses support case snapshots with legacy and camelCase fields', () => {
    expect(
      parseWebSupportCaseCustomerStatus('case-1', {
        status: 'resolved',
        support_case_id: 'OL-SUP-20260522-ABC123',
        updated_at: '2026-05-22T10:00:00.000Z',
      })
    ).toMatchObject({
      supportCaseId: 'OL-SUP-20260522-ABC123',
      status: 'resolved',
      label: 'Resolved',
      updatedAt: '2026-05-22T10:00:00.000Z',
    });

    expect(
      parseWebSupportCaseCustomerStatus('case-2', {
        status: 'waiting_on_customer',
        supportCaseId: 'OL-SUP-20260522-DEF456',
        updatedAt: '2026-05-22T11:00:00.000Z',
      })
    ).toMatchObject({
      supportCaseId: 'OL-SUP-20260522-DEF456',
      status: 'waiting_on_customer',
      label: 'Waiting for your reply',
      updatedAt: '2026-05-22T11:00:00.000Z',
    });
  });
});
