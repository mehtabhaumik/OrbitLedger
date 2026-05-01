import { describe, expect, it } from 'vitest';

import {
  buildRazorpayCheckoutPayload,
  normalizeProviderWebhookPayload,
  verifyRazorpayWebhookSignature,
} from './index';

describe('provider webhook payload mapping', () => {
  it('verifies Razorpay webhook signatures against the raw body', () => {
    const rawBody = '{"event":"payment.captured","payload":{}}';
    const signature = '6d33264f91d4fa934a9c942270373391e88fd3c526f4a5033b85ad58908d24e9';

    expect(verifyRazorpayWebhookSignature(rawBody, signature, 'webhook_secret')).toBe(true);
    expect(verifyRazorpayWebhookSignature(`${rawBody}\n`, signature, 'webhook_secret')).toBe(false);
    expect(verifyRazorpayWebhookSignature(rawBody, signature, 'wrong_secret')).toBe(false);
  });

  it('builds Razorpay checkout payloads with Orbit Ledger notes', () => {
    const payload = buildRazorpayCheckoutPayload({
      workspaceId: 'workspace_1',
      businessName: 'Rudraix PVT',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-641090',
      customerId: 'customer_1',
      customerName: 'Sonali Traders',
      amount: 1770,
      currency: 'inr',
      reference: 'INV-WEB-641090-V1',
      callbackUrl: 'https://orbit-ledger-f41c2.web.app/pay/',
    });

    expect(payload.amount).toBe(177000);
    expect(payload.currency).toBe('INR');
    expect(payload.accept_partial).toBe(false);
    expect(payload.reference_id).toBe('INV-WEB-641090-V1');
    expect(payload.customer?.name).toBe('Sonali Traders');
    expect(payload.callback_url).toBe('https://orbit-ledger-f41c2.web.app/pay/');
    expect(payload.notes).toMatchObject({
      orbit_workspace_id: 'workspace_1',
      orbit_invoice_id: 'invoice_1',
      orbit_invoice_number: 'WEB-641090',
      orbit_customer_id: 'customer_1',
    });
  });

  it('drops unsafe Razorpay callback URLs', () => {
    const payload = buildRazorpayCheckoutPayload({
      workspaceId: 'workspace_1',
      businessName: 'Rudraix PVT',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-641090',
      amount: 1770,
      currency: 'INR',
      reference: 'INV-WEB-641090-V1',
      callbackUrl: 'http://localhost:3000/pay/',
    });

    expect(payload.callback_url).toBeUndefined();
  });

  it('keeps the Orbit generic provider payload shape', () => {
    const payload = normalizeProviderWebhookPayload({
      workspaceId: 'workspace_1',
      invoiceId: 'invoice_1',
      customerId: 'customer_1',
      source: 'payment_page',
      status: 'succeeded',
      amount: 1770,
      currency: 'INR',
      reference: 'INV-WEB-1',
      providerPaymentId: 'orbit_payment_1',
    });

    expect(payload).toMatchObject({
      workspaceId: 'workspace_1',
      invoiceId: 'invoice_1',
      customerId: 'customer_1',
      source: 'payment_page',
      status: 'succeeded',
      amount: 1770,
      currency: 'INR',
      reference: 'INV-WEB-1',
      providerPaymentId: 'orbit_payment_1',
    });
  });

  it('maps Razorpay payment.captured events from notes metadata', () => {
    const payload = normalizeProviderWebhookPayload({
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_123',
            amount: 177000,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_123',
            method: 'upi',
            contact: '+919999999999',
            vpa: 'customer@upi',
            created_at: 1777666574,
            notes: {
              orbit_workspace_id: 'workspace_1',
              orbit_invoice_id: 'invoice_1',
              orbit_invoice_number: 'WEB-1',
              orbit_customer_id: 'customer_1',
              customer_name: 'Customer One',
            },
          },
        },
      },
    });

    expect(payload).toMatchObject({
      provider: 'razorpay',
      workspaceId: 'workspace_1',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-1',
      customerId: 'customer_1',
      source: 'upi',
      status: 'succeeded',
      amount: 1770,
      currency: 'INR',
      reference: 'order_123',
      providerPaymentId: 'pay_123',
      payerName: 'Customer One',
      payerContact: '+919999999999',
    });
  });

  it('maps Razorpay refund events to the original payment id', () => {
    const payload = normalizeProviderWebhookPayload({
      entity: 'event',
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_123',
            payment_id: 'pay_123',
            amount: 177000,
            currency: 'INR',
            status: 'processed',
            notes: {
              orbit_workspace_id: 'workspace_1',
            },
          },
        },
      },
    });

    expect(payload).toMatchObject({
      provider: 'razorpay',
      workspaceId: 'workspace_1',
      status: 'refunded',
      amount: 1770,
      reference: 'rfnd_123',
      providerPaymentId: 'pay_123',
    });
  });

  it('maps Cashfree payment success events', () => {
    const payload = normalizeProviderWebhookPayload({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: {
          order_id: 'order_1',
          order_amount: 1770,
          order_currency: 'INR',
          order_tags: {
            orbit_workspace_id: 'workspace_1',
            orbit_invoice_id: 'invoice_1',
            orbit_invoice_number: 'WEB-1',
            orbit_customer_id: 'customer_1',
          },
        },
        payment: {
          cf_payment_id: 'cfpay_1',
          payment_status: 'SUCCESS',
          payment_amount: 1770,
          payment_currency: 'INR',
          payment_time: '2026-05-02T01:00:00+05:30',
          payment_group: 'upi',
        },
        customer_details: {
          customer_name: 'Customer One',
          customer_phone: '+919999999999',
        },
      },
    });

    expect(payload).toMatchObject({
      provider: 'cashfree',
      workspaceId: 'workspace_1',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-1',
      customerId: 'customer_1',
      source: 'upi',
      status: 'succeeded',
      amount: 1770,
      providerPaymentId: 'cfpay_1',
      payerName: 'Customer One',
    });
  });

  it('maps Stripe payment intent success events from metadata', () => {
    const payload = normalizeProviderWebhookPayload({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_1',
          amount_received: 177000,
          currency: 'inr',
          status: 'succeeded',
          receipt_email: 'customer@example.com',
          created: 1777666574,
          metadata: {
            orbit_workspace_id: 'workspace_1',
            orbit_invoice_id: 'invoice_1',
            orbit_invoice_number: 'WEB-1',
            orbit_customer_id: 'customer_1',
          },
        },
      },
    });

    expect(payload).toMatchObject({
      provider: 'stripe',
      workspaceId: 'workspace_1',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-1',
      customerId: 'customer_1',
      source: 'card',
      status: 'succeeded',
      amount: 1770,
      currency: 'INR',
      providerPaymentId: 'pi_1',
      payerContact: 'customer@example.com',
    });
  });
});
