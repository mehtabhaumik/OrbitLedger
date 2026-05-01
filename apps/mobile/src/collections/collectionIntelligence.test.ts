import { describe, expect, it } from 'vitest';

import type {
  CollectionCustomer,
  CustomerPaymentInsight,
  PaymentPromiseWithCustomer,
  TopDueCustomer,
} from '../database';
import { buildCollectionRecommendations } from './collectionIntelligence';

const baseInsight: CustomerPaymentInsight = {
  behaviorHelper: 'Outstanding balance needs follow-up.',
  behaviorKind: 'high_outstanding_balance',
  behaviorLabel: 'High balance',
  behaviorTone: 'danger',
  daysOutstanding: 21,
  dueAgingBucket: 'seven_to_thirty',
  dueAgingHelper: 'Due for 21 days.',
  dueAgingLabel: '7-30 days',
  lastPaymentAt: null,
  oldestDueAt: '2026-04-05',
  paymentCount: 0,
  totalCredit: 12000,
  totalPayment: 0,
};

function customer(overrides: Partial<TopDueCustomer> = {}): TopDueCustomer {
  return {
    id: 'cus_1',
    name: 'Asha Stores',
    balance: 12000,
    latestActivityAt: '2026-04-25T08:00:00.000Z',
    lastPaymentAt: null,
    lastReminderAt: null,
    insight: baseInsight,
    ...overrides,
  };
}

function collectionCustomer(overrides: Partial<CollectionCustomer> = {}): CollectionCustomer {
  return {
    ...customer(),
    oldestCreditAt: '2026-04-05',
    ...overrides,
  };
}

function promise(overrides: Partial<PaymentPromiseWithCustomer> = {}): PaymentPromiseWithCustomer {
  return {
    id: 'prm_1',
    customerId: 'cus_2',
    customerName: 'Bala Traders',
    customerPhone: '+919999999999',
    currentBalance: 4000,
    promisedAmount: 2500,
    promisedDate: '2026-04-26',
    note: null,
    status: 'open',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
    lastModified: '2026-04-25T00:00:00.000Z',
    syncId: 'prm_1',
    syncStatus: 'synced',
    serverRevision: 1,
    ...overrides,
  };
}

describe('collection intelligence', () => {
  it('puts a due payment promise before a larger normal balance', () => {
    const recommendations = buildCollectionRecommendations({
      date: new Date('2026-04-26T10:00:00.000Z'),
      highestDues: [customer({ id: 'cus_1', balance: 24000 })],
      oldestDues: [],
      staleDues: [],
      promises: [promise()],
    });

    expect(recommendations[0]).toMatchObject({
      id: 'cus_2',
      reason: 'Payment promise is due today.',
      recommendedAction: 'call',
    });
  });

  it('explains high balances in plain language', () => {
    const recommendations = buildCollectionRecommendations({
      date: new Date('2026-04-26T10:00:00.000Z'),
      highestDues: [
        customer({
          balance: 18000,
          insight: {
            ...baseInsight,
            daysOutstanding: 24,
            dueAgingBucket: 'seven_to_thirty',
          },
        }),
      ],
      oldestDues: [],
      staleDues: [],
      promises: [],
    });

    expect(recommendations[0]).toMatchObject({
      reason: 'High balance and no full payment for 24 days.',
      helper: 'No reminder shared yet.',
      recommendedAction: 'message',
    });
  });

  it('dedupes customers across collection lists and keeps reminder context', () => {
    const recommendations = buildCollectionRecommendations({
      date: new Date('2026-04-26T10:00:00.000Z'),
      highestDues: [
        customer({
          id: 'cus_1',
          balance: 9000,
          lastReminderAt: '2026-04-25T10:00:00.000Z',
        }),
      ],
      oldestDues: [
        collectionCustomer({
          id: 'cus_1',
          balance: 9000,
          oldestCreditAt: '2026-03-10',
        }),
      ],
      staleDues: [
        collectionCustomer({
          id: 'cus_1',
          balance: 9000,
          lastPaymentAt: '2026-03-20',
        }),
      ],
      promises: [],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      id: 'cus_1',
      helper: 'Reminder shared yesterday.',
      oldestCreditAt: '2026-03-10',
    });
  });
});
