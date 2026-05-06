# Mistake Recovery Mode Blueprint

## Goal

Mistake Recovery Mode makes Orbit Ledger forgiving without making business records loose. It should answer:

> I made a mistake. What is the safest way to fix it without losing trust in my records?

This phase defines the shared recovery model only. Mobile and web can expose different workflows, but both must follow the same recovery rules.

## Product Promise

Small businesses make real-world mistakes:

- a payment amount was entered wrong,
- a payment was linked to the wrong invoice,
- a cheque bounced after being recorded,
- an invoice was saved with the wrong tax or item,
- a customer was added twice,
- stock count was wrong,
- a protected setting was changed,
- a restore needs review.

Orbit Ledger should not punish users for mistakes. It should guide them to the right safe correction path.

## Core Rule

Do not silently overwrite business truth.

Use this model:

- Draft work can usually be edited directly.
- Saved invoices are corrected through versions, cancellation, or corrected copies.
- Payments that affect balances use corrections, moves, splits, or reversals.
- Customer balances use visible correction entries.
- Stock count changes use stock adjustments.
- Sensitive settings keep audit history.
- Restore recovery must show what changed before another restore or rollback.

## Recovery Areas

Mistake Recovery Mode covers:

1. Payments
2. Invoices
3. Customer ledger
4. Customers
5. Inventory
6. Documents
7. Settings
8. Backup and restore

## Recovery Actions

The shared model can recommend:

- Edit draft
- Create invoice revision
- Restore invoice version
- Cancel invoice
- Correct payment
- Move payment
- Reverse payment
- Add ledger correction
- Merge customer
- Mark customer inactive
- Adjust stock
- Send corrected document
- Review setting audit
- Open restore review

Each action should say what happens in plain language and whether a reason is required.

## Risk Levels

Use four risk levels:

- `Low`: safe direct edit, usually draft-only.
- `Review`: needs a reason and user confirmation.
- `Protected`: affects money, invoices, customer history, tax, payments, or reports.
- `Blocked`: must be reviewed before more changes are made.

Blocked examples:

- restore needs rollback review,
- restore result is unclear,
- wrong workspace restore risk,
- repeated correction would hide the real source of truth.

## Required Guardrails

The shared guardrails are:

- Never silently overwrite money history.
- Drafts can be edited directly; saved documents use versions, cancellation, or correction notes.
- Payment amount changes should create a correction or reversal when reports or allocations are affected.
- Customer-facing documents should keep the exact version that was sent.
- Sensitive settings need confirmation, reason, and audit history.
- Restore recovery should show what changed before another restore or rollback action.

## User-Facing Copy Rules

- Do not use accounting-heavy words when a plain phrase works.
- Say `Correction`, `Move payment`, `Create revision`, `Reverse payment`, and `Review restore`.
- Avoid blame. Do not say the user made a bad entry.
- Explain what stays visible and why.
- Never say backend, transaction log, database write, query, or mutation on user screens.

## Data Contract

The shared core contract lives in `packages/core/src/mistakeRecovery.ts`.

It returns:

- title,
- summary,
- sorted recovery actions,
- global guardrails,
- empty-state flag.

Each recovery action includes:

- area,
- title,
- message,
- primary action,
- target,
- risk,
- tone,
- whether a reason is required,
- whether history is preserved,
- guardrails.

## Product Behavior

Recovery items should be prioritized by risk:

1. Blocked restore or safety issues.
2. Protected payment and invoice corrections.
3. Customer-facing document corrections.
4. Ledger and customer cleanup.
5. Stock adjustments.
6. Low-risk draft edits.

No recovery card should be decorative. Every item must open the correct correction, reversal, revision, cleanup, or review flow.

## Mobile And Web Parity

Mobile should offer simple correction flows close to where the mistake is discovered.

Web should offer a wider recovery review surface for invoices, payments, customers, reports, and restore outcomes.

Both must share:

- same recovery actions,
- same risk labels,
- same history-preservation rules,
- same reason requirements,
- same blocked-recovery behavior.

## Next Phase

The next phase should add Mistake Recovery Mode UI surfaces:

- payment correction/reversal entry points,
- invoice revision and version recovery prompts,
- customer cleanup prompts,
- stock adjustment prompts,
- settings audit review prompts,
- restore recovery review.
