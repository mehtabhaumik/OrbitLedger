# Payment Activity Timeline + Audit Trail

Orbit Ledger now shows a payment activity timeline on the web Payments page.

The timeline is derived from existing trusted records instead of creating a second payment history. It combines manual payment transactions and provider payment events so the owner can quickly understand what happened recently.

## What This Phase Adds

- Recent manual payments in the Payments page timeline.
- Recent provider events in the same timeline.
- Amount, source, customer/payment details, clearance state, and event time.
- Direct invoice link when the activity is tied to an invoice.
- Provider reversal and applied-event states shown in the same audit view.

## Audit Rule

The timeline does not replace source records.

Source records remain:

- transactions,
- payment allocations,
- provider events,
- reversal records,
- invoices.

The timeline is a readable audit view over those records.

## Launch Value

Small business owners need to answer:

- What payment came in?
- Was it manual or provider-based?
- Was it cleared, pending, bounced, applied, or reversed?
- Which invoice did it affect?
- When did it happen?

This phase makes those answers visible without needing a full accounting audit module.
