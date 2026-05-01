import { getPaymentClearanceStatusLabel, type PaymentClearanceStatus } from './paymentModes';

export type ManualPaymentFollowUpInput = {
  businessName: string;
  customerName: string;
  amountLabel: string;
  clearanceStatus: PaymentClearanceStatus;
  invoiceNumber?: string | null;
  paymentModeLabel?: string | null;
};

export function buildManualPaymentFollowUpMessage(input: ManualPaymentFollowUpInput): string {
  const invoiceLine = input.invoiceNumber ? ` for invoice ${input.invoiceNumber}` : '';
  const modeLine = input.paymentModeLabel ? ` via ${input.paymentModeLabel}` : '';
  const status = getPaymentClearanceStatusLabel(input.clearanceStatus).toLowerCase();

  if (input.clearanceStatus === 'bounced') {
    return [
      `Hi ${input.customerName},`,
      '',
      `The payment of ${input.amountLabel}${invoiceLine}${modeLine} could not be cleared.`,
      'Please arrange an alternate payment or share the corrected payment details today.',
      '',
      `Thank you,\n${input.businessName}`,
    ].join('\n');
  }

  if (input.clearanceStatus === 'post_dated') {
    return [
      `Hi ${input.customerName},`,
      '',
      `This is a reminder that your ${input.amountLabel} payment${invoiceLine}${modeLine} is post-dated and still waiting for clearance.`,
      'I will mark it received once it clears.',
      '',
      `Thank you,\n${input.businessName}`,
    ].join('\n');
  }

  return [
    `Hi ${input.customerName},`,
    '',
    `This is a reminder that your ${input.amountLabel} payment${invoiceLine}${modeLine} is currently marked ${status}.`,
    'Please reply once it is cleared from your side.',
    '',
    `Thank you,\n${input.businessName}`,
  ].join('\n');
}
