import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
  OrbitEntityVerificationStatus,
} from '@orbit-ledger/contracts';
import {
  ORBIT_ENTITY_PROFILE_DEFINITIONS,
  ORBIT_ENTITY_TYPE_OPTIONS,
  getHiddenOrbitEntityProfileFields,
  getRequiredOrbitEntityProfileFields,
  normalizeOrbitEntityProfile,
  type OrbitEntityProfileFieldId,
} from '@orbit-ledger/core';

export type WebEntityProfileUiInput = {
  entityType?: OrbitEntityType | null;
  entitySubtype?: OrbitEntitySubtype | null;
  entityVerificationStatus?: OrbitEntityVerificationStatus | null;
  entityComplianceFlags?: Partial<OrbitEntityComplianceFlags> | null;
};

export type WebEntityProfileUiModel = {
  entityType: OrbitEntityType;
  entitySubtype: OrbitEntitySubtype | null;
  entityLabel: string;
  entityDescription: string;
  subtypeOptions: readonly OrbitEntitySubtype[];
  requiredFields: Set<OrbitEntityProfileFieldId>;
  hiddenFields: Set<OrbitEntityProfileFieldId>;
};

export const WEB_ENTITY_SUBTYPE_LABELS: Record<OrbitEntitySubtype, string> = {
  private_limited: 'Private Limited',
  one_person_company: 'One Person Company',
  public_limited: 'Public Limited',
  other_company: 'Other Company',
  charitable_trust: 'Charitable Trust',
  registered_society: 'Registered Society',
  section_8_company: 'Section 8 Company',
  ngo_voluntary_organization: 'NGO / Voluntary Organization',
  religious_charitable_institution: 'Religious / Charitable Institution',
  other_nonprofit: 'Other Nonprofit',
};

export function buildWebEntityProfileUiModel(input: WebEntityProfileUiInput): WebEntityProfileUiModel {
  const normalized = normalizeOrbitEntityProfile({
    entityType: input.entityType,
    entitySubtype: input.entitySubtype,
    verificationStatus: input.entityVerificationStatus,
    complianceFlags: input.entityComplianceFlags,
  });
  const definition = ORBIT_ENTITY_PROFILE_DEFINITIONS[normalized.entityType];
  const option = ORBIT_ENTITY_TYPE_OPTIONS.find((entry) => entry.type === normalized.entityType) ?? definition;

  return {
    entityType: normalized.entityType,
    entitySubtype: normalized.entitySubtype,
    entityLabel: option.label,
    entityDescription: option.description,
    subtypeOptions: definition.allowedSubtypes,
    requiredFields: new Set(getRequiredOrbitEntityProfileFields(normalized)),
    hiddenFields: new Set(getHiddenOrbitEntityProfileFields(normalized)),
  };
}

export function shouldShowEntityProfileField(
  model: WebEntityProfileUiModel,
  field: OrbitEntityProfileFieldId
) {
  return !model.hiddenFields.has(field);
}

export function isEntityProfileFieldRequiredForVerification(
  model: WebEntityProfileUiModel,
  field: OrbitEntityProfileFieldId
) {
  return model.requiredFields.has(field);
}

export function getEntityBusinessNameLabel(entityType: OrbitEntityType) {
  if (entityType === 'freelancer_individual') {
    return 'Invoice / display name';
  }
  if (entityType === 'partnership_firm') {
    return 'Firm display name';
  }
  if (entityType === 'llp') {
    return 'LLP display name';
  }
  if (entityType === 'company') {
    return 'Company display name';
  }
  if (entityType === 'nonprofit_charity') {
    return 'Organization display name';
  }
  return 'Business / trade name';
}

export function getEntityOwnerNameLabel(entityType: OrbitEntityType) {
  if (entityType === 'freelancer_individual') {
    return 'Legal name';
  }
  if (entityType === 'sole_proprietorship') {
    return 'Proprietor legal name';
  }
  if (entityType === 'partnership_firm') {
    return 'Principal partner / signatory';
  }
  if (entityType === 'llp') {
    return 'Designated partner / signatory';
  }
  if (entityType === 'nonprofit_charity') {
    return 'Authorized signatory';
  }
  return 'Owner / authorized signatory';
}

export function getEntityPanLabel(entityType: OrbitEntityType) {
  if (entityType === 'llp') {
    return 'LLP PAN';
  }
  if (entityType === 'company') {
    return 'Company PAN';
  }
  if (entityType === 'partnership_firm') {
    return 'Firm PAN';
  }
  if (entityType === 'sole_proprietorship') {
    return 'Proprietor PAN';
  }
  if (entityType === 'nonprofit_charity') {
    return 'Organization PAN';
  }
  return 'PAN';
}
