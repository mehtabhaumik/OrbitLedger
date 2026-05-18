import { describe, expect, it } from 'vitest';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import {
  formatWorkspaceCompanyAddress,
  formatWorkspaceDocumentAddress,
  formatWorkspaceRegisteredAddress,
} from './workspace-address';

const baseWorkspace: OrbitWorkspaceSummary = {
  workspaceId: 'workspace-address-test',
  businessName: 'Rudraix Private Limited',
  ownerName: 'Bhaumik Mehta',
  phone: '+91 82009 52311',
  email: 'billing@example.com',
  address: 'B-603, Shilpan Bliss, Bhayli',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: null,
  authorizedPersonName: '',
  authorizedPersonTitle: '',
  signatureUri: null,
  paymentInstructions: {},
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
  serverRevision: 1,
  dataState: 'full_dataset',
};

describe('workspace address formatting', () => {
  it('uses structured registered address for documents when it is available', () => {
    const workspace: OrbitWorkspaceSummary = {
      ...baseWorkspace,
      addressLine1: 'Registered Office, Tower A',
      addressLine2: 'Near Navrachna University',
      city: 'Vadodara',
      postalCode: '391410',
    };

    expect(formatWorkspaceRegisteredAddress(workspace)).toBe(
      'Registered Office, Tower A, Near Navrachna University, Vadodara, GJ, 391410, IN'
    );
    expect(formatWorkspaceDocumentAddress(workspace)).toBe(
      'Registered Office, Tower A, Near Navrachna University, Vadodara, GJ, 391410, IN'
    );
  });

  it('falls back to company address when registered address is not saved', () => {
    const workspace: OrbitWorkspaceSummary = {
      ...baseWorkspace,
      addressLine1: null,
      addressLine2: null,
      city: null,
      town: null,
      postalCode: null,
    };

    expect(formatWorkspaceRegisteredAddress(workspace)).toBeNull();
    expect(formatWorkspaceCompanyAddress(workspace)).toBe('B-603, Shilpan Bliss, Bhayli, GJ, IN');
    expect(formatWorkspaceDocumentAddress(workspace)).toBe('B-603, Shilpan Bliss, Bhayli, GJ, IN');
  });
});
