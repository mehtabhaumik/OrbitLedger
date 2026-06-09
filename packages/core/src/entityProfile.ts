import type {
  OrbitCompanySubtype,
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
  OrbitEntityVerificationStatus,
  OrbitNonprofitSubtype,
} from '@orbit-ledger/contracts';

export type OrbitEntityProfileFieldId =
  | 'entityType'
  | 'entitySubtype'
  | 'legalName'
  | 'displayName'
  | 'ownerName'
  | 'businessName'
  | 'companyPan'
  | 'pan'
  | 'cin'
  | 'llpin'
  | 'gstin'
  | 'email'
  | 'mobile'
  | 'registeredOfficeAddress'
  | 'legalBillingAddress'
  | 'principalPlaceOfBusiness'
  | 'additionalPlacesOfBusiness'
  | 'registeredState'
  | 'city'
  | 'postalCode'
  | 'authorizedSignatory'
  | 'directorsOrPartners'
  | 'partnerList'
  | 'partnershipDeed'
  | 'llpAgreement'
  | 'certificateOfIncorporation'
  | 'registeredOfficeProof'
  | 'boardAuthorization'
  | 'nonprofitRegistrationNumber'
  | 'nonprofitRegistrationAuthority'
  | 'ngoDarpanId'
  | 'taxExemption12A12ABNumber'
  | 'taxDeduction80GNumber'
  | 'fcraRegistrationNumber'
  | 'csrRegistrationNumber'
  | 'bankProof'
  | 'professionalRegistration'
  | 'udyamNumber'
  | 'roc'
  | 'dateOfIncorporation'
  | 'authorizedCapital'
  | 'paidUpCapital'
  | 'website';

export type OrbitEntityComplianceFlagId = keyof OrbitEntityComplianceFlags;

export type OrbitEntityTypeOption = {
  type: OrbitEntityType;
  label: string;
  shortLabel: string;
  description: string;
  allowedSubtypes: readonly OrbitEntitySubtype[];
};

export type OrbitEntityProfileDefinition = OrbitEntityTypeOption & {
  requiredFields: readonly OrbitEntityProfileFieldId[];
  optionalFields: readonly OrbitEntityProfileFieldId[];
  hiddenFields: readonly OrbitEntityProfileFieldId[];
  protectedFields: readonly OrbitEntityProfileFieldId[];
  addressReasonFields: readonly OrbitEntityProfileFieldId[];
  documentTypes: readonly string[];
};

export type OrbitEntityProfileInput = {
  entityType?: OrbitEntityType | null;
  entitySubtype?: OrbitEntitySubtype | null;
  verificationStatus?: OrbitEntityVerificationStatus | null;
  complianceFlags?: Partial<OrbitEntityComplianceFlags> | null;
};

export const DEFAULT_ORBIT_ENTITY_TYPE: OrbitEntityType = 'sole_proprietorship';
export const DEFAULT_ORBIT_ENTITY_VERIFICATION_STATUS: OrbitEntityVerificationStatus = 'draft';

export const DEFAULT_ORBIT_ENTITY_COMPLIANCE_FLAGS: OrbitEntityComplianceFlags = {
  gstRegistered: false,
  donationReceiptsEnabled: false,
  has12A12AB: false,
  has80G: false,
  receivesForeignContribution: false,
  hasFcra: false,
  acceptsCsrFunding: false,
  hasUdyam: false,
};

const companySubtypes = [
  'private_limited',
  'one_person_company',
  'public_limited',
  'other_company',
] as const satisfies readonly OrbitCompanySubtype[];

const nonprofitSubtypes = [
  'charitable_trust',
  'registered_society',
  'section_8_company',
  'ngo_voluntary_organization',
  'religious_charitable_institution',
  'other_nonprofit',
] as const satisfies readonly OrbitNonprofitSubtype[];

export const ORBIT_ENTITY_TYPE_OPTIONS = [
  {
    type: 'freelancer_individual',
    label: 'Freelancer / Individual',
    shortLabel: 'Freelancer',
    description: 'Individual professional profile without company-only registration fields.',
    allowedSubtypes: [],
  },
  {
    type: 'sole_proprietorship',
    label: 'Sole Proprietorship',
    shortLabel: 'Proprietor',
    description: 'Single-owner business profile with proprietor PAN and trade identity.',
    allowedSubtypes: [],
  },
  {
    type: 'partnership_firm',
    label: 'Partnership Firm',
    shortLabel: 'Partnership',
    description: 'Firm profile with partner/signatory and partnership registration support.',
    allowedSubtypes: [],
  },
  {
    type: 'llp',
    label: 'LLP',
    shortLabel: 'LLP',
    description: 'Limited Liability Partnership profile with LLPIN and designated partners.',
    allowedSubtypes: [],
  },
  {
    type: 'company',
    label: 'Company',
    shortLabel: 'Company',
    description: 'Private, OPC, public, or other company profile with CIN and company PAN.',
    allowedSubtypes: companySubtypes,
  },
  {
    type: 'nonprofit_charity',
    label: 'Nonprofit / Charity Organization',
    shortLabel: 'Nonprofit',
    description: 'Trust, society, Section 8 company, NGO, or charity profile with compliance flags.',
    allowedSubtypes: nonprofitSubtypes,
  },
] as const satisfies readonly OrbitEntityTypeOption[];

