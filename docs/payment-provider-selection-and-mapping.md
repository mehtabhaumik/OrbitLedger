# Payment Provider Payload Mapping And Gateway Selection

This document explains the recommended payment gateway rollout for Orbit Ledger and the webhook payload fields each provider must send for safe invoice payment automation.

The goal is not just to accept money. The goal is to keep invoices, customer balances, allocations, refunds, and reversal history correct.

## Recommendation

Use this rollout order:

1. **Razorpay first for India launch.**
2. **Cashfree as the India backup provider.**
3. **Stripe later for US/UK and international packs, once those markets are active.**

Razorpay should be the first production gateway because Orbit Ledger is currently strongest around India-ready invoices, GST-style documents, UPI workflows, and small business collection flows. Razorpay has broad India payment coverage, official payment/refund webhooks, UPI/card/wallet/netbanking support, and a familiar dashboard for Indian merchants.

Cashfree is a useful backup because it has competitive pricing and strong India payment coverage, but Orbit Ledger should avoid launching with two live gateways at once. Start with one provider, prove reconciliation, then add backup routing.

Stripe should stay mapped but not be the first India launch path. It is valuable for global SaaS workflows and US/UK country packs, but Orbit Ledger’s immediate user promise is local daily money control for very small businesses.

## Provider Selection Criteria

Choose the provider that best supports:

- UPI and domestic India payments.
- Payment links or hosted checkout.
- Reliable webhooks for success, failure, pending, and refunds.
- Metadata fields that can store Orbit Ledger IDs.
- Clear dashboard review for owner support.
- Settlement and fee reports.
- Refund tracking.
- Good onboarding for small businesses.
- Low operational support load.

## Current Provider Decision

### Primary: Razorpay

Use Razorpay first for:

- India country pack.
- UPI-heavy workflows.
- Invoice payment links.
- Payment captured events.
- Refund processed events.
- Small business onboarding.

Required Razorpay webhook events:

- `payment.captured`
- `payment.authorized`
- `payment.failed`
- refund events such as `refund.processed`

Required Razorpay `notes` metadata:

- `orbit_workspace_id`
- `orbit_invoice_id`
- `orbit_invoice_number`
- `orbit_customer_id`

Orbit Ledger mapping:

- `payment.captured` becomes `succeeded`.
- `payment.authorized` becomes `pending`.
- `payment.failed` becomes `failed`.
- `refund.*` becomes `refunded`.
- Razorpay amount is treated as minor currency unit and divided by `100`.
- Refunds map back to the original payment by `payment_id`.

### Backup: Cashfree

Use Cashfree as the second India provider after Razorpay is proven.

Required Cashfree webhook events:

- `PAYMENT_SUCCESS_WEBHOOK`
- `PAYMENT_FAILED_WEBHOOK`
- refund webhook events

Required Cashfree `order_tags` metadata:

- `orbit_workspace_id`
- `orbit_invoice_id`
- `orbit_invoice_number`
- `orbit_customer_id`

Orbit Ledger mapping:

- `PAYMENT_SUCCESS_WEBHOOK` becomes `succeeded`.
- `PAYMENT_FAILED_WEBHOOK` becomes `failed`.
- `payment_status: PENDING` becomes `pending`.
- refund events become `refunded`.
- Cashfree amount is treated as normal decimal currency amount.
- `cf_payment_id` is used as the provider payment id.

### Future: Stripe

Keep Stripe mapped for later US/UK/international rollout.

Required Stripe events:

- `payment_intent.succeeded`
- `charge.succeeded`
- `charge.refunded`

Required Stripe `metadata`:

- `orbit_workspace_id`
- `orbit_invoice_id`
- `orbit_invoice_number`
- `orbit_customer_id`

Orbit Ledger mapping:

- `payment_intent.succeeded` becomes `succeeded`.
- `charge.succeeded` becomes `succeeded`.
- `charge.refunded` becomes `refunded`.
- Stripe amount is treated as minor currency unit and divided by `100`.
- Refunds map back to the original payment using `payment_intent` when available.

## Orbit Ledger Generic Payload

Orbit Ledger still accepts its own generic provider payload. This is useful for internal tests, custom provider adapters, and providers that can transform payloads before sending.

```json
{
  "workspaceId": "workspace_id",
  "invoiceId": "invoice_id",
  "invoiceNumber": "WEB-641090",
  "customerId": "customer_id",
  "source": "payment_page",
  "status": "succeeded",
  "amount": 1770,
  "currency": "INR",
  "reference": "INV-WEB-641090",
  "providerPaymentId": "provider_payment_id",
  "payerName": "Customer name",
  "payerContact": "+910000000000",
  "paidAt": "2026-05-02T01:00:00+05:30"
}
```

## Required Metadata Rule

Every payment link must carry Orbit Ledger IDs into the provider:

- `workspaceId` protects the tenant boundary.
- `invoiceId` gives exact invoice matching.
- `invoiceNumber` gives human-readable fallback matching.
- `customerId` lets customer balance updates happen without guessing.

If a provider event does not include enough information to match an invoice, Orbit Ledger must keep it in review. It must not guess.

## Supported Payment Outcomes

Orbit Ledger supports these normalized outcomes:

- `succeeded`
- `pending`
- `failed`
- `refunded`

Invoice behavior:

- `succeeded`: apply payment to the invoice if it can be safely matched.
- `pending`: store for review; do not mark invoice paid.
- `failed`: store for review; do not mark invoice paid.
- `refunded`: create reversal history if the original payment was already applied.

## Safety Rules

- Never use provider redirects as proof of payment.
- Webhooks are the source of truth for payment state.
- Never mark an invoice paid unless the webhook is trusted and matched.
- Never duplicate payment allocation for the same provider payment id.
- Never delete original payment history after refund.
- Always create reversal records for refunds.
- Do not expose webhook secrets in links, docs, screenshots, or client-side code.

## Real Gateway Setup Steps

1. Create the Razorpay account.
2. Keep Razorpay in test mode.
3. Add the Orbit Ledger webhook URL.
4. Add the secret header in Razorpay.
5. Enable payment success, pending/authorized, failed, and refund events.
6. Create a test invoice in Orbit Ledger.
7. Create a payment link carrying Orbit Ledger metadata.
8. Pay the invoice in Razorpay test mode.
9. Confirm the invoice becomes paid.
10. Retry the same event and confirm it does not duplicate.
11. Refund the test payment.
12. Confirm the invoice and customer balance reverse correctly.
13. Confirm the payment reversal record exists.
14. Only then switch Razorpay to live mode.

## Latest Razorpay Mapping Smoke Result

Last verified: `2026-05-02`

Sandbox workspace:

- `sandbox_razorpay_mapping_1777667186231`

Result:

- Razorpay-shaped `payment.captured` event returned HTTP `200`.
- Razorpay amount was converted from paise to rupees.
- Invoice payment status changed to `paid`.
- Invoice paid amount changed to `1770`.
- Customer balance changed to `0`.
- Duplicate Razorpay payment was detected and did not duplicate the transaction.
- Razorpay-shaped `refund.processed` event returned HTTP `200`.
- Refund created a reversal record.
- Invoice returned to `unpaid`.
- Invoice paid amount returned to `0`.
- Customer balance returned to `1770`.
- Sandbox workspace cleanup completed and was confirmed deleted.

## Official References

- Razorpay payment webhooks: https://razorpay.com/docs/webhooks/payments/?preferred-country=IN
- Razorpay pricing: https://razorpay.com/pricing/
- Cashfree payment webhooks: https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks
- Cashfree pricing: https://www.cashfree.com/payment-gateway-charges/
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe India pricing: https://stripe.com/in/pricing
