# Orbit Ledger Settings Hub Storage Blueprint

Phase: Settings Hub Phase 1 - Settings Map + Storage Rules

Status: implemented as the source-of-truth registry in `packages/core/src/settingsBlueprint.ts`.

## Purpose

Orbit Ledger must remember how each owner works without mixing personal preferences, shared company data, device-only security, and audit-sensitive money rules. This blueprint prevents settings from being saved in the wrong place before the Settings Hub UI is rebuilt.

The product rule is simple:

- Personal comfort settings follow the signed-in user.
- Company settings follow the business workspace.
- Device protection stays on the device.
- Money, tax, bank, security, and restore-impacting settings keep an audit trail.

## Settings Hub Sections

The future Settings Hub should be organized into these sections:

1. My Settings
2. Company Settings
3. Invoice & Document Settings
4. Payment Settings
5. Security
6. Backup & Data
7. Notifications & Reminders

The sidebar may continue to show `Settings`. A `Company settings` shortcut should deep-link to the company section, not look like a duplicate page.

## Storage Rules

### User Cloud

Use for per-user preferences synced to the account. These settings should not change the shared business setup for teammates.

Good candidates:

- default dashboard view
- table density
- rows per page
- default report date range
- default customer filter
- default invoice status filter
- balance privacy mode
- larger text mode
- default export format
- backup reminder frequency
- reminder style
- overdue alert timing

### Workspace Cloud

Use for shared company/workspace settings that affect everyone using the business.

Good candidates:

- company display name
- contact details
- structured address
- default invoice template
- default statement template
- document brand colors
- logo, signature, watermark assets
- watermark opacity
- default invoice notes
- PDF/CSV filename format
- WhatsApp and email message templates
- urgent payment stamp default

### Device Local

Use for device/browser-only settings. These should not be restored onto another device or described as cloud account security.

Good candidates:

- browser/app lock timeout
- PIN lock state
- biometric preference
- reduced motion override

### Audit Protected

Use for money, tax, legal, payment, security, or restore-impacting settings. These changes should keep actor, timestamp, previous value, new value, and reason once implemented.

Good candidates:

- legal business name
- tax IDs
- invoice numbering
- payment terms
- due days
- default tax rate
- manual payment instructions
- payment provider credentials
- restore confirmation rules

## Save Behavior Rules

### Auto-Save

Use for safe settings where accidental changes are easy to reverse and do not affect money truth.

Examples:

- watermark opacity
- brand colors
- table density
- default dashboard view
- default filters
- reminder tone
- default document template, with plan enforcement at generation time

Required UI behavior:

- show a small `Saving...` or `Saved` state
- do not show a toast for every small change
- show `Could not save` only when needed

### Manual Save

Use when a section has multiple related fields or affects shared customer-facing output.

Examples:

- company contact details
- address
- logo/signature/watermark uploads
- default invoice notes
- message templates

### Confirm

Use when a setting can surprise the user, team, or customer.

Examples:

- PDF footer preference
- urgent payment stamp default
- app lock timeout

### Audit

Use when a setting can affect accounting, tax, payments, reports, restore safety, or security.

Examples:

- legal name
- GSTIN/PAN/VAT
- invoice numbering
- payment terms
- due days
- tax rate
- bank/UPI/payment page details
- payment provider credentials
- restore confirmation rules

## Implementation Contract

The shared registry lives in:

`packages/core/src/settingsBlueprint.ts`

It exports:

- `ORBIT_LEDGER_SETTINGS_BLUEPRINT`
- `SETTINGS_SURFACE_LABELS`
- `SETTINGS_STORAGE_RULES`
- `SETTINGS_SAVE_BEHAVIOR_RULES`
- `getSettingsBlueprintBySurface`
- `getSettingsBlueprintByStorage`
- `getAutoSavedSettings`
- `getAuditProtectedSettings`

The tests live in:

`packages/core/src/settingsBlueprint.test.ts`

They enforce:

- every setting has a unique id
- every setting has a section, storage rule, save behavior, reason, user benefit, and implementation note
- every Settings Hub section has at least one setting
- every storage scope is represented
- low-risk settings are marked for auto-save
- money-impacting settings are audit-protected
- device-only settings are not mixed into workspace sync

## Settings Included In Phase 1

### My Settings

- Default dashboard view
- Table density
- Rows per page
- Default report date range
- Default customer filter
- Default invoice status filter
- Hide balances on screen
- Larger text
- Reduced motion
- Default export format

### Company Settings

- Company display name
- Legal business name
- Company contact details
- Company address
- Company tax IDs

### Invoice & Document Settings

- Invoice numbering
- Default invoice template
- Default statement template
- Document brand colors
- Logo, signature, and watermark files
- Watermark opacity
- Default invoice notes
- PDF footer preference
- Document filename format
- Default tax rate

### Payment Settings

- Default payment terms
- Default due days
- Manual payment instructions
- Payment provider credentials

### Security

- App lock timeout

### Backup & Data

- Backup reminder frequency
- Restore confirmation rules

### Notifications & Reminders

- Reminder style
- Overdue alert timing
- WhatsApp and email templates
- Urgent payment stamp default

## Product Principle

Orbit Ledger should feel like it remembers the owner. The user should not repeatedly set the same invoice design, report filter, payment wording, reminder tone, or privacy preference. At the same time, the app must be strict with anything that affects money, tax, legal identity, bank details, restore safety, or security.

This blueprint is the guardrail for the remaining Settings Hub phases.
