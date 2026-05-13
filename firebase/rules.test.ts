import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'orbit-ledger-ci',
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  } catch (error) {
    throw new Error(
      `Firestore rules tests require the Firebase Firestore emulator on 127.0.0.1:8080. ` +
        `Run npm run test:rules:emulators, and make sure Java 11 or newer is active. ${String(error)}`
    );
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore workspace rules', () => {
  it('allows an owner to create and read their workspace', async () => {
    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = owner.collection('workspaces').doc('workspace-1');

    await assertSucceeds(
      workspace.set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        owner_name: 'Owner',
        phone: '+91 98765 43210',
        email: 'owner@example.com',
        address: 'Main Road',
        currency: 'INR',
        country_code: 'IN',
        state_code: 'MH',
        data_state: 'profile_only',
        updated_at: '2026-01-01T00:00:00.000Z',
      })
    );

    await assertSucceeds(workspace.get());
    await assertSucceeds(owner.collection('workspaces').where('owner_uid', '==', 'owner-1').get());
  });

  it('blocks cross-owner workspace reads and writes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('workspaces').doc('workspace-1').set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        currency: 'INR',
        country_code: 'IN',
      });
    });

    const other = testEnv.authenticatedContext('owner-2').firestore();
    await assertFails(other.collection('workspaces').doc('workspace-1').get());
    await assertFails(
      other.collection('workspaces').doc('workspace-1').collection('customers').doc('customer-1').set({
        name: 'Blocked Customer',
      })
    );
  });

  it('allows only the owning user to access workspace records', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('workspaces').doc('workspace-1').set({
        owner_uid: 'owner-1',
        business_name: 'Orbit Store',
        currency: 'INR',
        country_code: 'IN',
      });
    });

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const customer = owner.collection('workspaces').doc('workspace-1').collection('customers').doc('customer-1');
    await assertSucceeds(customer.set({ name: 'Allowed Customer' }));

    const snapshot = await assertSucceeds(customer.get());
    expect(snapshot.exists).toBe(true);
  });

  it('allows active Office members to read the workspace and role-appropriate records', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'manager-1', 'manager');

    const manager = testEnv.authenticatedContext('manager-1').firestore();
    const workspace = manager.collection('workspaces').doc('workspace-1');
    const customer = workspace.collection('customers').doc('customer-1');

    await assertSucceeds(workspace.get());
    await assertSucceeds(customer.set({ name: 'Managed Customer' }));
    await assertSucceeds(customer.get());
  });

  it('lets active Office members discover shared workspaces through membership lookup', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'manager-1', 'manager');

    const manager = testEnv.authenticatedContext('manager-1').firestore();
    const memberships = await assertSucceeds(
      manager.collectionGroup('office_members').where('uid', '==', 'manager-1').where('status', '==', 'active').get()
    );

    expect(memberships.size).toBe(1);
    await assertSucceeds(memberships.docs[0].ref.parent.parent?.get());
  });

  it('keeps viewer Office members read-only', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'viewer-1', 'viewer');

    const viewer = testEnv.authenticatedContext('viewer-1').firestore();
    const workspace = viewer.collection('workspaces').doc('workspace-1');
    const customer = workspace.collection('customers').doc('customer-1');

    await assertSucceeds(workspace.get());
    await assertFails(customer.set({ name: 'Blocked Customer' }));
  });

  it('blocks inactive Office members from workspace data', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'manager-1', 'manager', 'suspended');

    const manager = testEnv.authenticatedContext('manager-1').firestore();
    await assertFails(manager.collection('workspaces').doc('workspace-1').get());
  });

  it('lets active Office members update only their own presence fields', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('workspaces').doc('workspace-1').collection('office_members').doc('viewer-1').set({
        uid: 'viewer-1',
        workspace_id: 'workspace-1',
        role: 'viewer',
        status: 'active',
        email: 'viewer-1@example.com',
        display_name: 'viewer-1',
        invited_by: 'owner-1',
        invited_at: '2026-05-06T00:00:00.000Z',
        accepted_at: '2026-05-06T00:00:00.000Z',
        suspended_at: null,
        removed_at: null,
        last_seen_at: null,
        created_at: '2026-05-06T00:00:00.000Z',
        updated_at: '2026-05-06T00:00:00.000Z',
      });
    });

    const staff = testEnv.authenticatedContext('staff-1').firestore();
    const ownMember = staff.collection('workspaces').doc('workspace-1').collection('office_members').doc('staff-1');
    const otherMember = staff.collection('workspaces').doc('workspace-1').collection('office_members').doc('viewer-1');

    await assertSucceeds(
      ownMember.update({
        last_seen_at: '2026-05-06T08:00:00.000Z',
        updated_at: '2026-05-06T08:00:00.000Z',
      })
    );
    await assertFails(ownMember.update({ role: 'admin', updated_at: '2026-05-06T08:01:00.000Z' }));
    await assertFails(otherMember.update({
      last_seen_at: '2026-05-06T08:02:00.000Z',
      updated_at: '2026-05-06T08:02:00.000Z',
    }));
  });

  it('blocks suspended Office members from refreshing presence', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff', 'suspended');

    const staff = testEnv.authenticatedContext('staff-1').firestore();
    await assertFails(
      staff.collection('workspaces').doc('workspace-1').collection('office_members').doc('staff-1').update({
        last_seen_at: '2026-05-06T08:00:00.000Z',
        updated_at: '2026-05-06T08:00:00.000Z',
      })
    );
  });

  it('blocks direct Office member role and status changes so trusted functions own access actions', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'viewer-1', 'viewer');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const ownerStaffMember = owner.collection('workspaces').doc('workspace-1').collection('office_members').doc('staff-1');
    const adminViewerMember = admin.collection('workspaces').doc('workspace-1').collection('office_members').doc('viewer-1');

    await assertFails(ownerStaffMember.update({
      role: 'manager',
      updated_at: '2026-05-06T08:30:00.000Z',
    }));
    await assertFails(ownerStaffMember.update({
      status: 'suspended',
      suspended_at: '2026-05-06T08:31:00.000Z',
      updated_at: '2026-05-06T08:31:00.000Z',
    }));
    await assertFails(adminViewerMember.update({
      status: 'removed',
      removed_at: '2026-05-06T08:32:00.000Z',
      updated_at: '2026-05-06T08:32:00.000Z',
    }));
  });

  it('lets owners bootstrap their Office owner member record', async () => {
    await seedWorkspace('workspace-1', 'owner-1');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    await assertSucceeds(
      owner.collection('workspaces').doc('workspace-1').collection('office_members').doc('owner-1').set({
        uid: 'owner-1',
        workspace_id: 'workspace-1',
        role: 'owner',
        status: 'active',
        email: 'owner@example.com',
        display_name: 'Owner',
        invited_by: null,
        invited_at: null,
        accepted_at: '2026-05-06T00:00:00.000Z',
        suspended_at: null,
        removed_at: null,
        last_seen_at: null,
        created_at: '2026-05-06T00:00:00.000Z',
        updated_at: '2026-05-06T00:00:00.000Z',
      })
    );
  });

  it('blocks client-created Office invitations so capacity is enforced by the server', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const ownerInvitations = owner.collection('workspaces').doc('workspace-1').collection('office_invitations');
    const adminInvitations = admin.collection('workspaces').doc('workspace-1').collection('office_invitations');

    await assertFails(
      ownerInvitations.doc('invite-owner-created').set(invitationPayload('workspace-1', 'owner-1', 'staff@example.com', 'staff'))
    );
    await assertFails(
      adminInvitations.doc('invite-staff').set(invitationPayload('workspace-1', 'admin-1', 'staff@example.com', 'staff'))
    );
    await assertFails(
      adminInvitations.doc('invite-admin').set(invitationPayload('workspace-1', 'admin-1', 'next-admin@example.com', 'admin'))
    );
  });

  it('blocks client-updated Office invitations so revocation and delivery stay server controlled', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .collection('workspaces')
        .doc('workspace-1')
        .collection('office_invitations')
        .doc('invite-staff')
        .set(invitationPayload('workspace-1', 'admin-1', 'staff@example.com', 'staff'));
    });

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    await assertFails(
      owner.collection('workspaces').doc('workspace-1').collection('office_invitations').doc('invite-staff').update({
        status: 'revoked',
        revoked_by: 'owner-1',
        revoked_at: '2026-05-06T01:00:00.000Z',
        updated_at: '2026-05-06T01:00:00.000Z',
      })
    );
  });

  it('blocks client-created Office ownership transfers so ownership stays server controlled', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const transferPayload = {
      workspace_id: 'workspace-1',
      status: 'pending',
      requested_by: 'owner-1',
      target_uid: 'admin-1',
      target_email: 'admin-1@example.com',
      requested_at: '2026-05-06T01:00:00.000Z',
      expires_at: '2026-05-13T01:00:00.000Z',
      created_at: '2026-05-06T01:00:00.000Z',
      updated_at: '2026-05-06T01:00:00.000Z',
    };

    await assertFails(
      owner.collection('workspaces').doc('workspace-1').collection('office_ownership_transfers').doc('transfer-1').set(transferPayload)
    );
    await assertFails(
      admin.collection('workspaces').doc('workspace-1').collection('office_ownership_transfers').doc('transfer-1').set(transferPayload)
    );
  });

  it('keeps subscription and Office audit collections server controlled', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');

    const admin = testEnv.authenticatedContext('admin-1').firestore();
    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = admin.collection('workspaces').doc('workspace-1');

    await assertFails(workspace.collection('subscription_events').doc('event-1').set({ status: 'paid' }));
    await assertFails(workspace.collection('office_access_audit').doc('audit-1').set({ action: 'member_invited' }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('office_access_requests').doc('request-1').set({
      status: 'submitted',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('office_access_admin_queue').doc('queue-1').set({
      status: 'needs_review',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_diagnostic_consents').doc('consent-1').set({
      status: 'active',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_cases').doc('case-1').set({
      status: 'open',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_case_email_requests').doc('email-1').set({
      delivery_status: 'pending_provider_connection',
    }));
  });

  it('limits Office support review reads to intended workspace roles', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'accountant-1', 'accountant');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const workspace = context.firestore().collection('workspaces').doc('workspace-1');
      await workspace.collection('office_access_audit').doc('audit-1').set({ action: 'internal_access_reviewed' });
      await workspace.collection('office_access_requests').doc('request-1').set({ status: 'submitted' });
      await workspace.collection('office_access_admin_queue').doc('queue-1').set({ status: 'needs_review' });
      await workspace.collection('support_diagnostic_consents').doc('consent-1').set({ status: 'active' });
      await workspace.collection('support_cases').doc('case-1').set({ status: 'open' });
      await workspace.collection('support_case_email_requests').doc('email-1').set({ delivery_status: 'pending_provider_connection' });
    });

    const owner = testEnv.authenticatedContext('owner-1').firestore().collection('workspaces').doc('workspace-1');
    const admin = testEnv.authenticatedContext('admin-1').firestore().collection('workspaces').doc('workspace-1');
    const accountant = testEnv.authenticatedContext('accountant-1').firestore().collection('workspaces').doc('workspace-1');
    const staff = testEnv.authenticatedContext('staff-1').firestore().collection('workspaces').doc('workspace-1');

    await assertSucceeds(owner.collection('office_access_admin_queue').doc('queue-1').get());
    await assertFails(admin.collection('office_access_admin_queue').doc('queue-1').get());

    await assertSucceeds(admin.collection('office_access_requests').doc('request-1').get());
    await assertFails(accountant.collection('office_access_requests').doc('request-1').get());

    await assertSucceeds(accountant.collection('office_access_audit').doc('audit-1').get());
    await assertSucceeds(accountant.collection('support_diagnostic_consents').doc('consent-1').get());
    await assertSucceeds(accountant.collection('support_cases').doc('case-1').get());
    await assertSucceeds(accountant.collection('support_case_email_requests').doc('email-1').get());

    await assertFails(staff.collection('office_access_audit').doc('audit-1').get());
    await assertFails(staff.collection('support_diagnostic_consents').doc('consent-1').get());
    await assertFails(staff.collection('support_cases').doc('case-1').get());
    await assertFails(staff.collection('support_case_email_requests').doc('email-1').get());
  });
});

