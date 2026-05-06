import { describe, expect, it } from 'vitest';

import {
  VOICE_WHATSAPP_FAST_ENTRY_GUARDRAILS,
  VOICE_WHATSAPP_FAST_ENTRY_SURFACES,
  buildVoiceWhatsAppFastEntryDraft,
} from './voiceWhatsAppFastEntry';

describe('voice and WhatsApp fast entry blueprint', () => {
  it('turns payment phrases into reviewed payment drafts', () => {
    const draft = buildVoiceWhatsAppFastEntryDraft({
      channel: 'voice',
      text: 'Sonali Traders paid 1500 by UPI',
    });

    expect(draft.intent).toBe('record_payment');
    expect(draft.extracted).toMatchObject({
      amount: 1500,
      customerName: 'Sonali Traders',
      paymentMode: 'UPI',
    });
    expect(draft.reviewRequired).toBe(true);
    expect(draft.canAutoSave).toBe(false);
    expect(draft.actionTarget).toBe('open_transaction_review');
    expect(draft.missingFields).toEqual([]);
  });

  it('keeps incomplete credit entries in review with missing fields', () => {
    const draft = buildVoiceWhatsAppFastEntryDraft({
      channel: 'whatsapp',
      text: 'Add outstanding for Mehta Stores',
    });

    expect(draft.intent).toBe('record_credit');
    expect(draft.confidence).toBe('medium');
    expect(draft.extracted.customerName).toBe('Mehta Stores');
    expect(draft.missingFields).toContain('amount');
    expect(draft.suggestedAction).toBe('Complete missing details');
  });

  it('prepares invoice text as a draft and never a final invoice', () => {
    const draft = buildVoiceWhatsAppFastEntryDraft({
      text: 'Create invoice for printer repair 1500 plus GST',
    });

    expect(draft.intent).toBe('create_invoice_draft');
    expect(draft.title).toBe('Review invoice draft');
    expect(draft.extracted.amount).toBe(1500);
    expect(draft.extracted.itemName).toBe('printer repair');
    expect(draft.actionTarget).toBe('open_invoice_draft_review');
    expect(draft.reviewRequired).toBe(true);
    expect(draft.canAutoSave).toBe(false);
  });

  it('detects reminders and payment promises without sending customer messages', () => {
    const reminder = buildVoiceWhatsAppFastEntryDraft({
      text: 'Remind Sonali Traders about WEB-100 tomorrow',
    });
    const promise = buildVoiceWhatsAppFastEntryDraft({
      text: 'Riya Traders promised to pay 5000 on Friday',
    });

    expect(reminder.intent).toBe('send_payment_reminder');
    expect(reminder.actionTarget).toBe('open_reminder_review');
    expect(reminder.extracted.invoiceNumber).toBe('WEB-100');
    expect(promise.intent).toBe('record_payment_promise');
    expect(promise.extracted.amount).toBe(5000);
    expect(promise.extracted.dueDateText).toBe('Friday');
  });

  it('defines every launch surface and safety guardrail', () => {
    expect(VOICE_WHATSAPP_FAST_ENTRY_SURFACES.map((surface) => surface.area)).toEqual([
      'capture',
      'money_entry',
      'invoice_draft',
      'collection_follow_up',
      'customer_setup',
      'inventory_setup',
      'review_safety',
    ]);
    expect(VOICE_WHATSAPP_FAST_ENTRY_SURFACES.every((surface) => surface.requiredReviewFields.length > 0)).toBe(true);
    expect(VOICE_WHATSAPP_FAST_ENTRY_GUARDRAILS).toContain(
      'Fast entry must create a draft for review, never silently save money, invoices, customers, or stock.'
    );
  });
});
