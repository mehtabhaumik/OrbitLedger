# Orbit Ledger AI Agent Product Brief

Last updated: 2026-04-30

This document is a high-context product, market, UX, and engineering brief for AI agents working on Orbit Ledger. It is meant to be ingested before planning, designing, coding, writing copy, evaluating roadmap ideas, or comparing Orbit Ledger to other business software.

The goal is simple: an agent should understand what Orbit Ledger is, what it offers today, what it must protect, why it is different, and how to keep future work aligned with the product's strongest market wedge.

---

## 1. One-Sentence Product Definition

Orbit Ledger is a mobile-first daily money-control app for very small businesses that helps owners collect faster, close each day with confidence, and never lose track of who owes what.

Canonical promise:

> Collect faster. Close each day with confidence. Never lose track of who owes what.

Canonical store subtitle:

> Daily money control for small businesses.

Canonical plain description:

> Orbit Ledger helps small businesses manage daily dues, payments, invoices, statements, backups, and follow-ups without feeling like heavy accounting software.

Sources inside the repo:

- `packages/core/src/marketLaunch.ts`
- `docs/market-phase-46-launch-polish.md`
- `docs/market-differentiation-phases.md`
- `apps/mobile/app.json`

---

## 2. Product Stance

Orbit Ledger should not try to become another broad accounting suite, ERP, or desktop-heavy billing system. The market already has strong broad tools. Orbit Ledger should win with clarity, daily discipline, relationship memory, and trust.

Core stance:

- Mobile is the main product.
- Web is the office companion for review, cleanup, imports, bulk work, exports, reports, backup control, and settings.
- The app should feel calm, fast, serious, trustworthy, and easy to use.
- The app should guide an owner toward the next useful action, not just show charts.
- User screens should avoid technical wording.
- Core ledger work must stay useful even without paid upgrades.
- Backup, restore, local app lock, and data trust are part of the product value, not afterthoughts.

The desired user emotion is not "I have accounting software." The desired user emotion is:

> "I know who owes me, what happened today, what to do tomorrow, and my records are protected."

---

## 3. Target Users

Primary audience:

- Very small business owners.
- Shopkeepers, service providers, small traders, freelancers, local merchants, small distributors, and family-run businesses.
- Owners who may not think in accounting terms but absolutely care about cash, dues, customer trust, and daily control.

Typical user situations:

- The owner gives goods or services on credit.
- Payments happen through cash, UPI, bank transfer, or informal customer promises.
- Customer history is often split across notebooks, WhatsApp chats, memory, paper bills, and spreadsheets.
- The owner needs fast entry at the counter or during work.
- The owner may have unreliable internet.
- The owner fears losing business records when changing phones or clearing data.
- The owner does not want a complicated accounting system just to know who owes money.

Secondary audience:

- Owners who use mobile during the day and web later for cleanup.
- Small businesses that need polished statements or invoices but do not need full accounting automation.
- Businesses that may eventually want local tax labels, document packs, backup confidence, and lightweight reporting.

Not the ideal first audience:

- Large companies with full finance teams.
- Businesses needing complete payroll, full compliance filing, bank reconciliation, audit controls, role-based departments, and complex multi-entity accounting from day one.
- Accountants who expect a full chart-of-accounts-first workflow.

---

## 4. The Main Problem Orbit Ledger Solves

Small businesses often lose money or confidence because daily money facts are scattered:

- Who owes money?
- Who paid today?
- Which customer promised to pay tomorrow?
- Which promise has been missed?
- What stock is at risk?
- What document should be sent?
- Was today's cash actually recorded?
- Did I back up the business after important changes?
- Can I explain a dispute with a customer?

Many tools track invoices, ledgers, inventory, or reports. Orbit Ledger should go further by turning those records into a daily operating rhythm.

The strongest problem framing:

> Small businesses do not only need accounting. They need daily money control.

---

## 5. What Orbit Ledger Offers Today

This section describes capabilities visible in the current repository. Some features are implemented as local mobile flows, some as web workspace flows, some as shared packages, and some as launch/readiness infrastructure.

### 5.1 Mobile Daily Command Center

Orbit Ledger's mobile dashboard is intended to act as the owner's first daily control room.

Implemented command center categories:

- Collect today.
- Paid today.
- Follow-up.
- Stock risk.
- Documents to send.
- Business health.

The command center uses local data to build prioritized action cards. Examples:

