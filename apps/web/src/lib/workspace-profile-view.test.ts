import { describe, expect, it } from 'vitest';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import { buildWorkspaceProfileView } from './workspace-profile-view';

const baseWorkspace: OrbitWorkspaceSummary = {
  workspaceId: 'profile-view-workspace',
  businessName: 'Rudraix',
  legalName: 'Rudraix Private Limited',
  ownerName: 'Bhaumik Mehta',
  phone: '+91 82009 52311',
  email: 'billing@rudraix.example',
  address: 'B-603, Shilpan Bliss, Bhayli',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: null,
  authorizedPersonName: '',
  authorizedPersonTitle: '',
  signatureUri: null,
  paymentInstructions: {},
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z',
  serverRevision: 1,
  dataState: 'full_dataset',
};

describe('workspace profile view', () => {
  it('builds a company document identity with protected registration fields', () => {
    const profile = buildWorkspaceProfileView({
      ...baseWorkspace,
      entityType: 'company',
      entitySubtype: 'private_limited',
      entityVerificationStatus: 'approved',
      registeredOfficeAddress: 'Registered Office, Vadodara, GJ 391410',
      principalPlaceOfBusiness: 'Operations Office, Ahmedabad',
      gstin: '24ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      cin: 'U72900GJ2024PTC123456',
    });

    expect(profile.displayName).toBe('Rudraix');
    expect(profile.documentName).toBe('Rudraix Private Limited');
    expect(profile.documentAddress).toBe('Registered Office, Vadodara, GJ 391410');
    expect(profile.identityLine).toContain('CIN: U72900GJ2024PTC123456');
    expect(profile.identityLine).toContain('GSTIN: 24ABCDE1234F1Z5');
    expect(profile.hasProtectedIdentity).toBe(true);
  });

  it('keeps freelancers free of company-only registration identity', () => {
    const profile = buildWorkspaceProfileView({
      ...baseWorkspace,
      businessName: 'PromptPay Studio',
      legalName: null,
      entityType: 'freelancer_individual',
      pan: 'ABCDE1234F',
      registeredOfficeAddress: null,
      principalPlaceOfBusiness: null,
    });

    expect(profile.entityLabel).toBe('Freelancer / Individual');
    expect(profile.documentName).toBe('PromptPay Studio');
    expect(profile.identityLine).toContain('PAN: ABCDE1234F');
    expect(profile.identityLine).not.toContain('CIN');
  });

  it('includes nonprofit compliance identity without requiring company fields', () => {
    const profile = buildWorkspaceProfileView({
      ...baseWorkspace,
      businessName: 'Orbit Charity Trust',
      legalName: 'Orbit Charity Trust',
      entityType: 'nonprofit_charity',
      entitySubtype: 'charitable_trust',
      nonprofitRegistrationNumber: 'TRUST-2048',
      taxExemption12A12ABNumber: '12AB-2048',
      taxDeduction80GNumber: '80G-2048',
    });

    expect(profile.entityLabel).toBe('Nonprofit / Charity');
    expect(profile.identityLine).toContain('Nonprofit Reg.: TRUST-2048');
    expect(profile.identityLine).toContain('12A/12AB: 12AB-2048');
    expect(profile.identityLine).toContain('80G: 80G-2048');
  });
});
