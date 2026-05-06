import { describe, expect, it } from 'vitest';

import {
  buildCustomerTimelineEvents,
  buildReminderMessage,
  getPromiseStatusLabel,
  getPromiseTone,
} from './customer-timeline';
import type {
  WorkspaceCustomerTimelineNote,
  WorkspacePaymentPromise,
  WorkspacePaymentReminder,
  WorkspaceTransaction,
} from './workspace-data';

describe('customer timeline helpers', () => {
  it('combines money, reminders, promises, and notes in newest-first order', () => {
    const events = buildCustomerTimelineEvents({
      transactions: [transaction()],
      notes: [note()],
      reminders: [reminder()],
      promises: [promise()],
      today: '2026-05-02',
      formatAmount: (value) => `Rs ${value}`,
    });

    expect(events.map((event) => event.kind)).toEqual(['reminder', 'promise', 'note', 'transaction']);
    expect(events[0].title).toBe('Firm reminder');
    expect(events[1].meta).toContain('Due today');
  });

  it('labels overdue open promises as missed without mutating status', () => {
    expect(getPromiseStatusLabel('open', '2026-05-01', '2026-05-02')).toBe('Missed');
    expect(getPromiseTone('open', '2026-05-01', '2026-05-02')).toBe('danger');
  });

  it('builds plain-language reminder messages by tone', () => {
    expect(
      buildReminderMessage({
        businessName: 'Orbit Shop',
        customerName: 'Asha Traders',
        balanceLabel: 'INR 4,000',
        tone: 'final',
      })
    ).toContain('urgent payment reminder');
  });
});

function transaction(): WorkspaceTransaction {
  return {
    id: 'txn1',
    customerId: 'cus1',
    customerName: 'Asha Traders',
    type: 'payment',
    amount: 1000,
    note: 'Paid cash',
    paymentMode: 'cash',
    paymentDetails: null,
    paymentClearanceStatus: 'cleared',
    paymentAttachments: [],
    effectiveDate: '2026-05-01',
    createdAt: '2026-05-01T10:00:00.000Z',
  };
}

function note(): WorkspaceCustomerTimelineNote {
  return {
    id: 'note1',
    customerId: 'cus1',
    kind: 'note',
    body: 'Asked for statement.',
    createdAt: '2026-05-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z',
  };
}

function reminder(): WorkspacePaymentReminder {
  return {
    id: 'rem1',
    customerId: 'cus1',
    tone: 'firm',
    message: 'Please pay today.',
    balanceAtSend: 4000,
    sharedVia: 'web_review',
    createdAt: '2026-05-02T09:00:00.000Z',
  };
}

function promise(): WorkspacePaymentPromise {
  return {
    id: 'prm1',
    customerId: 'cus1',
    promisedAmount: 1500,
    promisedDate: '2026-05-02',
    note: null,
    status: 'open',
    createdAt: '2026-05-01T13:00:00.000Z',
    updatedAt: '2026-05-02T08:00:00.000Z',
  };
}
