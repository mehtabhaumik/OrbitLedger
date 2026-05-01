# Production Payment Smoke Test And Provider Configuration Checklist

This document is the launch checklist for turning on a real payment provider for Orbit Ledger. It is intentionally strict because payment automation changes invoices, customer balances, ledger entries, and refund history.

Do not paste provider secrets into this document, screenshots, issue comments, support tickets, or chat messages.

## Current Production Endpoints

Current provider connection status: **not connected**. The production webhook and payment review tools are deployed, but there is no live Razorpay account or provider credential connected to Orbit Ledger yet.

- Public web app: `https://orbit-ledger-f41c2.web.app`
- Hosted payment page: `https://orbit-ledger-f41c2.web.app/pay`
- Provider webhook: `https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/providerWebhook`
- Razorpay checkout creation: `https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/createRazorpayCheckout`
- Function region: `asia-south1`
- Function runtime: `nodejs24`
- Internal provider secret header: `x-orbit-ledger-webhook-secret`
- Razorpay webhook signature header: `X-Razorpay-Signature`

The webhook also accepts `Authorization: Bearer <secret>` for providers that support bearer tokens more cleanly than custom headers. Razorpay webhooks should use `X-Razorpay-Signature`, verified with `RAZORPAY_WEBHOOK_SECRET`.

## Provider Payload Contract

Every provider event should be sent as a `POST` request with JSON.

Provider-specific mapping details are maintained in:

- `docs/payment-provider-selection-and-mapping.md`

The web Payments page can copy a Razorpay test payment-link draft. That draft contains no secrets. It is intended for the later Razorpay account setup phase and must remain in test mode until a real provider transaction has passed the full checklist.

The invoice editor can request a Razorpay checkout link from the server. Until `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` contain real test credentials, that request returns `provider_not_connected` and no checkout is created.

## Razorpay Test Credential Setup

Real Razorpay test keys must be set from a secure local shell. Do not paste them into docs or commit them.

