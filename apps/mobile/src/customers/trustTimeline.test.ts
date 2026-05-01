import { describe, expect, it } from 'vitest';

import type {
  CustomerTimelineNote,
  Invoice,
  LedgerTransaction,
  PaymentPromise,
  PaymentReminder,
} from '../database';
import {
  buildCustomerTrustTimeline,
  filterCustomerTrustTimeline,
} from './trustTimeline';

const sync = {
  lastModified: '2026-04-26T10:00:00.000Z',
  serverRevision: 1,
  syncId: 'sync_1',
  syncStatus: 'synced' as const,
};

function transaction(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    ...sync,
    id: 'txn_1',
    customerId: 'cus_1',
    type: 'credit',
    amount: 2500,
    note: 'Festival order',
    effectiveDate: '2026-04-20',
    createdAt: '2026-04-20T09:00:00.000Z',
    ...overrides,
  };
}

function reminder(overrides: Partial<PaymentReminder> = {}): PaymentReminder {
  return {
    ...sync,
    id: 'rem_1',
    customerId: 'cus_1',
    tone: 'firm',
    message: 'Please pay.',
    balanceAtSend: 2500,
    sharedVia: 'system_share_sheet',
    createdAt: '2026-04-22T09:00:00.000Z',
    ...overrides,
  };
}

function promise(overrides: Partial<PaymentPromise> = {}): PaymentPromise {
  return {
    ...sync,
    id: 'prm_1',
    customerId: 'cus_1',
    promisedAmount: 1500,
    promisedDate: '2026-04-24',
    note: null,
    status: 'missed',
    createdAt: '2026-04-21T09:00:00.000Z',
    updatedAt: '2026-04-25T09:00:00.000Z',
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    ...sync,
    id: 'inv_1',
    customerId: 'cus_1',
    invoiceNumber: 'INV-001',
    issueDate: '2026-04-21',
    dueDate: '2026-04-28',
    subtotal: 2000,
    taxAmount: 360,
    totalAmount: 2360,
    paidAmount: 0,
    status: 'issued',
    documentState: 'created',
    paymentStatus: 'unpaid',
    versionNumber: 1,
    latestVersionId: 'ivn_1',
    latestSnapshotHash: 'snapshot_1',
    notes: null,
    createdAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  };
}

function note(overrides: Partial<CustomerTimelineNote> = {}): CustomerTimelineNote {
  return {
    ...sync,
    id: 'note_1',
    customerId: 'cus_1',
    kind: 'dispute',
    body: 'Customer says one item was returned.',
    createdAt: '2026-04-26T09:00:00.000Z',
    updatedAt: '2026-04-26T09:00:00.000Z',
    ...overrides,
  };
}

describe('customer trust timeline', () => {
  it('combines events into newest-first human labels', () => {
    const events = buildCustomerTrustTimeline({
      currency: 'INR',
      customerName: 'Asha Stores',
      documents: [],
      invoices: [invoice()],
      notes: [note()],
      promises: [promise()],
      reminders: [reminder()],
      transactions: [transaction()],
    });

    expect(events.map((event) => event.title)).toEqual([
      'Dispute note',
      'Promise missed',
      'Firm reminder sent',
      'Invoice INV-001',
      'Credit given',
    ]);
    expect(events[0]).toMatchObject({
      category: 'notes',
      detail: 'Customer says one item was returned.',
      tone: 'danger',
    });
  });

  it('filters timeline groups without duplicating events', () => {
    const events = buildCustomerTrustTimeline({
      currency: 'INR',
      customerName: 'Asha Stores',
      invoices: [invoice()],
      notes: [note({ kind: 'note', body: 'Asked for monthly statement.' })],
      promises: [promise()],
      reminders: [reminder()],
      transactions: [transaction(), transaction({ id: 'txn_2', type: 'payment' })],
    });

    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(filterCustomerTrustTimeline(events, 'money')).toHaveLength(2);
    expect(filterCustomerTrustTimeline(events, 'notes')).toHaveLength(1);
    expect(filterCustomerTrustTimeline(events, 'all')).toHaveLength(events.length);
  });
});