async function seedWorkspace(workspaceId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('workspaces').doc(workspaceId).set({
      owner_uid: ownerUid,
      business_name: 'Orbit Store',
      currency: 'INR',
      country_code: 'IN',
      updated_at: '2026-05-06T00:00:00.000Z',
    });
  });
}

async function seedWorkspaceWithOfficeMember(
  workspaceId: string,
  ownerUid: string,
  memberUid: string,
  role: string,
  status = 'active'
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await firestore.collection('workspaces').doc(workspaceId).set({
      owner_uid: ownerUid,
      business_name: 'Orbit Store',
      currency: 'INR',
      country_code: 'IN',
      updated_at: '2026-05-06T00:00:00.000Z',
    });
    await firestore.collection('workspaces').doc(workspaceId).collection('office_members').doc(memberUid).set({
      uid: memberUid,
      workspace_id: workspaceId,
      role,
      status,
      email: `${memberUid}@example.com`,
      display_name: memberUid,
      invited_by: ownerUid,
      invited_at: '2026-05-06T00:00:00.000Z',
      accepted_at: status === 'active' ? '2026-05-06T00:00:00.000Z' : null,
      suspended_at: status === 'suspended' ? '2026-05-06T00:00:00.000Z' : null,
      removed_at: status === 'removed' ? '2026-05-06T00:00:00.000Z' : null,
      last_seen_at: null,
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
    });
  });
}

function invitationPayload(workspaceId: string, invitedBy: string, email: string, role: string) {
  return {
    email,
    role,
    status: 'pending',
    workspace_id: workspaceId,
    invited_by: invitedBy,
    invited_by_name: 'Admin',
    message: null,
    expires_at: '2026-06-06T00:00:00.000Z',
    accepted_by: null,
    accepted_at: null,
    revoked_by: null,
    revoked_at: null,
    created_at: '2026-05-06T00:00:00.000Z',
    updated_at: '2026-05-06T00:00:00.000Z',
  };
}
