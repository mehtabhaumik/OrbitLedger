# Orbit Ledger 100% SaaS Launch Readiness Phases

This is the strict execution plan for taking Orbit Ledger from strong beta foundation to public
SaaS launch quality.

The product direction is mobile-first. Web must feel like a polished companion workspace, not the
primary product unless the mobile app is already excellent.

## Global Rules

- Mobile comes first in every product decision.
- No user screen should expose implementation wording such as sync metadata, revisions, payloads,
  local cache, server state, Firestore, SQLite, API, backend, or technical error details.
- Every screen must be easy to understand for a small business owner.
- Every action must have enough spacing, tap target size, loading state, empty state, error state,
  and recovery path.
- Every destructive action must have a clear confirmation step.
- Every paid feature must be truthful, restorable, and tested through the store flow.
- Every cloud data path must be protected by deployed rules and abuse controls before public launch.
- Every phase must end with typecheck, build checks where applicable, and a real device/browser QA
  pass.

## Launch Quality Scorecard

The product is not public-launch-ready until every area below is green.

| Area | Required State |
| --- | --- |
| Mobile UX | Fast, polished, one-handed friendly, no cramped controls, no confusing wording |
| Web UX | Responsive, clean, complete workflows, no stretched mobile patterns |
| Data Security | Locked-down cloud access, verified ownership checks, safe restore flows |
| Speed | Main screens feel instant, heavy actions show progress, large data stays usable |
| Billing | Store-tested, restorable, no accidental unlocks, clear plan messaging |
| Reliability | Tested backup, restore, sync, conflict, offline, and reinstall flows |
| Support | Friendly errors, help surfaces, feedback, diagnostics, release notes |
| Compliance | Privacy policy, terms, app store disclosures, data deletion path |
| Operations | CI, release checklist, monitoring, rollback plan, incident process |

---

## Phase 21 - Mobile UX Spacing And Navigation Hardening

Prompt keyword:

`EXECUTE SAAS PHASE 21`

Goal:

Make the mobile app feel calm, roomy, and obvious on real devices.

Scope:

- Audit every mobile screen for cramped spacing, stuck buttons, crowded cards, long labels, clipped
  text, unsafe-area issues, keyboard overlap, and tiny tap targets.
- Standardize screen padding, section gaps, card spacing, bottom action spacing, and list row height.
- Make primary actions easy to reach without crowding content.
- Ensure bottom navigation never overlaps scroll content or action bars.
- Add consistent loading, empty, error, and success states.
- Remove technical wording from all mobile screens.
- Verify forms on small Android, large Android, iPhone, and tablet widths.

Exit criteria:

- No button touches a card, input, footer, keyboard, or screen edge unintentionally.
- Every tap target is at least 48px high.
- Every screen can be understood without reading technical language.
- Mobile screenshots pass visual QA in light mode across small and large devices.

---

## Phase 22 - Mobile Core Workflow Completion

Prompt keyword:

`EXECUTE SAAS PHASE 22`

Goal:

Make the daily business flows complete and smooth before expanding polish elsewhere.

Scope:

- Business setup and edit.
- Customer add, edit, search, archive, restore, and detail review.
- Credit/payment add and edit.
- Customer statement preview/export/share.
- Invoice create, edit, preview, issue, mark paid, cancel, and export.
- Product add/edit, low-stock handling, invoice item selection, and stock adjustment.
- Backup export, preview, restore, and post-restore confirmation.
- PIN and biometric lock setup, unlock, timeout, disable, and recovery wording.

Exit criteria:

- A user can run a real small business day from mobile without opening web.
- No primary flow ends in a placeholder, “later,” or incomplete screen.
- Every save has clear progress and friendly failure handling.

---

## Phase 23 - Mobile Performance And Large Data Readiness

Prompt keyword:

`EXECUTE SAAS PHASE 23`

Goal:

Make the mobile app fast with real business data.

Scope:

- Test with 100 customers / 1,000 transactions.
- Test with 1,000 customers / 20,000 transactions.
- Keep dashboard first view fast.
- Keep customer search instant.
- Keep ledger detail smooth with long histories.
- Keep invoice editing responsive with many items.
- Keep backup/export/restore from freezing the app.
- Add progress steps for PDF generation, backup, restore, and large imports.

Exit criteria:

- Main daily actions feel instant on mid-range Android.
- Heavy actions show clear progress and never look frozen.
- Performance reports are saved with before/after numbers.

---

## Phase 24 - Cloud Security And Access Rules

Prompt keyword:

`EXECUTE SAAS PHASE 24`

Goal:

