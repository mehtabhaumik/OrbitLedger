import { describe, expect, it } from 'vitest';

import {
  buildEntityProfileRevisionRecord,
  buildEntityProfileRevisionSnapshot,
} from './entity-profile-revisions';

describe('entity profile revision engine', () => {
  it('creates an accepted revision record with before and after snapshots', () => {
    const record = buildEntityProfileRevisionRecord({
      workspaceId: 'workspace-1',
      previous: {
        businessName: 'Asha Traders',
        entityType: 'sole_proprietorship',
        pan: 'ABCDE1234F',
        registeredOfficeAddress: 'Old office',
        entityComplianceFlags: {
          gstRegistered: false,
          hasUdyam: false,
        },
      },
      next: {
        businessName: 'Asha Trading Co',
        entityType: 'company',
        pan: 'ABCDE1234F',
        cin: 'U72900GJ2024PTC123456',
        registeredOfficeAddress: 'New office',
        entityComplianceFlags: {
          gstRegistered: true,
          hasUdyam: false,
        },
      },
      audit: {
        actorUid: 'owner-1',
        actorEmail: 'owner@example.com',
        reason: 'Identity verification update',
      },
      serverRevisionBefore: 4,
      serverRevisionAfter: 5,
      createdAt: '2026-06-09T18:00:00.000Z',
    });

    expect(record).toMatchObject({
      workspace_id: 'workspace-1',
      action: 'profile_updated',
      actor_uid: 'owner-1',
      actor_email: 'owner@example.com',
      source: 'user',
      approval_status: 'accepted',
      reason: 'Identity verification update',
      server_revision_before: 4,
      server_revision_after: 5,
      created_at: '2026-06-09T18:00:00.000Z',
    });
    expect(record?.changed_fields).toEqual(
      expect.arrayContaining([
        'Business name',
        'Entity type',
        'Entity compliance flags',
        'CIN',
        'Legal registered address',
      ])
    );
    expect(record?.previous_snapshot.registeredOfficeAddress).toBe('Old office');
    expect(record?.next_snapshot.cin).toBe('U72900GJ2024PTC123456');
  });

  it('returns null when profile-revision fields did not change', () => {
    expect(buildEntityProfileRevisionRecord({
      workspaceId: 'workspace-1',
      previous: {
        businessName: 'Asha Traders',
        address: ' Main office ',
        additionalPlacesOfBusiness: ['Godown'],
      },
      next: {
        businessName: 'Asha Traders',
        address: 'Main office',
        additionalPlacesOfBusiness: [' Godown '],
      },
      audit: {
        actorUid: 'owner-1',
      },
      serverRevisionBefore: 1,
      serverRevisionAfter: 2,
      createdAt: '2026-06-09T18:00:00.000Z',
    })).toBeNull();
  });

  it('normalizes list and compliance flag values for stable audit snapshots', () => {
    expect(buildEntityProfileRevisionSnapshot({
      additionalPlacesOfBusiness: ['  Ahmedabad office ', '', 'Surat warehouse'],
      entityComplianceFlags: {
        has80G: true,
        gstRegistered: false,
      },
    })).toMatchObject({
      additionalPlacesOfBusiness: 'Ahmedabad office\nSurat warehouse',
      entityComplianceFlags: 'gstRegistered:false|has80G:true',
    });
  });
});