- If a customer has the highest due, show "Collect from [customer]" with balance and last payment context.
- If payments were recorded today, show total payment value and customer names.
- If promises are missed or due today, show those before generic due lists.
- If low-stock products exist and products are enabled, surface restock risk.
- If customers have dues, suggest preparing statements.
- If recent activity slowed, point the owner to business health.

Important design principle:

- No card should be decorative.
- Every card should have a useful action target.
- Cards must be understandable without exposing formulas or internal data labels.

Source:

- `apps/mobile/src/dashboard/commandCenter.ts`

### 5.2 Collection Intelligence

Orbit Ledger includes a collection recommendation model. It ranks customers by follow-up urgency using practical signals:

- Outstanding balance.
- Age of dues.
- Last payment date.
- Reminder history.
- Broken or due payment promises.
- Oldest credit.
- Customer behavior insights.

The output is designed for owner action, not analyst interpretation:

- Plain-language reason, such as "Payment promise is due today" or "No payment in 14 days."
- Helper line, such as "No reminder shared yet" or "Last reminder 7 days ago."
- Recommended action: call, message, send statement, record payment, or add promise.
- Tone: danger, warning, or primary.
- Badges for compact scanning.

What makes this valuable:

- It does not merely list receivables.
- It tells the owner who to contact first and why.
- It remains deterministic and testable.
- It works even when data is partial.

Source:

- `apps/mobile/src/collections/collectionIntelligence.ts`

### 5.3 Promise-To-Pay Tracking

Orbit Ledger has promise follow-up logic for customers who say they will pay later.

Tracked states:

- Open.
- Fulfilled.
- Missed.
- Cancelled.

Follow-up groups:

- Overdue.
- Today.
- Tomorrow.
- Later.

The promise reminder model can generate practical reminder text with:

- Customer name.
- Business name.
- Promised amount.
- Promised date.
- Current balance.
- Polite confirmation request.

Why this matters:

- Many small businesses do not lose track because they lack invoices; they lose track because promises are informal.
- Promise tracking turns memory into a durable system.
- Missed promises can feed the command center and collection intelligence.

Sources:

- `apps/mobile/src/collections/promiseFollowUps.ts`
- `apps/mobile/src/collections/paymentRequests.ts`
- `apps/mobile/src/components/PaymentPromiseModal.tsx`

### 5.4 Customer Trust Timeline

Orbit Ledger includes a customer timeline model that combines multiple event types into one chronological customer story.

Timeline event categories:

- Money: credits and payments.
- Documents: invoices and saved statement/invoice PDFs.
- Reminders: polite, firm, final payment reminders.
- Promises: recorded, fulfilled, missed, cancelled.
- Notes: important notes and dispute notes.

Timeline event goals:

- Explain a customer dispute quickly.
- Show relationship memory beyond raw ledger entries.
- Avoid technical event names.
- Keep events compact and human-readable.

This is one of Orbit Ledger's most important differentiators. A ledger tells what happened financially. A trust timeline tells the relationship story: what was given, what was paid, what was promised, what was reminded, and what was disputed.

Source:

- `apps/mobile/src/customers/trustTimeline.ts`

### 5.5 Daily Closing Ritual

Orbit Ledger includes a daily closing ritual model. It is meant to become a short end-of-day business discipline flow.

The ritual checks:

- Cash collected is counted.
- Payments are recorded.
- New credit is recorded.
- Stock changes are checked.
- Tomorrow follow-ups are ready.

It compares counted cash with expected payments and can create next-day actions:

- Count today cash.
- Fix cash mismatch.
- Follow up promises.
- Check low stock.
- Finish closing checks.
- Start tomorrow fresh.

Why this matters:

- Many small businesses do not close the day formally.
- The app can help catch missing payment entries, unrecorded credit, and forgotten promises.
- It turns Orbit Ledger into a daily habit rather than a passive data store.

Sources:

- `apps/mobile/src/closing/ritual.ts`
- `apps/mobile/src/closing/ritualModel.ts`
- `apps/mobile/src/screens/DailyClosingReportScreen.tsx`

### 5.6 Customers, Ledger, Dues, Credits, And Payments

Orbit Ledger supports the core ledger model:

- Customers.
- Customer balances.
- Credit entries.
- Payment entries.
- Notes.
- Search.
- Customer detail.
- Running ledger history.
- Top due customers.
- Recent payments.

The concept language should remain simple:

- "Credit" means the customer owes the business.
- "Payment" means the customer paid and balance reduces.
- "Balance" means who owes whom.

Avoid forcing accounting vocabulary where small business language is clearer.

Sources:

