import { describe, expect, it } from 'vitest';

import type { PaymentPromiseWithCustomer } from '../database';
import {
  buildPromiseFollowUpCalendar,
  buildPromiseFollowUpReminderMessage,
  getPromiseFollowUpStatusActions,
} from './promiseFollowUps';

function promise(overrides: Partial<PaymentPromiseWithCustomer> = {}): PaymentPromiseWithCustomer {
  return {
    id: 'prm_1',
    customerId: 'cus_1',
    customerName: 'Asha Stores',
    customerPhone: '+919999999999',
    currentBalance: 3000,
    promisedAmount: 1500,
    promisedDate: '2026-04-27',
    note: null,
    status: 'open',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    lastModified: '2026-04-20T00:00:00.000Z',
    syncId: 'prm_1',
    syncStatus: 'synced',
    serverRevision: 1,
    ...overrides,
  };
}

describe('promise follow-up calendar', () => {
  it('groups promises by overdue, today, tomorrow, and later', () => {
    const groups = buildPromiseFollowUpCalendar({
      currency: 'INR',
      date: new Date('2026-04-27T10:00:00.000Z'),
      promises: [
        promise({ id: 'late', promisedDate: '2026-04-24' }),
        promise({ id: 'today', promisedDate: '2026-04-27' }),
        promise({ id: 'tomorrow', promisedDate: '2026-04-28' }),
        promise({ id: 'later', promisedDate: '2026-05-02' }),
      ],
    });

    expect(groups.map((group) => group.key)).toEqual(['overdue', 'today', 'tomorrow', 'later']);
    expect(groups[0].items[0]).toMatchObject({
      id: 'late',
      statusLabel: 'Missed',
      tone: 'danger',
    });
  });

  it('keeps manually missed promises visible even if the date is not old', () => {
    const groups = buildPromiseFollowUpCalendar({
      currency: 'INR',
      date: new Date('2026-04-27T10:00:00.000Z'),
      promises: [promise({ id: 'missed', promisedDate: '2026-04-29', status: 'missed' })],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: 'overdue',
      title: 'Overdue promises',
    });
  });

  it('builds a ready-to-send reminder in plain language', () => {
    const message = buildPromiseFollowUpReminderMessage({
      businessName: 'Orbit Ledger Demo',
      currency: 'INR',
      promise: promise({ promisedDate: '2026-04-20' }),
    });

    expect(message).toContain('Hi Asha Stores,');
    expect(message).toContain('promised payment');
    expect(message).toContain('Current balance');
    expect(message).not.toContain('status');
  });

  it('keeps promise state actions simple', () => {
    expect(getPromiseFollowUpStatusActions('open')).toEqual(['fulfilled', 'missed', 'cancelled']);
    expect(getPromiseFollowUpStatusActions('missed')).toEqual(['fulfilled', 'cancelled']);
    expect(getPromiseFollowUpStatusActions('fulfilled')).toEqual([]);
    expect(getPromiseFollowUpStatusActions('cancelled')).toEqual([]);
  });
});
