import { describe, expect, it } from 'vitest';

import {
  buildWebEntityProfileUiModel,
  getEntityBusinessNameLabel,
  getEntityOwnerNameLabel,
  getEntityPanLabel,
  isEntityProfileFieldRequiredForVerification,
  shouldShowEntityProfileField,
} from './entity-profile-ui';

describe('web entity profile field matrix', () => {
  it('hides company-only fields for freelancer profiles', () => {
    const model = buildWebEntityProfileUiModel({ entityType: 'freelancer_individual' });

    expect(getEntityBusinessNameLabel(model.entityType)).toBe('Invoice / display name');
    expect(getEntityOwnerNameLabel(model.entityType)).toBe('Legal name');
    expect(shouldShowEntityProfileField(model, 'cin')).toBe(false);
    expect(shouldShowEntityProfileField(model, 'llpin')).toBe(false);
    expect(shouldShowEntityProfileField(model, 'registeredOfficeAddress')).toBe(false);
    expect(shouldShowEntityProfileField(model, 'pan')).toBe(true);
  });

  it('marks company CIN and company PAN as required for verification', () => {
    const model = buildWebEntityProfileUiModel({
      entityType: 'company',
      entitySubtype: 'private_limited',
      entityComplianceFlags: { gstRegistered: true },
    });

    expect(getEntityPanLabel(model.entityType)).toBe('Company PAN');
    expect(shouldShowEntityProfileField(model, 'cin')).toBe(true);
    expect(shouldShowEntityProfileField(model, 'llpin')).toBe(false);
    expect(shouldShowEntityProfileField(model, 'gstin')).toBe(true);
    expect(isEntityProfileFieldRequiredForVerification(model, 'cin')).toBe(true);
    expect(isEntityProfileFieldRequiredForVerification(model, 'companyPan')).toBe(true);
    expect(isEntityProfileFieldRequiredForVerification(model, 'gstin')).toBe(true);
  });

  it('shows Section 8 nonprofit CIN and enabled nonprofit compliance fields only', () => {
    const model = buildWebEntityProfileUiModel({
      entityType: 'nonprofit_charity',
      entitySubtype: 'section_8_company',
      entityComplianceFlags: {
        donationReceiptsEnabled: true,
        has12A12AB: true,
        has80G: true,
        hasFcra: false,
        receivesForeignContribution: false,
        acceptsCsrFunding: false,
      },
    });

    expect(shouldShowEntityProfileField(model, 'cin')).toBe(true);
    expect(shouldShowEntityProfileField(model, 'taxExemption12A12ABNumber')).toBe(true);
    expect(shouldShowEntityProfileField(model, 'taxDeduction80GNumber')).toBe(true);
    expect(shouldShowEntityProfileField(model, 'fcraRegistrationNumber')).toBe(false);
    expect(shouldShowEntityProfileField(model, 'csrRegistrationNumber')).toBe(false);
  });
});
