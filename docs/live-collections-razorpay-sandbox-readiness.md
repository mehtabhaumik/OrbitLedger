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

Before preparing a real sandbox payment proof, audit the stored secret mode. This command reads Firebase Secret Manager values through `gcloud`, verifies that the Razorpay key id is a test key, checks that the server secrets are usable, confirms local `gcloud` can provide an admin access token for controlled setup/cleanup, and does not print secret values.

```sh
npm run audit:razorpay-secret-mode
```

If this command reports that `RAZORPAY_KEY_ID` is not `rzp_test_...`, do not run the payment proof. Replace the Firebase Secret Manager values with real Razorpay test credentials first.

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

## Controlled Sandbox Smoke Sequence

Use the combined runner after Razorpay test keys are available locally. It refuses live keys, does not print secret values, and requires an explicit Firestore admin access token for controlled setup and cleanup because production Firestore rules correctly reject direct smoke seeding with a normal user token.

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run smoke:razorpay-controlled-sandbox
```

To store the test credentials in Firebase Secret Manager first, add `-- --store-secrets`:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run smoke:razorpay-controlled-sandbox -- --store-secrets
```

The runner executes:

1. Signed Live Collections webhook boundary smoke.
2. Authenticated checkout creation smoke.
3. Signed capture reconciliation smoke.

It still does not replace the manual Razorpay test payment below. The manual payment is required to prove Razorpay dashboard configuration, payment-link behavior, webhook delivery, and Orbit Ledger realtime UI together.

## Manual Razorpay Test Payment

After both smoke tests pass:

1. Create an invoice in a sandbox workspace.
2. Create an online payment link.
3. Pay with a Razorpay test method.
4. Confirm the webhook updates Orbit Ledger state.
5. Confirm notification, receipt, invoice paid amount, allocation, customer balance, and audit records.
6. Replay the webhook and confirm no duplicate allocation.
7. Refund the payment and confirm reversal and recalculated invoice balance.

For a controlled manual test, keep the checkout sandbox and write a proof file:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run smoke:razorpay-checkout:connected -- --keep --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

Or run the Phase 12 wrapper, which validates local test credentials, runs the signed boundary smoke, creates the kept checkout, writes the proof file, and prints the Razorpay test checkout URL:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run live-collections:razorpay-sandbox-payment -- --prepare-only --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

To store the test credentials before preparing the payment link:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run live-collections:razorpay-sandbox-payment -- --store-secrets --prepare-only --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

Pay the `checkoutUrl` from the proof file with a Razorpay test method. After the webhook has been delivered and reconciliation has run, verify Orbit Ledger state:

```sh
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run proof:razorpay-sandbox-payment -- --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

The same wrapper can verify an existing proof file:

```sh
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run live-collections:razorpay-sandbox-payment -- --verify-only --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

For an attended test, the wrapper can poll while the tester pays:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx \
RAZORPAY_KEY_SECRET=xxx \
RAZORPAY_WEBHOOK_SECRET=xxx \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN=xxx \
npm run live-collections:razorpay-sandbox-payment -- --poll-seconds=300 --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

The proof command checks:

- checkout status is captured,
- invoice payment status is allocation-derived,
- customer balance reduced,
- exactly one transaction and allocation exist,
- payment received notification exists,
- receipt exists,
- payment-applied audit exists,
- follow-up automation update exists.

## Phase 15 Gate

After the secret-mode audit and before any live-pilot decision, use the Phase 15 gate in `@orbit-ledger/core` to classify the current operator state:

1. `blocked_missing_test_credentials`
   - Razorpay test credentials or the Firestore admin token are not ready.
   - Do not prepare a checkout proof.

2. `blocked_readiness_incomplete`
   - Credentials are ready, but signed webhook, checkout, or capture smoke is incomplete.
   - Do not prepare a checkout proof.

3. `ready_to_prepare_payment_proof`
   - Credentials and smoke checks are ready.
   - Prepare a kept Razorpay test checkout and proof file.

4. `waiting_for_manual_test_payment`
   - Checkout proof exists, but captured-payment, duplicate-webhook, or refund proof is incomplete.
   - Do not start live-pilot review.

5. `ready_for_live_pilot_review`
   - Captured payment, duplicate webhook, refund, audit, allocation, receipt, and notification proof are complete.
   - Live pilot still requires explicit operator approval and monitoring.

This gate is intentionally server-state driven. Browser checkout success is not an input and cannot move the phase forward by itself.

Run the operator gate locally:

```sh
npm run live-collections:phase-gate
```

Use explicit evidence flags only after the named smoke/proof step has passed:

```sh
npm run live-collections:phase-gate -- \
  --signed-webhook-smoke-passed \
  --checkout-smoke-passed \
  --signed-capture-smoke-passed \
  --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

After the manual Razorpay test payment, duplicate webhook replay, and refund proof are verified:

```sh
npm run live-collections:phase-gate -- \
  --signed-webhook-smoke-passed \
  --checkout-smoke-passed \
  --signed-capture-smoke-passed \
  --manual-payment-verified \
  --duplicate-webhook-verified \
  --refund-verified \
  --proof-file=artifacts/razorpay-sandbox-payment-proof.json
```

The command reads server-side secret readiness and proof metadata without printing secret values.

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
