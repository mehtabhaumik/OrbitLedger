import { describe, expect, it } from 'vitest';

import {
  LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX,
  getLiveCollectionsQaBlockers,
  getLiveCollectionsQaScenario,
} from './liveCollectionsQa';

describe('live collections Razorpay QA matrix', () => {
  it('has no launch-blocking gaps in payment safety coverage', () => {
    expect(getLiveCollectionsQaBlockers()).toEqual([]);
  });

  it('keeps browser success and manual instructions out of automatic payment mutation', () => {
    expect(getLiveCollectionsQaScenario('browser-success-only')).toMatchObject({
      backendAction: 'informational_only',
      invoicePaymentMayChange: false,
      ledgerEffect: 'No ledger effect from browser-only state.',
    });
    expect(getLiveCollectionsQaScenario('manual-payment-instruction')).toMatchObject({
      backendAction: 'informational_only',
      invoicePaymentMayChange: false,
    });
  });

  it('requires verified backend events, audit, and idempotency for all money-changing outcomes', () => {
    const moneyChanging = LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX.filter((scenario) => scenario.invoicePaymentMayChange);

    expect(moneyChanging.map((scenario) => scenario.id)).toEqual([
      'captured-payment',
      'refund',
      'partial-refund',
    ]);
    for (const scenario of moneyChanging) {
      expect(scenario.requiresVerifiedBackendEvent).toBe(true);
      expect(scenario.requiresAudit).toBe(true);
      expect(scenario.requiresIdempotency).toBe(true);
      expect(['apply_payment', 'record_refund']).toContain(scenario.backendAction);
    }
  });

  it('forces risky or ambiguous provider states through review without invoice mutation', () => {
    expect(getLiveCollectionsQaScenario('failed-payment')).toMatchObject({
      backendAction: 'needs_review',
      invoicePaymentMayChange: false,
    });
    expect(getLiveCollectionsQaScenario('wrong-amount')).toMatchObject({
      backendAction: 'needs_review',
      invoicePaymentMayChange: false,
    });
    expect(getLiveCollectionsQaScenario('missing-invoice')).toMatchObject({
      backendAction: 'needs_review',
      invoicePaymentMayChange: false,
    });
    expect(getLiveCollectionsQaScenario('cancelled-invoice')).toMatchObject({
      backendAction: 'needs_review',
      invoicePaymentMayChange: false,
    });
  });

  it('documents user-visible states for every QA scenario', () => {
    for (const scenario of LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX) {
      expect(scenario.userVisibleState.trim().length).toBeGreaterThan(12);
      expect(scenario.ledgerEffect.trim().length).toBeGreaterThan(12);
      expect(scenario.scenario.trim().length).toBeGreaterThan(12);
    }
  });
});
