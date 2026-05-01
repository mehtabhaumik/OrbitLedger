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

Current connection status: **no real payment provider account is connected yet**.

Orbit Ledger currently supports:

- Orbit-hosted invoice payment pages.
- Manual UPI/payment instructions on invoices.
- A deployed provider webhook ready to receive trusted payment events.
- A deployed Razorpay checkout creation endpoint that uses server-side credentials only.
- Razorpay, Cashfree, Stripe, and generic webhook payload mapping.
- Payment review, payment application, refunds, and reversal history after trusted events arrive.

Until Razorpay credentials are added, Orbit Ledger must not claim that online checkout is live. The owner can still collect with UPI or manual payment details, and the app can prepare the exact Razorpay test-link payload for later account setup.

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

## Razorpay Account Setup + Test Mode Payment Link

This is the strict setup path to follow once the Razorpay account is available.

### Account Setup

1. Create or open the Razorpay account.
2. Keep the Razorpay dashboard in **test mode**.
3. Generate test API keys inside Razorpay. Store them only in secret storage. Do not place them in app code, docs, screenshots, or client-side settings.
4. Store the credentials in Firebase Secret Manager:

   ```text
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET
   ```

   Until real values are provided, these can remain as `not_configured`. The app will show that Razorpay is not connected and will not create live checkout links.

5. Add the Orbit Ledger webhook URL:

   ```text
   https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/providerWebhook
   ```

6. Add the webhook secret as `x-orbit-ledger-webhook-secret` if Razorpay account settings allow a custom header. If the dashboard only supports a webhook secret/signature flow, add a Razorpay signature verification adapter before accepting live traffic.
7. Enable payment, payment link, and refund events needed for:
   - successful payments,
   - pending or authorized payments,
   - failed payments,
   - processed refunds.
8. Create one test invoice in Orbit Ledger.
9. Open the invoice editor and choose **Create checkout link**. The request goes to the server-side Firebase Function. It never sends Razorpay secret keys to the browser.
10. Open the web Payments page and use **Copy Razorpay test link** if you need to inspect the provider payload. This produces a provider payload with:
   - amount in paise,
   - INR currency,
   - invoice reference,
   - customer name,
   - Orbit Ledger metadata in `notes`.

### Server Checkout Endpoint

Orbit Ledger now has this server-only checkout endpoint:

```text
https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/createRazorpayCheckout
```

Security rules for this endpoint:

- Only signed-in Firebase users can call it.
- The caller must own the workspace.
- The invoice must exist inside that workspace.
- The invoice must have a pending amount.
- Razorpay credentials stay in Firebase Secret Manager.
- If credentials are missing or still set to `not_configured`, the endpoint returns `provider_not_connected`.

Successful checkout creation stores a `payment_checkouts` record and updates the invoice with the latest provider checkout URL/reference.

### Test Payment Link Payload

Orbit Ledger now prepares a Razorpay payment-link draft in this shape:

```json
{
  "amount": 177000,
  "currency": "INR",
  "accept_partial": false,
  "description": "Rudraix PVT invoice WEB-641090",
  "reference_id": "INV-WEB-641090",
  "customer": {
    "name": "Sonali Traders"
  },
  "notify": {
    "sms": false,
    "email": false
  },
  "reminder_enable": true,
  "callback_url": "https://orbit-ledger-f41c2.web.app/pay",
  "callback_method": "get",
  "notes": {
    "orbit_workspace_id": "workspace_id",
    "orbit_invoice_id": "invoice_id",
    "orbit_invoice_number": "WEB-641090",
    "orbit_customer_id": "customer_id",
    "orbit_customer_name": "Sonali Traders"
  }
}
```

Important Razorpay test-mode note: Razorpay documents that UPI Payment Links are not supported in test mode. For test mode, create a standard payment link and keep UPI-specific live testing for the final verified live account path.

### What Must Happen After Payment

The redirect or payment-link status page is not enough proof. Orbit Ledger should update invoice payment status only after a trusted webhook is received and matched by metadata.

Expected result after a successful Razorpay test payment:

- Provider event is stored.
- Invoice is matched by `orbit_invoice_id` or `orbit_invoice_number`.
- Customer is matched by `orbit_customer_id` when available.
- Payment allocation is created once.
- Invoice payment state becomes `Paid` or `Partially paid`.
- Duplicate webhook delivery does not duplicate the payment.
- Refund webhook creates a reversal without deleting the original payment.

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
3. Store the Razorpay test credentials as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Firebase Secret Manager.
4. Add the Orbit Ledger webhook URL.
5. Add the secret header in Razorpay.
6. Enable payment success, pending/authorized, failed, and refund events.
7. Run `npm run smoke:razorpay-checkout:connected`.
8. Create a test invoice in Orbit Ledger.
9. Create a payment link carrying Orbit Ledger metadata.
10. Pay the invoice in Razorpay test mode.
11. Confirm the invoice becomes paid.
12. Retry the same event and confirm it does not duplicate.
13. Refund the test payment.
14. Confirm the invoice and customer balance reverse correctly.
15. Confirm the payment reversal record exists.
16. Only then switch Razorpay to live mode.

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
