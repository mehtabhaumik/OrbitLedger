# Orbit Ledger Tier Entitlement Audit

Generated: May 6, 2026

## Launch Scope

Orbit Ledger web is currently in public beta with free services only. Paid checkout is disabled until Razorpay is connected, tested, and approved.

This audit checks whether the paid tier promises are mapped to the correct product behavior before paid checkout is enabled.

## Tier Rules

| Tier | Company access | User access | Important unlocks |
| --- | --- | --- | --- |
| Free | One company | One owner user | Daily ledger, customers, invoices, PDF/CSV export, backup, restore, browser lock. |
| Plus | One company | One owner user | Customer health, customer profile exports, payment links, payment proof attachments, batch statements, recurring invoice rules. |
| Pro Plus | Multiple companies for one owner | One owner user | Premium templates, document branding, automatic invoice email, payment reconciliation, payment reversals, tax/audit surfaces. |
| Office | Multiple companies | Team users | Invitation-only team review, bulk operations, multi-user workspace, accountant exports, priority support. |

## Important Separation

Multiple companies and multiple users are not the same feature.

- `multi_business_profiles` is a Pro Plus feature.
- `multi_user_workspace` is an Office feature.

That means:

- A Pro Plus owner can manage more than one company under the same sign-in.
- Office is required when more than one person needs access to the same company workspace.
- Office is invitation only. Users request Office from Market with full name, email, best contact number, optional alternate number, and a customizable message.

## Changes Made From This Audit

- Added `multi_business_profiles` to the shared core monetization model.
- Confirmed `multi_business_profiles` requires Pro Plus.
- Confirmed `multi_user_workspace` requires Office.
- Added reusable web workspace creation entitlement logic so additional company creation can check Pro Plus access before the paid flow is opened.
- Split recurring invoice behavior correctly:
  - Plus can save recurring invoice rules.
  - Pro Plus is required for automatic customer invoice email.
- Updated the invoices UI wording from only "Monthly auto email" to "Monthly invoices and auto email."
- Updated template wording from "Pro" to "Pro Plus" so user-facing labels match the tier ladder.
- Changed Office from self-serve checkout to an invitation-only request flow with a fixed subject and editable message.
- Added tests that lock these distinctions.

## Paid Launch Guard

Paid plans remain disabled in public beta. This protects users from buying a tier before Razorpay checkout, entitlement sync, and paid-feature fulfillment are ready.

Before paid checkout is enabled, re-check:

- Pro Plus additional-company creation flow is visible, polished, and wired to the entitlement check.
- Office team invitation/member permissions are implemented and covered by rules tests.
- Firestore rules understand member roles before Office multi-user access is sold.
- All paid feature gates have server-side or rules-side protection where money or private data is affected.

## Current Verdict

The web beta is safe because paid checkout is closed.

For future paid launch:

- Free, Plus, and Pro Plus are mostly aligned after this audit.
- Office should remain invitation-only until team/member workflow, permissions, and rules coverage are complete.
