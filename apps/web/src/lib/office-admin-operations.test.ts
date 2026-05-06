import { describe, expect, it } from 'vitest';

import {
  buildWebOfficeOperationsSnapshot,
  OFFICE_PRODUCTION_READINESS_CHECKLIST,
  OFFICE_FINAL_LAUNCH_FREEZE_ITEMS,
  OFFICE_SUPPORT_REVIEW_GUARDRAILS,
  parseOfficeAccessRequest,
  parseOfficeAdminQueueRecord,
  parseSupportCaseAuditEvent,
  parseSupportCaseEmailRequestRecord,
  parseSupportCaseRecord,
  parseSupportDiagnosticConsentRecord,
} from './office-admin-operations';

describe('office admin operations', () => {
  it('summarizes Office access requests for the hidden operations UI', () => {
    const snapshot = buildWebOfficeOperationsSnapshot({
      requests: [
        request('request-1', 'submitted'),
        request('request-2', 'approved'),
        request('request-3', 'granted'),
      ],
      adminQueue: [],
    });

    expect(snapshot.health).toMatchObject({
      title: 'Office operations need review',
      tone: 'warning',
    });
    expect(snapshot.metrics.map((metric) => [metric.id, metric.value])).toEqual([
      ['requests', 3],
      ['needs_review', 1],
      ['approved', 1],
      ['granted', 1],
    ]);
    expect(snapshot.queue[0].actionPlans.map((plan) => plan.action)).toEqual([
      'mark_reviewing',
      'approve',
      'reject',
    ]);
    expect(snapshot.queue[1].actionPlans.map((plan) => plan.action)).toEqual([
      'grant_access',
      'reject',
    ]);
    expect(snapshot.supportConsents).toEqual([]);
    expect(snapshot.supportCases).toEqual([]);
    expect(snapshot.supportCaseEmailRequests).toEqual([]);
    expect(snapshot.supportCaseEvents).toEqual([]);
  });

  it('does not show cancelled requests as active queue work', () => {
    const snapshot = buildWebOfficeOperationsSnapshot({
      requests: [request('request-1', 'cancelled')],
      adminQueue: [],
    });

    expect(snapshot.metrics[0]).toMatchObject({ id: 'requests', value: 0 });
    expect(snapshot.queue).toEqual([]);
    expect(snapshot.health.tone).toBe('success');
  });

  it('parses server-controlled request and queue documents safely', () => {
    expect(parseOfficeAccessRequest('request-1', {
      workspace_id: 'workspace-1',
      requester_uid: 'owner-1',
      requester_name: 'Owner One',
      requester_email: 'owner@example.com',
      best_contact_number: '+91 90000 00000',
      requested_plan_id: 'office_monthly',
      status: 'approved',
      admin_queue_id: 'queue-1',
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
    })).toMatchObject({
      id: 'request-1',
      workspaceId: 'workspace-1',
      requesterUid: 'owner-1',
      requestedPlanId: 'office_monthly',
      status: 'approved',
    });

    expect(parseOfficeAdminQueueRecord('queue-1', {
      request_id: 'request-1',
      workspace_id: 'workspace-1',
      requester_uid: 'owner-1',
      requester_name: 'Owner One',
      requester_email: 'owner@example.com',
      requested_plan_id: 'bad-plan',
      status: 'unexpected-status',
      action_label: 'Review request',
    })).toMatchObject({
      id: 'queue-1',
      requestId: 'request-1',
      requestedPlanId: 'office_yearly',
      status: 'needs_review',
    });

    expect(parseSupportDiagnosticConsentRecord('consent-1', {
      user_email: 'owner@example.com',
      support_kind: 'sync_issue',
      support_case_id: 'CASE-2001',
      status: 'active',
      sanitized_message: 'Sync review approved.',
      approved_fields: ['route', 'platform'],
      redacted_fields: ['business name'],
      expires_at: '2020-05-14T00:00:00.000Z',
      created_at: '2026-05-07T00:00:00.000Z',
    })).toMatchObject({
      id: 'consent-1',
      userEmail: 'owner@example.com',
      supportKind: 'sync_issue',
      supportCaseId: 'CASE-2001',
      approvedFields: ['route', 'platform'],
      redactedFields: ['business name'],
      isExpired: true,
      isActiveForReview: false,
    });

    expect(parseSupportCaseAuditEvent('audit-1', {
      support_consent_id: 'consent-1',
      support_case_id: 'CASE-2001',
      customer_approved_diagnostic_access: true,
      reason: 'Customer approved a safe diagnostic review pack.',
      created_at: '2026-05-07T00:00:00.000Z',
    })).toMatchObject({
      id: 'audit-1',
      supportConsentId: 'consent-1',
      supportCaseId: 'CASE-2001',
      title: 'Approval saved',
    });

    expect(parseSupportCaseAuditEvent('audit-2', {
      support_consent_id: 'consent-1',
      support_case_id: 'CASE-2001',
      next_status: 'revoked',
      reason: 'Support diagnostic approval revoked.',
    })).toMatchObject({
      title: 'Approval revoked',
      status: 'revoked',
    });

    expect(parseSupportCaseRecord('case-2001', {
      support_case_id: 'CASE-2001',
      status: 'resolved',
      latest_action: 'resolve',
      latest_note: 'Customer confirmed the issue is fixed.',
      latest_note_by_email: 'support@orbitledger.app',
      note_count: 2,
    })).toMatchObject({
      id: 'case-2001',
      supportCaseId: 'CASE-2001',
      status: 'resolved',
      latestAction: 'resolve',
      noteCount: 2,
    });

    expect(parseSupportCaseEmailRequestRecord('email-1', {
      support_case_id: 'CASE-2001',
      recipient_email: 'owner@example.com',
      subject: 'Update on CASE-2001',
      delivery_status: 'pending_provider_connection',
      queued_at: '2026-05-07T00:00:00.000Z',
    })).toMatchObject({
      id: 'email-1',
      supportCaseId: 'CASE-2001',
      recipientEmail: 'owner@example.com',
      deliveryStatus: 'pending_provider_connection',
    });
  });

  it('exposes impersonation-proof support review guardrails', () => {
    expect(OFFICE_SUPPORT_REVIEW_GUARDRAILS.join(' ')).toContain('does not create a member session');
    expect(OFFICE_SUPPORT_REVIEW_GUARDRAILS.join(' ')).toContain('customer-approved diagnostic consent');
  });

  it('keeps Office production readiness focused on secret names, not secret values', () => {
    const readiness = OFFICE_PRODUCTION_READINESS_CHECKLIST.map((item) => `${item.label} ${item.detail}`).join(' ');
    expect(readiness).toContain('email provider key');
    expect(readiness).toContain('Secret Manager');
    expect(readiness).not.toContain('RESEND_API_KEY');
    expect(readiness).not.toContain('sk_');
    expect(readiness).not.toContain('re_');
  });

  it('marks Office launch freeze as provider-pending instead of live-email ready', () => {
    const freeze = OFFICE_FINAL_LAUNCH_FREEZE_ITEMS.join(' ');
    expect(freeze).toContain('provider-pending');
    expect(freeze).toContain('bug fixes');
    expect(freeze).not.toContain('live email enabled');
  });
});

function request(id: string, status: 'submitted' | 'approved' | 'granted' | 'cancelled') {
  return {
    id,
    workspaceId: 'workspace-1',
    requesterUid: 'owner-1',
    requesterName: 'Owner One',
    requesterEmail: 'owner@example.com',
    bestContactNumber: '+91 90000 00000',
    alternateContactNumber: null,
    businessName: 'Orbit Store',
    requestedPlanId: 'office_yearly' as const,
    status,
    message: null,
    adminQueueId: `queue-${id}`,
    reviewedBy: null,
    reviewedAt: null,
    grantedBy: null,
    grantedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    lastReviewNote: null,
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
  };
}
