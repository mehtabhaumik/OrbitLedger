import type { OrbitEntitySubtype, OrbitEntityType, OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import { compactAddressParts, formatWorkspaceRegisteredAddress } from './workspace-address';

export type WorkspaceProfileView = {
  workspaceId: string;
  displayName: string;
  legalName: string;
  documentName: string;
  ownerName: string;
  entityLabel: string;
  entitySubtypeLabel: string | null;
  verificationStatusLabel: string;
  registeredAddress: string | null;
  businessAddress: string;
  principalPlaceOfBusiness: string | null;
  documentAddress: string;
  contactLine: string;
  taxIdentityLine: string;
  registrationIdentityLine: string;
  identityLine: string;
  logoAlt: string;
  initials: string;
  exportName: string;
  hasTaxProfile: boolean;
  hasProtectedIdentity: boolean;
};

const ENTITY_LABELS: Record<OrbitEntityType, string> = {
  freelancer_individual: 'Freelancer / Individual',
  sole_proprietorship: 'Sole Proprietorship',
  partnership_firm: 'Partnership Firm',
  llp: 'LLP',
  company: 'Company',
  nonprofit_charity: 'Nonprofit / Charity',
};

const SUBTYPE_LABELS: Partial<Record<OrbitEntitySubtype, string>> = {
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

export function buildWorkspaceProfileView(workspace: OrbitWorkspaceSummary): WorkspaceProfileView {
  const entityType = workspace.entityType ?? 'sole_proprietorship';
  const displayName = clean(workspace.businessName) ?? clean(workspace.legalName) ?? 'Orbit Ledger workspace';
  const legalName = clean(workspace.legalName) ?? displayName;
  const ownerName = clean(workspace.ownerName) ?? clean(workspace.contactPerson) ?? displayName;
  const documentName = legalName || displayName;
  const registeredAddress = formatRegisteredAddress(workspace);
  const principalPlaceOfBusiness = clean(workspace.principalPlaceOfBusiness);
  const businessAddress = principalPlaceOfBusiness ?? formatBusinessAddress(workspace);
  const documentAddress = registeredAddress ?? businessAddress;
  const taxIdentityLine = compactProfileParts([
    labelValue('GSTIN', workspace.gstin),
    labelValue(entityType === 'company' ? 'Company PAN' : 'PAN', workspace.pan),
    labelValue('Tax No.', workspace.taxNumber),
  ]).join(' | ');
  const registrationIdentityLine = compactProfileParts([
    labelValue('CIN', workspace.cin),
    labelValue('LLPIN', workspace.llpin),
    labelValue('Registration', workspace.registrationNumber),
    labelValue('Nonprofit Reg.', workspace.nonprofitRegistrationNumber),
    labelValue('Darpan', workspace.ngoDarpanId),
    labelValue('12A/12AB', workspace.taxExemption12A12ABNumber),
    labelValue('80G', workspace.taxDeduction80GNumber),
    labelValue('FCRA', workspace.fcraRegistrationNumber),
    labelValue('CSR-1', workspace.csrRegistrationNumber),
  ]).join(' | ');
  const identityLine = compactProfileParts([
    ENTITY_LABELS[entityType],
    workspace.entitySubtype ? SUBTYPE_LABELS[workspace.entitySubtype] : null,
    registrationIdentityLine,
    taxIdentityLine,
  ]).join(' | ');

  return {
    workspaceId: workspace.workspaceId,
    displayName,
    legalName,
    documentName,
    ownerName,
    entityLabel: ENTITY_LABELS[entityType],
    entitySubtypeLabel: workspace.entitySubtype ? SUBTYPE_LABELS[workspace.entitySubtype] ?? workspace.entitySubtype : null,
    verificationStatusLabel: humanize(workspace.entityVerificationStatus ?? 'draft'),
    registeredAddress,
    businessAddress,
    principalPlaceOfBusiness,
    documentAddress,
    contactLine: compactProfileParts([workspace.phone, workspace.email, workspace.website]).join(' | '),
    taxIdentityLine,
    registrationIdentityLine,
    identityLine,
    logoAlt: `${displayName} logo`,
    initials: initials(displayName),
    exportName: toExportName(displayName),
    hasTaxProfile: Boolean(workspace.gstin || workspace.pan || workspace.taxNumber || workspace.defaultTaxRate),
    hasProtectedIdentity: Boolean(workspace.cin || workspace.llpin || workspace.pan || workspace.gstin),
  };
}

export function getWorkspaceDisplayName(workspace: OrbitWorkspaceSummary | null | undefined): string {
  return workspace ? buildWorkspaceProfileView(workspace).displayName : 'Workspace';
}

export function getWorkspaceExportName(workspace: OrbitWorkspaceSummary | null | undefined): string {
  return workspace ? buildWorkspaceProfileView(workspace).exportName : 'workspace';
}

export function formatWorkspaceProfileDocumentAddress(workspace: OrbitWorkspaceSummary): string {
  return buildWorkspaceProfileView(workspace).documentAddress;
}

function formatRegisteredAddress(workspace: OrbitWorkspaceSummary): string | null {
  const registeredOffice = clean(workspace.registeredOfficeAddress);
  if (registeredOffice) {
    return registeredOffice;
  }
  return formatWorkspaceRegisteredAddress(workspace);
}

function formatBusinessAddress(workspace: OrbitWorkspaceSummary): string {
  const parts = compactAddressParts([
    workspace.address,
    workspace.town,
    workspace.city,
    workspace.stateCode,
    workspace.postalCode,
    workspace.countryCode,
  ]);
  return parts.length ? parts.join(', ') : 'Address not saved';
}

function labelValue(label: string, value: string | null | undefined): string | null {
  const cleaned = clean(value);
  return cleaned ? `${label}: ${cleaned}` : null;
}

function compactProfileParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return parts
    .map(clean)
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'not saved') {
    return null;
  }
  return trimmed;
}

function initials(value: string): string {
  const letters = value
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return letters || 'OL';
}

function toExportName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

function humanize(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
