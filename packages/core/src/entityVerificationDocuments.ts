import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
} from '@orbit-ledger/contracts';

import {
  DEFAULT_ORBIT_ENTITY_COMPLIANCE_FLAGS,
  normalizeOrbitEntityProfile,
  type OrbitEntityProfileInput,
} from './entityProfile';

export type OrbitVerificationDocumentCategory =
  | 'identity'
  | 'address'
  | 'registration'
  | 'authorization'
  | 'tax'
  | 'gst'
  | 'nonprofit_tax'
  | 'foreign_contribution'
  | 'csr'
  | 'bank'
  | 'professional'
  | 'other';

export type OrbitVerificationDocumentRequirement = 'required' | 'optional';

export type OrbitVerificationDocumentTypeId =
  | 'pan_card'
  | 'identity_proof'
  | 'address_proof'
  | 'gst_certificate'
  | 'bank_proof'
  | 'udyam_certificate'
  | 'professional_registration'
  | 'shop_establishment_registration'
  | 'partnership_deed'
  | 'partner_list'
  | 'authorization_letter'
  | 'llp_incorporation_certificate'
  | 'llp_agreement'
  | 'company_incorporation_certificate'
  | 'company_pan_proof'
  | 'registered_office_proof'
  | 'board_resolution'
  | 'authorized_signatory_proof'
  | 'trust_deed'
  | 'society_registration_certificate'
  | 'section_8_incorporation_certificate'
  | 'ngo_registration_certificate'
  | 'nonprofit_pan_proof'
  | 'twelve_a_12ab_certificate'
  | 'eighty_g_certificate'
  | 'fcra_registration'
  | 'csr_1_registration'
  | 'darpan_proof'
  | 'other';

export type OrbitVerificationDocumentDefinition = {
  id: OrbitVerificationDocumentTypeId;
  label: string;
  category: OrbitVerificationDocumentCategory;
  description: string;
  acceptedMimeTypes: readonly string[];
  maxBytes: number;
};

export type OrbitVerificationDocumentChecklistItem = OrbitVerificationDocumentDefinition & {
  requirement: OrbitVerificationDocumentRequirement;
};

export type OrbitVerificationDocumentChecklist = {
  required: readonly OrbitVerificationDocumentChecklistItem[];
  optional: readonly OrbitVerificationDocumentChecklistItem[];
  all: readonly OrbitVerificationDocumentChecklistItem[];
};

export type OrbitVerificationDocumentUploadFieldId =
  | 'documentName'
  | 'documentType'
  | 'documentCategory'
  | 'reasonToUpload'
  | 'file'
  | 'selfAttestation';

export type OrbitVerificationDocumentUploadFieldDefinition = {
  id: OrbitVerificationDocumentUploadFieldId;
  label: string;
  required: true;
};

export type OrbitVerificationDocumentFileInput = {
  type?: string | null;
  size?: number | null;
};

export const ORBIT_VERIFICATION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ORBIT_VERIFICATION_DOCUMENT_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const ORBIT_VERIFICATION_DOCUMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg';

export const ORBIT_VERIFICATION_DOCUMENT_UPLOAD_FIELDS = [
  { id: 'documentName', label: 'Document name', required: true },
  { id: 'documentType', label: 'Document type', required: true },
  { id: 'documentCategory', label: 'Document category', required: true },
  { id: 'reasonToUpload', label: 'Reason to upload', required: true },
  { id: 'file', label: 'File', required: true },
  { id: 'selfAttestation', label: 'Self-attestation', required: true },
] as const satisfies readonly OrbitVerificationDocumentUploadFieldDefinition[];

