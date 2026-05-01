# Manual Payment Verification + Received Payment Matching

Orbit Ledger now treats manual payment recording as a verification workflow, not a blind status change.

The rule is simple: an invoice becomes paid only when a payment is matched to it and the payment is cleared. A received cheque, post-dated cheque, deposited draft, or any other pending instrument can be recorded and matched, but it does not reduce the invoice or customer balance until it clears.

## What This Phase Adds

- Shared verification rules in `@orbit-ledger/core`.
- Clear payment actions:
  - Record verified payment
  - Record pending payment
  - Record payment note
- Web invoice editor now explains the invoice effect and balance effect before recording.
- Web transaction entry now has a verification selector for manual payments.
- Mobile transaction entry now shows the same verification outcome.
- Mobile invoice preview no longer offers a generic manual status change. Payment status should come from matched payments.
- Bounced or cancelled payment records do not reduce invoice due amounts.

## Verification Rules

Cleared:

- Reduces customer balance.
- Applies to the matched invoice.
- Can move invoice to partially paid or paid.

Received, post-dated, or deposited:

- Records the payment for follow-up.
- Keeps invoice in pending clearance when matched.
- Does not reduce the customer balance until marked cleared.

Bounced or cancelled:

- Records the payment note/history.
- Does not reduce invoice due amount.
- Does not reduce customer balance.

## Matching Rules

Payments can be handled as:

- Customer ledger only
- Oldest unpaid invoices
- Selected invoice

The invoice payment state is calculated from allocations and clearance, not from a free-form status dropdown.

## Next Phase

Recommended next phase: **Manual Payment Review Queue + Clearance Follow-Up**.

That phase should create one place where the owner can see received, post-dated, deposited, bounced, and cancelled payments that still need action.
