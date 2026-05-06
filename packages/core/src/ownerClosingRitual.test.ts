import { describe, expect, it } from 'vitest';

import {
  OWNER_CLOSING_RITUAL_SURFACES,
  buildOwnerClosingRitual,
} from './ownerClosingRitual';

describe('owner closing ritual blueprint', () => {
  it('turns a clean day into a ready-to-close summary', () => {
    const ritual = buildOwnerClosingRitual({
      businessName: 'Rudraix PVT',
      currency: 'INR',
      date: '2026-05-04',
      cash: {
        countedCash: 3200,
        expectedCash: 3200,
        cashConfirmed: true,
      },
      credit: {
        creditReviewed: true,
      },
      followUp: {
        followUpsPlanned: true,
      },
      ledger: {
        cashCollected: 3200,
        creditCount: 0,
        paymentCount: 2,
        paymentsRecordedAmount: 3200,
      },
      payments: {
        paymentsReviewed: true,
      },
      stock: {
        stockReviewed: true,
      },
    });

    expect(ritual.title).toBe('Rudraix PVT closing · 2026-05-04');
    expect(ritual.summary).toBe('Today is ready to close cleanly.');
    expect(ritual.flags).toHaveLength(0);
    expect(ritual.completion.readyToClose).toBe(true);
    expect(ritual.tomorrowActions[0]).toMatchObject({
      id: 'open_business',
      tone: 'success',
    });
  });

  it('flags cash differences before closing can be saved', () => {
    const ritual = buildOwnerClosingRitual({
      currency: 'INR',
      cash: {
        countedCash: 1400,
        expectedCash: 1500,
        cashConfirmed: true,
      },
    });

    expect(ritual.flags[0]).toMatchObject({
      id: 'cash_mismatch',
      title: 'Cash difference',
      target: 'count_cash',
      tone: 'danger',
    });
    expect(ritual.steps.find((step) => step.id === 'cash')?.completed).toBe(false);
  });

  it('surfaces pending payments, credit review, stock risk, and follow-ups', () => {
    const ritual = buildOwnerClosingRitual({
      credit: {
        unreviewedCreditCount: 2,
      },
      followUp: {
        customersDueTomorrow: 1,
        overdueCustomers: 1,
        promisesDueTomorrow: 1,
      },
      payments: {
        pendingClearanceCount: 1,
        pendingVerificationCount: 2,
      },
      stock: {
        lowStockCount: 4,
        mismatchCount: 1,
      },
    });

    expect(ritual.flags.map((flag) => flag.id)).toEqual([
      'payments_pending',
      'credit_pending_review',
      'stock_attention',
      'follow_up_needed',
    ]);
    expect(ritual.tomorrowActions.map((action) => action.id)).toEqual([
      'collect_customers',
      'verify_payments',
      'review_stock',
    ]);
  });

  it('keeps the ritual in a fixed owner-friendly step order', () => {
    const ritual = buildOwnerClosingRitual({});

    expect(ritual.steps.map((step) => step.id)).toEqual([
      'cash',
      'payments',
      'credit',
      'stock',
      'follow_up',
      'review',
    ]);
    expect(ritual.emptyState).toBe(true);
  });

  it('defines all closing surfaces needed by mobile and web', () => {
    expect(OWNER_CLOSING_RITUAL_SURFACES.map((surface) => surface.area)).toEqual([
      'cash',
      'payments',
      'credit',
      'stock',
      'follow_up',
      'review',
    ]);
    expect(
      OWNER_CLOSING_RITUAL_SURFACES.every(
        (surface) => surface.userPromise && surface.requiredData.length > 0 && surface.actionTarget
      )
    ).toBe(true);
  });
});