const commonRequiredFields = [
  'entityType',
  'email',
  'mobile',
  'registeredState',
  'city',
  'postalCode',
] as const satisfies readonly OrbitEntityProfileFieldId[];

const commonOptionalFields = [
  'website',
  'bankProof',
  'udyamNumber',
] as const satisfies readonly OrbitEntityProfileFieldId[];

const companyOnlyFields = [
  'cin',
  'llpin',
  'directorsOrPartners',
  'llpAgreement',
  'certificateOfIncorporation',
  'registeredOfficeProof',
  'boardAuthorization',
  'roc',
  'dateOfIncorporation',
  'authorizedCapital',
  'paidUpCapital',
] as const satisfies readonly OrbitEntityProfileFieldId[];

const nonprofitOnlyFields = [
  'nonprofitRegistrationNumber',
  'nonprofitRegistrationAuthority',
  'ngoDarpanId',
  'taxExemption12A12ABNumber',
  'taxDeduction80GNumber',
  'fcraRegistrationNumber',
  'csrRegistrationNumber',
] as const satisfies readonly OrbitEntityProfileFieldId[];

export const ORBIT_ENTITY_PROFILE_DEFINITIONS: Record<OrbitEntityType, OrbitEntityProfileDefinition> = {
  freelancer_individual: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[0],
    requiredFields: [
      ...commonRequiredFields,
      'legalName',
      'displayName',
      'legalBillingAddress',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'pan',
      'gstin',
      'principalPlaceOfBusiness',
      'professionalRegistration',
    ],
    hiddenFields: [
      ...companyOnlyFields,
      ...nonprofitOnlyFields,
      'companyPan',
      'registeredOfficeAddress',
      'partnerList',
      'partnershipDeed',
      'authorizedSignatory',
    ],
    protectedFields: ['legalName', 'pan', 'gstin'],
    addressReasonFields: ['legalBillingAddress', 'principalPlaceOfBusiness'],
    documentTypes: ['PAN card', 'Identity proof', 'Address proof', 'GST certificate', 'Bank proof', 'Professional registration', 'Other'],
  },
  sole_proprietorship: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[1],
    requiredFields: [
      ...commonRequiredFields,
      'ownerName',
      'businessName',
      'pan',
      'principalPlaceOfBusiness',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'gstin',
      'additionalPlacesOfBusiness',
      'professionalRegistration',
    ],
    hiddenFields: [
      ...companyOnlyFields,
      ...nonprofitOnlyFields,
      'companyPan',
      'registeredOfficeAddress',
      'partnerList',
      'partnershipDeed',
    ],
    protectedFields: ['ownerName', 'pan', 'gstin'],
    addressReasonFields: ['principalPlaceOfBusiness', 'additionalPlacesOfBusiness'],
    documentTypes: ['Proprietor PAN', 'Address proof', 'GST certificate', 'Udyam certificate', 'Shop registration', 'Bank proof', 'Other'],
  },
  partnership_firm: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[2],
    requiredFields: [
      ...commonRequiredFields,
      'legalName',
      'businessName',
      'pan',
      'authorizedSignatory',
      'principalPlaceOfBusiness',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'gstin',
      'partnerList',
      'partnershipDeed',
      'additionalPlacesOfBusiness',
    ],
    hiddenFields: [
      ...companyOnlyFields,
      ...nonprofitOnlyFields,
      'companyPan',
      'registeredOfficeAddress',
      'llpin',
    ],
    protectedFields: ['legalName', 'pan', 'gstin'],
    addressReasonFields: ['principalPlaceOfBusiness', 'additionalPlacesOfBusiness'],
    documentTypes: ['Partnership deed', 'Partner list', 'Firm PAN', 'Address proof', 'GST certificate', 'Authorization proof', 'Bank proof', 'Other'],
  },
  llp: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[3],
    requiredFields: [
      ...commonRequiredFields,
      'legalName',
      'llpin',
      'companyPan',
      'registeredOfficeAddress',
      'authorizedSignatory',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'gstin',
      'principalPlaceOfBusiness',
      'additionalPlacesOfBusiness',
      'llpAgreement',
      'roc',
    ],
    hiddenFields: [
      ...nonprofitOnlyFields,
      'cin',
      'partnerList',
      'partnershipDeed',
      'authorizedCapital',
      'paidUpCapital',
    ],
    protectedFields: ['legalName', 'llpin', 'companyPan', 'gstin'],
    addressReasonFields: ['registeredOfficeAddress', 'principalPlaceOfBusiness', 'additionalPlacesOfBusiness'],
    documentTypes: ['LLP incorporation certificate', 'LLP agreement', 'LLP PAN', 'Registered office proof', 'GST certificate', 'Authorization proof', 'Bank proof', 'Other'],
  },
  company: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[4],
    requiredFields: [
      ...commonRequiredFields,
      'legalName',
      'entitySubtype',
      'cin',
      'companyPan',
      'registeredOfficeAddress',
      'authorizedSignatory',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'gstin',
      'principalPlaceOfBusiness',
      'additionalPlacesOfBusiness',
      'directorsOrPartners',
      'certificateOfIncorporation',
      'registeredOfficeProof',
      'boardAuthorization',
      'roc',
      'dateOfIncorporation',
      'authorizedCapital',
      'paidUpCapital',
    ],
    hiddenFields: [
      ...nonprofitOnlyFields,
      'llpin',
      'partnerList',
      'partnershipDeed',
      'llpAgreement',
    ],
    protectedFields: ['legalName', 'cin', 'companyPan', 'gstin'],
    addressReasonFields: ['registeredOfficeAddress', 'principalPlaceOfBusiness', 'additionalPlacesOfBusiness'],
    documentTypes: ['Certificate of incorporation', 'Company PAN', 'Registered office proof', 'Board resolution', 'Authorized signatory proof', 'GST certificate', 'Bank proof', 'Other'],
  },
  nonprofit_charity: {
    ...ORBIT_ENTITY_TYPE_OPTIONS[5],
    requiredFields: [
      ...commonRequiredFields,
      'legalName',
      'entitySubtype',
      'pan',
      'nonprofitRegistrationNumber',
      'registeredOfficeAddress',
      'authorizedSignatory',
    ],
    optionalFields: [
      ...commonOptionalFields,
      'cin',
      'gstin',
      'principalPlaceOfBusiness',
      'nonprofitRegistrationAuthority',
      'ngoDarpanId',
      'taxExemption12A12ABNumber',
      'taxDeduction80GNumber',
      'fcraRegistrationNumber',
      'csrRegistrationNumber',
      'boardAuthorization',
    ],
    hiddenFields: [
      'llpin',
      'companyPan',
      'partnerList',
      'partnershipDeed',
      'llpAgreement',
      'authorizedCapital',
      'paidUpCapital',
    ],
    protectedFields: [
      'legalName',
      'pan',
      'nonprofitRegistrationNumber',
      'cin',
      'gstin',
      'taxExemption12A12ABNumber',
      'taxDeduction80GNumber',
      'fcraRegistrationNumber',
      'csrRegistrationNumber',
    ],
    addressReasonFields: ['registeredOfficeAddress', 'principalPlaceOfBusiness', 'additionalPlacesOfBusiness'],
    documentTypes: ['Trust deed', 'Society registration certificate', 'Section 8 incorporation certificate', 'NGO registration certificate', 'PAN proof', '12A / 12AB certificate', '80G certificate', 'FCRA registration', 'CSR-1 registration', 'Darpan proof', 'Address proof', 'Authorization proof', 'Bank proof', 'Other'],
  },
};

