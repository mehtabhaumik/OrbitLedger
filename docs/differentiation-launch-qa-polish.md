# Differentiation QA + Launch Polish

## Goal

Orbit Ledger’s differentiation work should feel like a coherent product promise, not a pile of features.

The launch promise is:

> Orbit Ledger helps small businesses know what to collect, what to review, what to send, what to fix, and whether the business day is under control.

This document closes the differentiation phase set and defines what must remain true before public launch.

## Differentiation Pillars

### 1. Daily Action Center

Launch expectation:

- home screen starts with what needs attention today,
- actions are specific and useful,
- summaries are clickable or route to the right workflow,
- mobile remains the primary command surface.

Pass condition:

- the owner can open the app and know the next action in under 10 seconds.

### 2. Collection Coach

Launch expectation:

- missed promises rank ahead of routine dues,
- reminder tone is suggested,
- follow-up actions are clear,
- customer language stays respectful.

Pass condition:

- the owner knows who to contact first and why.

### 3. Customer Trust Memory

Launch expectation:

- customer page shows relationship history,
- payments, invoices, reminders, promises, notes, disputes, and documents are visible,
- health labels avoid insulting wording.

Pass condition:

- a user can understand the customer relationship without searching across multiple screens.

### 4. Owner Closing Ritual

Launch expectation:

- day-end review covers collections, credit, pending payments, stock, documents, and tomorrow’s follow-up,
- saved closing state is understandable,
- language feels calm and practical.

Pass condition:

- the owner can close the business day in a few minutes.

### 5. Mistake Recovery Mode

Launch expectation:

- corrections preserve history,
- reversals and restores are guided,
- reason capture appears when needed,
- no destructive action feels casual.

Pass condition:

- user can fix mistakes without losing trust in old records.

### 6. Smart Document Pack

Launch expectation:

- documents go beyond invoice download,
- statements, notices, customer profiles, tax summaries, and audit packets are visible in the product direction,
- customer-facing documents do not expose internal template or plan labels.

Pass condition:

- documents feel like a business tool, not a file dump.

### 7. Local Business Intelligence

Launch expectation:

- country/state context shapes labels, payment wording, document readiness, and compliance review,
- India works now,
- US and UK remain upcoming until ready.

Pass condition:

- the product feels locally aware without pretending to provide legal advice.

### 8. Business Health Score

Launch expectation:

- score explains factors,
- every factor has a practical next step,
- score is consistent across web and mobile.

Pass condition:

- health score leads to action, not vanity metrics.

### 9. Voice And WhatsApp Fast Entry

Launch expectation:

- pasted or typed natural-language notes create review drafts,
- fast entry never silently saves money, invoices, customers, products, stock, or messages,
- missing fields and confidence are visible.

Pass condition:

- user saves typing time without losing control.

### 10. Founder-Safe Support

Launch expectation:

- user can request help,
- support preview shows what will be shared,
- private-looking details are redacted,
- diagnostics are opt-in,
- no business data is attached automatically.

Pass condition:

- user trusts support because privacy is visible.

## Launch Polish Rules

### Plain Language

Use:

- collect,
- review,
- send,
- fix,
- protect,
- close the day,
- payment proof,
- customer history.

Avoid on user screens:

- payload,
- webhook,
- stack trace,
- mutation,
- database,
- reconciliation engine,
- lifecycle state,
- provider adapter.

### Mobile-First Behavior

Every differentiation surface must remain:

- readable on phones,
- usable with one thumb where possible,
- no clipped pills,
- no huge CTAs,
- no horizontal overflow,
- no dense form walls,
- no drawer that pushes layout down.

### Review-First Trust

The following must never happen silently:

- save a fast-entry money record,
- send an automatic customer email without approval,
- attach private support data,
- overwrite an invoice version,
- clear a pending payment,
- delete a saved invoice,
- restore a backup.

### Actionable Summaries

Summaries should not be dead text.

Examples:

- `1 customer needs follow-up` opens the customer list/dialog.
- `1 invoice included this month` opens the invoice list/dialog.
- `2 payments pending clearance` opens payment review.
- `3 low-stock items` opens inventory review.

### Web And Mobile Parity

Different layouts are fine. Different meaning is not.

Shared behavior must remain consistent for:

- priority logic,
- health scoring,
- collection ranking,
- customer history categories,
- document pack availability,
- local intelligence signals,
- mistake recovery rules,
- fast-entry draft rules,
- support privacy rules.

## Final QA Checklist

Launch-blocking checks:

- Daily Action Center gives next actions.
- Collection Coach ranks follow-up work.
- Customer Trust Memory keeps relationship history.
- Owner Closing Ritual supports day-end review.
- Mistake Recovery preserves history.
- Smart Document Pack is useful beyond invoices.
- Local Business Intelligence stays country-aware.
- Business Health Score explains what to fix.
- Voice and WhatsApp Fast Entry is review-first.
- Founder-safe support protects private data.
- Mobile and web use the same feature meaning.
- Mobile-first polish is verified.

Non-blocking but important:

- copy stays plain and professional,
- empty states guide action,
- privacy copy stays visible,
- settings and support do not feel duplicated,
- paid features show value without blocking basic trust.

## Phase 23 Result

The shared QA module is now the reference for differentiation launch readiness:

- `ORBIT_LEDGER_DIFFERENTIATION_QA_CHECKS`
- `getLaunchBlockingDifferentiationQaChecks`
- `getDifferentiationQaReadiness`

This keeps the market-positioning work testable instead of only aspirational.
