import { describe, expect, it } from 'vitest';

import {
  buildSupportNotificationPreferenceRecord,
  buildSupportSlaTargets,
  normalizeSupportClockTime,
  normalizeSupportNotificationPermissionState,
  updateSupportTicketForCustomerMessage,
} from './index';

describe('support safety helpers', () => {
  it('normalizes notification permission and quiet-hour inputs safely', () => {
    expect(normalizeSupportNotificationPermissionState('granted')).toBe('granted');
    expect(normalizeSupportNotificationPermissionState('blocked')).toBeNull();
    expect(normalizeSupportClockTime('22:15')).toBe('22:15');
    expect(normalizeSupportClockTime('7:15')).toBeNull();
    expect(normalizeSupportClockTime('24:00')).toBeNull();
  });

  it('builds stable notification preference records', () => {
    const record = buildSupportNotificationPreferenceRecord({
      workspaceId: 'workspace-1',
      adminUid: 'admin-1',
      adminRole: 'support_admin',
      existing: {
        created_at: '2026-05-22T00:00:00.000Z',
      },
      muteAll: false,
      desktopAlertsEnabled: true,
      browserNotificationsEnabled: true,
      browserPermissionState: 'granted',
      soundEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      lastViewedSupportAt: '2026-05-22T10:00:00.000Z',
      now: new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(record).toMatchObject({
      workspace_id: 'workspace-1',
      admin_uid: 'admin-1',
      admin_role: 'support_admin',
      mute_all: false,
      desktop_alerts_enabled: true,
      browser_notifications_enabled: true,
      browser_permission_state: 'granted',
      sound_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      last_viewed_support_at: '2026-05-22T10:00:00.000Z',
      created_at: '2026-05-22T00:00:00.000Z',
      updated_at: '2026-05-22T12:00:00.000Z',
    });
  });

  it('derives SLA targets and preserves operator-first-reply state correctly', () => {
    const now = new Date('2026-05-22T12:00:00.000Z');
    expect(buildSupportSlaTargets({ priority: 'high', now })).toEqual({
      firstResponseDueAt: '2026-05-22T20:00:00.000Z',
      slaDueAt: '2026-05-25T12:00:00.000Z',
    });

    const updated = updateSupportTicketForCustomerMessage({
      currentTicket: {
        priority: 'normal',
        summary: 'Support summary',
        operator_first_replied_at: '2026-05-22T11:00:00.000Z',
        first_response_due_at: '2026-05-23T12:00:00.000Z',
        sla_due_at: '2026-05-29T12:00:00.000Z',
      },
      nextStatus: 'pending_customer',
      nextResolutionState: 'unresolved',
      nextResolutionReason: null,
      latestMessageId: 'message-1',
      actorUid: 'customer-1',
      actorRole: 'customer',
      now,
    });

    expect(updated).toMatchObject({
      status: 'pending_customer',
      latest_message_id: 'message-1',
      latest_message_at: '2026-05-22T12:00:00.000Z',
      last_customer_message_at: '2026-05-22T12:00:00.000Z',
      first_response_due_at: '2026-05-23T12:00:00.000Z',
      sla_due_at: '2026-05-29T12:00:00.000Z',
      operator_first_replied_at: '2026-05-22T11:00:00.000Z',
      last_actor_uid: 'customer-1',
      last_actor_role: 'customer',
    });
  });
});
