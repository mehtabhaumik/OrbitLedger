import { describe, expect, it } from 'vitest';

import {
  getNotificationReminderPreferences,
  reminderStyleToTimelineTone,
  renderReminderTemplate,
} from './notification-preferences';

describe('notification reminder preferences', () => {
  it('normalizes saved reminder preferences with safe defaults', () => {
    const preferences = getNotificationReminderPreferences({
      reminderStyle: 'urgent',
      overdueAlertTiming: 'bad',
      followUpCadenceDays: 120,
      backupReminderFrequency: 'monthly',
      urgentPaymentStampDefault: true,
    });

    expect(preferences.reminderStyle).toBe('urgent');
    expect(preferences.overdueAlertTiming).toBe('one_day_after');
    expect(preferences.followUpCadenceDays).toBe(90);
    expect(preferences.backupReminderFrequency).toBe('monthly');
    expect(preferences.urgentPaymentStampDefault).toBe(true);
  });

  it('maps business reminder style to saved timeline reminder tones', () => {
    expect(reminderStyleToTimelineTone('soft')).toBe('polite');
    expect(reminderStyleToTimelineTone('firm')).toBe('firm');
    expect(reminderStyleToTimelineTone('urgent')).toBe('final');
  });

  it('renders plain templates without exposing template markers', () => {
    expect(
      renderReminderTemplate('Hello {{customerName}}, pay {{balance}} to {{businessName}}.', {
        businessName: 'Orbit Shop',
        customerName: 'Asha Traders',
        balance: 'INR 4,000',
      })
    ).toBe('Hello Asha Traders, pay INR 4,000 to Orbit Shop.');
  });
});
