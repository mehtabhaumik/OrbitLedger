# Founder-Safe Support Layer Blueprint

## Goal

Orbit Ledger should make support feel close and trustworthy without turning support into a privacy risk.

The user should be able to:

- report an issue with an invoice, payment, export, backup, purchase, or screen,
- ask for help restoring data,
- suggest a feature,
- send a safe diagnostic summary,
- and contact the founder/support team without exposing customer records by accident.

The important rule:

> Support can receive app context only after review. It must never silently upload customer, ledger, invoice, payment, backup, or tax records.

## Product Promise

Support should feel like:

> “Orbit Ledger can help me, but it will not quietly send my business data away.”

User-facing support must be calm and non-technical:

- `Report an issue`
- `Request help`
- `Suggest an improvement`
- `Send diagnostic summary`
- `Review what will be shared`

Avoid user-facing wording like:

- payload,
- stack trace,
- webhook,
- provider secret,
- database record,
- internal route,
- raw error.

## Launch Surfaces

### Report An Issue

Purpose:

- Let users report broken workflows from the current screen.

Examples:

- invoice PDF did not open,
- payment status looks wrong,
- export failed,
- customer total looks off,
- form did not save,
- page looks broken on mobile.

Safe data:

- screen name,
- issue category,
- user-written description,
- optional safe diagnostic summary.

Blocked data:

- full ledger rows,
- full customer list,
- raw invoices,
- payment instrument images,
- tax IDs unless user intentionally shares them.

Action target:

- open support center.

### Restore Help

Purpose:

- Help users when backup/restore/sync feels risky.

Safe data:

- platform,
- app version,
- backup status label,
- restore step,
- error code,
- connectivity state.

Blocked data:

- backup file contents,
- full business export,
- raw restore payload,
- customer rows.

Action target:

- open backup support.

### Feature Request

Purpose:

- Let users suggest improvements without forcing a formal ticket.

Safe data:

- screen name,
- feature area,
- user-written idea.

Blocked data:

- customer names unless user types them intentionally,
- ledger amounts,
- tax IDs,
- payment details.

Action target:

- open feature feedback.

### Safe Diagnostic Summary

Purpose:

- Give support enough technical context without sharing private records.

Allowed fields:

- app version,
- platform,
- browser or OS label,
- route without IDs/query strings,
- screen name,
- connectivity,
- sync status label,
- error code,
- feature flags,
- record counts,
- recent action labels after redaction.

Redacted or omitted fields:

- business name,
- customer name,
- customer email,
- phone number,
- raw URL,
- raw error message,
- invoice number,
- tax ID,
- bank account number,
- payment provider secret,
- backup file content.

Action target:

- review support privacy.

### Purchase Support

Purpose:

- Help users with paid plan access, receipt recovery, cancellation, renewal, or checkout readiness.

Safe data:

- plan label,
- purchase status,
- provider mode,
- receipt status,
- safe event ID,
- country/currency.

Blocked data:

- card details,
- bank details,
- provider secret keys,
- full webhook payloads.

Action target:

- open purchase support.

### Privacy Review

Purpose:

- Show the user exactly what will be shared before anything leaves the app.

Required UI:

- message preview,
- redacted diagnostic summary,
- warnings for private-looking text,
- include/exclude diagnostics toggle,
- attachment review,
- clear send button.

Blocked behavior:

- hidden background uploads,
- auto-attached screenshots,
- unreviewed logs,
- automatic backup upload,
- automatic invoice upload.

## Support Draft Model

Each support draft should include:

- kind,
- title,
- summary,
- priority,
- action target,
- sanitized message,
- private data warnings,
- missing fields,
- privacy review required,
- diagnostic summary,
- guardrails.

Supported launch kinds:

- invoice issue,
- payment issue,
- restore help,
- sync issue,
- purchase help,
- feature request,
- general feedback.

## Diagnostic Rule

Diagnostics are useful, but they must be opt-in.

Default:

- diagnostics off.

When user enables diagnostics:

1. Build the safe diagnostic summary.
2. Redact private fields.
3. Show the preview.
4. Ask the user to confirm.
5. Send only the reviewed summary.

If the user has not approved diagnostics, the support draft must not include them.

## Attachment Rule

Attachments are allowed later, but only with strong guardrails.

Allowed after user selection:

- screenshot,
- invoice PDF,
- payment proof image,
- backup error screenshot,
- receipt copy.

Required behavior:

- show file name,
- show file type,
- show size,
- show remove button,
- ask confirmation before sending.

Never attach automatically:

- backup export,
- Firestore data,
- full ledger,
- full customer export,
- payment provider payload,
- secret files.

## Privacy Detection

The app should warn when support text contains:

- email address,
- phone number,
- account-like number,
- GSTIN,
- PAN,
- invoice number,
- payment reference,
- provider key-looking text.

This does not block the user forever. It asks them to review before sending.

## User-Facing Copy

Good:

- `Review what will be shared`
- `Private details were removed from diagnostics`
- `Attach a file yourself if support needs it`
- `No customer records are included automatically`
- `Send request`

Avoid:

- `Send logs`
- `Upload payload`
- `Share database snapshot`
- `Attach debug dump`
- `Send stack trace`

## Founder-Safe Support Guardrails

- Support must never upload customer, ledger, invoice, payment, backup, or tax records automatically.
- Diagnostics must be opt-in and must show a clear preview before sending.
- Private identifiers in diagnostics must be redacted or omitted by default.
- Attachments must be chosen by the user and reviewed before upload.
- Payment provider keys, card details, bank account numbers, and backup file contents must never be included in support payloads.
- Support copy should avoid scary technical wording on user screens.
- Web and mobile may use different layouts, but support categories, privacy rules, and safe diagnostic fields must match.

## Web And Mobile Parity

Web should offer:

- support link in sidebar,
- support surface from major workflows,
- current screen context,
- diagnostic preview,
- file attachment later,
- purchase support area,
- founder note / feedback surface.

Mobile should offer:

- support from dashboard/tools,
- report issue from invoice/payment/backup screens,
- safe diagnostic preview,
- share-sheet friendly support where needed,
- restore help entry point,
- feedback and founder note.

Different UI skins are fine. The support categories, redaction rules, diagnostic fields, and consent flow must match.

## Phase 22 Build Target

The next UI phase should add:

- web support page,
- mobile support entry surface,
- issue category picker,
- message field,
- diagnostic include toggle,
- diagnostic preview,
- privacy warning area,
- send-disabled-until-ready behavior,
- no browser default alerts,
- no automatic private attachments.
