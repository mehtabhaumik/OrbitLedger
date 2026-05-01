import { describe, expect, it } from 'vitest';

import { buildRazorpayNotes, buildRazorpayPaymentLinkDraft } from './paymentProviderSetup';

describe('payment provider setup helpers', () => {
  it('builds Razorpay notes that match the webhook mapper', () => {
    expect(
      buildRazorpayNotes({
        amount: 1770,
        businessName: 'Rudraix PVT',
        currency: 'INR',
        customerId: 'customer_1',
        customerName: 'Sonali Traders',
        invoiceId: 'invoice_1',
        invoiceNumber: 'WEB-641090',
        reference: 'INV-WEB-641090',
        workspaceId: 'workspace_1',
      })
    ).toEqual({
      orbit_workspace_id: 'workspace_1',
      orbit_invoice_id: 'invoice_1',
      orbit_invoice_number: 'WEB-641090',
      orbit_customer_id: 'customer_1',
      orbit_customer_name: 'Sonali Traders',
    });
  });

  it('builds a test-ready Razorpay payment link payload without secrets', () => {
    const draft = buildRazorpayPaymentLinkDraft({
      amount: 1770,
      businessName: 'Rudraix PVT',
      callbackUrl: 'https://orbit-ledger-f41c2.web.app/pay',
      currency: 'INR',
      customerId: 'customer_1',
      customerName: 'Sonali Traders',
      invoiceId: 'invoice_1',
      invoiceNumber: 'WEB-641090',
      reference: 'INV-WEB-641090',
      workspaceId: 'workspace_1',
    });

    expect(draft.amount).toBe(177000);
    expect(draft.currency).toBe('INR');
    expect(draft.reference_id).toBe('INV-WEB-641090');
    expect(draft.customer?.name).toBe('Sonali Traders');
    expect(draft.callback_method).toBe('get');
    expect(draft.notes.orbit_workspace_id).toBe('workspace_1');
  });

  it('drops unsafe callback URLs', () => {
    const draft = buildRazorpayPaymentLinkDraft({
      amount: 500,
      businessName: 'Orbit Ledger',
      callbackUrl: 'http://localhost:3000/pay',
      currency: 'INR',
      invoiceNumber: 'WEB-1',
      reference: 'INV-WEB-1',
      workspaceId: 'workspace_1',
    });

    expect(draft.callback_url).toBeUndefined();
  });
});