Make cloud data safe enough for public users.

Scope:

- Add deployable Firebase project files.
- Add Firestore rules for workspace ownership.
- Add rule tests for allowed and denied access.
- Add App Check where supported.
- Split development and production environments.
- Remove hardcoded fallback production config from app code.
- Add rate limits or abuse protection around account and workspace creation where possible.
- Add safe error messages that do not reveal internal details.

Exit criteria:

- A signed-in user can access only their own workspace data.
- A different signed-in user cannot read, write, restore, or list another user’s workspace.
- Public unauthenticated reads/writes are denied.
- Rule tests are part of CI.

---

## Phase 25 - Cloud Data Model And Speed

Prompt keyword:

`EXECUTE SAAS PHASE 25`

Goal:

Make cloud reads and writes fast, predictable, and affordable.

Scope:

- Replace full-collection browser calculations with paginated reads and stored summaries.
- Add customer balance summaries.
- Add dashboard summary records.
- Add invoice totals and status counts.
- Add search-friendly fields for customers and invoices.
- Add pagination on web and mobile synced views.
- Add retry and offline-friendly save states.
- Add friendly “still working” messages for slow networks.

Exit criteria:

- Dashboard does not need to read all customers and all transactions.
- Customer list does not need to read all transactions.
- Invoice and report screens stay fast with large workspaces.
- Slow networks degrade gracefully.

---

## Phase 26 - Sync, Conflict, And Multi-Device Trust

Prompt keyword:

`EXECUTE SAAS PHASE 26`

Goal:

Make mobile and web agree without silent data loss.

Scope:

- Test mobile-to-web sync.
- Test web-to-mobile sync.
- Test two devices editing the same customer.
- Test append-only transaction behavior.
- Test invoice edit conflicts.
- Test offline edits followed by reconnect.
- Add conflict review screens with plain-language choices.
- Add clear status labels such as “Saved,” “Waiting to upload,” and “Needs review.”

Exit criteria:

- No silent overwrite.
- No duplicate customer or invoice records from normal retry.
- Users can resolve conflicts without technical wording.
- Sync status is truthful and calm.

---

## Phase 27 - Web SaaS Workflow Completion

Prompt keyword:

`EXECUTE SAAS PHASE 27`

Goal:

Make web a complete polished workspace, not a partial shell.

Scope:

- Dashboard with real follow-up priorities and recent work.
- Customer search, filters, detail page, ledger, edit, archive, and statement actions.
- Transaction add/edit with date and customer shortcuts.
- Full invoice editor with customer, items, tax, preview, export, issue, payment state, and cancel.
- Reports with date filters, receivables, collections, sales, aging, and export.
- Backup with export, import preview, typed confirmation, restore progress, and restore result.
- Settings with business profile, security, billing, workspace, and data controls.

Exit criteria:

- No web screen says “later,” “future,” or describes a workflow that is not available.
- Web works on desktop, tablet, and mobile browser widths.
- Web pages use tables where useful and compact controls where appropriate.

---

## Phase 28 - Design System Polish And Responsive QA

Prompt keyword:

`EXECUTE SAAS PHASE 28`

Goal:

Make every screen feel intentionally designed.

Scope:

- Define mobile and web spacing rules in shared tokens.
- Standardize button sizes, input heights, chips, lists, tables, panels, modals, and action bars.
- Add icons for common actions where they improve recognition.
- Load and pin the intended font instead of relying on fallback behavior.
- Remove decorative or oversized UI that slows daily work.
- Check text wrapping and clipping at all supported widths.
- Check forms with validation messages visible.
- Check long business names, customer names, invoice numbers, and currency values.

Exit criteria:

- No clipped text.
- No overlapping UI.
- No accidental horizontal scroll.
- No awkward empty gaps or cramped clusters.
- Screens look polished with real data, empty data, and error states.

---

## Phase 29 - Product Copy And Plain-Language Audit

Prompt keyword:

`EXECUTE SAAS PHASE 29`

Goal:

Make the app sound trustworthy, simple, and human.

Scope:

- Replace technical labels and messages with user-centered language.
- Replace “sync,” “cache,” “payload,” “revision,” “database,” and internal names on user screens
  unless there is no simpler truthful word.
- Standardize success and error messages.
- Make payment, backup, restore, lock, and billing wording precise but not scary.
- Add helpful empty states that suggest the next action.
- Remove marketing filler from operational screens.

Exit criteria:

- A non-technical business owner can understand every screen.
- Error messages say what happened and what to do next.
- Trust-critical screens are honest without exposing internals.

---

