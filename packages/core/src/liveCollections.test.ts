import { describe, expect, it } from 'vitest';

import type {
  LivePaymentEvent,
  OnlinePaymentProviderServerConfig,
  PaymentCapabilitySettings,
} from '@orbit-ledger/contracts';

import {
  buildLivePaymentAuditEntry,
  buildLivePaymentIdempotencyKey,
  buildLivePaymentNotification,
  canLivePaymentEventChangePaymentState,
  deriveLiveInvoicePaymentStatus,
  redactOnlinePaymentProviderConfig,
  validatePaymentCapabilitySeparation,
} from './liveCollections';

const verifiedCapturedEvent: LivePaymentEvent = {
  id: 'event_1',
  workspaceId: 'workspace_1',
  provider: 'razorpay',
  source: 'provider_webhook',
  providerEventId: 'evt_pay_captured_1',
  providerPaymentId: 'pay_1',
  providerPaymentLinkId: 'plink_1',
  invoiceId: 'invoice_1',
  invoiceVersionId: 'version_1',
  customerId: 'customer_1',
  amount: 1770,
  currency: 'INR',
  providerStatus: 'captured',
  verificationStatus: 'verified',
  idempotencyKey: 'razorpay:evt_pay_captured_1',
  receivedAt: '2026-05-20T10:00:00.000Z',
  verifiedAt: '2026-05-20T10:00:01.000Z',
  rawEventPath: 'workspaces/workspace_1/paymentEvents/event_1/raw',
  auditEntryId: null,
};

describe('live collections guardrails', () => {
  it('derives invoice payment status from allocation math, not display labels', () => {
    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 0,
        today: '2026-05-20',
      })
    ).toBe('unpaid');

    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 1000,
        today: '2026-05-20',
      })
    ).toBe('partially_paid');

    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 1770,
        today: '2026-05-20',
      })
    ).toBe('paid');

    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 0,
        dueDate: '2026-05-01',
        today: '2026-05-20',
      })
    ).toBe('overdue');
  });

  it('handles refunds and review amounts without leaving invoices paid by label', () => {
    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 1770,
        refundedAmount: 1770,
      })
    ).toBe('refunded');

    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 1770,
        refundedAmount: 500,
      })
    ).toBe('partially_paid');

    expect(
      deriveLiveInvoicePaymentStatus({
        invoiceTotal: 1770,
        capturedAmount: 0,
        needsReviewAmount: 1770,
      })
    ).toBe('needs_review');
  });

  it('allows payment status changes only from verified backend events', () => {
    expect(canLivePaymentEventChangePaymentState(verifiedCapturedEvent)).toMatchObject({
      canChangePaymentState: true,
      auditAction: 'payment_applied',
    });

    expect(
      canLivePaymentEventChangePaymentState({
        ...verifiedCapturedEvent,
        id: 'event_browser',
        source: 'browser_checkout_success' as LivePaymentEvent['source'],
      })
    ).toMatchObject({
      canChangePaymentState: false,
      auditAction: 'event_rejected',
    });

    expect(
      canLivePaymentEventChangePaymentState({
        ...verifiedCapturedEvent,
        id: 'event_unverified',
        verificationStatus: 'needs_review',
      })
    ).toMatchObject({
      canChangePaymentState: false,
      auditAction: 'payment_review_required',
    });
  });

  it('treats duplicate webhooks as ignored so payments cannot double-record', () => {
    const duplicateEvent = {
      ...verifiedCapturedEvent,
      id: 'event_duplicate',
      verificationStatus: 'duplicate',
    } satisfies LivePaymentEvent;

    expect(buildLivePaymentIdempotencyKey({
      provider: duplicateEvent.provider,
      providerEventId: duplicateEvent.providerEventId,
      providerPaymentId: duplicateEvent.providerPaymentId,
    })).toBe('razorpay:evt_pay_captured_1');

    expect(canLivePaymentEventChangePaymentState(duplicateEvent)).toMatchObject({
      canChangePaymentState: false,
      auditAction: 'duplicate_ignored',
    });
  });

  it('keeps manual payment instructions separate from online provider payments', () => {
    const settings: PaymentCapabilitySettings = {
      manualInstructionsEnabled: true,
      manualInstructionsSource: 'workspace_payment_instructions',
      onlinePayments: {
        provider: 'razorpay',
        mode: 'test',
        status: 'test_mode',
        enabled: true,
        currency: 'INR',
        workspaceId: 'workspace_1',
        paymentLinksEnabled: true,
        automaticReconciliationEnabled: true,
        liveNotificationsEnabled: true,
        updatedAt: '2026-05-20T10:00:00.000Z',
        updatedBy: 'user_1',
      },
    };

    expect(validatePaymentCapabilitySeparation(settings)).toEqual([]);
    expect(
      validatePaymentCapabilitySeparation({
        ...settings,
        manualInstructionsSource: 'razorpay' as PaymentCapabilitySettings['manualInstructionsSource'],
      })
    ).toContain('Manual payment instructions must come from workspace payment instructions.');
  });

  it('redacts provider config so Razorpay secrets never reach clients', () => {
    const serverConfig: OnlinePaymentProviderServerConfig = {
      provider: 'razorpay',
      mode: 'test',
      workspaceId: 'workspace_1',
      keyIdSecretName: 'projects/orbit/secrets/razorpay-key-id',
      keySecretSecretName: 'projects/orbit/secrets/razorpay-key-secret',
      webhookSecretName: 'projects/orbit/secrets/razorpay-webhook-secret',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:00:00.000Z',
      updatedBy: 'admin_1',
    };

    const publicConfig = redactOnlinePaymentProviderConfig(serverConfig);

    expect(publicConfig).toEqual({
      provider: 'razorpay',
      mode: 'test',
      workspaceId: 'workspace_1',
      configured: true,
      secretReferences: 'server_only',
      updatedAt: '2026-05-20T10:00:00.000Z',
    });
    expect(JSON.stringify(publicConfig)).not.toContain('key-secret');
    expect(JSON.stringify(publicConfig)).not.toContain('webhook-secret');
  });

  it('creates system audit entries for automated payment updates', () => {
    const auditEntry = buildLivePaymentAuditEntry({
      id: 'audit_1',
      event: verifiedCapturedEvent,
      action: 'payment_applied',
      message: 'Verified Razorpay payment was applied to invoice invoice_1.',
    });

    expect(auditEntry).toMatchObject({
      actor: 'system',
      source: 'provider_webhook',
      provider: 'razorpay',
      paymentEventId: 'event_1',
      idempotencyKey: 'razorpay:evt_pay_captured_1',
      action: 'payment_applied',
    });
  });

  it('builds realtime notifications from Orbit Ledger state, not Razorpay directly', () => {
    const notification = buildLivePaymentNotification({
      id: 'notification_1',
      event: verifiedCapturedEvent,
      title: 'Payment received',
      message: 'INR 1,770 received from Sonali Traders.',
    });

    expect(notification).toMatchObject({
      source: 'orbit_ledger_state',
      kind: 'payment_received',
      invoiceId: 'invoice_1',
      deepLinkPath: '/invoices/detail/?invoiceId=invoice_1',
    });

    expect(
      buildLivePaymentNotification({
        id: 'notification_duplicate',
        event: {
          ...verifiedCapturedEvent,
          verificationStatus: 'duplicate',
        },
        title: 'Payment received',
        message: 'Duplicate should stay silent.',
      })
    ).toBeNull();
  });
});
