import { describe, expect, it } from 'vitest';

import { buildWorkspaceProfileDatabasePayload } from './workspace-profile-database';

describe('workspace profile database payload', () => {
  it('stores derived company identity fields for app-wide profile propagation', () => {
    const payload = buildWorkspaceProfileDatabasePayload({
      businessName: 'Rudraix',
      legalName: 'Rudraix Private Limited',
      ownerName: 'Bhaumik Mehta',
      contactPerson: 'Bhaumik Mehta',
      entityType: 'company',
      entitySubtype: 'private_limited',
      entityVerificationStatus: 'approved',
      phone: '+91 82009 52311',
      email: 'billing@rudraix.example',
      website: 'https://rudraix.example',
      address: 'Operations Office, Vadodara',
      addressLine1: 'Registered Office, Tower A',
      addressLine2: 'Near Navrachna University',
      city: 'Vadodara',
      town: null,
      postalCode: '391410',
      gstin: '24ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      cin: 'U72900GJ2024PTC123456',
      llpin: null,
      taxNumber: null,
      registrationNumber: null,
      registeredOfficeAddress: null,
      principalPlaceOfBusiness: 'Principal GST Place, Ahmedabad',
      nonprofitRegistrationNumber: null,
      ngoDarpanId: null,
      taxExemption12A12ABNumber: null,
      taxDeduction80GNumber: null,
      fcraRegistrationNumber: null,
      csrRegistrationNumber: null,
      currency: 'INR',
      countryCode: 'IN',
      stateCode: 'GJ',
    });

    expect(payload).toMatchObject({
      profile_summary_version: 1,
      profile_display_name: 'Rudraix',
      profile_document_name: 'Rudraix Private Limited',
      profile_entity_label: 'Company',
      profile_entity_subtype_label: 'Private Limited',
      profile_document_address: 'Registered Office, Tower A, Near Navrachna University, Vadodara, GJ, 391410, IN',
      profile_has_tax_profile: true,
      profile_has_protected_identity: true,
    });
    expect(payload.profile_identity_line).toContain('CIN: U72900GJ2024PTC123456');
    expect(payload.profile_identity_line).toContain('Company PAN: ABCDE1234F');
    expect(payload.profile_search_tokens).toEqual(expect.arrayContaining(['rudraix', 'private', 'limited', 'cin']));
  });

  it('keeps freelancer payloads free from company-only registration identity', () => {
    const payload = buildWorkspaceProfileDatabasePayload({
      businessName: 'PromptPay Studio',
      legalName: null,
      ownerName: 'Asha Shah',
      contactPerson: null,
      entityType: 'freelancer_individual',
      entitySubtype: null,
      entityVerificationStatus: 'draft',
      phone: '+91 90000 00000',
      email: 'asha@example.invalid',
      website: null,
      address: 'Workspace Road, Ahmedabad',
      addressLine1: null,
      addressLine2: null,
      city: null,
      town: null,
      postalCode: null,
      gstin: null,
      pan: 'ABCDE1234F',
      cin: null,
      llpin: null,
      taxNumber: null,
      registrationNumber: null,
      registeredOfficeAddress: null,
      principalPlaceOfBusiness: null,
      nonprofitRegistrationNumber: null,
      ngoDarpanId: null,
      taxExemption12A12ABNumber: null,
      taxDeduction80GNumber: null,
      fcraRegistrationNumber: null,
      csrRegistrationNumber: null,
      currency: 'INR',
      countryCode: 'IN',
      stateCode: 'GJ',
    });

    expect(payload.profile_document_name).toBe('PromptPay Studio');
    expect(payload.profile_entity_label).toBe('Freelancer / Individual');
    expect(payload.profile_identity_line).toContain('PAN: ABCDE1234F');
    expect(payload.profile_identity_line).not.toContain('CIN');
  });
});
