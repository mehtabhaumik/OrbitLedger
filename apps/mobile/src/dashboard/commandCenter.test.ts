import { describe, expect, it } from 'vitest';

import {
  buildDailyCommandCenter,
  type DailyCommandCenterInput,
} from './commandCenter';

const baseInput: DailyCommandCenterInput = {
  currency: 'INR',
  date: new Date('2026-04-26T10:00:00.000Z'),
  lowStockProducts: [],
  productsEnabled: true,
  recentTransactions: [],
  summary: {
    totalReceivable: 0,
    customersWithOutstandingBalance: 0,
    todayEntries: 0,
    recentPaymentsReceived: 0,
    followUpCustomerCount: 0,
    recentActivityCount: 3,
    previousActivityCount: 3,
  },
  topDueCustomers: [],
  upcomingPromises: [],
};

describe('daily command center', () => {
  it('prioritizes promises due today before other work', () => {
    const cards = buildDailyCommandCenter({
      ...baseInput,
      summary: {
        ...baseInput.summary!,
        followUpCustomerCount: 2,
      },
      topDueCustomers: [
        {
          id: 'cus_1',
          name: 'Asha Stores',
          balance: 2500,
          latestActivityAt: '2026-04-20T00:00:00.000Z',
          lastPaymentAt: null,
          lastReminderAt: null,
          insight: {
            behaviorHelper: 'No recent payment.',
            behaviorKind: 'no_recent_payment',
            behaviorLabel: 'No recent payment',
            behaviorTone: 'warning',
            daysOutstanding: 25,
            dueAgingBucket: 'seven_to_thirty',
            dueAgingHelper: 'Due for 25 days.',
            dueAgingLabel: '7-30 days',
            lastPaymentAt: null,
            oldestDueAt: '2026-04-01',
            paymentCount: 0,
            totalCredit: 2500,
            totalPayment: 0,
          },
        },
      ],
      upcomingPromises: [
        {
          id: 'prm_1',
          customerId: 'cus_1',
          customerName: 'Asha Stores',
          customerPhone: null,
          currentBalance: 2500,
          promisedAmount: 1000,
          promisedDate: '2026-04-26',
          note: null,
          status: 'open',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
          lastModified: '2026-04-20T00:00:00.000Z',
          syncId: 'prm_1',
          syncStatus: 'synced',
          serverRevision: 1,
        },
      ],
    });

    expect(cards[0]).toMatchObject({
      id: 'follow_up',
      title: 'Promises due today',
      target: 'get_paid',
      tone: 'warning',
    });
  });

  it('summarizes payments received today', () => {
    const cards = buildDailyCommandCenter({
      ...baseInput,
      recentTransactions: [
        {
          id: 'txn_1',
          customerId: 'cus_1',
          customerName: 'Asha Stores',
          type: 'payment',
          amount: 1200,
          note: null,
          effectiveDate: '2026-04-26',
          createdAt: '2026-04-26T08:00:00.000Z',
          lastModified: '2026-04-26T08:00:00.000Z',
          syncId: 'txn_1',
          syncStatus: 'synced',
          serverRevision: 1,
        },
        {
          id: 'txn_2',
          customerId: 'cus_2',
          customerName: 'Bala Traders',
          type: 'payment',
          amount: 800,
          note: null,
          effectiveDate: '2026-04-26',
          createdAt: '2026-04-26T09:00:00.000Z',
          lastModified: '2026-04-26T09:00:00.000Z',
          syncId: 'txn_2',
          syncStatus: 'synced',
          serverRevision: 1,
        },
      ],
    });

    const paidToday = cards.find((card) => card.id === 'paid_today');
    expect(paidToday).toMatchObject({
      title: 'Payments received today',
      message: 'Asha Stores, Bala Traders',
      tone: 'success',
    });
    expect(paidToday?.value).toContain('2,000');
  });

  it('puts missed promises above other daily cards', () => {
    const cards = buildDailyCommandCenter({
      ...baseInput,
      upcomingPromises: [
        {
          id: 'prm_missed',
          customerId: 'cus_1',
          customerName: 'Asha Stores',
          customerPhone: null,
          currentBalance: 2500,
          promisedAmount: 1000,
          promisedDate: '2026-04-20',
          note: null,
          status: 'missed',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
          lastModified: '2026-04-20T00:00:00.000Z',
          syncId: 'prm_missed',
          syncStatus: 'synced',
          serverRevision: 1,
        },
      ],
    });

    expect(cards[0]).toMatchObject({
      id: 'follow_up',
      title: 'Missed promises need follow-up',
      target: 'get_paid',
      tone: 'warning',
    });
  });

  it('includes a stock card only when inventory is enabled', () => {
    const withInventory = buildDailyCommandCenter({
      ...baseInput,
      lowStockProducts: [
        {
          id: 'prd_1',
          name: 'Notebook',
          price: 40,
          stockQuantity: 2,
          unit: 'pcs',
          createdAt: '2026-04-01T00:00:00.000Z',
          lastModified: '2026-04-01T00:00:00.000Z',
          syncId: 'prd_1',
          syncStatus: 'synced',
          serverRevision: 1,
        },
      ],
    });
    const withoutInventory = buildDailyCommandCenter({
      ...baseInput,
      productsEnabled: false,
    });

    expect(withInventory.some((card) => card.id === 'stock_risk')).toBe(true);
    expect(withoutInventory.some((card) => card.id === 'stock_risk')).toBe(false);
  });
});
