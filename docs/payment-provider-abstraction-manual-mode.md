# Payment Provider Abstraction And Manual Provider Mode

Orbit Ledger does not currently have a real payment provider connected.

The active payment collection mode is:

```text
Manual collection
```

This means users should see and use:

- UPI/payment details on invoices.
- Payment messages.
- Manual payment recording.
- Cash, cheque, demand draft, bank transfer, UPI, card, wallet, and other recorded payment modes.
- Payment proof attachments.
- Payment clearance tracking.
- Provider event review only as a future-ready admin surface.

Users should not be pushed toward Razorpay checkout until real test credentials are configured and connected verification passes.

## Provider Modes

Orbit Ledger now uses a small provider abstraction:

```text
manual
razorpay_test_ready
razorpay_connected
```

### manual

Default mode.

Behavior:

- Online checkout CTAs are hidden.
- Invoice editor shows manual collection guidance.
- Payments page shows manual collection as active.
- Razorpay test-link copy controls are hidden.
- Payment page/manual details continue to work.

### razorpay_test_ready

Future setup mode.

Behavior:

- Provider setup and draft payload tools can be shown.
- Online checkout remains unavailable until real connected verification passes.
- Manual collection remains the active user workflow.

### razorpay_connected

Future connected mode.

Behavior:

- Online checkout CTAs can be shown.
- The server-side checkout function creates provider links.
- Provider webhooks update invoices only after signature validation and safe matching.

## Web Environment Switch

The web app reads:

```text
NEXT_PUBLIC_ORBIT_LEDGER_PAYMENT_PROVIDER_MODE
```

Allowed values:

```text
manual
razorpay_test_ready
razorpay_connected
```

If the value is missing or unknown, the app uses `manual`.

## UX Rule

No user-facing screen should say or imply that Razorpay checkout is available while Orbit Ledger is in manual mode.

Acceptable copy:

- Manual collection
- Payment details
- Payment page
- Record payment
- Copy payment message

Avoid in manual mode:

- Create Razorpay link
- Create checkout link
- Razorpay test link
- Online checkout is ready

## Current Status

Last verified: `2026-05-02`

- Manual provider mode is the default.
- Razorpay checkout CTAs are hidden in the invoice editor unless connected mode is enabled.
- Razorpay draft/test controls are hidden from the Payments page in manual mode.
- Server-side Razorpay code remains available for future connection.
- Real Razorpay payment testing remains blocked until real Razorpay credentials exist.