- `apps/mobile/src/database/repository.ts`
- `apps/mobile/src/database/balance.ts`
- `apps/mobile/src/screens/CustomersScreen.tsx`
- `apps/mobile/src/screens/CustomerDetailScreen.tsx`
- `apps/mobile/src/screens/TransactionFormScreen.tsx`

### 5.7 Invoices And Statements

Orbit Ledger supports document workflows:

- Invoice create/edit/preview.
- Invoice PDF generation.
- Invoice line items.
- Product or service descriptions.
- Tax rate per item when tax is enabled.
- Statement preview.
- Date-filtered customer statements.
- Statement PDF generation.
- Save, share, print, and view generated PDFs.
- Generated document history.
- Document templates and local labels.

Document positioning:

- Free should keep basic statement exports available.
- Pro should improve document polish and business identity.
- Documents should build trust with customers, not become the whole product.

Sources:

- `apps/mobile/src/documents/customerStatement/*`
- `apps/mobile/src/documents/invoice/*`
- `apps/mobile/src/screens/InvoiceFormScreen.tsx`
- `apps/mobile/src/screens/InvoicePreviewScreen.tsx`
- `apps/mobile/src/screens/StatementPreviewScreen.tsx`

### 5.8 Products And Stock Awareness

Orbit Ledger has product and inventory-adjacent support:

- Products with name, price, unit, and stock quantity.
- Invoice item selection.
- Low-stock signals.
- Stock risk card in the command center.
- Inventory reorder assistant surface.

The current product direction is not to become a full inventory ERP. Inventory should support daily money control:

- Faster invoice entry.
- Awareness of stock at risk.
- Better daily closing.
- Better document accuracy.

Sources:

- `apps/mobile/src/screens/ProductsScreen.tsx`
- `apps/mobile/src/inventoryAssistant/*`
- `apps/mobile/src/dashboard/commandCenter.ts`

### 5.9 Local Business Packs

Orbit Ledger includes local business pack logic that makes the product feel native to a market.

Current pack support includes:

- India.
- United States.
- United Kingdom.
- Generic fallback.

Pack dimensions:

- Currency code.
- Phone formatting.
- Tax labels.
- Business ID labels.
- Invoice title.
- Statement title.
- Buyer/customer labels.
- Item table labels.
- Reminder tone descriptions.
- Local daily rhythm wording.
- Seasonal notes.
- Compliance disclaimers.

This is a major long-term moat if handled carefully. The app should not overclaim legal compliance. It should say "starter labels and summaries" unless true filing/compliance support exists.

Sources:

- `packages/core/src/localBusinessPacks.ts`
- `apps/mobile/src/countryPackages/*`
- `apps/mobile/src/tax/*`
- `docs/remote-tax-package-update-contract.md`

### 5.10 Backup, Restore, And Trust Layer

Backup confidence is a core feature. Orbit Ledger treats backup and restore as trust-building product moments.

Mobile backup capabilities include:

- Structured local backup export.
- Backup metadata and record counts.
- Validation before restore.
- Restore preview.
- Full replace restore plan.
- Maximum safe restore record limit.
- Relationship validation across customers, transactions, reminders, promises, tax profiles, documents, invoices, products, preferences, and security flags.
- Restore audit events.
- Transactional restore.
- Attempted rollback/preservation behavior when restore fails.
- PIN/biometric security details are treated carefully.

Web backup capabilities include:

- Signed-in workspace export.
- Backup preview counts.
- Owner/workspace validation.
- Restore into current workspace.
- Browser lock not included in backup.

Why this matters:

- Small business users fear losing records.
- Backup confidence can be a market differentiator.
- "Your business is protected" is more emotionally powerful than "export JSON."

Sources:

- `apps/mobile/src/backup/*`
- `apps/mobile/src/screens/BackupRestoreScreen.tsx`
- `apps/web/src/lib/workspace-backup.ts`
- `apps/web/app/(workspace)/backup/page.tsx`
- `docs/phase-8-backup-recovery-and-trust-layer.md`

### 5.11 App Lock And Privacy

Mobile security:

- Local PIN.
- Inactivity timeout.
- Device biometric support where available.
- Screen privacy helpers.
- Secure storage for local lock state.
- Restore can ask for confirmation when protection is enabled.

Web security:

- Browser-local 4-digit lock.
- Inactivity relock.
- Clear messaging that browser lock is not the cloud password.
- Clear messaging that browser-local lock is not included in workspace backups.

Security stance:

