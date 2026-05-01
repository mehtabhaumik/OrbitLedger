# Razorpay Dashboard Webhook Setup And Real Test Payment Run

This runbook is for connecting Orbit Ledger to a real Razorpay test-mode account.

Do not paste Razorpay keys or webhook secrets into this file, screenshots, chat, issue comments, or commits.

## Current Status

Orbit Ledger production is ready to receive Razorpay test-mode traffic, but the Razorpay account is not connected yet.

Current Firebase Secret Manager values are still placeholders:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Connected checkout and real payment capture cannot pass until real Razorpay test values are stored.

## Orbit Ledger Production Endpoints

Use these values in Razorpay test mode:

```text
Checkout creation:
https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/createRazorpayCheckout

Webhook URL:
https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/providerWebhook

Public app:
https://orbit-ledger-f41c2.web.app

Hosted payment page:
https://orbit-ledger-f41c2.web.app/pay
```

The webhook endpoint verifies Razorpay with:

```text
X-Razorpay-Signature
```

The signature is checked against:

```text
RAZORPAY_WEBHOOK_SECRET
```

## Step 1: Prepare Razorpay Test Mode

1. Log in to Razorpay Dashboard.
2. Switch to **Test Mode**.
3. Generate test API credentials.
4. Keep the key ID and key secret in a secure local shell only.
5. Create a separate webhook secret for Orbit Ledger test mode.

The webhook secret does not need to match the Razorpay API key secret.

## Step 2: Store Test Credentials In Firebase

From a secure local shell, run:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx npm run setup:razorpay-test-keys
```

This stores the values in Firebase Secret Manager and refuses placeholders.

Do not commit these values.

## Step 3: Configure Razorpay Webhook

In Razorpay Dashboard test mode:

1. Go to **Accounts & Settings**.
2. Open **Webhooks** under website/app settings.
3. Choose **Add New Webhook**.
4. Enter this webhook URL:

   ```text
   https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/providerWebhook
   ```

5. Enter the same webhook secret used for `RAZORPAY_WEBHOOK_SECRET`.
6. Add an alert email that someone actively monitors.
7. Enable only these events first:
   - `payment.captured`
   - `payment.authorized`
   - `payment.failed`
   - refund processed events such as `refund.processed`
8. Save the webhook.
9. Keep this webhook in **Test Mode** until every smoke test passes.

Do not enable extra events yet. Events that Orbit Ledger does not map can create noisy failures and may cause Razorpay to retry or disable the webhook.

## Step 4: Verify Connected Checkout Creation

Run:

```sh
npm run smoke:razorpay-checkout:connected
```

Expected result:

- Wrong methods are rejected with `405`.
- Unsigned checkout creation is rejected with `401`.
- A temporary sandbox user/workspace/invoice is created.
- Razorpay checkout creation returns `200`.
- Response includes a Razorpay checkout URL.
- A `payment_checkouts` record is created.
- Sandbox data is cleaned up.

If this still returns `provider_not_connected`, the Firebase secrets are missing or still placeholders.

## Step 5: Verify Signed Capture Webhook

Run this with the same webhook secret that was entered in Razorpay Dashboard:

```sh
RAZORPAY_WEBHOOK_SECRET=xxx npm run smoke:razorpay-capture
```

Expected result:

- A temporary sandbox user/workspace/customer/invoice is created.
- A Razorpay-shaped `payment.captured` payload is signed locally.
- Production webhook accepts the signature.
- Invoice `paid_amount` changes from `0` to `1770`.
- Invoice payment status becomes `paid`.
- Customer balance changes from `1770` to `0`.
- Sandbox data is cleaned up.

This proves Orbit Ledger’s webhook signature validation and ledger update path before taking a real customer payment.

## Step 6: Run A Real Razorpay Test Payment

After the two smoke tests above pass:

1. Open Orbit Ledger web.
2. Create or open a test invoice with a pending amount.
3. Choose **Create checkout link**.
4. Open the returned Razorpay test checkout link.
5. Pay with a Razorpay test payment method.
6. Wait for the webhook to arrive.
7. Open Orbit Ledger Payments.
8. Confirm the event is applied or ready for review.
9. Open the invoice.
10. Confirm the invoice payment status and customer balance are updated.

The invoice must not be marked paid from a redirect alone. The trusted source is the signed webhook.

## Step 7: Retry And Refund Checks

Before going live:

1. Re-send the same captured payment event from Razorpay Dashboard if available.
2. Confirm Orbit Ledger does not duplicate payment allocation.
3. Create a test refund in Razorpay Dashboard.
4. Confirm Orbit Ledger creates a reversal record.
5. Confirm invoice paid amount and customer balance are corrected.

## Current Blocker

This phase cannot complete the real Razorpay test payment because the actual Razorpay test credentials and webhook secret are not present in this workspace or Firebase Secret Manager.

Once credentials are supplied, run:

```sh
RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx npm run setup:razorpay-test-keys
npm run smoke:razorpay-checkout:connected
RAZORPAY_WEBHOOK_SECRET=xxx npm run smoke:razorpay-capture
```

Then perform the manual real test payment in Razorpay Dashboard/test checkout.

## References

- Razorpay Dashboard webhook setup: https://razorpay.com/docs/webhooks/setup-edit-payments/?preferred-country=US
- Razorpay webhook overview: https://razorpay.com/docs/webhooks/
- Razorpay payments webhook events: https://razorpay.com/docs/webhooks/payments/
- Razorpay webhook validation and testing: https://d6xcmfyh68wv8.cloudfront.net/docs/webhooks/validate-test/
- Razorpay webhook best practices: https://razorpay.com/docs/webhooks/best-practices/
