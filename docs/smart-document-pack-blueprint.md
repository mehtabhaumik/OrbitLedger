# Smart Document Pack Blueprint

## Goal

Orbit Ledger should stop treating documents as isolated downloads. A small business owner should be able to ask:

- What document should I send now?
- Should this customer get an invoice, statement, payment notice, or overdue notice?
- Can I prepare a customer profile before a call?
- Can I prepare a tax or audit packet without hunting through screens?

The Smart Document Pack is the document decision layer that turns business context into the right document action.

## Product Promise

Orbit Ledger helps the owner prepare the right business document at the right time, with the right customer data, payment wording, branding, tax labels, and history protection.

This is not only “download invoice.” It is:

- invoice,
- customer statement,
- payment notice,
- overdue notice,
- customer profile report,
- tax summary,
- audit packet.

## Launch Surfaces

### Invoice

Use when:

- a sale or service needs a formal document,
- line items and tax are ready,
- customer needs an official PDF or CSV,
- monthly recurring work creates an invoice.

Minimum tier: Free.

Required data:

- business identity,
- customer identity,
- line items,
- tax settings,
- payment status.

Rules:

- Draft wording never appears in customer documents.
- Saved invoices use frozen version snapshots.
- Paid invoices show a restrained paid stamp.
- Unpaid invoices show payment state and reason clearly.
- Template type/name must never appear on customer-facing documents.

### Customer Statement

Use when:

- customer has an open balance,
- customer asks what the balance is for,
- multiple invoices/payments need one clean explanation,
- collection follow-up needs a full account view.

Minimum tier: Free.

Required data:

- customer ledger,
- date range,
- opening balance,
- closing balance.

Rules:

- Statement should explain the account, not shame the customer.
- Each row should show date, type, note/reference, debit/credit, and balance where possible.
- Multiple customer statements can be batch generated later.

### Payment Notice

Use when:

- payment is due,
- customer needs a focused request,
- invoice exists but the owner wants a shorter collection document,
- payment link or UPI/bank details should be highlighted.

Minimum tier: Plus.

Required data:

- amount due,
- payment instructions,
- customer contact.

Rules:

- Tone should follow reminder settings: soft, firm, or urgent.
- Payment link is included only when enabled.
- PDF attachment and email body should use the same token system.

### Overdue Notice

Use when:

- invoice is overdue,
- payment promise was missed,
- cheque/DD/e-payment failed or bounced,
- customer needs a stronger but still professional document.

Minimum tier: Pro Plus.

Required data:

- overdue invoices,
- days overdue,
- payment history,
- business contact.

Rules:

- Use clear overdue reason: pending, received, deposited, bounced, errored, cancelled.
- Keep tone professional.
- Include payment link only if enabled.
- Avoid legal threats unless a future legal pack explicitly supports jurisdiction-specific language.

### Customer Profile Report

Use when:

- owner wants a customer review,
- credit limit is being changed,
- customer is risky or VIP,
- customer record may need cleanup,
- owner wants a one-page profile before a call.

Minimum tier: Plus.

Required data:

- customer profile,
- balance summary,
- customer health,
- timeline.

Should include:

- display name,
- legal/business name,
- phone/WhatsApp/email,
- contact person,
- address,
- tax identifiers,
- opening balance,
- credit limit,
- payment terms,
- preferred payment mode,
- total business,
- outstanding,
- last payment date,
- health rank,
- recent invoices/payments/promises/notes.

### Tax Summary

Use when:

- owner needs period review,
- country pack tax labels are available,
- invoices have taxable data,
- reports need PDF/CSV export.

Minimum tier: Pro Plus.

Required data:

- country pack,
- invoice tax data,
- date range.

Rules:

- Say “summary,” not “filing.”
- Never claim official tax filing or legal certification.
- Show a professional disclaimer:
  “This is a business review summary. Confirm filing requirements with a qualified professional.”

### Audit Packet

Use when:

- accountant/support needs a bundle,
- there were invoice revisions,
- payments were reversed or corrected,
- settings were changed,
- restore or rollback happened.

Minimum tier: Office.

Required data:

- document versions,
- payment corrections,
- settings audit,
- restore history.

Rules:

- This is internal or professional handoff, not a customer-facing document.
- Include reason fields and timestamps.
- Include “what changed” summaries.
- Preserve sensitive data masking for bank/security fields.

## Plan Strategy

Free:

- Invoice
- Customer statement
- Orbit Ledger footer required
- Basic templates

Plus:

- Payment notices
- Customer profile report
- Better exports
- Default document settings

Pro Plus:

- Overdue notices
- Tax summary
- Premium document templates
- Branding controls
- Payment-focused layouts

Office:

- Audit packet
- Advanced review/export bundle
- Admin support handoff
- Higher-trust recovery workflows

## Decision Rules

The Smart Document Pack recommends documents from business signals.

Signals:

- `invoice_ready`
- `customer_has_balance`
- `payment_due`
- `invoice_overdue`
- `customer_review`
- `tax_period_review`
- `audit_review`

Each recommendation includes:

- document kind,
- title,
- message,
- helper text,
- priority,
- score,
- tone,
- required plan,
- availability,
- action label,
- action target,
- required data,
- included documents.

## Guardrails

- Documents must never show internal template names or plan labels on customer-facing pages.
- Free documents can include the Orbit Ledger footer; paid documents can remove it when the plan allows.
- Every generated document must use frozen source data so later edits do not change old exports.
- Payment links, QR codes, and payment instructions should be included only when the business settings allow them.
- Tax and audit documents must use careful wording and avoid claiming official filing or legal certification.
- Batch packs should show a preview count before export or sending.

## UI Direction

Web:

- Add a Smart Document Pack section to Documents.
- Show recommended packs first.
- Show document pack catalog second.
- For each pack, show why it is recommended and what it includes.
- Locked packs should show the required plan without blocking learning.

Mobile:

- Add a compact “Recommended documents” section on Documents/Reports.
- Keep the first action simple: Prepare, Preview, Share.
- Avoid desktop-heavy controls.

## Future Phases

1. Smart Document Pack UI.
2. Payment notice and overdue notice templates.
3. Customer profile report upgrade alignment.
4. Tax summary PDF/CSV export.
5. Audit packet generator.
6. Golden parity tests for all document pack outputs.
