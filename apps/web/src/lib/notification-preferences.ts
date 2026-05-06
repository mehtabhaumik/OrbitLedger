import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

export type ReminderStylePreference = 'soft' | 'firm' | 'urgent';
export type PaymentNoticeTonePreference = 'friendly' | 'direct' | 'urgent';

export type NotificationReminderPreferences = {
  reminderStyle: ReminderStylePreference;
  overdueAlertTiming: 'same_day' | 'one_day_after' | 'three_days_after' | 'one_week_after';
  followUpCadenceDays: number;
  paymentNoticeTone: PaymentNoticeTonePreference;
  urgentPaymentStampDefault: boolean;
  backupReminderFrequency: 'off' | 'daily' | 'weekly' | 'monthly';
  whatsappReminderTemplate: string;
  emailReminderTemplate: string;
  paymentThankYouTemplate: string;
  bouncedPaymentTemplate: string;
};

export const DEFAULT_NOTIFICATION_REMINDER_PREFERENCES: NotificationReminderPreferences = {
  reminderStyle: 'soft',
  overdueAlertTiming: 'one_day_after',
  followUpCadenceDays: 7,
  paymentNoticeTone: 'friendly',
  urgentPaymentStampDefault: false,
  backupReminderFrequency: 'weekly',
  whatsappReminderTemplate:
    'Hello {{customerName}}, this is a gentle reminder from {{businessName}}. The pending balance is {{balance}}. Please share the payment update when convenient.',
  emailReminderTemplate:
    'Hello {{customerName}},\n\nThis is a reminder from {{businessName}} about the pending balance of {{balance}}.\n\nPlease share the payment update when convenient.\n\nThank you,\n{{businessName}}',
  paymentThankYouTemplate:
    'Hello {{customerName}}, thank you for the payment of {{amount}}. We have recorded it for {{businessName}}.',
  bouncedPaymentTemplate:
    'Hello {{customerName}}, the payment for {{reference}} needs attention. Please contact {{businessName}} so we can resolve it quickly.',
};

export function getNotificationReminderPreferences(
  workspace: Partial<OrbitWorkspaceSummary> | null | undefined
): NotificationReminderPreferences {
  return {
    reminderStyle: normalizeChoice(workspace?.reminderStyle, ['soft', 'firm', 'urgent'], DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.reminderStyle),
    overdueAlertTiming: normalizeChoice(
      workspace?.overdueAlertTiming,
      ['same_day', 'one_day_after', 'three_days_after', 'one_week_after'],
      DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.overdueAlertTiming
    ),
    followUpCadenceDays: normalizeCadence(workspace?.followUpCadenceDays),
    paymentNoticeTone: normalizeChoice(
      workspace?.paymentNoticeTone,
      ['friendly', 'direct', 'urgent'],
      DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentNoticeTone
    ),
    urgentPaymentStampDefault: Boolean(workspace?.urgentPaymentStampDefault),
    backupReminderFrequency: normalizeChoice(
      workspace?.backupReminderFrequency,
      ['off', 'daily', 'weekly', 'monthly'],
      DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.backupReminderFrequency
    ),
    whatsappReminderTemplate: cleanTemplate(workspace?.whatsappReminderTemplate, DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.whatsappReminderTemplate),
    emailReminderTemplate: cleanTemplate(workspace?.emailReminderTemplate, DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.emailReminderTemplate),
    paymentThankYouTemplate: cleanTemplate(workspace?.paymentThankYouTemplate, DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentThankYouTemplate),
    bouncedPaymentTemplate: cleanTemplate(workspace?.bouncedPaymentTemplate, DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.bouncedPaymentTemplate),
  };
}

export function reminderStyleToTimelineTone(style: ReminderStylePreference): 'polite' | 'firm' | 'final' {
  if (style === 'urgent') {
    return 'final';
  }
  if (style === 'firm') {
    return 'firm';
  }
  return 'polite';
}

export function renderReminderTemplate(
  template: string,
  values: {
    businessName: string;
    customerName: string;
    balance?: string;
    amount?: string;
    reference?: string;
  }
) {
  return template
    .replaceAll('{{businessName}}', values.businessName)
    .replaceAll('{{customerName}}', values.customerName)
    .replaceAll('{{balance}}', values.balance ?? '')
    .replaceAll('{{amount}}', values.amount ?? '')
    .replaceAll('{{reference}}', values.reference ?? '');
}

function normalizeChoice<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeCadence(value: unknown) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.followUpCadenceDays;
  return Math.min(90, Math.max(1, numeric));
}

function cleanTemplate(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