export function normalizeOrbitEntityProfile(input?: OrbitEntityProfileInput | null) {
  const entityType = normalizeEntityType(input?.entityType);
  const entitySubtype = normalizeEntitySubtype(entityType, input?.entitySubtype);
  const entityVerificationStatus = normalizeEntityVerificationStatus(input?.verificationStatus);
  const complianceFlags = normalizeEntityComplianceFlags(input?.complianceFlags);

  return {
    entityType,
    entitySubtype,
    entityVerificationStatus,
    complianceFlags,
  };
}

export function getOrbitEntityProfileDefinition(entityType?: OrbitEntityType | null) {
  return ORBIT_ENTITY_PROFILE_DEFINITIONS[normalizeEntityType(entityType)];
}

export function getRequiredOrbitEntityProfileFields(input?: OrbitEntityProfileInput | null) {
  const profile = normalizeOrbitEntityProfile(input);
  const definition = getOrbitEntityProfileDefinition(profile.entityType);
  const requiredFields = new Set<OrbitEntityProfileFieldId>(definition.requiredFields);

  if (profile.complianceFlags.gstRegistered) {
    requiredFields.add('gstin');
    requiredFields.add('principalPlaceOfBusiness');
  }
  if (profile.entityType === 'nonprofit_charity') {
    if (profile.entitySubtype === 'section_8_company') {
      requiredFields.add('cin');
    }
    if (profile.complianceFlags.has12A12AB) {
      requiredFields.add('taxExemption12A12ABNumber');
    }
    if (profile.complianceFlags.has80G || profile.complianceFlags.donationReceiptsEnabled) {
      requiredFields.add('taxDeduction80GNumber');
    }
    if (profile.complianceFlags.receivesForeignContribution || profile.complianceFlags.hasFcra) {
      requiredFields.add('fcraRegistrationNumber');
    }
    if (profile.complianceFlags.acceptsCsrFunding) {
      requiredFields.add('csrRegistrationNumber');
    }
  }

  return [...requiredFields];
}

