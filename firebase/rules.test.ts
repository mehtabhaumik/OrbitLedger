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

  it('allows the full first-workspace payload used by the web setup flow', async () => {
    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = owner.collection('workspaces').doc('workspace-bootstrap');

    await assertSucceeds(
      workspace.set({
        owner_uid: 'owner-1',
        owner_email: 'owner@example.com',
        business_name: 'Orbit Bootstrap Workspace',
        profile_summary_version: 1,
        profile_display_name: 'Orbit Bootstrap Workspace',
        profile_legal_name: 'Orbit Bootstrap Private Limited',
        profile_document_name: 'Orbit Bootstrap Private Limited',
        profile_owner_name: 'Orbit Owner',
        profile_entity_label: 'Company',
        profile_entity_subtype_label: 'Private Limited',
        profile_verification_status_label: 'Draft',
        profile_registered_address: 'B-603, Shilpan Bliss, Vadodara',
        profile_business_address: 'B-603, Shilpan Bliss, Vadodara',
        profile_principal_place_of_business: 'B-603, Shilpan Bliss, Vadodara',
        profile_document_address: 'B-603, Shilpan Bliss, Vadodara',
        profile_contact_line: 'owner@example.com · +91 98765 43210',
        profile_tax_identity_line: 'GSTIN: 24ABCDE1234F1Z5 · Company PAN: ABCDE1234F',
        profile_registration_identity_line: 'CIN: U72900GJ2024PTC123456',
        profile_identity_line: 'CIN: U72900GJ2024PTC123456 · Company PAN: ABCDE1234F',
        profile_export_name: 'orbit-bootstrap-workspace',
        profile_search_text: 'orbit bootstrap workspace private limited cin',
        profile_search_tokens: ['orbit', 'bootstrap', 'workspace', 'private', 'limited', 'cin'],
        profile_has_tax_profile: true,
        profile_has_protected_identity: true,
        owner_name: 'Orbit Owner',
        legal_name: 'Orbit Bootstrap Private Limited',
        entity_type: 'company',
        entity_subtype: 'private_limited',
        entity_verification_status: 'draft',
        entity_compliance_flags: {
          gstRegistered: true,
          donationReceiptsEnabled: false,
          has12A12AB: false,
          has80G: false,
          receivesForeignContribution: false,
          hasFcra: false,
          acceptsCsrFunding: false,
          hasUdyam: false,
        },
        phone: '',
        email: 'owner@example.com',
        address: '',
        gstin: '24ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        cin: 'U72900GJ2024PTC123456',
        registered_office_address: 'B-603, Shilpan Bliss, Vadodara',
        principal_place_of_business: 'B-603, Shilpan Bliss, Vadodara',
        additional_places_of_business: [],
        currency: 'INR',
        country_code: 'IN',
        state_code: 'GJ',
        logo_uri: null,
        document_watermark_type: 'none',
        document_watermark_text: null,
        document_watermark_image_uri: null,
        document_watermark_opacity: 0.08,
        authorized_person_name: '',
        authorized_person_title: '',
        signature_uri: null,
        data_state: 'profile_only',
        created_at: '2026-05-22T00:00:00.000Z',
        updated_at: '2026-05-22T00:00:00.000Z',
        profile_summary_updated_at: '2026-05-22T00:00:00.000Z',
        server_revision: 1,
      })
    );

    await assertSucceeds(workspace.get());
  });

  it('validates workspace profile summary writes and blocks unsafe root fields', async () => {
    await seedWorkspace('workspace-1', 'owner-1');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = owner.collection('workspaces').doc('workspace-1');

    await assertSucceeds(
      workspace.update({
        profile_summary_version: 1,
        profile_display_name: 'Orbit Store',
        profile_document_name: 'Orbit Store',
        profile_owner_name: 'Owner',
        profile_entity_label: 'Freelancer / Individual',
        profile_verification_status_label: 'Draft',
        profile_document_address: 'Main Road, Ahmedabad',
        profile_search_text: 'orbit store owner',
        profile_search_tokens: ['orbit', 'store', 'owner'],
        profile_has_tax_profile: false,
        profile_has_protected_identity: false,
        entity_type: 'freelancer_individual',
        entity_verification_status: 'draft',
        entity_compliance_flags: {
          gstRegistered: false,
          donationReceiptsEnabled: false,
          has12A12AB: false,
          has80G: false,
          receivesForeignContribution: false,
          hasFcra: false,
          acceptsCsrFunding: false,
          hasUdyam: false,
        },
        owner_name: 'Owner',
        phone: '+91 98765 43210',
        email: 'owner@example.com',
        address: 'Main Road, Ahmedabad',
        updated_at: '2026-05-22T00:01:00.000Z',
        profile_summary_updated_at: '2026-05-22T00:01:00.000Z',
        server_revision: 2,
      })
    );

    await assertFails(
      workspace.update({
        profile_display_name: 42,
      })
    );
    await assertFails(
      workspace.update({
        profile_admin_override: true,
      })
    );
    await assertFails(
      workspace.update({
        entity_type: 'shell_company',
      })
    );
  });

  it('locks approved workspace identity fields while allowing address maintenance', async () => {
    await seedApprovedCompanyWorkspace('workspace-1', 'owner-1');

    const owner = testEnv.authenticatedContext('owner-1').firestore();
    const workspace = owner.collection('workspaces').doc('workspace-1');

    await assertSucceeds(
      workspace.update({
        address: 'Updated billing address, Vadodara',
        registered_office_address: 'Updated registered office, Vadodara',
        profile_registered_address: 'Updated registered office, Vadodara',
        profile_business_address: 'Updated billing address, Vadodara',
        profile_document_address: 'Updated registered office, Vadodara',
        profile_search_text: 'orbit store updated registered office',
        profile_search_tokens: ['orbit', 'store', 'updated', 'registered', 'office'],
        updated_at: '2026-05-22T00:02:00.000Z',
        profile_summary_updated_at: '2026-05-22T00:02:00.000Z',
        server_revision: 2,
      })
    );

    await assertFails(
      workspace.update({
        business_name: 'Renamed Company',
      })
    );
    await assertFails(
      workspace.update({
        cin: 'U72900GJ2025PTC999999',
      })
    );
    await assertFails(
      workspace.update({
        profile_document_name: 'Tampered Legal Name',
      })
    );
    await assertFails(
      workspace.update({
        entity_verification_status: 'draft',
      })
    );
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

  it('keeps platform admin registry server-owned', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection('platform_admins').doc('admin-1').set({
        uid: 'admin-1',
        email: 'admin@example.com',
        role: 'super_admin',
        status: 'active',
        role_source: 'allowlist',
      });
      await context.firestore().collection('platform_users').doc('user-1').set({
        uid: 'user-1',
        email: 'user@example.com',
      });
      await context.firestore().collection('platform_admin_audit').doc('audit-1').set({
        action: 'registry_snapshot_generated',
      });
      await context.firestore().collection('platform_user_warnings').doc('warning-1').set({
        target_uid: 'user-1',
        message: 'Review needed',
      });
      await context.firestore().collection('platform_user_notes').doc('note-1').set({
        target_uid: 'user-1',
        note: 'Internal note',
      });
      await context.firestore().collection('platform_offers').doc('offer-1').set({
        label: 'Launch Offer',
        status: 'active',
      });
    });

    const user = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(user.collection('platform_admins').doc('admin-1').get());
    await assertFails(user.collection('platform_admins').doc('user-1').set({ role: 'super_admin' }));
    await assertFails(user.collection('platform_users').doc('user-1').get());
    await assertFails(user.collection('platform_admin_audit').doc('audit-1').get());
    await assertFails(user.collection('platform_user_warnings').doc('warning-1').get());
    await assertFails(user.collection('platform_user_notes').doc('note-1').get());
    await assertFails(user.collection('platform_offers').doc('offer-1').get());
    await assertFails(user.collection('platform_offers').doc('offer-2').set({ label: 'Unsafe discount' }));
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

  it('lets invoice-capable members advance only invoice numbering metadata', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');

    const staff = testEnv.authenticatedContext('staff-1').firestore();
    const workspace = staff.collection('workspaces').doc('workspace-1');

    await assertSucceeds(
      workspace.update({
        invoice_number_next_sequence: 2,
        invoice_number_last_value: 'OS12/26/0001',
        invoice_number_last_sequence: 1,
        invoice_number_last_issued_at: '2026-05-17T00:00:00.000Z',
        invoice_number_scheme: 'smart_company_fy_sequence',
      })
    );
    await assertFails(
      workspace.update({
        invoice_number_prefix: 'NEW',
        invoice_number_separator: '-',
        invoice_number_padding: 5,
      })
    );
    await assertFails(
      workspace.update({
        business_name: 'Changed by Staff',
        invoice_number_next_sequence: 3,
        invoice_number_last_value: 'OS12/26/0002',
        invoice_number_last_sequence: 2,
        invoice_number_last_issued_at: '2026-05-17T00:01:00.000Z',
        invoice_number_scheme: 'smart_company_fy_sequence',
      })
    );
  });

  it('lets invoice-capable members write invoice number keys but keeps viewers read-only', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'viewer-1', 'viewer');

    const staff = testEnv.authenticatedContext('staff-1').firestore();
    const viewer = testEnv.authenticatedContext('viewer-1').firestore();
    const staffInvoice = staff.collection('workspaces').doc('workspace-1').collection('invoices').doc('invoice-1');
    const viewerInvoice = viewer.collection('workspaces').doc('workspace-1').collection('invoices').doc('invoice-2');

    await assertSucceeds(
      staffInvoice.set({
        customer_id: 'customer-1',
        invoice_number: 'OS12/26/0001',
        invoice_number_key: 'OS12/26/0001',
        document_state: 'draft',
        status: 'draft',
        created_at: '2026-05-17T00:00:00.000Z',
      })
    );
    await assertFails(
      viewerInvoice.set({
        customer_id: 'customer-1',
        invoice_number: 'OS12/26/0002',
        invoice_number_key: 'OS12/26/0002',
        document_state: 'draft',
        status: 'draft',
        created_at: '2026-05-17T00:00:00.000Z',
      })
    );
  });

  it('restricts settings audit writes to owners and Office admins', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'accountant-1', 'accountant');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');

    const ownerAudit = testEnv.authenticatedContext('owner-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('settings_audit');
    const adminAudit = testEnv.authenticatedContext('admin-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('settings_audit');
    const accountantAudit = testEnv.authenticatedContext('accountant-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('settings_audit');
    const staffAudit = testEnv.authenticatedContext('staff-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('settings_audit');

    await assertSucceeds(ownerAudit.doc('owner-audit').set(settingsAuditPayload('workspace-1', 'owner-1')));
    await assertSucceeds(adminAudit.doc('admin-audit').set(settingsAuditPayload('workspace-1', 'admin-1')));
    await assertSucceeds(accountantAudit.doc('owner-audit').get());
    await assertFails(accountantAudit.doc('accountant-audit').set(settingsAuditPayload('workspace-1', 'accountant-1')));
    await assertFails(staffAudit.doc('owner-audit').get());
    await assertFails(staffAudit.doc('staff-audit').set(settingsAuditPayload('workspace-1', 'staff-1')));
  });

  it('restricts entity profile revisions to owners and Office admins', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'accountant-1', 'accountant');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');

    const ownerRevisions = testEnv.authenticatedContext('owner-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('entity_profile_revisions');
    const adminRevisions = testEnv.authenticatedContext('admin-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('entity_profile_revisions');
    const accountantRevisions = testEnv.authenticatedContext('accountant-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('entity_profile_revisions');
    const staffRevisions = testEnv.authenticatedContext('staff-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('entity_profile_revisions');

    await assertSucceeds(ownerRevisions.doc('owner-revision').set(entityProfileRevisionPayload('workspace-1', 'owner-1')));
    await assertSucceeds(adminRevisions.doc('admin-revision').set(entityProfileRevisionPayload('workspace-1', 'admin-1')));
    await assertSucceeds(accountantRevisions.doc('owner-revision').get());
    await assertFails(accountantRevisions.doc('accountant-revision').set(entityProfileRevisionPayload('workspace-1', 'accountant-1')));
    await assertFails(staffRevisions.doc('owner-revision').get());
    await assertFails(staffRevisions.doc('staff-revision').set(entityProfileRevisionPayload('workspace-1', 'staff-1')));
  });

  it('restricts document vault records to owners and Office admins', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'admin-1', 'admin');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'accountant-1', 'accountant');
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'staff-1', 'staff');

    const ownerVault = testEnv.authenticatedContext('owner-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('document_vault');
    const adminVault = testEnv.authenticatedContext('admin-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('document_vault');
    const accountantVault = testEnv.authenticatedContext('accountant-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('document_vault');
    const staffVault = testEnv.authenticatedContext('staff-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('document_vault');

    await assertSucceeds(ownerVault.doc('owner-document').set(documentVaultPayload('workspace-1', 'owner-1')));
    await assertSucceeds(adminVault.doc('admin-document').set(documentVaultPayload('workspace-1', 'admin-1')));
    await assertSucceeds(accountantVault.doc('owner-document').get());
    await assertFails(accountantVault.doc('accountant-document').set(documentVaultPayload('workspace-1', 'accountant-1')));
    await assertFails(staffVault.doc('owner-document').get());
    await assertFails(staffVault.doc('staff-document').set(documentVaultPayload('workspace-1', 'staff-1')));
  });

  it('blocks unsafe document vault metadata', async () => {
    await seedWorkspace('workspace-1', 'owner-1');

    const ownerVault = testEnv.authenticatedContext('owner-1').firestore()
      .collection('workspaces').doc('workspace-1').collection('document_vault');

    await assertFails(
      ownerVault.doc('webp-document').set({
        ...documentVaultPayload('workspace-1', 'owner-1'),
        content_type: 'image/webp',
      })
    );
    await assertFails(
      ownerVault.doc('missing-attestation').set({
        ...documentVaultPayload('workspace-1', 'owner-1'),
        self_attested: false,
      })
    );
    await assertFails(
      ownerVault.doc('oversized-document').set({
        ...documentVaultPayload('workspace-1', 'owner-1'),
        size: 10 * 1024 * 1024 + 1,
      })
    );
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
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_tickets').doc('ticket-1').set({
      status: 'opened',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_messages').doc('message-1').set({
      kind: 'customer_message',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_assignments').doc('assignment-1').set({
      assigned_role: 'support_admin',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_events').doc('event-1').set({
      kind: 'ticket_created',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_queues').doc('queue-1').set({
      label: 'General',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('support_notification_preferences').doc('preference-1').set({
      mute_all: false,
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('live_payment_events').doc('event-1').set({
      processing_status: 'pending_reconciliation',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('live_payment_event_raw').doc('event-1').set({
      raw_payload: {},
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('live_payment_audit').doc('audit-1').set({
      action: 'payment_applied',
    }));
    await assertFails(owner.collection('workspaces').doc('workspace-1').collection('live_payment_notifications').doc('notification-1').set({
      kind: 'payment_received',
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
      await workspace.collection('support_tickets').doc('ticket-1').set({ status: 'opened' });
      await workspace.collection('support_messages').doc('message-1').set({ kind: 'customer_message' });
      await workspace.collection('support_assignments').doc('assignment-1').set({ assigned_role: 'support_admin' });
      await workspace.collection('support_events').doc('event-1').set({ kind: 'ticket_created' });
      await workspace.collection('support_queues').doc('queue-1').set({ label: 'General' });
      await workspace.collection('support_notification_preferences').doc('preference-1').set({ mute_all: false });
      await workspace.collection('live_payment_events').doc('event-1').set({ processing_status: 'reconciled' });
      await workspace.collection('live_payment_event_raw').doc('event-1').set({ raw_payload: { secret: true } });
      await workspace.collection('live_payment_audit').doc('audit-1').set({ action: 'payment_applied' });
      await workspace.collection('live_payment_notifications').doc('notification-1').set({ kind: 'payment_received' });
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
    await assertSucceeds(accountant.collection('live_payment_audit').doc('audit-1').get());

    await assertFails(staff.collection('office_access_audit').doc('audit-1').get());
    await assertFails(staff.collection('support_diagnostic_consents').doc('consent-1').get());
    await assertFails(staff.collection('support_cases').doc('case-1').get());
    await assertFails(staff.collection('support_case_email_requests').doc('email-1').get());
    await assertFails(owner.collection('support_tickets').doc('ticket-1').get());
    await assertFails(accountant.collection('support_tickets').doc('ticket-1').get());
    await assertFails(owner.collection('support_messages').doc('message-1').get());
    await assertFails(accountant.collection('support_messages').doc('message-1').get());
    await assertFails(owner.collection('support_assignments').doc('assignment-1').get());
    await assertFails(accountant.collection('support_assignments').doc('assignment-1').get());
    await assertFails(owner.collection('support_events').doc('event-1').get());
    await assertFails(accountant.collection('support_events').doc('event-1').get());
    await assertFails(owner.collection('support_queues').doc('queue-1').get());
    await assertFails(accountant.collection('support_queues').doc('queue-1').get());
    await assertFails(owner.collection('support_notification_preferences').doc('preference-1').get());
    await assertFails(accountant.collection('support_notification_preferences').doc('preference-1').get());
    await assertSucceeds(staff.collection('live_payment_events').doc('event-1').get());
    await assertSucceeds(staff.collection('live_payment_notifications').doc('notification-1').get());
    await assertFails(staff.collection('live_payment_event_raw').doc('event-1').get());
    await assertFails(staff.collection('live_payment_audit').doc('audit-1').get());
  });

  it('allows read-only user-context sessions to inspect a target workspace without granting writes', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'viewer-1', 'viewer');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await firestore.collection('workspaces').doc('workspace-1').collection('customers').doc('customer-1').set({
        name: 'Orbit Customer',
      });
      await firestore.collection('operator_user_context_sessions').doc('support-admin-1').set({
        session_id: 'session-1',
        status: 'active',
        mode: 'view_as_user',
        actor_uid: 'support-admin-1',
        actor_role: 'support_admin',
        target_uid: 'viewer-1',
        target_workspace_id: 'workspace-1',
        target_workspace_name: 'Orbit Store',
        target_access_source: 'member',
        target_office_role: 'viewer',
        target_is_owner: false,
        read_only: true,
        allow_actions: false,
        expires_at: new Date('2030-01-01T00:00:00.000Z'),
      });
    });

    const operator = testEnv.authenticatedContext('support-admin-1').firestore();
    const workspace = operator.collection('workspaces').doc('workspace-1');
    const customer = workspace.collection('customers').doc('customer-1');

    await assertSucceeds(workspace.get());
    await assertSucceeds(customer.get());
    await assertFails(customer.set({ name: 'Blocked write' }));
  });

  it('lets act-as-user sessions inherit the target role write scope', async () => {
    await seedWorkspaceWithOfficeMember('workspace-1', 'owner-1', 'manager-1', 'manager');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const firestore = context.firestore();
      await firestore.collection('operator_user_context_sessions').doc('admin-operator-1').set({
        session_id: 'session-2',
        status: 'active',
        mode: 'act_as_user',
        actor_uid: 'admin-operator-1',
        actor_role: 'admin',
        target_uid: 'manager-1',
        target_workspace_id: 'workspace-1',
        target_workspace_name: 'Orbit Store',
        target_access_source: 'member',
        target_office_role: 'manager',
        target_is_owner: false,
        read_only: false,
        allow_actions: true,
        expires_at: new Date('2030-01-01T00:00:00.000Z'),
      });
    });

    const operator = testEnv.authenticatedContext('admin-operator-1').firestore();
    const workspace = operator.collection('workspaces').doc('workspace-1');
    const customer = workspace.collection('customers').doc('customer-1');

    await assertSucceeds(customer.set({ name: 'Allowed via act-as-user' }));
    await assertFails(
      workspace.update({
        business_name: 'Manager cannot change company profile',
      })
    );
  });
});

async function seedWorkspace(workspaceId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('workspaces').doc(workspaceId).set({
      owner_uid: ownerUid,
      business_name: 'Orbit Store',
      owner_name: 'Owner',
      phone: '+91 98765 43210',
      email: 'owner@example.com',
      address: 'Main Road',
      currency: 'INR',
      country_code: 'IN',
      state_code: 'GJ',
      updated_at: '2026-05-06T00:00:00.000Z',
      server_revision: 1,
    });
  });
}

async function seedApprovedCompanyWorkspace(workspaceId: string, ownerUid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection('workspaces').doc(workspaceId).set({
      owner_uid: ownerUid,
      owner_email: 'owner@example.com',
      business_name: 'Orbit Store Private Limited',
      legal_name: 'Orbit Store Private Limited',
      owner_name: 'Orbit Owner',
      entity_type: 'company',
      entity_subtype: 'private_limited',
      entity_verification_status: 'approved',
      entity_compliance_flags: {
        gstRegistered: true,
        donationReceiptsEnabled: false,
        has12A12AB: false,
        has80G: false,
        receivesForeignContribution: false,
        hasFcra: false,
        acceptsCsrFunding: false,
        hasUdyam: false,
      },
      phone: '+91 98765 43210',
      email: 'owner@example.com',
      address: 'Main Road',
      gstin: '24ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      cin: 'U72900GJ2024PTC123456',
      registered_office_address: 'Registered Office, Vadodara',
      principal_place_of_business: 'Main Road, Vadodara',
      currency: 'INR',
      country_code: 'IN',
      state_code: 'GJ',
      profile_summary_version: 1,
      profile_display_name: 'Orbit Store Private Limited',
      profile_legal_name: 'Orbit Store Private Limited',
      profile_document_name: 'Orbit Store Private Limited',
      profile_owner_name: 'Orbit Owner',
      profile_entity_label: 'Company',
      profile_entity_subtype_label: 'Private Limited',
      profile_verification_status_label: 'Approved',
      profile_registered_address: 'Registered Office, Vadodara',
      profile_business_address: 'Main Road, Vadodara',
      profile_principal_place_of_business: 'Main Road, Vadodara',
      profile_document_address: 'Registered Office, Vadodara',
      profile_contact_line: 'owner@example.com · +91 98765 43210',
      profile_tax_identity_line: 'GSTIN: 24ABCDE1234F1Z5 · Company PAN: ABCDE1234F',
      profile_registration_identity_line: 'CIN: U72900GJ2024PTC123456',
      profile_identity_line: 'CIN: U72900GJ2024PTC123456 · Company PAN: ABCDE1234F',
      profile_export_name: 'orbit-store-private-limited',
      profile_search_text: 'orbit store private limited cin',
      profile_search_tokens: ['orbit', 'store', 'private', 'limited', 'cin'],
      profile_has_tax_profile: true,
      profile_has_protected_identity: true,
      data_state: 'profile_only',
      created_at: '2026-05-06T00:00:00.000Z',
      updated_at: '2026-05-06T00:00:00.000Z',
      profile_summary_updated_at: '2026-05-06T00:00:00.000Z',
      server_revision: 1,
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
      owner_name: 'Owner',
      phone: '+91 98765 43210',
      email: 'owner@example.com',
      address: 'Main Road',
      currency: 'INR',
      country_code: 'IN',
      state_code: 'GJ',
      updated_at: '2026-05-06T00:00:00.000Z',
      server_revision: 1,
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

function settingsAuditPayload(workspaceId: string, actorUid: string) {
  return {
    workspace_id: workspaceId,
    scope: 'company_settings',
    setting_group: 'audit_protected_settings',
    action: 'updated',
    actor_uid: actorUid,
    actor_email: `${actorUid}@example.com`,
    reason: 'Invoice numbering updated',
    changed_fields: ['Invoice number company code'],
    changes: [
      {
        field: 'invoiceNumberPrefix',
        label: 'Invoice number company code',
        previous_value: null,
        next_value: 'OS',
      },
    ],
    server_revision_before: 1,
    server_revision_after: 2,
    created_at: '2026-05-17T00:00:00.000Z',
  };
}

function entityProfileRevisionPayload(workspaceId: string, actorUid: string) {
  return {
    workspace_id: workspaceId,
    action: 'profile_updated',
    actor_uid: actorUid,
    actor_email: `${actorUid}@example.com`,
    source: 'user',
    approval_status: 'accepted',
    reason: 'Address change reason: Office relocation. Changed: Workspace address.',
    changed_fields: ['Workspace address'],
    changes: [
      {
        field: 'address',
        label: 'Workspace address',
        previous_value: 'Old office',
        next_value: 'New office',
      },
    ],
    previous_snapshot: {
      businessName: 'Asha Traders',
      address: 'Old office',
    },
    next_snapshot: {
      businessName: 'Asha Traders',
      address: 'New office',
    },
    linked_document_ids: [],
    server_revision_before: 1,
    server_revision_after: 2,
    created_at: '2026-06-09T18:00:00.000Z',
  };
}

function documentVaultPayload(workspaceId: string, actorUid: string) {
  return {
    workspace_id: workspaceId,
    document_name: 'PAN card',
    document_type: 'pan_card',
    document_type_label: 'PAN card',
    document_category: 'tax',
    document_category_label: 'Tax',
    reason_to_upload: 'Initial verification',
    self_attested: true,
    attestation_text: 'I confirm this document is legal, authentic, correct, and I am authorized to upload it.',
    file_name: 'pan-card.pdf',
    content_type: 'application/pdf',
    size: 1024,
    storage_path: `workspaces/${workspaceId}/documents/vault/document-1/pan-card.pdf`,
    download_url: 'https://storage.example/pan-card.pdf',
    uploaded_by_uid: actorUid,
    uploaded_by_email: `${actorUid}@example.com`,
    uploaded_at: '2026-06-09T18:00:00.000Z',
    created_at: '2026-06-09T18:00:00.000Z',
    updated_at: '2026-06-09T18:00:00.000Z',
    entity_type: 'sole_proprietorship',
    entity_subtype: null,
    verification_status: 'uploaded',
    linked_profile_revision_id: null,
  };
}
