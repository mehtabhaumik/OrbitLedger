# Daily Action Center Blueprint

## Goal

Orbit Ledger should feel like a daily business control app. The first daily screen should answer one question:

> What should I do now to protect cash, customers, stock, and records?

This phase defines the shared blueprint only. Web and mobile screens can have different layouts, but they must consume the same action model.

## Daily Signals

The Daily Action Center is built from lightweight summaries and counters, not heavy customer or invoice reads.

Required signals:

- Collections due: customer count, amount due, customer list for drill-down.
- Unpaid invoices: invoice count, overdue count, unpaid amount, invoice list for drill-down.
- Stock attention: low-stock count, out-of-stock count, product list.
- Payment review: pending verification count, pending clearance count, payment review list.
- Backup health: backup state, age, last result.
- Business health: current week value, previous week value, trend.
- Daily closing: completed state and open closing items.

## Product Behavior

The screen should sort actions by business urgency:

1. Payments that need review.
2. Overdue invoices.
3. Collections due today.
4. Stock that can affect sales.
5. Backup risk.
6. Business slowdown.
7. Daily closing.

Each summary must be actionable. If a card says customers need follow-up, the action opens the list of those customers. If a card says invoices are overdue, the action opens the invoice list. No dead summaries.

## User-Facing Copy Rules

- Use clear business language.
- Avoid technical words on screens.
- Avoid vague dashboard copy.
- Prefer action labels such as `Review payments`, `Open collections`, `Review invoices`, and `Start closing`.
- Do not expose internal terms such as query, counter, backend, sync job, or queue.

## Data Contract

The shared core contract lives in `packages/core/src/dailyActionCenter.ts`.

It returns:

- title
- summary
- top action
- sorted action items
- empty-state flag

Each action item includes:

- area
- title
- message
- value
- priority
- tone
- action label
- target
- detail dialog key

## Fast Loading Rule

This feature must load from already-computed summaries, Firestore counters, server-side summaries, or paginated lists. It should not scan every customer, invoice, payment, product, and transaction on first load.

## Mobile And Web Parity

Mobile can show stacked cards or a command-center feed.

Web can show a wider action board with drill-down dialogs.

The behavior must remain the same:

- same priority order,
- same action categories,
- same empty state,
- same drill-down expectations,
- same summary-to-action rule.

## Next Phase

The next implementation phase should add the Daily Action Center UI and wire it to existing summary data without changing the data contract.
