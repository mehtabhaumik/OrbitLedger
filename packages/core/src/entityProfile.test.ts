import { describe, expect, it } from 'vitest';

import {
  doesOrbitEntityRequireCin,
  getHiddenOrbitEntityProfileFields,
  getProtectedOrbitEntityProfileFields,
  getRequiredOrbitEntityProfileFields,
  normalizeOrbitEntityProfile,
} from './entityProfile';

describe('entity profile foundation', () => {
  it('keeps freelancer profiles free of company-only fields', () => {
    const profile = {
      entityType: 'freelancer_individual' as const,
      verificationStatus: 'approved' as const,
    };

    expect(doesOrbitEntityRequireCin(profile)).toBe(false);
    expect(getRequiredOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining(['legalName', 'displayName', 'legalBillingAddress'])
    );
    expect(getHiddenOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining(['cin', 'llpin', 'companyPan', 'registeredOfficeAddress'])
    );
    expect(getProtectedOrbitEntityProfileFields(profile)).toEqual(['legalName', 'pan', 'gstin']);
  });

  it('requires CIN and company PAN for company profiles', () => {
    const profile = {
      entityType: 'company' as const,
      entitySubtype: 'private_limited' as const,
      verificationStatus: 'approved' as const,
      complianceFlags: {
        gstRegistered: true,
      },
    };

    expect(doesOrbitEntityRequireCin(profile)).toBe(true);
    expect(getRequiredOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining(['legalName', 'entitySubtype', 'cin', 'companyPan', 'registeredOfficeAddress', 'gstin'])
    );
    expect(getHiddenOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining(['llpin', 'nonprofitRegistrationNumber', 'llpAgreement'])
    );
    expect(getProtectedOrbitEntityProfileFields(profile)).toEqual(['legalName', 'cin', 'companyPan', 'gstin']);
  });

  it('treats Section 8 nonprofits as nonprofit profiles that also require CIN', () => {
    const profile = {
      entityType: 'nonprofit_charity' as const,
      entitySubtype: 'section_8_company' as const,
      verificationStatus: 'approved' as const,
      complianceFlags: {
        donationReceiptsEnabled: true,
        has12A12AB: true,
        receivesForeignContribution: true,
        acceptsCsrFunding: true,
      },
    };

    expect(doesOrbitEntityRequireCin(profile)).toBe(true);
    expect(getRequiredOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining([
        'legalName',
        'pan',
        'nonprofitRegistrationNumber',
        'registeredOfficeAddress',
        'cin',
        'taxExemption12A12ABNumber',
        'taxDeduction80GNumber',
        'fcraRegistrationNumber',
        'csrRegistrationNumber',
      ])
    );
    expect(getHiddenOrbitEntityProfileFields(profile)).not.toContain('cin');
    expect(getProtectedOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining([
        'legalName',
        'pan',
        'nonprofitRegistrationNumber',
        'cin',
        'taxExemption12A12ABNumber',
        'taxDeduction80GNumber',
        'fcraRegistrationNumber',
        'csrRegistrationNumber',
      ])
    );
  });

  it('hides nonprofit compliance numbers until the matching flags are enabled', () => {
    const profile = {
      entityType: 'nonprofit_charity' as const,
      entitySubtype: 'charitable_trust' as const,
    };

    expect(doesOrbitEntityRequireCin(profile)).toBe(false);
    expect(getRequiredOrbitEntityProfileFields(profile)).not.toContain('cin');
    expect(getHiddenOrbitEntityProfileFields(profile)).toEqual(
      expect.arrayContaining([
        'llpin',
        'companyPan',
        'taxExemption12A12ABNumber',
        'taxDeduction80GNumber',
        'fcraRegistrationNumber',
        'csrRegistrationNumber',
      ])
    );
  });

  it('normalizes unknown or missing values to a safe sole-proprietor draft profile', () => {
    expect(normalizeOrbitEntityProfile(null)).toEqual({
      entityType: 'sole_proprietorship',
      entitySubtype: null,
      entityVerificationStatus: 'draft',
      complianceFlags: {
        gstRegistered: false,
        donationReceiptsEnabled: false,
        has12A12AB: false,
        has80G: false,
        receivesForeignContribution: false,
        hasFcra: false,
        acceptsCsrFunding: false,
        hasUdyam: false,
      },
    });
  });
});
