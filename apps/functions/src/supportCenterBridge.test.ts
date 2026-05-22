import { describe, expect, it } from 'vitest';

import {
  buildCustomerSupportSubmissionDecision,
  buildSupportCaseId,
  buildSupportEventRecord,
  buildSupportMessageRecord,
  buildSupportTicketRecord,
  supportPriorityForKind,
  supportQueueForKind,
  supportSubjectForKind,
} from './supportCenterBridge';

describe('support center customer bridge', () => {
  it('generates stable support case ids', () => {
    const now = new Date('2026-05-22T10:15:30.000Z');
    expect(buildSupportCaseId(now, 123456)).toBe('OL-SUP-20260522-002N9C');
  });

  it('maps support kinds to queues, priorities, and subjects', () => {
    expect(supportQueueForKind('invoice_issue')).toBe('billing');
    expect(supportQueueForKind('purchase_help')).toBe('purchase');
    expect(supportQueueForKind('feature_request')).toBe('feedback');
    expect(supportPriorityForKind('restore_help')).toBe('urgent');
    expect(supportPriorityForKind('feature_request')).toBe('low');
    expect(supportSubjectForKind('sync_issue')).toBe('Sync help request');
  });

  it('reopens resolved tickets and keeps active work in the opened queue', () => {
    expect(buildCustomerSupportSubmissionDecision({
      currentSupportCaseStatus: 'resolved',
      currentTicketStatus: 'closed',
    })).toMatchObject({
      supportCaseAction: 'reopen',
      nextSupportCaseStatus: 'reopened',
      nextTicketStatus: 'opened',
      nextResolutionState: 'unresolved',
    });

    expect(buildCustomerSupportSubmissionDecision({
      currentSupportCaseStatus: 'waiting_on_customer',
      currentTicketStatus: 'pending_customer',
    })).toMatchObject({
      supportCaseAction: 'add_note',
      nextSupportCaseStatus: 'open',
      nextTicketStatus: 'opened',
    });
  });

  it('builds a customer ticket record with linked consent continuity', () => {
    const record = buildSupportTicketRecord({
      workspaceId: 'workspace-1',
      ticketId: 'support_ticket_1',
      supportCaseId: 'OL-SUP-20260522-ABC123',
      supportKind: 'payment_issue',
      subject: 'Payment help request',
      summary: 'Customer reported that a payment status looks wrong.',
      customerUserId: 'user-1',
      customerEmail: 'owner@example.com',
      customerName: 'Orbit Owner',
      messageId: 'message-1',
      consentId: 'consent-1',
      linkedConsentIds: ['consent-0', 'consent-1'],
      now: new Date('2026-05-22T11:00:00.000Z'),
    });

    expect(record).toMatchObject({
      workspace_id: 'workspace-1',
      support_case_id: 'OL-SUP-20260522-ABC123',
      queue_id: 'purchase',
      priority: 'high',
      status: 'opened',
      active_support_consent_id: 'consent-1',
      linked_support_consent_ids: ['consent-0', 'consent-1'],
      latest_message_id: 'message-1',
    });
  });

  it('builds customer-visible thread messages and audit events', () => {
    const message = buildSupportMessageRecord({
      workspaceId: 'workspace-1',
      ticketId: 'ticket-1',
      supportCaseId: 'OL-SUP-20260522-ABC123',
      actorUid: 'user-1',
      actorEmail: 'owner@example.com',
      body: 'The payment still shows pending after clearance.',
      now: new Date('2026-05-22T11:05:00.000Z'),
    });
    const event = buildSupportEventRecord({
      workspaceId: 'workspace-1',
      ticketId: 'ticket-1',
      supportCaseId: 'OL-SUP-20260522-ABC123',
      eventKind: 'message_added',
      detail: 'Customer added a follow-up message from the founder-safe support flow.',
      queueId: 'purchase',
      actorUid: 'user-1',
      actorEmail: 'owner@example.com',
      statusBefore: 'pending_customer',
      statusAfter: 'opened',
      resolutionStateBefore: 'unresolved',
      resolutionStateAfter: 'unresolved',
      now: new Date('2026-05-22T11:05:00.000Z'),
    });

    expect(message).toMatchObject({
      kind: 'customer_message',
      visible_to_customer: true,
      actor_role: 'customer',
      ticket_id: 'ticket-1',
    });
    expect(event).toMatchObject({
      kind: 'message_added',
      queue_id: 'purchase',
      actor_role: 'customer',
      status_before: 'pending_customer',
      status_after: 'opened',
    });
  });
});
