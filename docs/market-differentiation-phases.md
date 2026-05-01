# Orbit Ledger Market Differentiation Phases

This playbook turns Orbit Ledger from a capable ledger/invoice app into a daily money-control
product for very small businesses.

North star:

Orbit Ledger helps small businesses collect faster, close each day with confidence, and never lose
track of who owes what.

Product stance:

- Mobile is the primary product.
- Web is the polished office companion for cleanup, review, bulk work, exports, and backup control.
- Do not copy broad accounting suites. Win through daily cash control, trust, speed, and clarity.
- User screens must avoid technical wording.
- Every phase must end with typecheck, tests where relevant, web build when web is touched, and
  browser/device QA notes.

## Prompt Keyword Registry

Use these exact keywords one at a time:

| Phase | Keyword | Outcome |
| --- | --- | --- |
| 36 | `EXECUTE MARKET PHASE 36` | Mobile daily command center |
| 37 | `EXECUTE MARKET PHASE 37` | Collection intelligence |
| 38 | `EXECUTE MARKET PHASE 38` | Promise-to-pay and follow-up calendar |
| 39 | `EXECUTE MARKET PHASE 39` | Customer trust timeline |
| 40 | `EXECUTE MARKET PHASE 40` | Daily closing ritual |
| 41 | `EXECUTE MARKET PHASE 41` | Local business packs |
| 42 | `EXECUTE MARKET PHASE 42` | Backup confidence center |
| 43 | `EXECUTE MARKET PHASE 43` | Payments, UPI, and WhatsApp-ready sharing |
| 44 | `EXECUTE MARKET PHASE 44` | Practical AI helpers that do work |
| 45 | `EXECUTE MARKET PHASE 45` | Web power workspace |
| 46 | `EXECUTE MARKET PHASE 46` | Market launch polish and positioning |

---

## Phase 36 - Mobile Daily Command Center

Prompt keyword:

`EXECUTE MARKET PHASE 36`

Strict kickoff prompt:

Execute Market Phase 36 for Orbit Ledger. Build the mobile daily command center as the first
meaningful screen after unlock/onboarding. The screen must answer: who should I collect from today,
who paid today, what needs follow-up, what stock is at risk, what documents need sending, and whether
the business is healthier than last week. Replace generic dashboard behavior with prioritized action
cards, plain-language summaries, and one-tap paths into the right workflow. Keep it mobile-first,
fast, calm, and one-handed. Do not add technical wording on user screens. Do not create placeholder
cards. Use existing data where possible and add small local summary helpers only when needed.

Required work:

- Audit the current mobile dashboard and related summary services.
- Add a prioritized daily action model with stable categories: collect today, recent payments,
  overdue follow-up, stock risk, documents to send, business health.
- Make every card actionable with clear next steps.
- Add empty states that teach the next useful action.
- Keep all cards readable on small Android screens.
- Add tests for summary selection and priority ordering.
- Run typecheck and relevant tests.

Exit criteria:

- The first mobile screen feels like a daily money-control cockpit, not a generic report page.
- A shop owner can decide the next best action in under 10 seconds.
- No card is decorative or dead-ended.
- No technical words appear on the screen.

---

## Phase 37 - Collection Intelligence

Prompt keyword:

`EXECUTE MARKET PHASE 37`

Strict kickoff prompt:

Execute Market Phase 37 for Orbit Ledger. Add collection intelligence that helps a business owner
recover money faster. This is not another receivables report. It must rank customers by follow-up
priority using balance, age, recent payments, broken promises when available, and reminder history
when available. Add a plain-language reason for each recommendation. Keep the UI practical and
mobile-first. Web may show the same intelligence in a denser review table. Do not expose formulas,
scores, database terms, or internal labels on user screens.

Required work:

- Add a collection priority service with deterministic, testable rules.
- Show top collection targets on mobile.
- Add a customer-level explanation such as "High balance and no payment in 21 days."
- Add quick actions: call, message, send statement, record payment, add promise.
- Add web review support if existing web customer/report surfaces can reuse it cleanly.
- Add tests for ranking and explanation logic.
- Run typecheck, tests, and web build if web is touched.

Exit criteria:

- The app tells the owner who to follow up with first and why.
- Recommendations are explainable without math or jargon.
- The feature still works with partial or old data.

---

## Phase 38 - Promise-To-Pay And Follow-Up Calendar

Prompt keyword:

`EXECUTE MARKET PHASE 38`

Strict kickoff prompt:

Execute Market Phase 38 for Orbit Ledger. Add promise-to-pay tracking and a lightweight follow-up
calendar. A business owner must be able to record when a customer promised to pay, how much, the
expected date, and the current status. The app should surface due promises, missed promises, and
tomorrow's follow-ups in plain language. Keep the flow faster than writing a note in a notebook.
Do not build a complex CRM. Do not add technical wording.

Required work:

- Add or extend local data structures for payment promises.
- Add create, complete, missed, and cancel states.
- Add promise summary on customer detail and command center.
- Add follow-up list grouped by today, tomorrow, overdue, and later.
- Add reminder-ready message text.
- Add tests for promise state transitions and due-date grouping.
- Run typecheck and relevant tests.

Exit criteria:

- A promise can be recorded in under 20 seconds.
- Missed promises are visible without searching.
- Customer history clearly shows promise behavior.

---

## Phase 39 - Customer Trust Timeline

Prompt keyword:

`EXECUTE MARKET PHASE 39`

Strict kickoff prompt:

Execute Market Phase 39 for Orbit Ledger. Build the customer trust timeline. Each customer should
show a clear chronological story: credit given, payments received, invoices, statements sent,
reminders, promises, missed promises, notes, disputes, and backup-safe important events. The goal is
relationship memory, not accounting complexity. Make it mobile-first, searchable enough for real use,
and readable for non-technical business owners.

Required work:

- Audit customer detail screens on mobile and web.
- Add a timeline model that can combine existing events without duplicating records.
- Add timeline filters for money, documents, reminders, promises, and notes.
- Add important note/dispute entry if no suitable note path exists.
- Add tests for timeline ordering and event labeling.
- Run typecheck, tests, and web build if web is touched.

Exit criteria:

- A customer dispute can be understood from one timeline.
- Timeline labels are human and compact.
- No technical event names appear.

---

## Phase 40 - Daily Closing Ritual

Prompt keyword:

`EXECUTE MARKET PHASE 40`

Strict kickoff prompt:

Execute Market Phase 40 for Orbit Ledger. Add a 3-minute daily closing ritual for very small
businesses. The owner should confirm today's cash collected, payments recorded, new credit given,
stock changes, mismatches, and tomorrow's follow-ups. The output should be a simple daily closing
summary and a next-day action list. This must feel like business discipline, not accounting homework.

Required work:

- Add a daily closing flow on mobile.
- Pre-fill from today's ledger, invoice, payment, and stock data.
- Let the owner confirm or flag mismatch.
- Save a daily closing summary.
- Show closing history and tomorrow actions.
- Add tests for closing summary calculations and mismatch flags.
- Run typecheck and relevant tests.

Exit criteria:

- Daily closing can be completed in about 3 minutes.
- The app catches obvious mismatches.
- Tomorrow's action list improves after closing.

---

## Phase 41 - Local Business Packs

Prompt keyword:

`EXECUTE MARKET PHASE 41`

Strict kickoff prompt:

Execute Market Phase 41 for Orbit Ledger. Build local business packs that make Orbit Ledger feel
native to the owner's market. Start with the existing country/state direction and make packs affect
invoice labels, statement wording, currency/phone formatting, tax wording, reminder tone, and local
business rhythms. Do not overbuild legal compliance. Do not claim compliance unless the app actually
supports it. Keep all copy plain and locally respectful.

Required work:

- Audit existing country package code and document templates.
- Define a clean pack interface for labels, formats, reminders, document wording, and seasonal notes.
- Strengthen India pack first, then keep US/UK/generic safe and honest.
- Add tests for formatting and label selection.
- Ensure mobile and web use the same pack language where possible.
- Run typecheck, tests, and web build if web is touched.

Exit criteria:

- India users feel the app was built for them, not translated later.
- Unsupported compliance is not implied.
- Packs are easy to extend without scattering copy.

---

## Phase 42 - Backup Confidence Center

Prompt keyword:

`EXECUTE MARKET PHASE 42`

Strict kickoff prompt:

Execute Market Phase 42 for Orbit Ledger. Turn backup into a trust feature. The owner should always
know whether their business data is protected, when the last backup happened, what is included, what
is not included, and how restore would work. Improve backup health, restore preview, typed
confirmation, rollback messaging, and export confidence on mobile and web. Do not use scary or
technical language.

Required work:

- Audit mobile and web backup screens.
- Add backup health status and last protected time.
- Improve restore preview with business name, counts, date, and safety warnings.
- Add rollback/result summary where available.
- Add corrupted/wrong-business/large-backup tests.
- Run typecheck, tests, and web build if web is touched.

