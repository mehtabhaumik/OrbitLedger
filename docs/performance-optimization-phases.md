# Orbit Ledger Performance Optimization Phases

This document defines the next four performance-focused phases for Orbit Ledger.

Global execution rule:

- Execute phases strictly in order.
- Do not skip ahead unless the user explicitly changes the priority.
- After completing each phase, report the next phase and the exact prompt keyword to continue.
- Do not leave placeholder performance work. Each phase must include implementation, verification, and a clear PASS/FAIL result.

---

## Phase 17 - Performance Instrumentation And Baseline

Prompt keyword:

`EXECUTE PERFORMANCE PHASE 17`

Prompt:

Build a performance instrumentation and baseline system for Orbit Ledger.

Requirements:

- Add lightweight dev-only performance timing utilities.
- Measure and log timing for:
  - app startup readiness
  - SQLite initialization
  - business profile load
  - dashboard summary load
  - customer search
  - customer detail ledger load
  - transaction save
  - invoice save
  - statement PDF generation
  - invoice PDF generation
  - backup export
  - restore validation and restore apply
- Add a reachable dev-only Performance QA screen or diagnostics section.
- Add a structured performance report object that can be copied or exported locally.
- Add defensive guards so instrumentation does not affect production behavior.
- Establish baseline targets for:
  - cold start
  - dashboard first usable render
  - customer search response
  - transaction save
  - invoice save
  - PDF generation
  - backup export and restore
- Run typecheck.
- Verify the diagnostics path is reachable in development mode.

Important:

- Keep instrumentation lightweight.
- Do not add external analytics or cloud tracking.
- Do not slow down the app to measure the app.
- Use local-only logs/state.

Success criteria:

- We can see real timing numbers for the main slow-risk flows.
- The app has a repeatable performance baseline before optimization.
- Production behavior remains unaffected.

After completion, say:

`Next phase: Phase 18 - Startup, Navigation, And Dashboard Speed. Prompt keyword: EXECUTE PERFORMANCE PHASE 18`

---

## Phase 18 - Startup, Navigation, And Dashboard Speed

Prompt keyword:

`EXECUTE PERFORMANCE PHASE 18`

Prompt:

Optimize Orbit Ledger startup, navigation, and dashboard performance.

Requirements:

- Make startup focus only on critical work:
  - database initialization
  - business profile/onboarding state
  - security lock state
  - first dashboard essentials
- Defer heavy systems until needed:
  - reports
  - compliance
  - country packages
  - tax update checks
  - backup history
  - document generation
  - Orbit Helper
- Lazy-load secondary screens/modules where safe.
- Optimize dashboard data loading:
  - show above-the-fold critical summary first
  - load secondary insights after first render
  - avoid expensive recomputation on every focus
  - use dedicated lightweight summary queries where needed
- Add skeleton/loading states only where they improve perceived speed.
- Ensure bottom navigation and back navigation remain responsive.
- Run typecheck.
- Compare performance timings against the Phase 17 baseline.

Important:

- Do not break onboarding, PIN lock, or dashboard correctness.
- Do not remove features.
- Do not delay security checks.
- Keep Android and iOS behavior consistent.

Success criteria:

- App first usable screen is faster.
- Dashboard appears quickly and updates secondary insights without blocking initial use.
- Navigation between primary tabs feels responsive.
- No core flow regresses.

After completion, say:

`Next phase: Phase 19 - SQLite, Lists, And Daily Flow Speed. Prompt keyword: EXECUTE PERFORMANCE PHASE 19`

---

## Phase 19 - SQLite, Lists, And Daily Flow Speed

Prompt keyword:

`EXECUTE PERFORMANCE PHASE 19`

Prompt:

Optimize SQLite queries, list rendering, and daily transaction/invoice usage in Orbit Ledger.

Requirements:

- Audit and add useful indexes for:
  - customers
  - transactions
  - invoices
  - invoice_items
  - products
  - tax packs
  - document templates
  - compliance reports
  - country packages
- Replace repeated JavaScript aggregation with SQL aggregation where practical.
- Prevent per-row async balance lookups in customer lists.
- Optimize customer list:
  - instant search by name, phone, and notes
  - outstanding/recent/archived filters
  - stable row rendering
  - memoized row components
  - FlatList tuning
- Optimize customer detail:
  - paginate or window long ledgers
  - keep running balances correct
  - keep transaction edit reachable
- Optimize fast transaction flow:
  - recent customers loaded quickly
  - last transaction type remembered
  - amount input focused
  - save path avoids unnecessary full reloads
  - success feedback does not block navigation
- Optimize invoice form:
  - totals update immediately and cheaply
  - active tax pack lookup is cached
  - product selection remains fast
  - item list handles larger invoices cleanly
- Run typecheck.
- Validate with a larger local seed dataset.

Important:

- Do not compromise balance correctness.
- Do not break invoice stock adjustment.
- Do not break tax auto-fill behavior.
- Keep all optimizations local/offline.

Success criteria:

- Customer search and customer list remain smooth with large local data.
- Transaction add/edit feels instant.
- Invoice totals update without typing lag.
- Ledger screens remain usable with long histories.

After completion, say:

`Next phase: Phase 20 - Heavy Flow Optimization And Release Performance QA. Prompt keyword: EXECUTE PERFORMANCE PHASE 20`

---

## Phase 20 - Heavy Flow Optimization And Release Performance QA

Prompt keyword:

`EXECUTE PERFORMANCE PHASE 20`

Prompt:

Optimize Orbit Ledger heavy flows and run release-focused performance QA.

Requirements:

- Optimize PDF generation:
  - generate only when preview/export is opened
  - cache last generated statement/invoice PDFs when inputs are unchanged
  - avoid unnecessary regeneration
  - resize/compress logo and signature before PDF embedding where practical
  - keep long transaction and invoice item lists stable
- Optimize backup and restore:
  - show progress stages
  - avoid rendering huge previews
  - keep restore transactional
  - preserve failure rollback safety
- Optimize image handling:
  - copy logo/signature into app storage
  - store URI only
  - keep display/PDF dimensions controlled
- Add large dataset performance QA:
  - 100 customers / 1,000 transactions
  - 1,000 customers / 20,000 transactions
  - larger dataset if practical without destabilizing development machines
- Measure:
  - dashboard load
  - customer search
  - ledger open
  - transaction save
  - invoice save
  - PDF generation
  - backup export
  - restore apply
- Run Android debug/dev verification.
- Run iOS simulator verification if available.
- Build or prepare release-mode verification where practical.
- Run typecheck and project doctor.

Important:

- Do not break document correctness.
- Do not break backup/restore integrity.
- Do not degrade visual quality while compressing images.
- Do not over-optimize with risky rewrites.

Success criteria:

- Heavy flows do not freeze the app.
- PDFs and backups provide clear progress and failure states.
- Large local datasets remain usable.
- Final performance report shows improvements from Phase 17 baseline.

After completion, say:

`Performance optimization phases complete. Next phase is not defined yet.`