## Phase 30 - Billing, Plans, And Entitlement Hardening

Prompt keyword:

`EXECUTE SAAS PHASE 30`

Goal:

Make paid access reliable and launch-safe.

Scope:

- Complete Android Play Billing QA.
- Decide iOS billing launch approach before iOS public release.
- Add server-side receipt validation or an approved equivalent before relying on paid SaaS access.
- Test purchase, cancel, pending, failed, restore, app restart, reinstall, and revoked purchase cases.
- Make plan cards clear and non-misleading.
- Ensure free features remain usable.
- Ensure paid features do not unlock without valid entitlement.

Exit criteria:

- Store testing passes.
- Entitlements survive restart and reinstall through restore.
- Revoked purchases do not keep paid access forever.
- Billing copy is plain and honest.

---

## Phase 31 - Backup, Restore, And Data Safety Certification

Prompt keyword:

`EXECUTE SAAS PHASE 31`

Goal:

Make backup and restore safe enough for real business records.

Scope:

- Validate backup shape deeply, not only top-level fields.
- Verify backup belongs to the intended business or clearly warn when it does not.
- Add typed confirmation before restore.
- Add restore progress.
- Add restore result summary.
- Add failure rollback checks.
- Test large backups.
- Test corrupted backups.
- Test wrong-workspace backups.
- Test interrupted restore scenarios where practical.

Exit criteria:

- Restore cannot start accidentally.
- Restore failure does not leave users unsure about their data.
- Backup files are versioned, validated, and user-readable.

---

## Phase 32 - Privacy, Compliance, And Account Controls

Prompt keyword:

`EXECUTE SAAS PHASE 32`

Goal:

Prepare for real public users and store review.

Scope:

- Privacy policy.
- Terms of service.
- Data deletion request path.
- Account deletion path or documented support path.
- Export-my-data flow.
- App store privacy disclosures.
- Permission wording review.
- Data retention policy.
- Support contact flow.

Exit criteria:

- Store submission has all required disclosures.
- Users can understand what data is stored and how to leave.
- Support can handle account and data requests.

---

## Phase 33 - Testing, CI, And Release Automation

Prompt keyword:

`EXECUTE SAAS PHASE 33`

Goal:

Stop relying on manual confidence.

Scope:

- Add CI for install, typecheck, lint if configured, web build, Expo doctor, and rule tests.
- Add unit tests for money math, balances, invoices, backup validation, restore planning, sync
  conflict logic, entitlement parsing, and form validation.
- Add web smoke tests for login, onboarding, customers, transactions, invoices, reports, backup,
  and settings.
- Add mobile runtime smoke checklist for Android and iOS.
- Add release checklist.
- Add rollback checklist.

Exit criteria:

- Every PR gets automated checks.
- Release builds cannot happen from a failing baseline.
- Manual QA has a repeatable checklist.

---

## Phase 34 - Production Observability And Support Readiness

Prompt keyword:

`EXECUTE SAAS PHASE 34`

Goal:

Know when the product is unhealthy and help users quickly.

Scope:

- Add privacy-safe crash reporting if approved.
- Add performance logging that avoids sensitive business data.
- Add support diagnostics export that users can review before sharing.
- Add incident response checklist.
- Add release notes process.
- Add support FAQ for lock, backup, restore, billing, and sync issues.

Exit criteria:

- Support can diagnose issues without asking users for private ledger data.
- Product health problems are visible quickly.
- Users receive clear guidance during common failures.

---

## Phase 35 - Final Public Launch Gate

Prompt keyword:

`EXECUTE SAAS PHASE 35`

Goal:

Decide whether Orbit Ledger is ready for public launch.

Scope:

- Run full mobile QA on Android.
- Run full mobile QA on iOS if launching iOS.
- Run full web QA across desktop, tablet, and mobile browser widths.
- Run security rule tests.
- Run backup and restore certification tests.
- Run billing tests.
- Run large data performance tests.
- Run copy audit.
- Run accessibility and responsive QA.
- Confirm legal, privacy, store listing, screenshots, and support paths.

Exit criteria:

- Every previous phase is green.
- No critical or high issue remains open.
- No screen contains placeholder language.
- No launch-critical flow depends on developer knowledge.
- Public release is approved.

## 100% Definition

Orbit Ledger reaches “100% SaaS launch readiness” only when:

- mobile daily use is excellent,
- cloud data is protected,
- paid access is reliable,
- backup and restore are trustworthy,
- web workflows are complete,
- performance holds with real data,
- support and legal paths exist,
- and every user-facing screen feels simple, polished, and calm.

