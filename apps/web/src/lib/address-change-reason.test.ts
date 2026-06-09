import { describe, expect, it } from 'vitest';

import {
  buildAddressChangeRequestKey,
  buildWorkspaceAddressChanges,
  formatAddressChangeAuditReason,
  isAddressChangeReasonComplete,
  summarizeAddressChanges,
} from './address-change-reason';

describe('address change reason flow', () => {
  it('detects workspace, registered, and principal address changes', () => {
    const changes = buildWorkspaceAddressChanges(
      {
        address: 'Old shop',
        addressLine1: 'Old registered line',
        city: 'Ahmedabad',
        postalCode: '380001',
        stateCode: 'GJ',
        registeredOfficeAddress: 'Old office',
        principalPlaceOfBusiness: 'Old principal place',
        additionalPlacesOfBusiness: ['Old godown'],
      },
      {
        address: 'New shop',
        addressLine1: 'New registered line',
        city: 'Surat',
        postalCode: '395001',
        stateCode: 'GJ',
        registeredOfficeAddress: 'New office',
        principalPlaceOfBusiness: 'New principal place',
        additionalPlacesOfBusiness: ['New godown'],
      }
    );

    expect(changes.map((change) => change.field)).toEqual([
      'address',
      'addressLine1',
      'city',
      'postalCode',
      'registeredOfficeAddress',
      'principalPlaceOfBusiness',
      'additionalPlacesOfBusiness',
    ]);
    expect(summarizeAddressChanges(changes)).toContain('Registered office address');
    expect(buildAddressChangeRequestKey(changes)).toContain('New office');
  });

  it('ignores whitespace-only address formatting differences', () => {
    expect(
      buildWorkspaceAddressChanges(
        {
          address: '  Old shop  ',
          additionalPlacesOfBusiness: ['Main office', 'Godown'],
          stateCode: 'GJ',
        },
        {
          address: 'Old shop',
          additionalPlacesOfBusiness: [' Main office ', 'Godown'],
          stateCode: 'GJ',
        }
      )
    ).toEqual([]);
  });

  it('requires custom text only for Other and formats the audit reason', () => {
    const changes = buildWorkspaceAddressChanges(
      {
        address: 'Old shop',
        stateCode: 'GJ',
      },
      {
        address: 'New shop',
        stateCode: 'GJ',
      }
    );

    expect(isAddressChangeReasonComplete('office_relocation', '')).toBe(true);
    expect(isAddressChangeReasonComplete('other', 'Fix')).toBe(false);
    expect(isAddressChangeReasonComplete('other', 'Lease correction')).toBe(true);
    expect(formatAddressChangeAuditReason('other', 'Lease correction', changes)).toBe(
      'Address change reason: Lease correction. Changed: Workspace address.'
    );
  });
});
