import type { ProviderBackedPaymentStatus } from '@orbit-ledger/contracts';

export type LiveCollectionsQaBackendAction =
  | 'apply_payment'
  | 'ignore_duplicate'
  | 'record_refund'
  | 'needs_review'
  | 'informational_only';

export type LiveCollectionsQaScenarioKind =
  | ProviderBackedPaymentStatus
  | 'duplicate_webhook'
  | 'wrong_amount'
  | 'missing_invoice'
  | 'cancelled_invoice'
  | 'expired_payment_link'
  | 'browser_success_only'
  | 'manual_payment_instruction';

export type LiveCollectionsQaScenario = {
  id: string;
  scenario: string;
  kind: LiveCollectionsQaScenarioKind;
  providerEvent: string;
  backendAction: LiveCollectionsQaBackendAction;
  invoicePaymentMayChange: boolean;
  requiresVerifiedBackendEvent: boolean;
  requiresAudit: boolean;
  requiresIdempotency: boolean;
  userVisibleState: string;
  ledgerEffect: string;
  testEvidence: string[];
};

export const LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX: LiveCollectionsQaScenario[] = [
  {
    id: 'captured-payment',
    scenario: 'Verified captured payment matches an unpaid invoice.',
    kind: 'captured',
    providerEvent: 'payment_link.paid or payment.captured',
    backendAction: 'apply_payment',
    invoicePaymentMayChange: true,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment received; invoice becomes paid or partially paid from allocation math.',
    ledgerEffect: 'Create transaction, allocation, receipt, follow-up update, audit, and notification.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
      'apps/functions/src/providerPayload.test.ts',
      'apps/web/src/lib/live-collections-status.test.ts',
    ],
  },
  {
    id: 'duplicate-webhook',
    scenario: 'Razorpay retries the same webhook or reconciliation sees existing ledger records.',
    kind: 'duplicate_webhook',
    providerEvent: 'same event id or same deterministic idempotency key',
    backendAction: 'ignore_duplicate',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'No second payment notification; audit records duplicate ignored.',
    ledgerEffect: 'No additional transaction or allocation.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'failed-payment',
    scenario: 'Customer payment fails or payment link is cancelled.',
    kind: 'failed',
    providerEvent: 'payment.failed or payment_link.cancelled',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment failed; invoice remains unpaid and can be followed up.',
    ledgerEffect: 'Create review audit and failed notification only.',
    testEvidence: [
      'packages/core/src/liveCollectionsQa.test.ts',
      'apps/functions/src/providerPayload.test.ts',
      'apps/web/src/lib/live-collections-status.test.ts',
    ],
  },
  {
    id: 'authorized-not-captured',
    scenario: 'Payment is authorized but not captured.',
    kind: 'authorized',
    providerEvent: 'payment.authorized',
    backendAction: 'informational_only',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment is not final yet; wait for captured event or review.',
    ledgerEffect: 'No transaction or allocation until captured.',
    testEvidence: [
      'packages/core/src/liveCollectionsQa.test.ts',
      'packages/core/src/liveCollections.test.ts',
    ],
  },
  {
    id: 'refund',
    scenario: 'Captured payment is refunded later.',
    kind: 'refunded',
    providerEvent: 'refund.processed',
    backendAction: 'record_refund',
    invoicePaymentMayChange: true,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment refunded; invoice paid amount and balance are recalculated.',
    ledgerEffect: 'Create reversal transaction, payment reversal, audit, and refund notification.',
    testEvidence: [
      'apps/functions/src/providerPayload.test.ts',
      'apps/web/src/lib/live-collections-receipts.test.ts',
    ],
  },
  {
    id: 'partial-refund',
    scenario: 'Only part of the captured payment is refunded.',
    kind: 'partially_refunded',
    providerEvent: 'refund.processed with partial amount',
    backendAction: 'record_refund',
    invoicePaymentMayChange: true,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment partially refunded; invoice may move to partially paid or unpaid.',
    ledgerEffect: 'Create reversal entries for the refunded allocation amount only.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'dispute',
    scenario: 'Payment is disputed.',
    kind: 'disputed',
    providerEvent: 'payment.dispute.created or payment.dispute.lost',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment needs review; invoice balance is not silently changed.',
    ledgerEffect: 'Create review audit and needs-review notification only.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
      'apps/web/src/lib/live-collections-status.test.ts',
    ],
  },
  {
    id: 'wrong-amount',
    scenario: 'Provider amount does not cleanly match remaining invoice balance.',
    kind: 'wrong_amount',
    providerEvent: 'payment.captured',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment needs review before allocation.',
    ledgerEffect: 'No automatic allocation when the amount cannot be trusted.',
    testEvidence: [
      'docs/live-collections-razorpay-failure-matrix.md',
    ],
  },
  {
    id: 'missing-invoice',
    scenario: 'Provider event is verified but invoice metadata is missing or stale.',
    kind: 'missing_invoice',
    providerEvent: 'payment.captured',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment needs review; user can match it manually.',
    ledgerEffect: 'No automatic invoice update.',
    testEvidence: [
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'cancelled-invoice',
    scenario: 'Payment arrives for a cancelled invoice.',
    kind: 'cancelled_invoice',
    providerEvent: 'payment.captured',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment needs review because the invoice is cancelled.',
    ledgerEffect: 'No automatic invoice status change.',
    testEvidence: [
      'apps/functions/src/providerPayload.test.ts',
    ],
  },
  {
    id: 'expired-payment-link',
    scenario: 'Payment event references an expired or stale payment link.',
    kind: 'expired_payment_link',
    providerEvent: 'payment.captured',
    backendAction: 'needs_review',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: true,
    requiresAudit: true,
    requiresIdempotency: true,
    userVisibleState: 'Payment needs review before ledger changes.',
    ledgerEffect: 'No automatic invoice update until reviewed.',
    testEvidence: [
      'docs/live-collections-razorpay-failure-matrix.md',
    ],
  },
  {
    id: 'browser-success-only',
    scenario: 'Browser checkout callback claims success without verified backend event.',
    kind: 'browser_success_only',
    providerEvent: 'client callback only',
    backendAction: 'informational_only',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: false,
    requiresAudit: false,
    requiresIdempotency: false,
    userVisibleState: 'Payment received, verifying; invoice is not marked paid.',
    ledgerEffect: 'No ledger effect from browser-only state.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
      'apps/web/src/lib/live-collections-status.test.ts',
    ],
  },
  {
    id: 'manual-payment-instruction',
    scenario: 'Customer pays through UPI or bank instructions outside Razorpay.',
    kind: 'manual_payment_instruction',
    providerEvent: 'none',
    backendAction: 'informational_only',
    invoicePaymentMayChange: false,
    requiresVerifiedBackendEvent: false,
    requiresAudit: false,
    requiresIdempotency: false,
    userVisibleState: 'Manual payment must be recorded or verified through manual review.',
    ledgerEffect: 'No provider automation; manual payment workflow applies.',
    testEvidence: [
      'packages/core/src/liveCollections.test.ts',
    ],
  },
];