Exit criteria:

- Users feel protected before something goes wrong.
- Restore cannot be started casually.
- Backup limitations are honest and easy to understand.

---

## Phase 43 - Payments, UPI, And WhatsApp-Ready Sharing

Prompt keyword:

`EXECUTE MARKET PHASE 43`

Strict kickoff prompt:

Execute Market Phase 43 for Orbit Ledger. Make collection actions easier by adding payment-ready and
WhatsApp-ready sharing flows. Start with safe share text, statement links/files, invoice sharing, UPI
ID/QR fields where appropriate, and payment status tracking. Do not process real money unless the
integration is explicit and safe. Do not imply a payment was received until the owner records or
confirms it.

Required work:

- Audit current statement, invoice, and reminder sharing paths.
- Add UPI/payment details to business profile where regionally appropriate.
- Add WhatsApp-ready reminder and statement copy.
- Add invoice/statement share actions from collection targets and customer detail.
- Add payment status states that are truthful.
- Add tests for generated message text and payment-detail formatting.
- Run typecheck, tests, and web build if web is touched.

Exit criteria:

- The owner can ask for payment in two taps from a collection target.
- Shared messages are polite, clear, and locally formatted.
- The app never fakes payment confirmation.

---

## Phase 44 - Practical AI Helpers That Do Work

Prompt keyword:

`EXECUTE MARKET PHASE 44`

Strict kickoff prompt:

Execute Market Phase 44 for Orbit Ledger. Add practical helpers that do specific work, not a generic
chatbot. The helpers should prepare collection messages, explain receivables changes, suggest whom to
call first, summarize the month, spot suspicious entries, and prepare tomorrow's collection plan.
If AI services are not configured, build deterministic local helpers and clean interfaces first.
Never send sensitive business data to a third party without explicit user-controlled setup and clear
permission. No technical wording on user screens.

Required work:

- Audit existing Orbit Helper surfaces.
- Define helper actions as concrete tasks, not open-ended chat.
- Add deterministic local versions where possible.
- Add privacy-safe boundaries and settings before any external AI call.
- Add tests for helper inputs, outputs, and redaction rules.
- Run typecheck and relevant tests.

Exit criteria:

- Helpers save time in real workflows.
- Users understand what each helper does.
- Sensitive data is not transmitted by default.

---

## Phase 45 - Web Power Workspace

Prompt keyword:

`EXECUTE MARKET PHASE 45`

Strict kickoff prompt:

Execute Market Phase 45 for Orbit Ledger. Make web the office companion for power work. Web should
not replace mobile daily use; it should make cleanup, review, imports, bulk actions, exports,
reports, customer review, invoice editing, backup control, and settings faster. Use dense but calm
tables, filters, keyboard-friendly forms, and responsive layouts. No marketing sections. No technical
wording. No placeholder workflows.

Required work:

- Audit every web route for incomplete workflows.
- Add or improve bulk customer/transaction/invoice actions.
- Add import/export paths where safe.
- Improve filters, search, date ranges, and table density.
- Strengthen customer detail, invoice editor, reports, backup, and settings.
- Add web smoke tests if test tooling exists.
- Run typecheck, tests, web build, and browser QA.

Exit criteria:

- Web feels like a real SaaS workspace, not a mobile app stretched wide.
- Common cleanup tasks are faster on web than mobile.
- Mobile browser widths still work cleanly.

---

## Phase 46 - Market Launch Polish And Positioning

Prompt keyword:

`EXECUTE MARKET PHASE 46`

Strict kickoff prompt:

Execute Market Phase 46 for Orbit Ledger. Prepare the product for market clarity. Align onboarding,
empty states, upgrade prompts, app store copy, web login copy, screenshots, support copy, and pricing
around the positioning: collect faster, close each day with confidence, and never lose track of who
owes what. This phase is not about adding new core features. It is about making the product feel
obvious, trustworthy, and differentiated.

Required work:

- Audit onboarding and first-run experience.
- Rewrite user-facing positioning around daily money control.
- Remove vague accounting-suite language.
- Add screenshot/story checklist for app stores and web.
- Review pricing prompts for honesty and value clarity.
- Confirm support, privacy, terms, domain, Google consent branding, and release notes.
- Run typecheck, web build, and browser/mobile QA where touched.

Exit criteria:

- A new user understands Orbit Ledger's value in under 30 seconds.
- App store and web copy match the product.
- No launch-critical branding or trust issue remains.
