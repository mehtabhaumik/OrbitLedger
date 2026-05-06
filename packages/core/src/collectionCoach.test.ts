import { describe, expect, it } from 'vitest';

import {
  COLLECTION_COACH_SURFACES,
  buildCollectionCoach,
  buildCollectionReminderMessage,
} from './collectionCoach';

describe('collection coach blueprint', () => {
  it('prioritizes missed promises ahead of routine overdue balances', () => {
    const coach = buildCollectionCoach({
      businessName: 'Rudraix PVT',
      currency: 'INR',
      today: '2026-05-04',
      customers: [
        {
          id: 'c1',
          name: 'Asha Stores',
          balance: 3000,
          daysOutstanding: 45,
          overdueInvoiceCount: 1,
          healthRank: 'needs_follow_up',
        },
        {
          id: 'c2',
          name: 'Sonali Traders',
          balance: 1500,
          daysOutstanding: 5,
          lastPromise: {
            amount: 1500,
            promisedDate: '2026-05-02',
            status: 'open',
          },
        },
      ],
    });

    expect(coach.emptyState).toBe(false);
    expect(coach.topRecommendation).toMatchObject({
      customerName: 'Sonali Traders',
      nextAction: {
        target: 'call_customer',
      },
      priority: 'critical',
      reason: 'Payment promise was missed.',
      reminderTone: 'urgent',
    });
    expect(coach.summary).toContain('contacted first');
  });

  it('suggests statements when invoices are overdue', () => {
    const coach = buildCollectionCoach({
      today: '2026-05-04',
      customers: [
        {
          id: 'c1',
          name: 'Asha Stores',
          balance: 9000,
          daysOutstanding: 12,
          overdueInvoiceCount: 2,
          lastReminderAt: '2026-04-20',
        },
      ],
    });

    expect(coach.topRecommendation).toMatchObject({
      customerName: 'Asha Stores',
      nextAction: {
        label: 'Send statement',
        target: 'send_statement',
      },
    });
  });

  it('keeps recent reminders from creating harsh repeated follow-up', () => {
    const coach = buildCollectionCoach({
      today: '2026-05-04',
      customers: [
        {
          id: 'c1',
          name: 'Asha Stores',
          balance: 1200,
          daysOutstanding: 2,
          lastReminderAt: '2026-05-04',
        },
      ],
    });

    expect(coach.topRecommendation?.reminderTone).toBe('soft');
    expect(coach.topRecommendation?.helper).toBe('Reminder was already sent today.');
  });

  it('returns an empty state when no customer has collection work', () => {
    const coach = buildCollectionCoach({
      customers: [
        {
          id: 'c1',
          name: 'Asha Stores',
          balance: 0,
          healthRank: 'excellent',
        },
      ],
    });

    expect(coach.emptyState).toBe(true);
    expect(coach.topRecommendation).toBeNull();
  });

  it('builds practical customer-facing reminder copy', () => {
    const message = buildCollectionReminderMessage({
      balanceLabel: '₹1,500',
      businessName: 'Rudraix PVT',
      customerName: 'Sonali Traders',
      promise: {
        amount: 1500,
        promisedDate: '2026-05-02',
        status: 'missed',
      },
      tone: 'urgent',
    });

    expect(message).toContain('urgent payment follow-up');
    expect(message).toContain('Sonali Traders');
    expect(message).toContain('2026-05-02');
  });

  it('defines the coach surfaces needed by web and mobile', () => {
    expect(COLLECTION_COACH_SURFACES.map((surface) => surface.area)).toEqual([
      'priority_queue',
      'promise_tracking',
      'reminder_guidance',
      'next_action',
    ]);
    expect(COLLECTION_COACH_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
  });
});