const documentDefinitions = {
  pan_card: {
    id: 'pan_card',
    label: 'PAN card',
    category: 'tax',
    description: 'PAN proof for the individual, proprietor, firm, or registered entity.',
  },
  identity_proof: {
    id: 'identity_proof',
    label: 'Identity proof',
    category: 'identity',
    description: 'Government identity proof for the individual or authorized person.',
  },
  address_proof: {
    id: 'address_proof',
    label: 'Address proof',
    category: 'address',
    description: 'Proof for the legal, billing, or principal business address.',
  },
  gst_certificate: {
    id: 'gst_certificate',
    label: 'GST certificate',
    category: 'gst',
    description: 'GST registration certificate for GST-enabled workspaces.',
  },
  bank_proof: {
    id: 'bank_proof',
    label: 'Bank proof',
    category: 'bank',
    description: 'Cancelled cheque, bank letter, or account proof for payout verification.',
  },
  udyam_certificate: {
    id: 'udyam_certificate',
    label: 'Udyam certificate',
    category: 'registration',
    description: 'MSME/Udyam registration proof when Udyam is enabled.',
  },
  professional_registration: {
    id: 'professional_registration',
    label: 'Professional registration',
    category: 'professional',
    description: 'Professional license or membership proof, if applicable.',
  },
  shop_establishment_registration: {
    id: 'shop_establishment_registration',
    label: 'Shop & establishment registration',
    category: 'registration',
    description: 'Local establishment registration proof, if applicable.',
  },
  partnership_deed: {
    id: 'partnership_deed',
    label: 'Partnership deed',
    category: 'registration',
    description: 'Executed partnership deed or firm constitution proof.',
  },
  partner_list: {
    id: 'partner_list',
    label: 'Partner list',
    category: 'authorization',
    description: 'Current partner or stakeholder list for firm verification.',
  },
  authorization_letter: {
    id: 'authorization_letter',
    label: 'Authorization letter',
    category: 'authorization',
    description: 'Proof that the workspace signatory can act for the entity.',
  },
  llp_incorporation_certificate: {
    id: 'llp_incorporation_certificate',
    label: 'LLP incorporation certificate',
    category: 'registration',
    description: 'Certificate of incorporation for the LLP.',
  },
  llp_agreement: {
    id: 'llp_agreement',
    label: 'LLP agreement',
    category: 'registration',
    description: 'LLP agreement or current deed of partners.',
  },
  company_incorporation_certificate: {
    id: 'company_incorporation_certificate',
    label: 'Certificate of incorporation',
    category: 'registration',
    description: 'Company incorporation certificate containing legal identity details.',
  },
  company_pan_proof: {
    id: 'company_pan_proof',
    label: 'Company PAN proof',
    category: 'tax',
    description: 'PAN proof issued for the company or Section 8 company.',
  },
  registered_office_proof: {
    id: 'registered_office_proof',
    label: 'Registered office proof',
    category: 'address',
    description: 'Proof for the registered office or registered principal address.',
  },
  board_resolution: {
    id: 'board_resolution',
    label: 'Board resolution',
    category: 'authorization',
    description: 'Board resolution or equivalent authorization for the signatory.',
  },
  authorized_signatory_proof: {
    id: 'authorized_signatory_proof',
    label: 'Authorized signatory proof',
    category: 'authorization',
    description: 'Identity or authority proof for the authorized signatory.',
  },
  trust_deed: {
    id: 'trust_deed',
    label: 'Trust deed',
    category: 'registration',
    description: 'Trust deed or trust registration proof.',
  },
  society_registration_certificate: {
    id: 'society_registration_certificate',
    label: 'Society registration certificate',
    category: 'registration',
    description: 'Registration certificate for a society or association.',
  },
  section_8_incorporation_certificate: {
    id: 'section_8_incorporation_certificate',
    label: 'Section 8 incorporation certificate',
    category: 'registration',
    description: 'Incorporation certificate for a Section 8 nonprofit company.',
  },
  ngo_registration_certificate: {
    id: 'ngo_registration_certificate',
    label: 'NGO / charity registration',
    category: 'registration',
    description: 'Registration proof for NGO, voluntary, religious, or charity organizations.',
  },
  nonprofit_pan_proof: {
    id: 'nonprofit_pan_proof',
    label: 'Organization PAN proof',
    category: 'tax',
    description: 'PAN proof issued to the nonprofit or charity organization.',
  },
  twelve_a_12ab_certificate: {
    id: 'twelve_a_12ab_certificate',
    label: '12A / 12AB certificate',
    category: 'nonprofit_tax',
    description: 'Income-tax exemption registration proof.',
  },
  eighty_g_certificate: {
    id: 'eighty_g_certificate',
    label: '80G certificate',
    category: 'nonprofit_tax',
    description: 'Donor tax deduction approval proof.',
  },
  fcra_registration: {
    id: 'fcra_registration',
    label: 'FCRA registration / permission',
    category: 'foreign_contribution',
    description: 'FCRA registration or prior-permission proof for foreign contribution.',
  },
  csr_1_registration: {
    id: 'csr_1_registration',
    label: 'CSR-1 registration',
    category: 'csr',
    description: 'CSR registration proof for CSR-funded nonprofit work.',
  },
  darpan_proof: {
    id: 'darpan_proof',
    label: 'NGO Darpan proof',
    category: 'registration',
    description: 'NGO Darpan registration proof, if used by the organization.',
  },
  other: {
    id: 'other',
    label: 'Other supporting document',
    category: 'other',
    description: 'Additional verification proof requested by support or admin.',
  },
} as const satisfies Record<OrbitVerificationDocumentTypeId, Omit<OrbitVerificationDocumentDefinition, 'acceptedMimeTypes' | 'maxBytes'>>;

