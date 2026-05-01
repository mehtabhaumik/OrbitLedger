# Manual Payment Review Queue + Clearance Follow-Up

Orbit Ledger now has a manual payment review queue for payments that need owner attention before they should affect balances.

This phase closes the gap between recording a manual payment and confidently applying it. A cheque, draft, bank transfer, or ledger payment can be saved as received, post-dated, deposited, bounced, cancelled, or cleared. The Payments page now gives the owner one place to review and update those records.

## What This Phase Adds

- Manual payment review queue on the web Payments page.
- Queue includes invoice-matched payments and ledger-only payments.
- Owner can verify a payment as cleared.
- Owner can mark a payment bounced.
- Queue shows:
  - customer,
  - amount,
  - payment mode,
  - invoice match when available,
  - current verification state,
  - follow-up impact.
- Ledger-only pending payments can now be cleared later and then reduce the customer balance.
- Invoice-matched pending payments can now be cleared later and then update invoice paid amount and payment status.

## Behavior Rules

Cleared:

- Reduces the customer balance.
- Updates matched invoice paid amount.
- Can move invoice to partially paid or paid.

Received, post-dated, deposited:

- Appears in the manual payment review queue.
- Does not reduce customer balance.
- Keeps matched invoice pending clearance.

Bounced:

- Remains visible for review.
- Does not reduce invoice due amount.
- Does not reduce customer balance.

Cancelled:

- Remains as history.
- Does not reduce invoice due amount.
- Does not reduce customer balance.

## Why This Matters

Small businesses often receive payments that are not final yet: post-dated cheques, drafts, promised bank transfers, or screenshots that still need verification. Orbit Ledger now handles those without pretending the money is already safe.

## Remaining Payment Track Phases

The remaining payment track is intentionally capped:

1. Payment Activity Timeline + Audit Trail
2. Payment Reminder Follow-Up from Review Queue
3. Customer Payment Page Polish
4. Provider Connection Readiness Gate

After those four, the payment system should stop expanding and move into QA/hardening unless a real provider account is available.
