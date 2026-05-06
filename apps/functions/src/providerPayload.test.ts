import { describe, expect, it } from 'vitest';

import {
  buildSubscriptionEntitlementRecord,
  buildSubscriptionEntitlementAuditRecord,
  buildSubscriptionBillingEmailDeliveryUpdate,
  buildSubscriptionBillingEmailAdminQueueRecord,
  buildSubscriptionBillingEmailRequestRecord,
  buildOfficeAccessRequestAdminQueueRecord,
  buildOfficeAccessRequestAuditRecord,
  buildOfficeSupportReviewAuditRecord,
  buildSupportCaseRecord,
  buildSupportCaseEmailRequestRecord,
  buildSupportDiagnosticConsentRecord,
  buildSupportDiagnosticConsentStatusUpdate,
  buildOfficeInvitationCreatedAuditRecord,
  buildOfficeInvitationDeliveryAuditRecord,
  buildOfficeInvitationRecord,
  buildOfficeInvitationRevokedAuditRecord,
  buildOfficeInvitedMemberRecord,
  buildOfficeInvitationAcceptanceAuditRecord,
  buildOfficeInvitationEmailDeliveryUpdate,
  buildOfficeMemberAccessAuditRecord,
  buildOfficeOwnershipTransferAuditRecord,
  buildOfficeOwnershipTransferNotificationUpdate,
  buildOfficeOwnershipTransferRecord,
  buildOfficeOwnerMemberRecord,
  buildBillingPortalSessionRecord,
  buildRazorpayCheckoutPayload,
  buildSubscriptionBillingMetadata,
  buildSubscriptionRenewalAdminQueueRecord,
  buildSubscriptionRenewalAuditRecord,
  buildSubscriptionRenewalChangeRecord,
  normalizeMonetizationWebhookPayload,
  normalizeProviderWebhookPayload,
  resolveSubscriptionCheckoutPricing,
  resolveSubscriptionCheckoutPricingFromRecord,
  resolveMonetizationPlanChange,
  validateMonetizationWebhookPayload,
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

  it('normalizes subscription payment confirmations without activating from the client', () => {
    const payload = normalizeMonetizationWebhookPayload({
      provider: 'razorpay',
      userId: 'user_1',
      workspaceId: 'workspace_1',
      checkoutIntentId: 'checkout_pro_yearly_1',
      planId: 'pro_yearly',
      status: 'succeeded',
      transactionId: 'pay_123',
      providerReference: 'order_123',
    });

    expect(validateMonetizationWebhookPayload(payload)).toBeNull();
    expect(payload).toMatchObject({
      provider: 'razorpay',
      userId: 'user_1',
      workspaceId: 'workspace_1',
      checkoutIntentId: 'checkout_pro_yearly_1',
      planId: 'pro_yearly',
      status: 'confirmed',
      transactionId: 'pay_123',
    });

    const entitlement = buildSubscriptionEntitlementRecord(payload, new Date('2026-05-03T00:00:00.000Z'));
    expect(entitlement).toMatchObject({
      tier: 'pro',
      plan_id: 'pro_yearly',
      product_id: 'com.rudraix.orbitledger.pro.yearly',
      source: 'provider_webhook',
      transaction_id: 'pay_123',
    });
    expect(entitlement.valid_until).toContain('2027-05-03');

    const audit = buildSubscriptionEntitlementAuditRecord(
      payload,
      'razorpay_pay_123',
      new Date('2026-05-03T00:00:00.000Z')
    );
    expect(audit).toMatchObject({
      event_id: 'razorpay_pay_123',
      action: 'entitlement_confirmed',
      status: 'confirmed',
      plan_id: 'pro_yearly',
      transaction_id: 'pay_123',
    });
  });

  it('maps Razorpay subscription confirmations from notes metadata', () => {
    const payload = normalizeMonetizationWebhookPayload({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_sub_1',
            status: 'captured',
            order_id: 'order_sub_1',
            created_at: 1777666574,
            notes: {
              orbit_user_id: 'user_1',
              orbit_workspace_id: 'workspace_1',
              orbit_checkout_intent_id: 'checkout_plus_monthly_1',
              orbit_plan_id: 'plus_monthly',
            },
          },
        },
      },
    });

    expect(validateMonetizationWebhookPayload(payload)).toBeNull();
    expect(payload).toMatchObject({
      provider: 'razorpay',
      userId: 'user_1',
      workspaceId: 'workspace_1',
      checkoutIntentId: 'checkout_plus_monthly_1',
      planId: 'plus_monthly',
      status: 'confirmed',
      transactionId: 'pay_sub_1',
      providerReference: 'order_sub_1',
    });
  });

  it('rejects incomplete subscription confirmation payloads', () => {
    const payload = normalizeMonetizationWebhookPayload({
      userId: 'user_1',
      workspaceId: 'workspace_1',
      checkoutIntentId: 'checkout_1',
      planId: 'pro_monthly',
      status: 'confirmed',
    });

    expect(validateMonetizationWebhookPayload(payload)).toBe('transaction_required');
  });

  it('allows new purchases and upgrades while blocking reductions and same-tier billing changes', () => {
    expect(resolveMonetizationPlanChange(null, 'plus_monthly')).toMatchObject({
      kind: 'new_purchase',
      canApply: true,
    });
    expect(resolveMonetizationPlanChange('plus_yearly', 'pro_monthly')).toMatchObject({
      kind: 'upgrade',
      canApply: true,
    });
    expect(resolveMonetizationPlanChange('pro_yearly', 'plus_yearly')).toMatchObject({
      kind: 'downgrade',
      canApply: false,
      reason: 'downgrade_blocked',
    });
    expect(resolveMonetizationPlanChange('plus_monthly', 'plus_yearly')).toMatchObject({
      kind: 'billing_change',
      canApply: false,
      reason: 'billing_change_at_renewal',
    });
    expect(resolveMonetizationPlanChange('office_yearly', 'office_yearly')).toMatchObject({
      kind: 'current_plan',
      canApply: false,
      reason: 'current_plan',
    });
  });

  it('builds renewal-change and billing-portal records without changing entitlement', () => {
    const now = new Date('2026-05-04T00:00:00.000Z');
    const renewal = buildSubscriptionRenewalChangeRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      currentPlanId: 'pro_yearly',
      targetPlanId: 'plus_yearly',
      changeKind: 'downgrade',
      applyAfter: '2027-05-03T00:00:00.000Z',
      now,
    });

    expect(renewal).toMatchObject({
      workspace_id: 'workspace_1',
      requested_by: 'user_1',
      current_plan_id: 'pro_yearly',
      target_plan_id: 'plus_yearly',
      status: 'queued',
      provider: 'manual_provider_pending',
      provider_portal_status: 'pending_provider_connection',
      server_sync_status: 'queued',
      review_status: 'needs_review',
      provider_action_required: true,
    });

    const queue = buildSubscriptionRenewalAdminQueueRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      renewalChangeId: 'renewal_pro_yearly_to_plus_yearly',
      currentPlanId: 'pro_yearly',
      targetPlanId: 'plus_yearly',
      changeKind: 'downgrade',
      applyAfter: '2027-05-03T00:00:00.000Z',
      now,
    });

    expect(queue).toMatchObject({
      queue_type: 'subscription_renewal_change',
      workspace_id: 'workspace_1',
      renewal_change_id: 'renewal_pro_yearly_to_plus_yearly',
      status: 'open',
      review_status: 'needs_review',
      provider_sync_status: 'pending_provider_connection',
    });

    const portal = buildBillingPortalSessionRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      currentPlanId: 'pro_yearly',
      callbackUrl: 'https://orbit-ledger-f41c2.web.app/market',
      now,
    });

    expect(portal).toMatchObject({
      workspace_id: 'workspace_1',
      user_id: 'user_1',
      current_plan_id: 'pro_yearly',
      provider: 'manual_provider_pending',
      provider_status: 'provider_not_connected',
      portal_url: null,
    });

    const audit = buildSubscriptionRenewalAuditRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      renewalChangeId: 'renewal_pro_yearly_to_plus_yearly',
      adminQueueId: 'admin_renewal_pro_yearly_to_plus_yearly',
      action: 'complete',
      status: 'applied',
      reviewStatus: 'completed',
      serverSyncStatus: 'completed',
      currentPlanId: 'pro_yearly',
      targetPlanId: 'plus_yearly',
      resolvedBy: 'billing_admin',
      providerReference: 'provider_ref_1',
      note: 'Applied at renewal.',
      now,
    });

    expect(audit).toMatchObject({
      workspace_id: 'workspace_1',
      user_id: 'user_1',
      renewal_change_id: 'renewal_pro_yearly_to_plus_yearly',
      action: 'complete',
      status: 'applied',
      review_status: 'completed',
      server_sync_status: 'completed',
      current_plan_label: 'Pro Yearly',
      target_plan_label: 'Plus Yearly',
      resolved_by: 'billing_admin',
      provider_reference: 'provider_ref_1',
      note: 'Applied at renewal.',
    });
  });

  it('maps subscription checkout pricing by workspace country', () => {
    expect(resolveSubscriptionCheckoutPricing('pro_yearly', 'IN')).toMatchObject({
      pricingCountry: 'IN',
      currency: 'INR',
      amountMinor: 199900,
      amountDisplay: '₹1,999',
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_in_pro_yearly',
      providerPriceStatus: 'pending_provider_connection',
    });
    expect(resolveSubscriptionCheckoutPricing('office_monthly', 'GB')).toMatchObject({
      pricingCountry: 'GB',
      currency: 'GBP',
      amountMinor: 1999,
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_gb_office_monthly',
    });
    expect(resolveSubscriptionCheckoutPricing('plus_monthly', 'ZZ')).toMatchObject({
      pricingCountry: 'US',
      currency: 'USD',
      checkoutProvider: 'razorpay',
      providerPriceId: 'orbit_razorpay_us_plus_monthly',
    });
    expect(resolveSubscriptionCheckoutPricingFromRecord('office_yearly', {
      pricing_country: 'GB',
      currency: 'GBP',
      amount_minor: 19999,
      amount_display: '£199.99',
      checkout_provider: 'razorpay',
      provider_price_id: 'rzp_live_gb_office_yearly',
      provider_price_status: 'active',
    })).toMatchObject({
      pricingCountry: 'GB',
      currency: 'GBP',
      amountMinor: 19999,
      checkoutProvider: 'razorpay',
      providerPriceId: 'rzp_live_gb_office_yearly',
      providerPriceStatus: 'active',
    });
  });

  it('builds receipt and tax-invoice metadata for subscription purchases', () => {
    const pricing = resolveSubscriptionCheckoutPricing('pro_yearly', 'IN');
    const metadata = buildSubscriptionBillingMetadata({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      planId: 'pro_yearly',
      checkoutIntentId: 'checkout_pro_yearly_123456',
      pricing,
      workspace: {
        business_name: 'Rudraix PVT',
        legal_name: 'Rudraix Private Limited',
        email: 'billing@example.com',
        country_code: 'IN',
        state_code: 'GJ',
        gstin: '24ABCDE1234F1Z5',
        registration_number: 'U12345GJ2026PTC000001',
      },
      status: 'confirmed',
      provider: 'razorpay',
      transactionId: 'pay_123',
      providerReference: 'order_123',
      now: new Date('2026-05-04T00:00:00.000Z'),
    });

    expect(metadata).toMatchObject({
      billing_document_version: 1,
      billing_status: 'confirmed',
      receipt_number: 'OL-202605-Y_123456',
      receipt_status: 'ready',
      tax_invoice_number: 'OL-TAX-202605-Y_123456',
      tax_country: 'IN',
      tax_label: 'GST',
      tax_registration_label: 'GSTIN / PAN',
      tax_registration_number: '24ABCDE1234F1Z5',
      tax_document_label: 'GST tax invoice',
      receipt_label: 'Receipt',
      tax_treatment: 'india_gst_provider_review',
      tax_calculation_status: 'provider_review_required',
      tax_compliance_review_status: 'ready_for_review',
      tax_compliance_basis: 'india_gst',
      tax_registration_required: true,
      tax_registration_present: true,
      tax_inclusive_pricing: false,
      amount_minor: 199900,
      currency: 'INR',
      buyer_business_name: 'Rudraix PVT',
      buyer_legal_name: 'Rudraix Private Limited',
      seller_brand: 'Orbit Ledger by Rudraix',
      transaction_id: 'pay_123',
      provider_reference: 'order_123',
    });
  });

  it('marks country billing rules for missing tax identifiers and sales tax review', () => {
    const gbPricing = resolveSubscriptionCheckoutPricing('pro_yearly', 'GB');
    const gbMetadata = buildSubscriptionBillingMetadata({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      planId: 'pro_yearly',
      checkoutIntentId: 'checkout_gb_123',
      pricing: gbPricing,
      workspace: {
        business_name: 'Orbit UK Ltd',
        country_code: 'GB',
      },
      status: 'confirmed',
      now: new Date('2026-05-04T00:00:00.000Z'),
    });
    const usPricing = resolveSubscriptionCheckoutPricing('pro_yearly', 'US');
    const usMetadata = buildSubscriptionBillingMetadata({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      planId: 'pro_yearly',
      checkoutIntentId: 'checkout_us_123',
      pricing: usPricing,
      workspace: {
        business_name: 'Orbit US LLC',
        country_code: 'US',
      },
      status: 'confirmed',
      now: new Date('2026-05-04T00:00:00.000Z'),
    });

    expect(gbMetadata).toMatchObject({
      tax_country: 'GB',
      tax_label: 'VAT',
      tax_document_label: 'VAT invoice',
      tax_compliance_review_status: 'business_tax_id_missing',
      tax_registration_required: true,
      tax_registration_present: false,
    });
    expect(usMetadata).toMatchObject({
      tax_country: 'US',
      tax_label: 'Sales tax',
      tax_document_label: 'Receipt',
      tax_compliance_review_status: 'country_tax_review_required',
      tax_registration_required: false,
    });
  });

  it('builds queued billing receipt email requests without sending immediately', () => {
    const request = buildSubscriptionBillingEmailRequestRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      checkoutIntentId: 'checkout_pro_yearly_123456',
      planId: 'pro_yearly',
      receiptNumber: 'OL-202605-Y_123456',
      taxInvoiceNumber: 'OL-TAX-202605-Y_123456',
      recipientEmail: 'billing@example.com',
      requestedBy: 'user_1',
      buyerBusinessName: 'Rudraix PVT',
      amountDisplay: '₹1,999',
      adminQueueId: 'admin_billing_receipt_email_checkout_pro_yearly_123456',
      resendCount: 2,
      now: new Date('2026-05-04T00:00:00.000Z'),
    });

    expect(request).toMatchObject({
      request_type: 'billing_receipt_email',
      status: 'queued',
      delivery_status: 'queued',
      delivery_channel: 'email',
      email_provider_status: 'pending_connection',
      workspace_id: 'workspace_1',
      checkout_intent_id: 'checkout_pro_yearly_123456',
      plan_id: 'pro_yearly',
      receipt_number: 'OL-202605-Y_123456',
      amount_display: '₹1,999',
      buyer_business_name: 'Rudraix PVT',
      admin_queue_id: 'admin_billing_receipt_email_checkout_pro_yearly_123456',
      admin_review_status: 'needs_review',
      resend_count: 2,
      last_resend_at: '2026-05-04T00:00:00.000Z',
      recipient_email: 'billing@example.com',
      requested_at: '2026-05-04T00:00:00.000Z',
      sent_at: null,
    });
  });

  it('builds billing email delivery updates for provider sync', () => {
    expect(buildSubscriptionBillingEmailDeliveryUpdate({
      status: 'sent',
      providerMessageId: 'email_123',
      sentAt: '2026-05-04T01:00:00.000Z',
      now: new Date('2026-05-04T01:01:00.000Z'),
    })).toMatchObject({
      status: 'sent',
      delivery_status: 'sent',
      email_provider_status: 'sent',
      provider_message_id: 'email_123',
      sent_at: '2026-05-04T01:00:00.000Z',
      failure_reason: null,
    });

    expect(buildSubscriptionBillingEmailDeliveryUpdate({
      status: 'pending_provider_connection',
      now: new Date('2026-05-04T01:01:00.000Z'),
    })).toMatchObject({
      status: 'pending_provider_connection',
      delivery_status: 'pending_provider_connection',
      email_provider_status: 'pending_connection',
      sent_at: null,
    });
  });

  it('builds admin queue records for billing receipt email review', () => {
    expect(buildSubscriptionBillingEmailAdminQueueRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      checkoutIntentId: 'checkout_pro_yearly_123456',
      requestId: 'billing_receipt_email_checkout_pro_yearly_123456',
      planId: 'pro_yearly',
      receiptNumber: 'OL-202605-Y_123456',
      recipientEmail: 'billing@example.com',
      deliveryStatus: 'pending_provider_connection',
      resendCount: 2,
      now: new Date('2026-05-04T00:00:00.000Z'),
    })).toMatchObject({
      queue_type: 'billing_receipt_email',
      workspace_id: 'workspace_1',
      checkout_intent_id: 'checkout_pro_yearly_123456',
      request_id: 'billing_receipt_email_checkout_pro_yearly_123456',
      status: 'open',
      review_status: 'needs_review',
      provider_sync_status: 'pending_provider_connection',
      provider_action_required: true,
      resend_count: 2,
    });

    expect(buildSubscriptionBillingEmailAdminQueueRecord({
      workspaceId: 'workspace_1',
      userId: 'user_1',
      checkoutIntentId: 'checkout_pro_yearly_123456',
      requestId: 'billing_receipt_email_checkout_pro_yearly_123456',
      planId: 'pro_yearly',
      receiptNumber: 'OL-202605-Y_123456',
      recipientEmail: 'billing@example.com',
      deliveryStatus: 'sent',
      now: new Date('2026-05-04T00:00:00.000Z'),
    })).toMatchObject({
      status: 'completed',
      review_status: 'completed',
      provider_sync_status: 'completed',
      provider_action_required: false,
    });
  });

  it('builds Office access grant records for trusted admin actions', () => {
    const now = new Date('2026-05-06T12:00:00.000Z');

    expect(buildOfficeAccessRequestAdminQueueRecord({
      workspaceId: 'workspace_1',
      requestId: 'office_request_1',
      requesterUid: 'owner_1',
      requesterName: 'Owner One',
      requesterEmail: 'owner@example.com',
      businessName: 'Orbit Store',
      requestedPlanId: 'office_yearly',
      status: 'approved',
      note: 'Approved after call.',
      now,
    })).toMatchObject({
      kind: 'office_access_request',
      workspace_id: 'workspace_1',
      request_id: 'office_request_1',
      requester_uid: 'owner_1',
      requester_email: 'owner@example.com',
      requested_plan_id: 'office_yearly',
      status: 'approved',
      review_status: 'approved',
      action_label: 'Grant Office access',
      note: 'Approved after call.',
    });

    expect(buildOfficeAccessRequestAuditRecord({
      workspaceId: 'workspace_1',
      requestId: 'office_request_1',
      adminQueueId: 'office_admin_1',
      actorUid: 'internal_admin',
      action: 'grant_access',
      targetUid: 'owner_1',
      targetEmail: 'owner@example.com',
      previousStatus: 'approved',
      nextStatus: 'granted',
      note: 'Granted after review.',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      request_id: 'office_request_1',
      actor_uid: 'internal_admin',
      action: 'member_accepted',
      target_uid: 'owner_1',
      next_role: 'owner',
      previous_status: 'approved',
      next_status: 'granted',
      reason: 'Granted after review.',
    });

    expect(buildOfficeSupportReviewAuditRecord({
      workspaceId: 'workspace_1',
      actorUid: 'internal_support_1',
      actorEmail: 'support@orbitledger.app',
      reason: 'Reviewing a customer-approved Office setup ticket.',
      supportCaseId: 'CASE-1001',
      customerApprovedDiagnosticAccess: true,
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      actor_uid: 'internal_support_1',
      actor_email: 'support@orbitledger.app',
      actor_role: 'internal_support_reviewer',
      action: 'internal_access_reviewed',
      target_uid: null,
      target_email: null,
      support_case_id: 'CASE-1001',
      customer_approved_diagnostic_access: true,
      impersonation_allowed: false,
      reason: expect.stringContaining('Impersonation blocked; no member session started'),
    });

    expect(buildSupportDiagnosticConsentRecord({
      workspaceId: 'workspace_1',
      userId: 'owner_1',
      userEmail: 'owner@example.com',
      supportKind: 'sync_issue',
      supportCaseId: 'CASE-2001',
      sanitizedMessage: 'Sync review approved.',
      safeFields: {
        route: '/support',
        platform: 'web',
        invoiceCount: 2,
      },
      redactedFields: ['business name'],
      privateDataWarnings: ['email address'],
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      user_id: 'owner_1',
      user_email: 'owner@example.com',
      support_kind: 'sync_issue',
      support_case_id: 'CASE-2001',
      status: 'active',
      diagnostic_safe_fields: {
        route: '/support',
        platform: 'web',
        invoicecount: 2,
      },
      approved_fields: ['route', 'platform', 'invoicecount'],
      redacted_fields: ['business name'],
      private_data_warnings: ['email address'],
      expires_at: '2026-05-13T12:00:00.000Z',
    });

    expect(buildSupportDiagnosticConsentStatusUpdate({
      status: 'revoked',
      actorUid: 'owner_1',
      reason: 'No longer needed.',
      now,
    })).toMatchObject({
      status: 'revoked',
      revoked_by: 'owner_1',
      revoked_at: '2026-05-06T12:00:00.000Z',
      expired_at: null,
      status_reason: 'No longer needed.',
    });

    expect(buildSupportDiagnosticConsentStatusUpdate({
      status: 'expired',
      actorUid: 'system',
      now,
    })).toMatchObject({
      status: 'expired',
      revoked_by: null,
      expired_at: '2026-05-06T12:00:00.000Z',
      status_reason: 'Support review approval expired.',
    });

    expect(buildSupportCaseRecord({
      workspaceId: 'workspace_1',
      supportCaseId: 'CASE-2001',
      action: 'resolve',
      status: 'resolved',
      previousStatus: 'open',
      note: 'Customer confirmed the issue is fixed.',
      actorUid: 'internal_support_1',
      actorEmail: 'support@orbitledger.app',
      noteCount: 1,
      createdAt: '2026-05-06T10:00:00.000Z',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      support_case_id: 'CASE-2001',
      status: 'resolved',
      previous_status: 'open',
      latest_action: 'resolve',
      latest_note: 'Customer confirmed the issue is fixed.',
      latest_note_by: 'internal_support_1',
      latest_note_by_email: 'support@orbitledger.app',
      note_count: 2,
      created_at: '2026-05-06T10:00:00.000Z',
      updated_at: '2026-05-06T12:00:00.000Z',
    });

    expect(buildSupportCaseEmailRequestRecord({
      workspaceId: 'workspace_1',
      supportCaseId: 'CASE-2001',
      recipientEmail: 'owner@example.com',
      subject: 'Update on CASE-2001',
      body: 'We have a safe update for your support case.',
      queuedBy: 'internal_support_1',
      queuedByEmail: 'support@orbitledger.app',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      support_case_id: 'CASE-2001',
      recipient_email: 'owner@example.com',
      provider: 'resend',
      delivery_status: 'pending_provider_connection',
      queued_by: 'internal_support_1',
      queued_by_email: 'support@orbitledger.app',
      queued_at: '2026-05-06T12:00:00.000Z',
    });

    expect(buildOfficeOwnerMemberRecord({
      workspaceId: 'workspace_1',
      ownerUid: 'owner_1',
      ownerEmail: 'owner@example.com',
      ownerName: 'Owner One',
      invitedBy: 'internal_admin',
      now,
    })).toMatchObject({
      uid: 'owner_1',
      workspace_id: 'workspace_1',
      role: 'owner',
      status: 'active',
      email: 'owner@example.com',
      display_name: 'Owner One',
      invited_by: 'internal_admin',
      accepted_at: '2026-05-06T12:00:00.000Z',
    });
  });

  it('builds accepted Office invitation member and audit records', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');

    expect(buildOfficeInvitedMemberRecord({
      workspaceId: 'workspace_1',
      memberUid: 'staff_1',
      memberEmail: 'staff@example.com',
      memberName: 'Staff One',
      role: 'staff',
      invitedBy: 'owner_1',
      invitedAt: '2026-05-05T10:00:00.000Z',
      now,
    })).toMatchObject({
      uid: 'staff_1',
      workspace_id: 'workspace_1',
      role: 'staff',
      status: 'active',
      email: 'staff@example.com',
      display_name: 'Staff One',
      invited_by: 'owner_1',
      invited_at: '2026-05-05T10:00:00.000Z',
      accepted_at: '2026-05-06T10:00:00.000Z',
    });

    expect(buildOfficeInvitationAcceptanceAuditRecord({
      workspaceId: 'workspace_1',
      invitationId: 'invite_1',
      actorUid: 'staff_1',
      actorEmail: 'staff@example.com',
      invitedBy: 'owner_1',
      role: 'staff',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      invitation_id: 'invite_1',
      action: 'member_accepted',
      target_uid: 'staff_1',
      next_role: 'staff',
      previous_status: 'pending',
      next_status: 'active',
    });
  });

  it('builds trusted Office invitation records and creation audit entries', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');

    expect(buildOfficeInvitationRecord({
      workspaceId: 'workspace_1',
      email: ' STAFF@Example.com ',
      role: 'staff',
      invitedBy: 'owner_1',
      invitedByName: 'Owner One',
      message: 'Please join the workspace.',
      now,
    })).toMatchObject({
      email: 'staff@example.com',
      role: 'staff',
      status: 'pending',
      workspace_id: 'workspace_1',
      invited_by: 'owner_1',
      invited_by_name: 'Owner One',
      message: 'Please join the workspace.',
      expires_at: '2026-05-20T10:00:00.000Z',
      accepted_by: null,
      revoked_by: null,
      created_at: '2026-05-06T10:00:00.000Z',
    });

    expect(buildOfficeInvitationCreatedAuditRecord({
      workspaceId: 'workspace_1',
      invitationId: 'invite_1',
      actorUid: 'owner_1',
      actorRole: 'owner',
      targetEmail: 'staff@example.com',
      role: 'staff',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      invitation_id: 'invite_1',
      actor_uid: 'owner_1',
      actor_role: 'owner',
      action: 'member_invited',
      target_email: 'staff@example.com',
      next_role: 'staff',
      next_status: 'pending',
    });
  });

  it('builds trusted Office invitation revoke and delivery audit entries', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');

    expect(buildOfficeInvitationRevokedAuditRecord({
      workspaceId: 'workspace_1',
      invitationId: 'invite_1',
      actorUid: 'owner_1',
      actorRole: 'owner',
      targetEmail: 'staff@example.com',
      role: 'staff',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      invitation_id: 'invite_1',
      actor_uid: 'owner_1',
      actor_role: 'owner',
      action: 'invitation_revoked',
      target_email: 'staff@example.com',
      previous_role: 'staff',
      next_status: 'revoked',
    });

    expect(buildOfficeInvitationDeliveryAuditRecord({
      workspaceId: 'workspace_1',
      invitationId: 'invite_1',
      actorUid: 'admin_1',
      actorRole: 'admin',
      targetEmail: 'staff@example.com',
      role: 'staff',
      deliveryStatus: 'pending_provider_connection',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      invitation_id: 'invite_1',
      actor_uid: 'admin_1',
      actor_role: 'admin',
      action: 'invitation_email_sent',
      target_email: 'staff@example.com',
      next_role: 'staff',
      next_status: 'pending_provider_connection',
      reason: 'Invitation email is ready; email delivery is not connected yet.',
    });
  });

  it('builds trusted Office member access audit entries', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');

    expect(buildOfficeMemberAccessAuditRecord({
      workspaceId: 'workspace_1',
      actorUid: 'owner_1',
      actorRole: 'owner',
      targetUid: 'staff_1',
      targetEmail: 'staff@example.com',
      action: 'member_role_changed',
      previousRole: 'staff',
      nextRole: 'manager',
      previousStatus: 'active',
      nextStatus: 'active',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      actor_uid: 'owner_1',
      actor_role: 'owner',
      action: 'member_role_changed',
      target_uid: 'staff_1',
      target_email: 'staff@example.com',
      previous_role: 'staff',
      next_role: 'manager',
      previous_status: 'active',
      next_status: 'active',
      reason: 'Office member role changed.',
    });

    expect(buildOfficeMemberAccessAuditRecord({
      workspaceId: 'workspace_1',
      actorUid: 'admin_1',
      actorRole: 'admin',
      targetUid: 'viewer_1',
      action: 'member_restored',
      previousRole: 'viewer',
      nextRole: 'viewer',
      previousStatus: 'suspended',
      nextStatus: 'active',
      now,
    })).toMatchObject({
      action: 'member_restored',
      target_uid: 'viewer_1',
      previous_status: 'suspended',
      next_status: 'active',
      reason: 'Office member access restored.',
    });
  });

  it('builds trusted Office ownership transfer records and audit entries', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');

    expect(buildOfficeOwnershipTransferRecord({
      workspaceId: 'workspace_1',
      requestedBy: 'owner_1',
      requestedByEmail: 'owner@example.com',
      targetUid: 'admin_1',
      targetEmail: 'admin@example.com',
      targetName: 'Admin One',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      status: 'pending',
      requested_by: 'owner_1',
      requested_by_email: 'owner@example.com',
      target_uid: 'admin_1',
      target_email: 'admin@example.com',
      target_name: 'Admin One',
      requested_at: '2026-05-06T10:00:00.000Z',
      expires_at: '2026-05-13T10:00:00.000Z',
      notification_status: 'queued',
      notification_resend_count: 0,
    });

    expect(buildOfficeOwnershipTransferNotificationUpdate({
      status: 'pending_provider_connection',
      resendCount: 1,
      now,
    })).toMatchObject({
      notification_status: 'pending_provider_connection',
      notification_provider_status: 'pending_connection',
      notification_resend_count: 1,
      notification_last_resend_at: null,
      updated_at: '2026-05-06T10:00:00.000Z',
    });

    expect(buildOfficeOwnershipTransferAuditRecord({
      workspaceId: 'workspace_1',
      transferId: 'transfer_1',
      actorUid: 'owner_1',
      actorRole: 'owner',
      action: 'ownership_transfer_requested',
      targetUid: 'admin_1',
      targetEmail: 'admin@example.com',
      previousRole: 'admin',
      nextRole: 'owner',
      now,
    })).toMatchObject({
      workspace_id: 'workspace_1',
      ownership_transfer_id: 'transfer_1',
      actor_uid: 'owner_1',
      actor_role: 'owner',
      action: 'ownership_transfer_requested',
      target_uid: 'admin_1',
      target_email: 'admin@example.com',
      previous_role: 'admin',
      next_role: 'owner',
      reason: 'Ownership transfer requested.',
    });

    expect(buildOfficeOwnershipTransferAuditRecord({
      workspaceId: 'workspace_1',
      transferId: 'transfer_1',
      actorUid: 'system',
      actorRole: 'internal_support_reviewer',
      action: 'ownership_transfer_expired',
      targetUid: 'admin_1',
      targetEmail: 'admin@example.com',
      now,
    })).toMatchObject({
      action: 'ownership_transfer_expired',
      actor_role: 'internal_support_reviewer',
      reason: 'Ownership transfer expired.',
    });
  });

  it('builds Office invitation email delivery updates without exposing provider secrets', () => {
    expect(buildOfficeInvitationEmailDeliveryUpdate({
      status: 'pending_provider_connection',
      inviteUrl: 'https://orbit-ledger-f41c2.web.app/team/invite?workspaceId=workspace_1&invitationId=invite_1',
      resendCount: 1,
      now: new Date('2026-05-06T10:00:00.000Z'),
    })).toMatchObject({
      delivery_status: 'pending_provider_connection',
      email_provider_status: 'pending_connection',
      resend_count: 1,
      last_resend_at: null,
      invite_url: 'https://orbit-ledger-f41c2.web.app/team/invite?workspaceId=workspace_1&invitationId=invite_1',
      updated_at: '2026-05-06T10:00:00.000Z',
    });

    expect(buildOfficeInvitationEmailDeliveryUpdate({
      status: 'sent',
      inviteUrl: 'https://orbit-ledger-f41c2.web.app/team/invite?workspaceId=workspace_1&invitationId=invite_1',
      providerMessageId: 'email_1',
      sentAt: '2026-05-06T10:01:00.000Z',
      resendCount: 2,
      now: new Date('2026-05-06T10:02:00.000Z'),
    })).toMatchObject({
      delivery_status: 'sent',
      email_provider_status: 'sent',
      provider_message_id: 'email_1',
      sent_at: '2026-05-06T10:01:00.000Z',
      resend_count: 2,
      last_resend_at: '2026-05-06T10:02:00.000Z',
    });
  });
});
