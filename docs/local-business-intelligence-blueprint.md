# Local Business Intelligence Blueprint

## Goal

Orbit Ledger should feel locally native for the business owner, not like a generic ledger with a country dropdown.

Local Business Intelligence is the layer that turns country, state, city, tax setup, payment setup, invoice activity, and collection context into practical guidance:

- which local tax details are missing,
- which payment details should appear on invoices and reminders,
- which document style fits the country pack,
- when collection follow-up should be reviewed,
- when seasonal business reminders are useful,
- whether reports and exports are using the right local framing.

This is not a tax filing engine. It is a business-readiness layer that helps the owner prepare cleaner documents, reminders, reports, and exports.

## Product Promise

Orbit Ledger remembers where the business operates and quietly adapts the work:

- local tax labels,
- local payment wording,
- local address and currency formatting,
- country-ready document packs,
- payment reminders that match local behavior,
- seasonal review nudges,
- careful tax and audit review wording.

The owner should feel: “This app understands my local business workflow.”

## Launch Surfaces

### Local Tax Labels

Use when:

- business country is known,
- tax setup is incomplete,
- invoices or reports may need local wording,
- customer tax fields depend on the country pack.

India launch behavior:

- GSTIN,
- PAN,
- state,
- place of supply,
- GST-ready invoice wording,
- tax summary readiness.

US and UK behavior:

- remain upcoming unless their packs are enabled,
- can be shown as upcoming only,
- must not unlock tax/compliance wording early.

Action:

- open tax setup.

### Local Payment Wording

Use when:

- payment details are missing,
- invoices or reminders need payment instructions,
- payment notices should include the correct local method.

India launch behavior:

- UPI ID,
- account name,
- bank name,
- account number,
- IFSC,
- branch,
- payment note.

Other countries:

- use generic bank/manual payment instructions until their country packs are ready.

Action:

- open payment settings.

### Local Document Pack

Use when:

- default invoice or statement template is not set,
- country pack suggests a better starting template,
- PDF/CSV exports need consistent document behavior.

Documents affected:

- invoice,
- statement,
- payment notice,
- overdue notice,
- customer profile,
- tax summary,
- audit packet.

Rules:

- never show internal template names on customer-facing documents,
- free documents may include the Orbit Ledger footer,
- paid documents may remove footer based on entitlement,
- old invoice versions must use frozen snapshots.

Action:

- open document settings.

### Collection Timing

Use when:

- overdue customers exist,
- unpaid invoices exist,
- payment reminders or statements should be prepared,
- customer trust history suggests follow-up.

India launch behavior:

- keep WhatsApp-ready copy in mind,
- include UPI/bank instructions where enabled,
- use polite language by default.

Action:

- open Collection Coach.

### Seasonal Nudge

Use when:

- the selected country has known business review periods,
- month suggests extra collection/reporting attention,
- user has dues or tax data worth reviewing.

India launch examples:

- March/April: year-end review season,
- October/November: festival-season collection check.

Rules:

- subtle and dismissible,
- never fear-based,
- do not spam dashboards,
- do not claim legal deadlines unless backed by a future compliance pack.

Action:

- open reports.

### Regional Formatting

Use when:

- currency does not match country,
- address/phone/date settings need review,
- exports need native formatting.

Examples:

- India: INR, Indian phone formatting, state and PIN/postcode labels,
- US: USD, ZIP, state,
- UK: GBP, postcode,
- Canada: CAD, province, postal code,
- Australia: AUD, state/territory, postcode.

Action:

- open settings.

### Compliance Review

Use when:

- tax profile exists,
- invoices contain tax data,
- reports or accountant handoff are likely.

Important wording:

- “review summary,”
- “accountant handoff,”
- “tax-ready export.”

Avoid:

- “filed,”
- “certified,”
- “legal compliance guaranteed.”

Action:

- open reports.

## Data Model

Core input signal:

- country code,
- state code,
- city,
- month,
- tax profile ready,
- local payment details ready,
- invoice template ready,
- overdue customer count,
- unpaid invoice count,
- tax invoice count,
- local currency.

Core output:

- title,
- summary,
- top insight,
- insight list,
- guardrails.

Each insight includes:

- area,
- title,
- message,
- helper,
- priority,
- tone,
- action label,
- action target,
- country code,
- locality label.

## Guardrails

- Local guidance must be written as business help, not legal or tax advice.
- Country packs can suggest labels, wording, and review reminders, but they must not claim official filing.
- US and UK packs remain upcoming until enabled by entitlement and implementation.
- India can use GST, PAN, UPI, IFSC, state, and place-of-supply language where data is available.
- Seasonal nudges should be subtle and dismissible, never noisy or fear-based.
- Every local recommendation must still respect the user’s saved settings and plan entitlement.

## Launch Behavior

For public launch, focus on India-first depth:

- India country locked/ready,
- state and city data available,
- GST labels,
- PAN/GSTIN fields,
- place of supply,
- UPI/bank payment instructions,
- India GST invoice template,
- local report wording.

Keep US and UK as upcoming packs until the full pack behavior is ready.

## Why This Matters

Most billing tools say they support countries, but the experience often feels generic. Orbit Ledger can stand apart by making local work easier:

- fewer repeated settings,
- clearer customer documents,
- better payment instructions,
- locally meaningful reminders,
- safer tax/report language,
- less confusion for small business owners.

The north star: Orbit Ledger should feel like it was built for the owner’s actual market, not merely translated into it.