type MutableChecklistItem = {
  id: OrbitVerificationDocumentTypeId;
  requirement: OrbitVerificationDocumentRequirement;
};

export const ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS = (
  Object.keys(documentDefinitions) as OrbitVerificationDocumentTypeId[]
).reduce((definitions, id) => {
  definitions[id] = {
    ...documentDefinitions[id],
    acceptedMimeTypes: ORBIT_VERIFICATION_DOCUMENT_ACCEPTED_MIME_TYPES,
    maxBytes: ORBIT_VERIFICATION_DOCUMENT_MAX_BYTES,
  };
  return definitions;
}, {} as Record<OrbitVerificationDocumentTypeId, OrbitVerificationDocumentDefinition>);

export function getOrbitEntityVerificationDocuments(
  input?: OrbitEntityProfileInput | null
): OrbitVerificationDocumentChecklist {
  const profile = normalizeOrbitEntityProfile(input);
  const complianceFlags = {
    ...DEFAULT_ORBIT_ENTITY_COMPLIANCE_FLAGS,
    ...profile.complianceFlags,
  };
  const items = new Map<OrbitVerificationDocumentTypeId, OrbitVerificationDocumentRequirement>();

  for (const item of getBaseDocuments(profile.entityType, profile.entitySubtype)) {
    setDocumentRequirement(items, item);
  }
  for (const item of getComplianceDocuments(profile.entityType, complianceFlags)) {
    setDocumentRequirement(items, item);
  }

  setDocumentRequirement(items, { id: 'bank_proof', requirement: 'optional' });
  setDocumentRequirement(items, { id: 'other', requirement: 'optional' });

  const all = [...items.entries()].map(([id, requirement]) => ({
    ...ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS[id],
    requirement,
  }));

  return {
    required: all.filter((item) => item.requirement === 'required'),
    optional: all.filter((item) => item.requirement === 'optional'),
    all,
  };
}

export function validateOrbitVerificationDocumentFile(file: OrbitVerificationDocumentFileInput) {
  const type = file.type ?? '';
  if (!ORBIT_VERIFICATION_DOCUMENT_ACCEPTED_MIME_TYPES.includes(type as typeof ORBIT_VERIFICATION_DOCUMENT_ACCEPTED_MIME_TYPES[number])) {
    return 'Use a PDF, PNG, or JPEG file.';
  }

  if ((file.size ?? 0) > ORBIT_VERIFICATION_DOCUMENT_MAX_BYTES) {
    return 'Use a verification document smaller than 10 MB.';
  }

  return null;
}

