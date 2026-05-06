# Customer Trust Memory Blueprint

## Goal

Customer Trust Memory turns a customer page into a relationship record, not only a ledger. It should answer:

> What happened with this customer, what can I trust, and what should I remember before the next action?

This phase defines the shared model for web and mobile.

## Required Signals

The memory should combine:

- credit and payment entries
- invoices and saved documents
- payment reminders
- payment promises
- missed promises
- important notes
- dispute notes
- current balance
- customer health
- last payment

## Output

The shared model returns:

- relationship title
- plain-language summary
- summary cards
- timeline events
- filter counts
- empty state

## Timeline Categories

- Money
- Documents
- Reminders
- Promises
- Notes
- Disputes

Disputes are separated from ordinary notes because they affect trust, collection tone, and whether the user should extend more credit.

## Summary Cards

The first customer memory surface should show:

- Current balance
- Payment behavior
- Promise memory
- Notes and disputes
- Documents

## Sorting Rule

Newest events appear first. When events happen at the same time, more sensitive relationship context appears first:

1. Disputes
2. Notes
3. Promises
4. Reminders
5. Money
6. Documents

## User-Facing Rules

- Do not call a customer bad.
- Do not hide missed promises.
- Do not mix disputes into ordinary notes.
- Use clear labels like `Promise missed`, `Firm reminder sent`, `Payment recorded`, and `Invoice INV-001`.
- Every item should preserve the original source record. The memory view is a read model, not a second copy of business truth.

## Fast Loading Rule

The memory should use paginated customer detail records and saved summaries where possible. It should not load every historical transaction for a workspace on first page load.

## Mobile And Web Parity

Mobile already has a customer trust timeline concept. Web and mobile should converge on the shared model in `packages/core/src/customerTrustMemory.ts`.

Web can use a wider timeline with filter chips and summary cards. Mobile can use stacked cards and quick actions. The event labels, categories, tones, and ordering should remain consistent.

## Next Phase

The next phase should wire this shared Customer Trust Memory model into the customer detail UI and replace any separate timeline behavior that drifts from the shared model.
