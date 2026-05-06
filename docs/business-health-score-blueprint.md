# Business Health Score Blueprint

## Goal

Orbit Ledger should give the owner one plain, trusted answer:

> Is my business under control today?

The Business Health Score is not an accounting score and not a vanity metric. It is a daily control score built from practical signals:

- collections,
- invoices,
- payment verification,
- stock pressure,
- backup safety,
- document readiness,
- local setup,
- daily closing rhythm.

The score should tell the owner what needs attention and where to act next.

## Product Promise

Orbit Ledger helps the owner see business health without reading a wall of reports.

The owner should be able to open the app and quickly know:

- who needs follow-up,
- which invoices are unpaid or overdue,
- which payments are not trusted yet,
- whether stock could block sales,
- whether backup protection is healthy,
- whether documents and local settings are ready,
- whether today can be closed cleanly.

## Score Meaning

Use a 0-100 score:

- `90-100`: Excellent
- `76-89`: Steady
- `58-75`: Watch closely
- `40-57`: Needs action
- `0-39`: At risk

Tone:

- Healthy
- Watch
- Action
- Critical

The score must always show the top reason. A score without an explanation feels arbitrary.

## Launch Surfaces

### Collections

Signals:

- receivable amount,
- receivable change,
- customer count,
- risky customer count,
- overdue customer count,
- collection rate.

User promise:

- show whether dues need follow-up before they become stale.

Action:

- open Collection Coach.

### Invoices

Signals:

- unpaid invoice count,
- overdue invoice count,
- invoice payment state.

User promise:

- show invoice work that could affect cash flow.

Action:

- open Invoices.

### Payments

Signals:

- pending payment count,
- pending clearance count,
- manual review queue.

User promise:

- show whether received money can be trusted.

Action:

- open Payment Review.

### Inventory

Signals:

- low stock count,
- out-of-stock count,
- stock units.

User promise:

- show whether stock could block sales or delivery.

Action:

- open Inventory.

### Backup

Signals:

- backup status,
- backup age,
- last backup result.

User promise:

- show whether business records are protected.

Action:

- open Backup.

### Documents

Signals:

- document defaults,
- template settings,
- payment wording,
- export readiness.

User promise:

- show whether customer-facing documents are ready to send.

Action:

- open Documents.

### Local Setup

Signals:

- country,
- tax setup,
- payment instructions,
- currency,
- address/phone formatting.

User promise:

- show whether the workspace feels locally ready.

Action:

- open local settings.

### Daily Rhythm

Signals:

- daily closing open items,
- today review state.

User promise:

- show whether the day can be closed without loose ends.

Action:

- open Daily Closing.

## Scoring Rules

Start from 100 and subtract impact from open risk factors.

Collection factors usually have the highest impact because cash control is the product’s center of gravity.

Suggested impact order:

1. Collections
2. Backup failure or missing backup
3. Payment verification
4. Overdue invoices
5. Inventory pressure
6. Local setup
7. Document readiness
8. Daily closing

The score should recover as the user resolves open items. This makes the score feel motivating instead of judgmental.

## Output Model

The shared model returns:

- title,
- score,
- grade,
- label,
- tone,
- summary,
- top factor,
- all factors,
- positive signals,
- guardrails.

Each factor includes:

- area,
- label,
- value label,
- impact,
- priority,
- tone,
- message,
- action label,
- action target.

## Action Flows

Every score action target must resolve to a concrete user flow on both web and mobile.

The shared action flow registry defines:

- target,
- label,
- user goal,
- primary action label,
- web route,
- mobile screen,
- completion signal.

Launch action flows:

| Factor area | Web flow | Mobile flow | Completion signal |
| --- | --- | --- | --- |
| Collections | Reports action dialog | Get Paid | Customer follow-up list reviewed or customer opened. |
| Invoices | Invoices / invoice action dialog | Invoices | Invoice opened, paid, revised, cancelled, or reviewed. |
| Payments | Payments / manual review dialog | Payment event review | Payment cleared, corrected, bounced, reversed, or left for follow-up. |
| Inventory | Products / stock action dialog | Products | Product stock reviewed or reorder action started. |
| Backup | Backup | Backup & Restore | Backup exported, restore reviewed, or backup reminder checked. |
| Documents | Documents | Statement batch | Document previewed, exported, sent, or settings reviewed. |
| Local setup | Settings invoice/document section | Business profile settings | Local tax, payment, document, or business settings saved. |
| Daily rhythm | Reports daily closing section | Daily Closing | Daily closing review opened or saved. |

This avoids dead-end score cards. A health factor should always answer:

1. What is wrong or ready?
2. Why does it matter?
3. Where do I go now?
4. How do I know it was handled?

## Guardrails

- The score must explain what changed and what to do next.
- A low score should never shame the business owner; it should point to recoverable actions.
- Money-impacting actions must link to review flows, not silently change records.
- Tax, local, and audit signals should use review wording and avoid legal guarantees.
- The score should be recalculated from saved business data and never manually typed by the user.
- Mobile and web may show different layouts, but the score meaning and factors must match.

## UI Direction

Web:

- show score on Reports and Home,
- show top factor and action,
- show factor cards,
- link factors to actionable dialogs/pages.

Mobile:

- show score on Business Health Snapshot,
- keep top action first,
- show factor cards as tappable rows,
- avoid dense chart-heavy UI.

## Why This Stands Apart

Most small-business apps show reports. Orbit Ledger should show control.

The score is useful because it combines:

- cash,
- customers,
- invoices,
- payments,
- stock,
- backup,
- documents,
- local readiness,
- daily closing.

That makes it feel like a daily business control system, not just billing software.
