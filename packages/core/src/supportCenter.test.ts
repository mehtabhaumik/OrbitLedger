import { describe, expect, it } from 'vitest';

import {
  buildSupportTicketActionPlan,
  canSupportRoleAccessQueue,
  canSupportRoleAuditAllTickets,
  canSupportRoleMutateQueue,
  getSupportRoleCapability,
  isSupportCenterCollection,
  isSupportEventKind,
  isSupportMessageKind,
  isSupportResolutionReason,
  isSupportResolutionState,
  isSupportTicketAction,
  isSupportTicketStatus,
  SUPPORT_CENTER_COLLECTIONS,
  SUPPORT_CENTER_FIRESTORE_PATHS,
} from './supportCenter';

describe('support center core contract', () => {
  it('defines the server-owned support center collections and paths', () => {
    expect(SUPPORT_CENTER_COLLECTIONS).toEqual([
      'support_tickets',
      'support_messages',
      'support_assignments',
      'support_events',
      'support_queues',
      'support_notification_preferences',
    ]);
    expect(isSupportCenterCollection('support_tickets')).toBe(true);
    expect(isSupportCenterCollection('support_cases')).toBe(false);
    expect(SUPPORT_CENTER_FIRESTORE_PATHS.tickets).toBe('workspaces/{workspaceId}/support_tickets/{ticketId}');
  });

  it('keeps status, resolution, message, and event validation strict', () => {
    expect(isSupportTicketStatus('in_progress')).toBe(true);
    expect(isSupportTicketStatus('waiting_on_customer')).toBe(false);
    expect(isSupportResolutionState('resolved')).toBe(true);
    expect(isSupportResolutionState('pending')).toBe(false);
    expect(isSupportResolutionReason('cannot_reproduce')).toBe(true);
    expect(isSupportResolutionReason('reopened')).toBe(false);
    expect(isSupportMessageKind('internal_note')).toBe(true);
    expect(isSupportMessageKind('reply')).toBe(false);
    expect(isSupportEventKind('permission_denied')).toBe(true);
    expect(isSupportEventKind('reply_failed')).toBe(true);
    expect(isSupportEventKind('case_note_saved')).toBe(false);
    expect(isSupportTicketAction('resolve')).toBe(true);
    expect(isSupportTicketAction('add_note')).toBe(false);
  });

  it('keeps audit-heavy role visibility explicit', () => {
    expect(canSupportRoleAuditAllTickets('super_admin')).toBe(true);
    expect(canSupportRoleAuditAllTickets('admin')).toBe(true);
    expect(canSupportRoleAuditAllTickets('finance_admin')).toBe(true);
    expect(canSupportRoleAuditAllTickets('support_admin')).toBe(false);
    expect(getSupportRoleCapability('read_only_admin')).toMatchObject({
      mutateScope: 'none',
      canSendReplies: false,
      canExportReports: true,
    });
    expect(getSupportRoleCapability('support_admin')).toMatchObject({
      canSendReplies: true,
    });
  });

  it('limits queue mutation by role while preserving broad audit access where required', () => {
    expect(canSupportRoleAccessQueue('support_admin', 'technical')).toBe(true);
    expect(canSupportRoleAccessQueue('support_admin', 'billing')).toBe(false);
    expect(canSupportRoleMutateQueue('finance_admin', 'billing')).toBe(true);
    expect(canSupportRoleMutateQueue('finance_admin', 'technical')).toBe(false);
    expect(canSupportRoleMutateQueue('read_only_admin', 'general')).toBe(false);
    expect(canSupportRoleMutateQueue('admin', 'privacy')).toBe(true);
  });

  it('requires explicit reasoning for sensitive ticket lifecycle changes', () => {
    expect(buildSupportTicketActionPlan({ action: 'start_work' })).toMatchObject({
      canApply: true,
      nextStatus: 'in_progress',
      nextResolutionState: 'unresolved',
    });

    expect(buildSupportTicketActionPlan({
      action: 'resolve',
      resolutionReason: 'fixed',
      reason: 'Confirmed the sync issue is fixed after applying the patch.',
    })).toMatchObject({
      canApply: true,
      nextStatus: 'resolved',
      nextResolutionReason: 'fixed',
      nextResolutionState: 'resolved',
    });

    expect(buildSupportTicketActionPlan({
      action: 'resolve',
      resolutionReason: 'fixed',
      reason: '',
    })).toMatchObject({
      canApply: false,
      message: 'Add a short resolution note before resolving this ticket.',
    });

    expect(buildSupportTicketActionPlan({
      action: 'close',
      currentStatus: 'resolved',
      resolutionState: 'resolved',
      resolutionReason: 'answered',
      reason: 'Customer confirmed everything is clear now.',
    })).toMatchObject({
      canApply: true,
      nextStatus: 'closed',
      nextResolutionReason: 'answered',
    });

    expect(buildSupportTicketActionPlan({
      action: 'reopen',
      reason: '',
    })).toMatchObject({
      canApply: false,
      message: 'Add a short reason before reopening this ticket.',
    });

    expect(buildSupportTicketActionPlan({
      action: 'mark_spam',
      reason: 'Automated phishing message with no real customer context.',
    })).toMatchObject({
      canApply: true,
      nextStatus: 'spam',
      nextResolutionReason: 'spam',
    });
  });
});