export function getLiveCollectionsQaBlockers(
  matrix: LiveCollectionsQaScenario[] = LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX
): string[] {
  const blockers: string[] = [];
  const ids = new Set<string>();

  for (const scenario of matrix) {
    if (ids.has(scenario.id)) {
      blockers.push(`Duplicate QA scenario id: ${scenario.id}`);
    }
    ids.add(scenario.id);

    if (scenario.invoicePaymentMayChange && scenario.backendAction !== 'apply_payment' && scenario.backendAction !== 'record_refund') {
      blockers.push(`${scenario.id} allows invoice mutation without a payment/refund backend action.`);
    }

    if ((scenario.backendAction === 'apply_payment' || scenario.backendAction === 'record_refund') && !scenario.requiresVerifiedBackendEvent) {
      blockers.push(`${scenario.id} changes money state without requiring verified backend event.`);
    }

    if ((scenario.backendAction === 'apply_payment' || scenario.backendAction === 'record_refund') && !scenario.requiresAudit) {
      blockers.push(`${scenario.id} changes money state without audit.`);
    }

    if (scenario.backendAction === 'ignore_duplicate' && scenario.invoicePaymentMayChange) {
      blockers.push(`${scenario.id} lets a duplicate mutate invoice state.`);
    }

    if (!scenario.testEvidence.length) {
      blockers.push(`${scenario.id} has no test or documentation evidence.`);
    }
  }

  return blockers;
}

export function getLiveCollectionsQaScenario(
  id: string,
  matrix: LiveCollectionsQaScenario[] = LIVE_COLLECTIONS_RAZORPAY_QA_MATRIX
): LiveCollectionsQaScenario | null {
  return matrix.find((scenario) => scenario.id === id) ?? null;
}
