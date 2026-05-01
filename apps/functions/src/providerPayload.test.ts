import { describe, expect, it } from 'vitest';

import { normalizeProviderWebhookPayload } from './index';

describe('provider webhook payload mapping', () => {
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
