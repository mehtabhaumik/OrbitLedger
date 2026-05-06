import { describe, expect, it } from 'vitest';

import {
  CUSTOMER_TRUST_MEMORY_SURFACES,
  buildCustomerTrustMemory,
  filterCustomerTrustMemory,
} from './customerTrustMemory';

describe('customer trust memory blueprint', () => {
  it('combines customer relationship events into a newest-first memory', () => {
    const memory = buildCustomerTrustMemory({
      currency: 'INR',
      currentBalance: 2500,
      customerName: 'Asha Stores',
      healthRank: 'needs_follow_up',
      today: '2026-05-04',
      invoiceEvents: [
        {
          id: 'inv_1',
          amount: 2360,
          invoiceNumber: 'INV-001',
          occurredAt: '2026-05-01T08:00:00.000Z',
          paymentState: 'unpaid',
        },
      ],
      moneyEvents: [
        {
          id: 'txn_1',
          amount: 2500,
          note: 'Festival order',
          occurredAt: '2026-04-30T09:00:00.000Z',
          type: 'credit',
        },
      ],
      noteEvents: [
        {
          id: 'note_1',
          body: 'Customer says one item was returned.',
          kind: 'dispute',
          occurredAt: '2026-05-03T09:00:00.000Z',
        },
      ],
      promiseEvents: [
        {
          id: 'prm_1',
          amount: 1500,
          occurredAt: '2026-05-02T08:00:00.000Z',
          promisedDate: '2026-05-02',
          status: 'open',
        },
      ],
      reminderEvents: [
        {
          id: 'rem_1',
          balanceAtSend: 2500,
          message: 'Please share update.',
          occurredAt: '2026-05-02T09:00:00.000Z',
          tone: 'firm',
        },
      ],
    });

    expect(memory.title).toBe('Asha Stores memory');
    expect(memory.summary).toBe('Review promises and disputes before the next collection action.');
    expect(memory.timeline.map((event) => event.title)).toEqual([
      'Dispute note',
      'Firm reminder sent',
      'Promise missed',
      'Invoice INV-001',
      'Credit added',
    ]);
    expect(memory.summaryCards.find((card) => card.id === 'promise_memory')).toMatchObject({
      tone: 'danger',
      value: '1 missed',
    });
  });

  it('filters trust memory without duplicating events', () => {
    const memory = buildCustomerTrustMemory({
      customerName: 'Asha Stores',
      documentEvents: [
        {
          id: 'doc_1',
          fileName: 'statement.pdf',
          kind: 'statement',
          occurredAt: '2026-05-01T00:00:00.000Z',
          pageCount: 2,
        },
      ],
      moneyEvents: [
        {
          id: 'txn_1',
          amount: 1000,
          occurredAt: '2026-05-02T00:00:00.000Z',
          type: 'payment',
        },
      ],
      noteEvents: [
        {
          id: 'note_1',
          body: 'Asked for monthly billing.',
          kind: 'note',
          occurredAt: '2026-05-03T00:00:00.000Z',
        },
      ],
    });

    expect(new Set(memory.timeline.map((event) => event.id)).size).toBe(memory.timeline.length);
    expect(filterCustomerTrustMemory(memory.timeline, 'money')).toHaveLength(1);
    expect(filterCustomerTrustMemory(memory.timeline, 'documents')).toHaveLength(1);
    expect(filterCustomerTrustMemory(memory.timeline, 'all')).toHaveLength(3);
    expect(memory.filters.find((filter) => filter.id === 'notes')?.count).toBe(1);
  });

  it('returns a calm empty state for a new relationship', () => {
    const memory = buildCustomerTrustMemory({
      customerName: 'New Customer',
    });

    expect(memory.emptyState).toBe(true);
    expect(memory.summary).toBe('No customer history is recorded yet.');
    expect(memory.summaryCards.find((card) => card.id === 'current_balance')?.tone).toBe('success');
  });

  it('defines shared trust memory surfaces for web and mobile', () => {
    expect(CUSTOMER_TRUST_MEMORY_SURFACES.map((surface) => surface.area)).toEqual([
      'relationship_summary',
      'memory_timeline',
      'trust_signals',
      'action_context',
    ]);
    expect(CUSTOMER_TRUST_MEMORY_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
  });
});
