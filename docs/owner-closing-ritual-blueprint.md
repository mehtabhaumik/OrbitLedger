# Owner Closing Ritual Blueprint

## Goal

Owner Closing Ritual turns the end of the day into a calm business habit. It should answer:

> Is today closed cleanly, and what should I handle first tomorrow?

This phase defines the shared closing model only. Mobile and web can use different layouts, but both must follow the same closing checks, flags, and tomorrow action rules.

## Product Promise

The ritual should take about three minutes. It is not an accounting worksheet. It is a guided review that helps the owner avoid missed payments, wrong balances, forgotten credit, stock surprises, and unclear follow-up work.

## Required Checks

The closing flow has six fixed checks:

1. Cash check
2. Payments recorded
3. Credit given
4. Stock check
5. Tomorrow plan
6. Save closing

Each check should show:

- what the owner should confirm,
- the value being reviewed,
- whether the check is complete,
- a plain helper line,
- the next action.

## Required Signals

The shared model consumes:

- cash collected today,
- expected cash,
- counted cash,
- payments recorded amount,
- payment count,
- pending payment verification count,
- pending payment clearance count,
- credit given amount,
- credit count,
- unreviewed credit count,
- stock movement count,
- low-stock count,
- stock mismatch count,
- customers due tomorrow,
- overdue customers,
- promises due tomorrow.

These should come from saved summaries, counters, or today-scoped records. The ritual must not scan an entire workspace history on load.

## Closing Flags

The ritual highlights the items that should be reviewed before the day is closed:

- Cash difference
- Payments need review
- Credit needs confirmation
- Stock needs attention
- Tomorrow follow-up

Flags must be calm and actionable. Do not use scary accounting language. Each flag must have a clear action such as `Check cash`, `Review payments`, `Review credit`, `Review stock`, or `Plan follow-up`.

## Tomorrow Actions

The closing summary should produce a short next-day list:

- Start with collections
- Verify payments
- Review stock
- Open clean tomorrow

This list is part of the product value. It turns closing into tomorrow’s first useful screen.

## User-Facing Copy Rules

- Use plain business language.
- Do not say ledger reconciliation, journal, backend, sync, query, or job on user screens.
- Avoid blame. Use `needs review`, `should be checked`, and `ready for closing`.
- Do not bury mismatch warnings in reports.
- The owner should understand the day’s risk without opening a spreadsheet.

## Data Contract

The shared core contract lives in `packages/core/src/ownerClosingRitual.ts`.

It returns:

- title,
- summary,
- ordered closing steps,
- closing flags,
- tomorrow actions,
- completion state,
- empty-state flag.

Each step includes:

- id,
- title,
- prompt,
- value,
- helper,
- tone,
- completed state,
- action label and target.

## Mobile And Web Parity

Mobile should make this a quick, one-handed end-of-day flow.

Web can show a wider review surface with side-by-side checks and history.

Both must share:

- same step order,
- same mismatch rules,
- same flag labels,
- same tomorrow action rules,
- same ready-to-close behavior.

## Save Behavior

The UI should let the owner save a closing summary only after open flags are reviewed or intentionally acknowledged. The saved record should include:

- closing date,
- completed checks,
- open or acknowledged flags,
- cash difference if any,
- today’s payment and credit totals,
- stock review state,
- tomorrow actions.

## Next Phase

The next phase should add the Owner Closing Ritual UI. Mobile should get the fast closing flow first; web should show the same checks as an office review surface.
