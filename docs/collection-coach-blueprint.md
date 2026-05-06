# Collection Coach Blueprint

## Goal

Collection Coach turns dues into guided recovery work. It should not be a generic reminder list. It should answer:

> Who should I contact first, why, and what should I say?

This phase defines the shared recommendation model for web and mobile.

## Required Signals

The coach should consume summary-ready customer signals:

- current balance
- days outstanding
- last payment date
- last reminder date
- reminder count
- overdue invoice count
- latest payment promise
- broken promise count
- customer health rank
- total business value later

## Coach Output

Each recommendation includes:

- customer
- balance label
- priority score
- priority label
- plain-language reason
- helper line
- next action
- reminder tone
- suggested message
- follow-up date

## Priority Order

The coach ranks customers using practical collection risk:

1. Missed payment promises.
2. Promises due today.
3. High-risk customers with old balances.
4. Overdue invoices.
5. Customers with no reminder history.
6. Routine outstanding balances.

## Next Actions

The coach can recommend:

- Call customer
- Send reminder
- Send statement
- Record payment
- Add payment promise
- Review customer

Every action should open a real screen or dialog. No dead summaries.

## Message Tone

Reminder tone must be respectful:

- Soft: routine follow-up.
- Firm: overdue or due-today work.
- Urgent: missed promise, high-risk customer, or repeated broken promise.

The app should not label customers as bad. Use calm wording such as `needs follow-up`, `watch closely`, or `high risk` only where the health model already uses it.

## Fast Loading Rule

Collection Coach should be built from customer summaries, promise summaries, invoice counters, and reminder metadata. It must not scan every ledger entry on first load.

## Mobile And Web Parity

Mobile can present this as a call/message queue.

Web can present this as a ranked review panel with filters and bulk statement/reminder actions.

Both must use the same shared scoring model from `packages/core/src/collectionCoach.ts`.

## Next Phase

The next phase should add Collection Coach UI surfaces and wire them to existing customer, promise, invoice, and reminder data.
