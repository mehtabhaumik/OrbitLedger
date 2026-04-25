import { Share } from 'react-native';

import type { PaymentReminderTone } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';

export type PaymentReminderMessageInput = {
  businessName: string;
  customerName: string;
  balance: number;
  currency: string;
  tone: PaymentReminderTone;
  lastPaymentDate?: string | null;
};

export type PaymentReminderShareResult = {
  shared: boolean;
  sharedVia: string | null;
};

export const paymentReminderToneLabels: Record<PaymentReminderTone, string> = {
  polite: 'Polite',
  firm: 'Firm',
  final: 'Final',
};

export const paymentReminderToneDescriptions: Record<PaymentReminderTone, string> = {
  polite: 'Friendly follow-up for regular customers.',
  firm: 'Clear request when dues need attention.',
  final: 'Strong but professional final reminder.',
};

export function buildPaymentReminderMessage(input: PaymentReminderMessageInput): string {
  const amount = formatCurrency(Math.max(input.balance, 0), input.currency);
  const lastPaymentLine = input.lastPaymentDate
    ? `Last payment recorded: ${formatShortDate(input.lastPaymentDate)}.\n`
    : '';

  if (input.tone === 'firm') {
    return [
      `Hi ${input.customerName},`,
      '',
      `This is a reminder from ${input.businessName}. Your pending balance is ${amount}.`,
      lastPaymentLine.trim(),
      'Please arrange the payment at the earliest.',
      '',
      `Thank you,\n${input.businessName}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.tone === 'final') {
    return [
      `Hi ${input.customerName},`,
      '',
      `Your pending balance with ${input.businessName} is ${amount}.`,
      lastPaymentLine.trim(),
      'Please clear this amount as soon as possible so we can keep the account updated.',
      '',
      `Regards,\n${input.businessName}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hi ${input.customerName},`,
    '',
    `Hope you are doing well. This is a gentle reminder from ${input.businessName}.`,
    `Your pending balance is ${amount}.`,
    lastPaymentLine.trim(),
    'Please send the payment when convenient.',
    '',
    `Thank you,\n${input.businessName}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sharePaymentReminderMessage(
  message: string
): Promise<PaymentReminderShareResult> {
  const result = await Share.share({
    message,
    title: 'Payment Reminder',
  });

  const shared =
    result.action === Share.sharedAction ||
    (result.action !== Share.dismissedAction && result.action !== undefined);

  return {
    shared,
    sharedVia: result.activityType ?? (shared ? 'system_share_sheet' : null),
  };
}
