import { describe, expect, it } from 'vitest';

import { buildManualPaymentFollowUpMessage } from './manualPaymentFollowUp';

describe('manual payment follow-up messages', () => {
  it('builds post-dated follow-up copy', () => {
    const message = buildManualPaymentFollowUpMessage({
      businessName: 'Orbit Store',
      customerName: 'Asha Traders',
      amountLabel: '₹1,770.00',
      clearanceStatus: 'post_dated',
      invoiceNumber: 'WEB-641090',
      paymentModeLabel: 'Cheque',
    });

    expect(message).toContain('post-dated');
    expect(message).toContain('WEB-641090');
    expect(message).toContain('Cheque');
  });

  it('builds bounced payment copy without saying paid', () => {
    const message = buildManualPaymentFollowUpMessage({
      businessName: 'Orbit Store',
      customerName: 'Asha Traders',
      amountLabel: '₹1,770.00',
      clearanceStatus: 'bounced',
    });

    expect(message).toContain('could not be cleared');
    expect(message).not.toContain('paid');
  });
});