Use:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx npm run setup:razorpay-test-keys
```

Then run:

```sh
npm run smoke:razorpay-checkout:connected
RAZORPAY_WEBHOOK_SECRET=xxx npm run smoke:razorpay-capture
```

Current local/Firebase verification:

- `RAZORPAY_KEY_ID` is still the placeholder value.
- `RAZORPAY_KEY_SECRET` is still the placeholder value.
- `RAZORPAY_WEBHOOK_SECRET` is still the placeholder value.
- Connected checkout verification cannot pass until real Razorpay test credentials are supplied.

Required fields:

- `workspaceId`
- `amount`
- Either `providerPaymentId` or `reference`

Recommended fields:

- `invoiceId` when the payment was created from an invoice payment link.
- `invoiceNumber` when the provider cannot store `invoiceId`.
- `customerId` when available.
- `source`: `upi`, `payment_page`, `bank_transfer`, `card`, `wallet`, or `other`.
- `status`: `succeeded`, `pending`, `failed`, or `refunded`.
- `currency`
- `payerName`
- `payerContact`
- `paidAt`

Example shape, with placeholder values only:

```json
{
  "workspaceId": "workspace_id",
  "invoiceNumber": "WEB-641090",
  "source": "payment_page",
  "status": "succeeded",
  "amount": 1770,
  "currency": "INR",
  "reference": "INV-WEB-641090",
  "providerPaymentId": "provider_payment_id",
  "payerName": "Customer name"
}
```

## Provider Configuration Checklist

1. Create or open the payment provider account.
2. Keep the provider in test mode.
3. Store provider credentials with `npm run setup:razorpay-test-keys`.
4. Add the production webhook URL.
5. Add the secret as `x-orbit-ledger-webhook-secret`, or as a bearer token if the provider cannot send custom headers.
6. Set the webhook method to `POST`.
7. Set the content type to JSON.
8. Configure success, pending, failed, and refund events.
9. Store `workspaceId` in provider metadata, payment notes, or webhook custom fields.
10. Store `invoiceId` in provider metadata when a payment is started from an invoice.
11. Store `invoiceNumber` as a fallback reference.
12. Confirm the provider sends payment amounts in the same currency unit Orbit Ledger expects.
13. Confirm refunds include the original provider payment ID or original invoice reference.
14. Create a checkout link from the invoice editor.
15. Run the smoke tests below.
16. Turn provider test mode off only after all smoke tests pass.

## Backend Access Checklist

The deployed webhook runs as the project compute service account. That service account must have enough access to read and write payment events, invoices, customers, allocations, transactions, and reversal records.

Required production access:

- Secret Manager access to `ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET`.
- Firestore read/write access for payment automation.
- Logging access so failed provider events can be diagnosed.
- Artifact Registry and source bucket access for function deploys.

Current production note:

- During the sandbox transaction test, the webhook initially returned `500` because the function service account did not have Firestore read/write access.
- The missing Firestore access was corrected by granting the function service account `roles/datastore.user`.
- The sandbox transaction test passed after that permission was applied.

## Production Smoke Tests

These tests should be run every time the webhook code, payment page, provider dashboard setup, or Firebase project configuration changes.

### 1. Webhook Rejects Untrusted Calls

Send a `POST` request without the secret header.

Expected result:

- HTTP `401`
- Body includes `unauthorized`
- No ledger changes
- No invoice changes

### 2. Webhook Rejects Wrong Methods

Send a `GET` request to the webhook URL.

Expected result:

- HTTP `405`
- Response includes `Allow: POST`
- No ledger changes
- No invoice changes

### 3. Webhook Validates Trusted Payloads

Send a `POST` request with the correct secret but without required payment fields.

Expected result:

- HTTP `400`
- Body includes a validation error such as `workspace_required`
- No ledger changes
- No invoice changes

### 4. Hosted Payment Page Loads

Open:

```text
https://orbit-ledger-f41c2.web.app/pay
```

Expected result:

- Page loads with HTTP `200`
- Page is readable on mobile and desktop
- Payment details from invoice links are understandable to the customer

### 5. Razorpay Checkout Endpoint Is Safe Before Credentials

Run:

```sh
npm run smoke:razorpay-checkout
```

Expected result when Razorpay credentials are still placeholders:

- `GET` to checkout creation returns `405`.
- Unsigned checkout creation returns `401`.
- A temporary signed-in sandbox user can create a sandbox workspace and invoice.
- Signed checkout creation reaches the server credential gate.
- Response is `503 provider_not_connected`.
- No Razorpay checkout link is created.
- Sandbox user, workspace, customer, and invoice are cleaned up.

Expected result after real Razorpay test credentials are stored:

```sh
npm run smoke:razorpay-checkout:connected
```

- `GET` to checkout creation returns `405`.
- Unsigned checkout creation returns `401`.
- A temporary signed-in sandbox user can create a sandbox workspace and invoice.
- Signed checkout creation returns `200`.
- Response includes a Razorpay checkout URL.
- A `payment_checkouts` record is created.
- The sandbox workspace is cleaned up.

### 6. Payment Admin Page Loads

Open:

```text
https://orbit-ledger-f41c2.web.app/payments
```

Expected result:

- Page loads with HTTP `200`
- Signed-in owner can see provider setup details
- Setup checklist is visible
- Event review table loads without layout overflow

### 7. Successful Payment Updates Invoice

Use a test invoice with an unpaid balance.

Provider event:

- `status`: `succeeded`
- Match by `invoiceId` when possible
- Match by `invoiceNumber` only as fallback

Expected result:

- One provider event is created.
- One payment transaction is created.
- One payment allocation is created.
- Invoice `paid_amount` increases once.
- Invoice payment status changes to `paid` or `partially_paid`.
- Customer balance decreases by the received amount.
- Re-sending the same provider event does not duplicate the payment.

### 8. Unmatched Payment Waits For Review

Send a successful test payment without a matching invoice.

Expected result:

- Event appears in Payments.
- Event does not change invoice totals automatically.
- Owner can choose an invoice and apply it manually.

### 9. Pending Or Failed Payment Does Not Mark Invoice Paid

Send events with:

- `status`: `pending`
- `status`: `failed`

Expected result:

- Event is stored for review.
- Invoice remains unpaid or partially paid.
- Customer balance is not reduced.

### 10. Refund Creates Reversal History

Refund a previously applied test payment.

Expected result:

- Original payment remains in history.
- A reversal ledger entry is created.
- A `payment_reversals` record is created.
- Invoice `paid_amount` is reduced.
- Invoice payment status is recalculated.
- Customer balance increases by the refunded amount.
- Re-sending the same refund does not duplicate the reversal.

### 11. Owner Manual Reversal Works

In Payments, open an applied payment event and use `Reverse`.

Expected result:

- Owner sees confirmation first.
- Original payment remains in history.
- Reversal entry is created.
- Invoice and customer balances are corrected.

## Go-Live Acceptance

Payments are ready for live provider traffic only when all items are true:

- Function is deployed in `asia-south1`.
- Function runtime shows `nodejs24`.
- Provider secret is stored in Firebase Secret Manager.
- Function service account has Firestore read/write access.
- Public calls without the secret return `401`.
- `GET` returns `405`.
- Hosted payment page returns `200`.
- Payment admin page returns `200`.
- Success, unmatched, pending, failed, refund, and manual reversal tests pass.
- Provider dashboard is switched from test mode to live mode.
- First live payment is monitored in Payments immediately after checkout.

## Operational Notes

- Rotate the provider secret if it appears in logs, support messages, screenshots, or a provider dashboard used by the wrong person.
- Never send the secret in a URL query string.
- Keep the provider in test mode when changing payload mappings.
- Preserve original payment entries even after refunds; use reversals for audit history.
- Review unmatched payments daily until provider matching is fully proven.

## Latest Sandbox Transaction Result

Last verified: `2026-05-02`

Sandbox workspace:

- `sandbox_payment_smoke_1777666574025`

Result:

- Sandbox workspace created.
- Successful payment event returned HTTP `200`.
- Invoice paid amount changed from `0` to `1770`.
- Invoice payment status changed to `paid`.
- Customer balance changed from `1770` to `0`.
- One payment transaction was created.
- One payment allocation was created.
- Duplicate payment event was detected and did not duplicate ledger records.
- Refund event returned HTTP `200`.
- Refund created one reversal transaction.
- Refund created one `payment_reversals` record.
- Invoice paid amount returned to `0`.
- Invoice payment status returned to `unpaid`.
- Customer balance returned to `1770`.
- Duplicate refund was detected as `already_reversed`.
- Sandbox workspace cleanup completed.

## Latest Razorpay Checkout Smoke Result

Last verified: `2026-05-02`

Command:

```sh
npm run smoke:razorpay-checkout
```

Sandbox workspace:

- `sandbox_razorpay_checkout_1777670302115`

Result:

- Checkout endpoint rejected wrong methods with HTTP `405`.
- Checkout endpoint rejected unsigned calls with HTTP `401`.
- Temporary Firebase smoke user was created.
- Sandbox workspace and invoice were created.
- Signed checkout request returned HTTP `503`.
- Response was `provider_not_connected`.
- This is expected because `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are still placeholder values.
- Sandbox cleanup completed.

## Latest Razorpay Signature Smoke Result

Last verified: `2026-05-02`

Result:

- `RAZORPAY_WEBHOOK_SECRET` placeholder was created in Firebase Secret Manager so deployment can bind the secret.
- Placeholder webhook secrets are treated as disabled and cannot authorize a webhook.
- A Razorpay-style signed request using the placeholder secret returned HTTP `401`.
- `npm run smoke:razorpay-capture` refuses to run unless a real local `RAZORPAY_WEBHOOK_SECRET` is provided.
