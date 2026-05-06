import { describe, expect, it } from 'vitest';

import {
  buildOfficeAccessAdminQueueRecord,
  buildOfficeAccessReviewPlan,
  isOfficeAccessRequestStatus,
  isOfficeAccessReviewAction,
  type OfficeAccessRequestRecord,
} from './officeGrantWorkflow';

const now = new Date('2026-05-06T12:00:00.000Z');

describe('office grant workflow', () => {
  it('builds an admin queue record from an Office request', () => {
    expect(buildOfficeAccessAdminQueueRecord(request())).toMatchObject({
      id: 'office_queue_1',
      kind: 'office_access_request',
      workspaceId: 'workspace-1',
      requestId: 'office_request_1',
      requestedPlanId: 'office_yearly',
      reviewStatus: 'needs_review',
      actionLabel: 'Review request',
    });
  });

  it('moves a submitted request into review', () => {
    const plan = buildOfficeAccessReviewPlan({
      request: request(),
      action: 'mark_reviewing',
      resolvedBy: 'internal-admin',
      note: 'Calling owner to confirm team size.',
      now,
    });

    expect(plan).toMatchObject({
      canApply: true,
      previousStatus: 'submitted',
      nextStatus: 'reviewing',
      reviewStatus: 'reviewing',
      shouldGrantEntitlement: false,
      shouldCreateOwnerMember: false,
    });
    expect(plan.requestPatch).toMatchObject({
      status: 'reviewing',
      reviewed_by: 'internal-admin',
      reviewed_at: now.toISOString(),
    });
  });

  it('approves a reviewed request without granting entitlement yet', () => {
    const plan = buildOfficeAccessReviewPlan({
      request: request({ status: 'reviewing' }),
      action: 'approve',
      resolvedBy: 'internal-billing',
      now,
    });

    expect(plan).toMatchObject({
      canApply: true,
      nextStatus: 'approved',
      reviewStatus: 'approved',
      shouldGrantEntitlement: false,
      adminMessage: 'Office request approved. Grant access when workspace and contact details are confirmed.',
    });
  });

  it('requires approval before Office access can be granted', () => {
    const plan = buildOfficeAccessReviewPlan({
      request: request({ status: 'reviewing' }),
      action: 'grant_access',
      resolvedBy: 'internal-billing',
      now,
    });

    expect(plan).toMatchObject({
      canApply: false,
      nextStatus: 'reviewing',
      shouldGrantEntitlement: false,
      shouldCreateOwnerMember: false,
      adminMessage: 'Approve the Office request before granting access.',
    });
  });

  it('grants approved Office access with owner membership draft', () => {
    const plan = buildOfficeAccessReviewPlan({
      request: request({ status: 'approved' }),
      action: 'grant_access',
      resolvedBy: 'internal-billing',
      note: 'Invitation approved by founder.',
      now,
    });

    expect(plan).toMatchObject({
      canApply: true,
      nextStatus: 'granted',
      reviewStatus: 'completed',
      shouldGrantEntitlement: true,
      shouldCreateOwnerMember: true,
    });
    expect(plan.ownerMemberDraft).toMatchObject({
      uid: 'owner-1',
      workspaceId: 'workspace-1',
      role: 'owner',
      status: 'active',
      email: 'owner@example.com',
      displayName: 'Owner One',
    });
    expect(plan.accessAuditDraft).toMatchObject({
      action: 'member_accepted',
      targetUid: 'owner-1',
      nextRole: 'owner',
      nextStatus: 'granted',
    });
  });

  it('blocks finalized requests from being changed again', () => {
    const plan = buildOfficeAccessReviewPlan({
      request: request({ status: 'granted' }),
      action: 'reject',
      resolvedBy: 'internal-billing',
      now,
    });

    expect(plan).toMatchObject({
      canApply: false,
      nextStatus: 'granted',
      shouldWriteAccessAudit: false,
      adminMessage: 'Office access request is already finalized.',
    });
  });

  it('recognizes workflow enums', () => {
    expect(isOfficeAccessRequestStatus('approved')).toBe(true);
    expect(isOfficeAccessRequestStatus('paid')).toBe(false);
    expect(isOfficeAccessReviewAction('grant_access')).toBe(true);
    expect(isOfficeAccessReviewAction('delete')).toBe(false);
  });
});

function request(overrides: Partial<OfficeAccessRequestRecord> = {}): OfficeAccessRequestRecord {
  return {
    id: 'office_request_1',
    workspaceId: 'workspace-1',
    requesterUid: 'owner-1',
    requesterName: 'Owner One',
    requesterEmail: 'owner@example.com',
    bestContactNumber: '+91 90000 00000',
    alternateContactNumber: null,
    businessName: 'Orbit Store',
    requestedPlanId: 'office_yearly',
    status: 'submitted',
    message: 'We want Office access for a small team.',
    adminQueueId: 'office_queue_1',
    reviewedBy: null,
    reviewedAt: null,
    grantedBy: null,
    grantedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    lastReviewNote: null,
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-06T00:00:00.000Z',
    ...overrides,
  };
}