- Be truthful about protection boundaries.
- Do not imply cloud password, browser PIN, mobile PIN, and biometric unlock are the same thing.
- Do not store biometric data.

Sources:

- `apps/mobile/src/security/*`
- `apps/web/src/providers/web-lock-provider.tsx`
- `docs/phase-7-security-model-across-mobile-and-web.md`

### 5.12 Practical AI Helpers

Orbit Ledger's AI direction should be "helpers that do work," not a generic chatbot.

Implemented practical helper cards include:

- Prepare a collection message.
- Who to call first.
- Explain receivables.
- Summarize this month.
- Spot entries to review.
- Prepare tomorrow's plan.

Privacy stance:

- Current helper copy says it runs on the device and does not send customer data out.
- Helper text includes redaction for emails, phone numbers, and payment IDs.

This is important: Orbit Ledger's AI should not be positioned as "ask anything." It should be positioned as a quiet assistant for daily owner actions.

Sources:

- `apps/mobile/src/orbitHelper/practicalHelpers.ts`
- `apps/mobile/src/orbitHelper/bundledPack.ts`
- `apps/mobile/src/screens/OrbitHelperScreen.tsx`

### 5.13 Web Office Companion

The web app is a Next.js workspace, not an Expo web afterthought.

Web offers:

- Login.
- Workspace guard.
- Sidebar SaaS shell.
- Dashboard.
- Customers.
- Customer detail.
- Transactions.
- Invoices.
- Invoice detail/editor.
- Reports.
- Backup.
- Settings.
- PWA manifest and service worker.
- Online/offline workspace status.
- Business workspace setup card.

Web power-work capabilities include:

- Dense customer tables.
- Customer search and filtering.
- Balance filters: all, outstanding, advance, settled.
- CSV export.
- Customer CSV import.
- Bulk-oriented selection helpers.
- Transaction filters by query, type, and date range.
- Invoice filters by invoice number, status, and date range.
- CSV export helpers.
- Reports export and summaries.
- Invoice detail editing with line items.
- Customer detail review.
- Backup control.

Web should be used for:

- Cleanup.
- Review.
- Imports.
- Bulk work.
- Exports.
- Reports.
- Invoice editing.
- Backup/restore confidence.
- Settings/security.

Web should not become:

- The product's main identity.
- A marketing landing page inside the app.
- A stretched mobile layout.
- A generic admin dashboard.

Sources:

- `apps/web/app/(workspace)/*`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/lib/workspace-power.ts`
- `apps/web/src/lib/workspace-data.ts`
- `docs/phase-5-web-pwa-product-build.md`

---

## 6. Monetization And Pricing Philosophy

Orbit Ledger has Pro and country/region pack monetization primitives.

Current Pro catalog:

- Monthly: INR 199.
- Yearly: INR 1,999.

Current Pro positioning:

- Flexible document polish for businesses that share statements regularly.
- Best value when polished documents are part of weekly business work.

Country/region pack catalog:

- United States pack: USD 9.99 fallback price.
- United Kingdom pack: GBP 9.99 fallback price.

Free remains useful:

- Dues and payments.
- Customer records.
- Basic statement exports.
- Backup and restore.
- App lock.

Pro adds presentation value:

- Cleaner shared documents.
- Logo/signature/business identity.
- Pro document themes.
- More document options.
- Future templates and local review packs.

Important pricing rule:

- Do not block basic ledger work behind Pro.
- Do not make paid prompts feel like a trap.
- Paid copy should be honest: Pro improves presentation and future advanced document/local packs.

Sources:

- `apps/mobile/src/monetization/products.ts`
- `apps/mobile/src/screens/UpgradeScreen.tsx`
- `docs/market-phase-46-launch-polish.md`

---

## 7. Technical And Operational Foundation

This section gives AI agents enough engineering context to avoid breaking the product shape.

### 7.1 Repository Structure

Orbit Ledger is a monorepo.

Main areas:

- `apps/mobile`: Expo React Native app.
- `apps/web`: Next.js web/PWA workspace.
- `packages/core`: shared product/business logic.
- `packages/contracts`: shared sync/workspace types.
- `packages/sync`: sync strategy and metadata helpers.
- `packages/ui`: shared brand/theme tokens.
- `firebase`: rules tests.
- `docs`: product, phase, launch, and architecture documentation.

### 7.2 Runtime And Package Baseline

Current Node pin:

- `.nvmrc`: `24.14.0`
- root/package workspace engines: `>=24.14.0`
- Firebase Functions runtime: Node 24.

Reason:

- The workspace is aligned on Node 24.14.0 for local installs, web builds, mobile tooling, and Firebase Functions deployment.
- Previous older Node versions blocked reliable builds and installs.

Mobile key stack:

- Expo SDK 54.
- React Native.
- Expo SQLite.
- Expo FileSystem.
- Expo Document Picker.
- Expo Image Picker.
- Expo Local Authentication.
- Expo IAP.
- Expo Secure Store.
- Firebase.

Web key stack:

- Next.js.
- React.
- Firebase.
- Zod.

### 7.3 Firebase And Environment Separation

Firebase integration includes:

- Development defaults for local work.
- Production environment enforcement.
- Separate web `NEXT_PUBLIC_ORBIT_LEDGER_*` variables.
- Separate mobile `EXPO_PUBLIC_ORBIT_LEDGER_*` variables.
- Web App Check with reCAPTCHA v3 when site key exists.
- Production App Check site key enforcement.
- Firestore IndexedDB persistence on web.
- Auth local persistence on web.

Important:

- The raw Firebase project auth domain may be used for testing.
- Public launch should use Orbit Ledger branding in Google consent and public domain.
- Production should not rely on development fallback config.

Sources:

- `apps/web/src/lib/firebase.ts`
- `apps/mobile/src/cloud/firebase.ts`
- `.env.example`
- `docs/firebase-project-reference.md`

### 7.4 Firestore And Storage Rules

Firestore rules:

- Signed-in users can create workspaces only when `owner_uid` matches their auth UID.
- Users can read/update/delete only their own workspace.
- Workspace subcollection records are accessible only when the signed-in user owns the workspace.
- Unmatched document access is denied.

Storage rules:

- Workspace storage paths are readable/writable only by the workspace owner.
- All other paths are denied.

Rules tests cover:

- Owner can create/read workspace.
- Cross-owner read/write blocked.
- Owner can access workspace records.

Sources:

- `firestore.rules`
- `storage.rules`
- `firebase/rules.test.ts`

### 7.5 CI

GitHub Actions CI currently runs:

- Checkout.
- Node setup from `.nvmrc`.
- `npm ci`.
- Typecheck.
- Unit tests.
- Java setup.
- Firebase emulator rules tests.
- Audit.
- Web build.
- Expo Doctor.

Source:

- `.github/workflows/ci.yml`

### 7.6 Performance And Large Data Direction

The product direction is to avoid heavy client reads where possible.

Current web data code uses limits:

- Customer list limit.
- Transaction list limit.
- Invoice list limit.
- Firestore `in` query batching limit.

Existing direction:

- Move heavy aggregations to server-side summaries, Firestore counters, or paginated queries.
- Keep dashboards fast.
- Keep large customer/transaction lists usable.
- Show clear progress for heavy operations.

Sources:

- `apps/web/src/lib/workspace-data.ts`
- `docs/saas-100-launch-readiness-phases.md`
- `docs/performance-optimization-phases.md`

---

## 8. Market Context

This section uses public official sources for comparison. It should not be read as saying competitors are weak. The point is that the market already contains powerful broad accounting and billing tools, so Orbit Ledger should compete on a sharper wedge.

### 8.1 Zoho Books

Zoho Books is a broad accounting platform. Official feature coverage includes receivables, payables, tax compliance, bank reconciliation, inventory, projects accounting, payroll, reports, collaboration, accountant workflows, automation, customization, global scale, integrations, mobile/desktop access, and security/privacy. Zoho's official feature page also describes professional invoices, online payments, automated reminders, inventory restocking, 70+ reports, client/vendor collaboration, audit trail, and multi-device accounting.

Source:

- https://www.zoho.com/us/books/accounting-software-features/

Implication for Orbit Ledger:

- Do not try to out-Zoho Zoho.
- Zoho's strength is breadth, accounting depth, collaboration, automation, reports, and ecosystem.
- Orbit Ledger should win when an owner needs a faster, calmer, mobile-first daily money-control routine.

### 8.2 Vyapar

Vyapar publicly positions itself as billing, accounting, inventory, POS, reminders, WhatsApp/SMS/email sharing, multi-device sync, branded invoices, payment reminders, low-stock alerts, reports, and offline billing for small businesses. Vyapar's official site describes party-wise receivables/payables, bulk reminders, WhatsApp sharing, inventory alerts, invoice templates, and free Android billing features.

Sources:

- https://vyapar.com/
- Relevant public positioning includes inventory/billing/accounting, payment reminders, WhatsApp/SMS/email sharing, and offline billing.

Implication for Orbit Ledger:

- Vyapar already owns much of the "GST billing/inventory/accounting app" mental space.
- Orbit Ledger should not position itself as just another billing app.
- Orbit Ledger should emphasize daily cash discipline, promise tracking, trust timeline, backup confidence, and practical helper cards.

### 8.3 TallyPrime

TallyPrime is a deep business/accounting system. Official help describes bookkeeping, accounting, inventory, payroll, tax compliance, audit features, vouchers, billing, reports, outstanding bills, payment reminders, remote access, imports/exports, synchronization, backup/restore, permissions, encryption, GST/VAT/e-invoicing, and digital signatures.

Source:

- https://help.tallysolutions.com/tallyprime-get-started/

Implication for Orbit Ledger:

- TallyPrime is powerful for accounting, compliance, and business operations.
- Orbit Ledger should not try to match Tally's depth in vouchers, compliance, payroll, and audit controls.
- Orbit Ledger should become the simple daily operating layer for owners who need action and memory more than accounting depth.

---

## 9. What Orbit Ledger Has That Competitors Often Do Not Combine Well

No serious agent should claim that no competitor offers any single feature. Many competitors offer invoices, reminders, inventory, reports, backups, cloud sync, mobile apps, and WhatsApp sharing.

The differentiation is the combination and product emphasis:

> Offline-first ledger + mobile daily command center + collection intelligence + promise-to-pay follow-up + customer trust timeline + daily closing ritual + backup confidence + local business packs + web office companion + practical private helpers.

This bundle is uncommon because broad accounting tools tend to optimize for accounting completeness, while billing apps tend to optimize for invoicing, inventory, tax, and document sharing.

### 9.1 Daily Money-Control Identity

Orbit Ledger's core identity is not "accounting software" or "billing software."

It should be:

- A daily command center.
- A collection control room.
- A customer memory system.
- A closing ritual.
- A backup confidence layer.

This identity makes the product easier to understand and more emotionally useful.

### 9.2 Collection Intelligence Instead Of Receivables Table Only

Competitors often show outstanding amounts and reminders. Orbit Ledger's opportunity is to decide priority:

- Who should be contacted first?
- Why that person?
- What action should be taken?
- Has a promise been broken?
- Was a reminder already sent recently?

This moves from "report" to "decision."

### 9.3 Promise-To-Pay As A First-Class Object

In many small businesses, money is not collected through formal invoice due-date workflows. It is collected through human promises:

- "I will pay tomorrow."
- "I will send half by evening."
- "Call me next week."

Orbit Ledger can own this reality better than tools built around formal invoices only.

### 9.4 Customer Trust Timeline

A dispute is rarely solved by one balance number. It needs a story:

- Credit given.
- Payment received.
- Invoice sent.
- Statement saved.
- Reminder sent.
- Promise made.
- Promise missed.
- Note or dispute recorded.

Orbit Ledger's trust timeline can become the place where owners stop relying on memory.

### 9.5 Daily Closing Ritual

Most small business software offers reports. Fewer products make daily closing feel like a short habit:

- Count cash.
- Confirm payments are recorded.
- Confirm credit is recorded.
- Check stock changes.
- Prepare follow-ups.
- Save next-day actions.

This is business discipline, not accounting homework.

### 9.6 Backup Confidence As A Product Feature

Many apps support backup. Orbit Ledger should make backup confidence visible:

- Backup health.
- Restore preview.
- Typed confirmation.
- Validation before restore.
- Clear "not included" language.
- Restore progress.
- Rollback/preservation effort.

Small businesses fear data loss. Trust can be a product wedge.

### 9.7 Practical AI Helpers With Privacy Positioning

Rather than a generic chatbot, Orbit Ledger's helper should answer practical daily questions:

- Write a payment reminder.
- Who should I call first?
- Why did receivables change?
- Summarize this month.
- Find entries to review.
- Prepare tomorrow's plan.

The current helper model includes privacy-first language and redaction.

### 9.8 Web As Companion, Not Core Identity

Many products either start web-first or make mobile a companion. Orbit Ledger should be mobile-first and use web for what web is better at:

- Tables.
- Filters.
- Imports.
- Exports.
- Reports.
- Bulk cleanup.
- Review.
- Backup.
- Settings.

This avoids turning the mobile app into a cramped desktop system.

---

## 10. Canonical Positioning And Copy Rules

Use:

- Daily money control.
- Collect faster.
- Close each day with confidence.
- Never lose track of who owes what.
- Know who needs follow-up.
- Record confirmed payments.
- Protect your business records.
- Review customers, invoices, reports, and backups on web.
- Free stays useful.
- Pro improves document polish.

Avoid user-facing wording like:

- Firestore.
- SQLite.
- Sync metadata.
- Server revision.
- JSON payload.
- Cached state.
- Backend.
- API call.
- Technical error.
- Workspace snapshot.
- CRUD.
- Flat form.
- Placeholder.
- Internal config.

Preferred replacements:

- "Saved" instead of "synced."
- "Waiting to upload" instead of "pending sync."
- "Needs review" instead of "conflict."
- "Backup copy" instead of "JSON export."
- "Region setup" instead of "country package" when speaking to non-technical users.
- "Local labels" instead of "tax pack logic."
- "Business workspace" instead of "cloud workspace."

---

## 11. UX Principles

### 11.1 Mobile UX

Mobile must be:

- One-handed friendly.
- Fast.
- Calm.
- Action-led.
- Easy to read on small Android screens.
- Respectful of safe areas and bottom actions.
- Free from cramped controls.
- Free from technical language.

Good mobile screen behavior:

- Primary action visible.
- No button stuck to a card or edge.
- Tap targets at least 48 px high.
- Empty states teach the next useful action.
- Heavy actions show progress.
- Forms avoid overwhelming owners.
- Labels use business language.

### 11.2 Web UX

Web must be:

- Dense but calm.
- Table-friendly.
- Keyboard-friendly.
- Good for repeated review.
- Responsive down to mobile browser widths.
- Not a landing page inside the app.

Good web behavior:

- Sidebar navigation.
- Top business context.
- Search/filter/export affordances.
- No decorative cards inside cards.
- Clear empty/loading/error states.
- Bulk and cleanup workflows where safe.
- Strong customer/invoice/report review.

---

## 12. Brand Direction

Orbit Ledger should feel:

- Trustworthy.
- Modern.
- Serious.
- Clear.
- Lightly futuristic.
- Operational, not decorative.

Color semantics from the brand foundation:

- Blue: primary action, active navigation, selected state, links.
- Teal: payment received, success, healthy backup.
- Amber: dues, stale follow-up, attention, overdue.
- Violet: tax, region packs, intelligence, advanced systems.
- Plum: premium/Pro only.
- Red: destructive action only.

No-go styling:

- Generic dashboard template styling.
- Oversized marketing heroes inside the product shell.
- Random color usage without semantic meaning.
- Mobile cards simply widened for desktop.
- Loud gradients behind operational data.
- UI that feels like a toy instead of a business tool.

Sources:

- `docs/phase-0-brand-web-foundation.md`
- `packages/ui/src/theme.ts`
- `packages/ui/src/brand.ts`
- `apps/web/app/globals.css`

---

## 13. Launch Trust Requirements

Before public launch, keep these trust requirements visible:

- Google consent branding must show Orbit Ledger or Orbit Ledger by Rudraix.
- Public domain should use Orbit Ledger branding, not a raw Firebase project domain.
- Privacy policy must explain account data, local records, backups, app lock, billing, and support.
- Terms must explain acceptable use, billing, refunds through app stores, user data responsibility, and limitations.
- Support topics must include backup, restore, lock, billing, account access, and Google sign-in.
- Release notes should explain user value, not internal engineering work.
- Screenshots must use demo data only.
- App Store and web copy must match the product's actual capabilities.

Sources:

- `docs/market-phase-46-launch-polish.md`
- `packages/core/src/marketLaunch.ts`

---

## 14. Current Readiness Snapshot

Areas that appear strong in the current repo:

- Clear market positioning.
- Mobile-first product direction.
- Daily command center model.
- Collection intelligence model.
- Promise follow-up model.
- Customer trust timeline model.
- Daily closing ritual model.
- Backup/restore validation and preview direction.
- Mobile security and web lock boundaries.
- Local business pack foundation.
- Web office companion with real routes.
- Firebase rules and tests.
- CI workflow.
- Expo Doctor passing after SDK patch updates.
- Node pin aligned to Node 24.14.0 across local, web, mobile, shared packages, and Firebase Functions.

Areas to continue strengthening:

- Real device visual QA across Android/iOS/tablet sizes.
- Public domain and Google consent branding outside code.
- Privacy policy, terms, support, data deletion, and public launch pages.
- Server-side summaries/counters for large workspaces.
- Full sync conflict UX.
- Payments/UPI/WhatsApp workflow integration quality.
- Billing store end-to-end testing in real app store sandbox environments.
- Monitoring, rollback, incident response, and support operations.

---

## 15. Roadmap Logic For Future Agents

Use this order of judgment when deciding future work:

1. Does it help the owner collect money faster?
2. Does it help the owner close the day with confidence?
3. Does it help the owner remember who owes what and why?
4. Does it protect records or improve trust?
5. Does it make mobile daily use faster?
6. Does it make web review/cleanup faster?
7. Does it preserve simple user language?
8. Does it avoid becoming a broad accounting clone?

If an idea does not answer yes to at least one of those, it does not belong in the near-term roadmap.

High-value next roadmap areas:

- Richer collection intelligence.
- Promise-to-pay workflow polish.
- Customer trust timeline UX polish.
- Faster daily closing.
- WhatsApp/UPI payment request workflow.
- Backup health dashboard.
- Better restore rollback confidence.
- Local pack marketplace.
- Web import/export polish.
- Web report/document export polish.
- Server summaries and pagination.
- Plain-language sync conflict resolution.
- Public launch trust pages.

Low-priority unless a clear user need emerges:

- Full payroll.
- Full bank reconciliation.
- Full chart of accounts.
- Deep audit/compliance filing.
- Complex multi-warehouse inventory.
- Project accounting.
- Large-team role matrices.
- Custom automation builder.

These are valuable in the market but would pull Orbit Ledger toward broad-suite competition.

---

## 16. Agent Instructions For Future Work

When another AI agent works on Orbit Ledger:

1. Read this brief first.
2. Preserve the north star.
3. Prefer mobile-first UX.
4. Keep web as a power workspace, not the main identity.
5. Do not add technical wording to user screens.
6. Preserve backup and security truthfulness.
7. Add tests for deterministic business logic.
8. Run typecheck/tests/build/doctor where touched.
9. Avoid broad refactors that do not serve the requested phase.
10. Do not claim compliance beyond what the code actually supports.
11. Do not make Pro block basic ledger, backup, restore, or app lock.
12. Treat trust and data loss prevention as product features.

For product copy:

- Use concrete verbs: collect, record, close, review, send, protect.
- Prefer "customer has dues" over "receivable entity has outstanding balance."
- Prefer "follow up today" over "collection priority score."
- Prefer "backup copy" over "serialized export."

For UI:

- Use action cards for daily decisions.
- Use tables and filters on web.
- Use short labels on mobile.
- Keep destructive actions confirmed.
- Keep loading/progress states visible.

For engineering:

- Keep business logic deterministic and testable.
- Keep local-first mobile behavior reliable.
- Keep Firebase ownership checks strict.
- Keep restore validation defensive.
- Keep large reads paginated or summarized.
- Keep Node and Expo versions aligned with Doctor.

---

## 17. Suggested AI Agent Context Header

Future agents can paste this short header into planning prompts:

```text
Orbit Ledger is a mobile-first daily money-control app for very small businesses. Its north star is: collect faster, close each day with confidence, and never lose track of who owes what. Do not turn it into a broad accounting suite. Mobile is the primary product; web is the office companion for cleanup, review, imports, bulk work, exports, reports, backup control, and settings. User screens must avoid technical language. Preserve backup confidence, security truthfulness, local-first trust, and simple owner actions.
```

---

## 18. External Market Reference Links

Use these references only to understand market context, not to copy product shape.

- Zoho Books feature page: https://www.zoho.com/us/books/accounting-software-features/
- Vyapar official site: https://vyapar.com/
- TallyPrime help feature overview: https://help.tallysolutions.com/tallyprime-get-started/

Competitive conclusion:

- Zoho is broad and accounting-rich.
- Vyapar is strong in billing/accounting/inventory/reminders/WhatsApp/offline positioning.
- TallyPrime is deep in accounting, inventory, compliance, audit, reporting, and business operations.
- Orbit Ledger's wedge is not breadth. It is daily money control, collection discipline, relationship memory, backup confidence, and calm mobile-first ownership.

---

## 19. Final Product Thesis

Orbit Ledger should become the app a very small business owner opens every morning and evening:

- Morning: see who needs money follow-up first.
- During the day: record credit, record payments, send documents, capture promises.
- Evening: close the day, catch mismatches, prepare tomorrow.
- Always: know customer history, protect records, and keep the business under control.

The strongest market promise is not "more features."

The strongest promise is:

> Orbit Ledger helps small businesses protect cash, trust their records, and run each day with less mental load.