function getBaseDocuments(
  entityType: OrbitEntityType,
  entitySubtype: OrbitEntitySubtype | null
): readonly MutableChecklistItem[] {
  if (entityType === 'freelancer_individual') {
    return [
      { id: 'identity_proof', requirement: 'required' },
      { id: 'address_proof', requirement: 'required' },
      { id: 'pan_card', requirement: 'optional' },
      { id: 'professional_registration', requirement: 'optional' },
    ];
  }

  if (entityType === 'sole_proprietorship') {
    return [
      { id: 'pan_card', requirement: 'required' },
      { id: 'address_proof', requirement: 'required' },
      { id: 'shop_establishment_registration', requirement: 'optional' },
    ];
  }

  if (entityType === 'partnership_firm') {
    return [
      { id: 'partnership_deed', requirement: 'required' },
      { id: 'partner_list', requirement: 'required' },
      { id: 'pan_card', requirement: 'required' },
      { id: 'address_proof', requirement: 'required' },
      { id: 'authorization_letter', requirement: 'required' },
    ];
  }

  if (entityType === 'llp') {
    return [
      { id: 'llp_incorporation_certificate', requirement: 'required' },
      { id: 'llp_agreement', requirement: 'required' },
      { id: 'pan_card', requirement: 'required' },
      { id: 'registered_office_proof', requirement: 'required' },
      { id: 'authorization_letter', requirement: 'required' },
    ];
  }

  if (entityType === 'company') {
    return [
      { id: 'company_incorporation_certificate', requirement: 'required' },
      { id: 'company_pan_proof', requirement: 'required' },
      { id: 'registered_office_proof', requirement: 'required' },
      { id: 'board_resolution', requirement: 'required' },
      { id: 'authorized_signatory_proof', requirement: 'required' },
    ];
  }

  return getNonprofitBaseDocuments(entitySubtype);
}

function getNonprofitBaseDocuments(entitySubtype: OrbitEntitySubtype | null): readonly MutableChecklistItem[] {
  if (entitySubtype === 'section_8_company') {
    return [
      { id: 'section_8_incorporation_certificate', requirement: 'required' },
      { id: 'company_pan_proof', requirement: 'required' },
      { id: 'registered_office_proof', requirement: 'required' },
      { id: 'board_resolution', requirement: 'required' },
      { id: 'authorized_signatory_proof', requirement: 'required' },
      { id: 'darpan_proof', requirement: 'optional' },
    ];
  }

  const registrationDocument =
    entitySubtype === 'registered_society'
      ? 'society_registration_certificate'
      : entitySubtype === 'charitable_trust'
        ? 'trust_deed'
        : 'ngo_registration_certificate';

  return [
    { id: registrationDocument, requirement: 'required' },
    { id: 'nonprofit_pan_proof', requirement: 'required' },
    { id: 'address_proof', requirement: 'required' },
    { id: 'authorization_letter', requirement: 'required' },
    { id: 'darpan_proof', requirement: 'optional' },
  ];
}

function getComplianceDocuments(
  entityType: OrbitEntityType,
  complianceFlags: OrbitEntityComplianceFlags
): readonly MutableChecklistItem[] {
  const items: MutableChecklistItem[] = [];

  if (complianceFlags.gstRegistered) {
    items.push({ id: 'gst_certificate', requirement: 'required' });
    if (entityType === 'freelancer_individual') {
      items.push({ id: 'pan_card', requirement: 'required' });
    }
  }
  if (complianceFlags.hasUdyam && entityType !== 'freelancer_individual') {
    items.push({ id: 'udyam_certificate', requirement: 'required' });
  }
  if (entityType === 'nonprofit_charity') {
    if (complianceFlags.has12A12AB) {
      items.push({ id: 'twelve_a_12ab_certificate', requirement: 'required' });
    }
    if (complianceFlags.has80G || complianceFlags.donationReceiptsEnabled) {
      items.push({ id: 'eighty_g_certificate', requirement: 'required' });
    }
    if (complianceFlags.receivesForeignContribution || complianceFlags.hasFcra) {
      items.push({ id: 'fcra_registration', requirement: 'required' });
    }
    if (complianceFlags.acceptsCsrFunding) {
      items.push({ id: 'csr_1_registration', requirement: 'required' });
    }
  }

  return items;
}

function setDocumentRequirement(
  items: Map<OrbitVerificationDocumentTypeId, OrbitVerificationDocumentRequirement>,
  item: MutableChecklistItem
) {
  const current = items.get(item.id);
  if (current === 'required') {
    return;
  }
  items.set(item.id, item.requirement);
}
