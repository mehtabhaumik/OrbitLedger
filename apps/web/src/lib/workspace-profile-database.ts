import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import { buildWorkspaceProfileView } from './workspace-profile-view';

export type WorkspaceProfileDatabaseInput = Pick<
  OrbitWorkspaceSummary,
  | 'businessName'
  | 'legalName'
  | 'ownerName'
  | 'contactPerson'
  | 'entityType'
  | 'entitySubtype'
  | 'entityVerificationStatus'
  | 'phone'
  | 'email'
  | 'website'
  | 'address'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'town'
  | 'postalCode'
  | 'gstin'
  | 'pan'
  | 'cin'
  | 'llpin'
  | 'taxNumber'
  | 'registrationNumber'
  | 'registeredOfficeAddress'
  | 'principalPlaceOfBusiness'
  | 'nonprofitRegistrationNumber'
  | 'ngoDarpanId'
  | 'taxExemption12A12ABNumber'
  | 'taxDeduction80GNumber'
  | 'fcraRegistrationNumber'
  | 'csrRegistrationNumber'
  | 'currency'
  | 'countryCode'
  | 'stateCode'
>;

export function buildWorkspaceProfileDatabasePayload(input: WorkspaceProfileDatabaseInput) {
  const profile = buildWorkspaceProfileView({
    ...input,
    workspaceId: 'database-profile-preview',
    logoUri: null,
    authorizedPersonName: '',
    authorizedPersonTitle: '',
    signatureUri: null,
    paymentInstructions: {},
    dataState: 'profile_only',
  } as OrbitWorkspaceSummary);
  const searchTokens = buildProfileSearchTokens([
    profile.displayName,
    profile.legalName,
    profile.documentName,
    profile.ownerName,
    profile.entityLabel,
    profile.entitySubtypeLabel,
    profile.identityLine,
    profile.documentAddress,
    input.email,
    input.phone,
  ]);

  return {
    profile_summary_version: 1,
    profile_display_name: profile.displayName,
    profile_legal_name: profile.legalName,
    profile_document_name: profile.documentName,
    profile_owner_name: profile.ownerName,
    profile_entity_label: profile.entityLabel,
    profile_entity_subtype_label: profile.entitySubtypeLabel,
    profile_verification_status_label: profile.verificationStatusLabel,
    profile_registered_address: profile.registeredAddress,
    profile_business_address: profile.businessAddress,
    profile_principal_place_of_business: profile.principalPlaceOfBusiness,
    profile_document_address: profile.documentAddress,
    profile_contact_line: profile.contactLine,
    profile_tax_identity_line: profile.taxIdentityLine,
    profile_registration_identity_line: profile.registrationIdentityLine,
    profile_identity_line: profile.identityLine,
    profile_export_name: profile.exportName,
    profile_search_text: searchTokens.join(' '),
    profile_search_tokens: searchTokens,
    profile_has_tax_profile: profile.hasTaxProfile,
    profile_has_protected_identity: profile.hasProtectedIdentity,
  };
}

function buildProfileSearchTokens(parts: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    const normalized = part?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalized) {
      continue;
    }
    for (const token of normalized.split(/\s+/)) {
      if (token.length >= 2) {
        tokens.add(token);
      }
      if (tokens.size >= 48) {
        return [...tokens];
      }
    }
  }
  return [...tokens];
}
