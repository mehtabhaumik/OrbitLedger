# Live Collections Razorpay Sandbox Readiness

This is the Phase 9 readiness gate for turning Live Collections from prepared code into Razorpay sandbox traffic. It does not approve live customer payments by itself.

## Readiness Levels

1. `blocked`
   - Missing HTTPS endpoint, server secret, or failure-matrix proof.
   - Do not send signed Razorpay traffic.

2. `ready_for_signed_smoke`
   - HTTPS endpoints and server-side secrets are ready.
   - Run checkout and signed capture smoke tests.

3. `ready_for_real_test_payment`
   - Checkout and signed capture smoke have passed.
   - Run a real Razorpay test payment, duplicate retry, and refund test.

4. `ready_for_live_pilot`
   - Sandbox checks are complete.
   - Only then consider a limited live pilot with monitoring.

## Required Production Endpoints

```text
Checkout creation:
https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/createRazorpayCheckout

Live Collections webhook:
https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/razorpayLiveCollectionsWebhook

Public app:
https://orbit-ledger-f41c2.web.app

Hosted payment page:
https://orbit-ledger-f41c2.web.app/pay
```

## Required Server Secrets

These must exist in Firebase Secret Manager. They must not be committed or printed in web/mobile clients.

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

## Commands

Store test credentials only when real Razorpay test values are available:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx npm run setup:razorpay-test-keys
```

Run checkout smoke:

```sh
npm run smoke:razorpay-checkout:connected
```

Run signed Live Collections webhook boundary smoke:

```sh
RAZORPAY_WEBHOOK_SECRET=xxx npm run smoke:razorpay-live-collections-webhook
```

This validates method guard, signature rejection, signed payload verification, and payload mapping without creating Firestore records.

Run signed capture smoke:

```sh
RAZORPAY_WEBHOOK_SECRET=xxx npm run smoke:razorpay-capture
```

## Manual Razorpay Test Payment

After both smoke tests pass:

1. Create an invoice in a sandbox workspace.
2. Create an online payment link.
3. Pay with a Razorpay test method.
4. Confirm the webhook updates Orbit Ledger state.
5. Confirm notification, receipt, invoice paid amount, allocation, customer balance, and audit records.
6. Replay the webhook and confirm no duplicate allocation.
7. Refund the payment and confirm reversal and recalculated invoice balance.

## Live Pilot Guardrails

- Keep the pilot limited to one internal/test business first.
- Monitor `live_payment_events`, `live_payment_audit`, `live_payment_notifications`, `transactions`, `payment_allocations`, `payment_reversals`, and receipts.
- Keep manual UPI/bank instructions available as fallback.
- Do not enable broader live traffic until duplicate, failed, refund, missing invoice, and cancelled invoice cases have proof.

## Automated Evidence

- `packages/core/src/liveCollectionsSandboxReadiness.test.ts`
- `packages/core/src/liveCollectionsQa.test.ts`
- `docs/live-collections-razorpay-failure-matrix.md`
- `scripts/razorpay-live-collections-webhook-smoke.mjs`
- `scripts/razorpay-checkout-smoke.mjs`
- `scripts/razorpay-webhook-capture-smoke.mjs`
