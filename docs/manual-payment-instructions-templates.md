# Manual Payment Instructions + UPI/Bank Detail Templates

Orbit Ledger now treats manual payment instructions as a first-class business setup item.

This is the active payment workflow until a real online provider account is connected. The app can still prepare payment links and provider payloads for future checkout work, but customer-facing screens should not imply that provider checkout is live.

## What This Phase Adds

- Shared payment instruction templates in `@orbit-ledger/core`.
- India-ready fields for UPI and bank transfer.
- Future-ready US and UK bank fields while those country packs remain upcoming.
- Web workspace settings for saving business payment instructions.
- Web invoice editor support for showing saved manual payment details.
- Mobile business settings support for the same country-aware fields.
- Invoice PDFs can show manual payment instructions even when no online checkout provider exists.
- Payment request messages include saved manual details.

## Supported Fields

India:

- UPI ID
- Account name
- Bank name
- Account number
- IFSC
- Branch
- Payment page
- Payment note

United States:

- Account name
- Bank name
- Account number
- Routing number
- Payment page
- Payment note

United Kingdom:

- Account name
- Bank name
- Account number
- Sort code
- IBAN
- SWIFT/BIC
- Payment page
- Payment note

Generic:

- Account name
- Bank name
- Account number
- Payment page
- Payment note

## User-Facing Rules

- Do not say a provider is connected unless provider mode is explicitly connected.
- Manual collection remains valid and polished.
- Payment details should appear as business-friendly instructions, not raw setup data.
- UPI is shown only for India.
- Bank details should be displayed in compact, readable lines on invoices and payment messages.

## Next Phase

Recommended next phase: **Manual Payment Verification + Received Payment Matching**.

That phase should make it easier for the owner to mark a manual transfer as received, match it to the invoice, and avoid double-entry mistakes.
