import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
} from '@orbit-ledger/contracts';
import {
  ORBIT_VERIFICATION_DOCUMENT_ACCEPT,
  getOrbitEntityVerificationDocuments,
  type OrbitVerificationDocumentCategory,
  type OrbitVerificationDocumentChecklistItem,
} from '@orbit-ledger/core';

export type WebEntityVerificationDocumentChecklistInput = {
  entityType?: OrbitEntityType | null;
  entitySubtype?: OrbitEntitySubtype | null;
  entityComplianceFlags?: Partial<OrbitEntityComplianceFlags> | null;
};

export type WebEntityVerificationDocumentRow = {
  id: string;
  label: string;
  description: string;
  categoryLabel: string;
  requirement: 'required' | 'optional';
  requirementLabel: string;
  acceptedFileSummary: string;
  maxSizeLabel: string;
};

export type WebEntityVerificationDocumentChecklist = {
  required: readonly WebEntityVerificationDocumentRow[];
  optional: readonly WebEntityVerificationDocumentRow[];
  acceptedFileSummary: string;
};

const CATEGORY_LABELS: Record<OrbitVerificationDocumentCategory, string> = {
  identity: 'Identity',
  address: 'Address',
  registration: 'Registration',
  authorization: 'Authorization',
  tax: 'Tax',
  gst: 'GST',
  nonprofit_tax: 'Nonprofit tax',
  foreign_contribution: 'Foreign contribution',
  csr: 'CSR',
  bank: 'Bank',
  professional: 'Professional',
  other: 'Other',
};

export function buildWebEntityVerificationDocumentChecklist(
  input: WebEntityVerificationDocumentChecklistInput
): WebEntityVerificationDocumentChecklist {
  const checklist = getOrbitEntityVerificationDocuments({
    entityType: input.entityType,
    entitySubtype: input.entitySubtype,
    complianceFlags: input.entityComplianceFlags,
  });

  return {
    required: checklist.required.map(toWebDocumentRow),
    optional: checklist.optional.map(toWebDocumentRow),
    acceptedFileSummary: ORBIT_VERIFICATION_DOCUMENT_ACCEPT,
  };
}

function toWebDocumentRow(item: OrbitVerificationDocumentChecklistItem): WebEntityVerificationDocumentRow {
  return {
    id: item.id,
    label: item.label,
    description: item.description,
    categoryLabel: CATEGORY_LABELS[item.category],
    requirement: item.requirement,
    requirementLabel: item.requirement === 'required' ? 'Required' : 'Optional',
    acceptedFileSummary: 'PDF, PNG, JPEG',
    maxSizeLabel: `${Math.round(item.maxBytes / (1024 * 1024))} MB`,
  };
}