export function getHiddenOrbitEntityProfileFields(input?: OrbitEntityProfileInput | null) {
  const profile = normalizeOrbitEntityProfile(input);
  const definition = getOrbitEntityProfileDefinition(profile.entityType);
  const hiddenFields = new Set<OrbitEntityProfileFieldId>(definition.hiddenFields);

  if (profile.entityType === 'nonprofit_charity' && profile.entitySubtype === 'section_8_company') {
    hiddenFields.delete('cin');
  }
  if (profile.complianceFlags.gstRegistered) {
    hiddenFields.delete('gstin');
    hiddenFields.delete('principalPlaceOfBusiness');
    hiddenFields.delete('additionalPlacesOfBusiness');
  }
  if (profile.entityType === 'nonprofit_charity') {
    if (!profile.complianceFlags.has12A12AB) {
      hiddenFields.add('taxExemption12A12ABNumber');
    }
    if (!profile.complianceFlags.has80G && !profile.complianceFlags.donationReceiptsEnabled) {
      hiddenFields.add('taxDeduction80GNumber');
    }
    if (!profile.complianceFlags.receivesForeignContribution && !profile.complianceFlags.hasFcra) {
      hiddenFields.add('fcraRegistrationNumber');
    }
    if (!profile.complianceFlags.acceptsCsrFunding) {
      hiddenFields.add('csrRegistrationNumber');
    }
  }

  return [...hiddenFields];
}

export function getProtectedOrbitEntityProfileFields(input?: OrbitEntityProfileInput | null) {
  const profile = normalizeOrbitEntityProfile(input);
  if (profile.entityVerificationStatus !== 'approved') {
    return [];
  }

  const definition = getOrbitEntityProfileDefinition(profile.entityType);
  const hiddenFields = new Set(getHiddenOrbitEntityProfileFields(profile));
  return definition.protectedFields.filter((field) => !hiddenFields.has(field));
}

export function isOrbitCompanyEntity(input?: OrbitEntityProfileInput | OrbitEntityType | null) {
  const entityType = typeof input === 'string' ? input : normalizeOrbitEntityProfile(input).entityType;
  return entityType === 'company';
}

export function isOrbitNonprofitEntity(input?: OrbitEntityProfileInput | OrbitEntityType | null) {
  const entityType = typeof input === 'string' ? input : normalizeOrbitEntityProfile(input).entityType;
  return entityType === 'nonprofit_charity';
}

export function doesOrbitEntityRequireCin(input?: OrbitEntityProfileInput | null) {
  const profile = normalizeOrbitEntityProfile(input);
  return profile.entityType === 'company' || (
    profile.entityType === 'nonprofit_charity' &&
    profile.entitySubtype === 'section_8_company'
  );
}

function normalizeEntityType(value?: OrbitEntityType | null): OrbitEntityType {
  return ORBIT_ENTITY_PROFILE_DEFINITIONS[value as OrbitEntityType]
    ? value as OrbitEntityType
    : DEFAULT_ORBIT_ENTITY_TYPE;
}

function normalizeEntitySubtype(
  entityType: OrbitEntityType,
  value?: OrbitEntitySubtype | null
): OrbitEntitySubtype | null {
  if (!value) {
    return entityType === 'company' ? 'private_limited' : entityType === 'nonprofit_charity' ? 'charitable_trust' : null;
  }

  const allowedSubtypes = ORBIT_ENTITY_PROFILE_DEFINITIONS[entityType].allowedSubtypes;
  return allowedSubtypes.includes(value) ? value : allowedSubtypes[0] ?? null;
}

function normalizeEntityVerificationStatus(
  value?: OrbitEntityVerificationStatus | null
): OrbitEntityVerificationStatus {
  return value === 'pending_review' ||
    value === 'approved' ||
    value === 'needs_updates' ||
    value === 'rejected'
    ? value
    : DEFAULT_ORBIT_ENTITY_VERIFICATION_STATUS;
}

function normalizeEntityComplianceFlags(
  flags?: Partial<OrbitEntityComplianceFlags> | null
): OrbitEntityComplianceFlags {
  return {
    ...DEFAULT_ORBIT_ENTITY_COMPLIANCE_FLAGS,
    ...(flags ?? {}),
  };
}
