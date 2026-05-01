import { describe, expect, it } from 'vitest';

import { buildPracticalHelperCards, redactHelperText } from './practicalHelpers';
import type { DashboardSummary, TopDueCustomer } from '../database';

const summary: DashboardSummary = {
  totalReceivable: 12000,
  customersWithOutstandingBalance: 3,
  todayEntries: 2,
  recentPaymentsReceived: 1,
  followUpCustomerCount: 2,
  recentActivityCount: 5,
  previousActivityCount: 3,
};

const topDueCustomer: TopDueCustomer = {
  id: 'customer-1',
  name: 'Asha Traders',
  phone: '+91 98765 43210',
  balance: 7000,
  latestActivityAt: '2026-04-26T10:00:00.000Z',
  lastPaymentAt: null,
  lastReminderAt: null,
  insight: {
    behaviorHelper: 'Most credited amount is still unpaid.',
    behaviorKind: 'high_outstanding_balance',
    behaviorLabel: 'High outstanding',
    behaviorTone: 'danger',
    daysOutstanding: 18,
    dueAgingBucket: 'seven_to_thirty',
    dueAgingHelper: 'Follow up soon.',
    dueAgingLabel: '18 days',
    lastPaymentAt: null,
    oldestDueAt: '2026-04-08',
    paymentCount: 0,
    totalCredit: 7000,
    totalPayment: 0,
  },
};

describe('practical helper cards', () => {
  it('builds concrete local helpers for collection work', () => {
    const cards = buildPracticalHelperCards({
      businessName: 'Orbit Test Store',
      currency: 'INR',
      date: new Date('2026-04-27T00:00:00.000Z'),
      promises: [],
      recentTransactions: [],
      summary,
      topDueCustomers: [topDueCustomer],
    });

    expect(cards.map((card) => card.id)).toEqual([
      'collection_message',
      'call_first',
      'receivables_change',
      'month_summary',
      'suspicious_entries',
      'tomorrow_plan',
    ]);
    expect(cards[0].result).toContain('Mark payment only after you confirm it.');
    expect(cards.every((card) => card.privacyNote.includes('No customer data is sent'))).toBe(true);
  });

  it('spots repeated and unusually large recent entries', () => {
    const cards = buildPracticalHelperCards({
      businessName: 'Orbit Test Store',
      currency: 'INR',
      date: new Date('2026-04-27T00:00:00.000Z'),
      promises: [],
      summary,
      topDueCustomers: [],
      recentTransactions: [
        recentTransaction('1', 100),
        recentTransaction('2', 100),
        recentTransaction('3', 2000),
        recentTransaction('4', 100),
      ],
    });

    const suspicious = cards.find((card) => card.id === 'suspicious_entries');
    expect(suspicious?.result).toContain('large');
    expect(suspicious?.result).toContain('repeated');
  });

  it('redacts sensitive text before external use', () => {
    expect(redactHelperText('Call +91 98765 43210, email owner@example.com, UPI owner@upi')).toBe(
      'Call [phone hidden], email [email hidden], UPI [payment id hidden]'
    );
  });
});

function recentTransaction(id: string, amount: number) {
  return {
    id,
    amount,
    createdAt: '2026-04-27T10:00:00.000Z',
    customerId: 'customer-1',
    customerName: 'Asha Traders',
    effectiveDate: '2026-04-27',
    lastModified: '2026-04-27T10:00:00.000Z',
    note: null,
    serverRevision: 0,
    syncId: id,
    syncStatus: 'synced' as const,
    type: 'credit' as const,
  };
}
