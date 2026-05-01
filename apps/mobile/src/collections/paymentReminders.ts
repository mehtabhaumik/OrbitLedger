import { getLocalBusinessPack, getLocalReminderToneDescriptions } from '@orbit-ledger/core';
import { Share } from 'react-native';

import type { PaymentReminderTone } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import { formatPaymentDetailsLine, type PaymentShareDetails } from './paymentRequests';

export type PaymentReminderMessageInput = {
  businessName: string;
  customerName: string;
  balance: number;
  currency: string;
  tone: PaymentReminderTone;
  countryCode?: string | null;
  regionCode?: string | null;
  paymentDetails?: PaymentShareDetails | null;
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
  ...getLocalReminderToneDescriptions({ countryCode: 'GENERIC' }),
};

export function buildPaymentReminderMessage(input: PaymentReminderMessageInput): string {
  const localPack = getLocalBusinessPack({
    countryCode: input.countryCode,
    regionCode: input.regionCode,
  });
  const amount = formatCurrency(Math.max(input.balance, 0), input.currency);
  const paymentDetailsLine = formatPaymentDetailsLine(input.paymentDetails, input.countryCode);
  const lastPaymentLine = input.lastPaymentDate
    ? `Last payment recorded: ${formatShortDate(input.lastPaymentDate)}.\n`
    : '';

  if (input.tone === 'firm') {
    return [
      `Hi ${input.customerName},`,
      '',
      `This is a reminder from ${input.businessName}. Your pending balance is ${amount}.`,
      lastPaymentLine.trim(),
      localPack.reminders.firmAction,
      paymentDetailsLine,
      'Please reply after sending the payment. I will mark it received once I confirm it.',
      '',
      `${localPack.reminders.signOff},\n${input.businessName}`,
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
      localPack.reminders.finalAction,
      paymentDetailsLine,
      'Please reply after sending the payment. I will mark it received once I confirm it.',
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
    localPack.reminders.politeAction,
    paymentDetailsLine,
    'Please reply after sending the payment. I will mark it received once I confirm it.',
    '',
    `${localPack.reminders.signOff},\n${input.businessName}`,
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
