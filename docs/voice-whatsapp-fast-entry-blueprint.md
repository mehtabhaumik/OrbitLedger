# Voice And WhatsApp Fast Entry Blueprint

## Goal

Orbit Ledger should let a small business owner capture work quickly in natural language:

- spoken into the phone,
- typed into a fast entry box,
- pasted from WhatsApp,
- or later received through a WhatsApp workflow.

The important rule is simple:

> Fast entry captures intent. It does not silently save money or send customer messages.

Every captured entry becomes a reviewed draft first.

## Product Promise

The owner should be able to say or type:

- `Sonali Traders paid 1500 by UPI`
- `Add 2000 credit for Mehta Stores`
- `Create invoice for printer repair 1500 plus GST`
- `Remind Sonali about WEB-100 tomorrow`
- `Riya promised to pay 5000 on Friday`
- `Add product thermal paper roll price 120 stock 25`

Orbit Ledger should respond with:

1. what it understood,
2. what is missing,
3. where the user should review it,
4. and a clear save action only after review.

## Launch Surfaces

### Fast Capture

Purpose:

- accept voice, WhatsApp-style, and typed text.

Required review fields:

- raw text,
- source channel,
- detected intent.

Action:

- open capture review.

### Money Entry Review

Purpose:

- turn payment and credit phrases into ledger drafts.

Examples:

- `Received 5000 cash from Aarav Stores`
- `Add outstanding 3200 for Riya Traders`

Required review fields:

- customer,
- amount,
- entry type,
- date,
- payment mode when payment.

Action:

- open transaction review.

### Invoice Draft Review

Purpose:

- prepare invoice drafts from quick text.

Required review fields:

- customer,
- line item,
- quantity,
- price,
- tax choice.

Action:

- open invoice draft review.

### Collection Follow-Up

Purpose:

- prepare reminders and promise notes.

Required review fields:

- customer or invoice,
- reminder message,
- promise date when relevant,
- amount when available.

Action:

- open reminder or promise review.

### Customer Setup

Purpose:

- prepare new customer records from quick text.

Required review fields:

- display name,
- phone or email when available,
- customer type.

Action:

- open customer review.

### Inventory Setup

Purpose:

- prepare product or stock drafts from quick text.

Required review fields:

- product name,
- price or stock quantity,
- unit when available.

Action:

- open product review.

### Review Safety

Purpose:

- make fast entry trustworthy.

Rules:

- no money save without review,
- no invoice finalization without review,
- no customer-facing WhatsApp/email without editable preview,
- no stock change without confirmation,
- low-confidence input asks user to choose the entry type.

## Intent Model

Supported launch intents:

- record payment,
- record credit,
- create invoice draft,
- send payment reminder,
- record payment promise,
- add customer,
- add product,
- unknown.

Every detected intent returns:

- title,
- summary,
- extracted fields,
- missing fields,
- confidence,
- suggested action,
- review target,
- guardrails.

## Review-First Rule

All fast-entry drafts must have:

- `reviewRequired: true`
- `canAutoSave: false`

This is non-negotiable for launch. A fast entry can speed up typing, but it must not quietly change business money, invoice state, stock, or customer records.

## Guardrails

- Fast entry must create a draft for review, never silently save money, invoices, customers, or stock.
- Every draft must show what Orbit Ledger understood and which fields are missing.
- Low-confidence input must ask the user to choose the intent before showing save actions.
- Voice and WhatsApp text can suggest payment mode, but clearance and invoice allocation still need review.
- Customer-facing messages must be editable before sharing.
- Invoice drafts created from fast entry must follow normal invoice save and version rules.
- Sensitive data from WhatsApp or voice must stay inside the active workspace review flow.

## Mobile Direction

Mobile is the primary surface for this feature.

Suggested future UI:

- a compact fast-entry button on Dashboard,
- microphone capture,
- paste-from-WhatsApp capture,
- review sheet with detected details,
- save buttons only after required fields are complete.

## Web Direction

Web should support the same model but with desktop-friendly controls:

- fast-entry bar on Transactions,
- paste text area for WhatsApp messages,
- side-by-side detected fields and review form,
- direct handoff to invoice, customer, product, or reminder review.

## WhatsApp Direction

The first launch step should support pasted WhatsApp text. Direct WhatsApp automation can come later.

When direct WhatsApp is added:

- imported text must still become a review draft,
- customer messages must open an editable preview,
- reminders must use saved tone and templates,
- payment links can be inserted only when user confirms.

## Success Criteria

This feature succeeds when the owner can capture a real business event in seconds while still feeling safe:

- no accidental entries,
- no wrong invoice sent,
- no hidden balance changes,
- no customer message sent without preview,
- no confusing accounting language.
