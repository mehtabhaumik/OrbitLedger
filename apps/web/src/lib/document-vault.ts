'use client';

import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
  OrbitWorkspaceSummary,
} from '@orbit-ledger/contracts';
import {
  ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS,
  getOrbitEntityVerificationDocuments,
  type OrbitVerificationDocumentCategory,
  type OrbitVerificationDocumentTypeId,
} from '@orbit-ledger/core';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type FieldValue,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';
import {
  uploadWorkspaceVerificationDocument,
  validateWorkspaceVerificationDocumentFile,
} from './workspace-storage';

export type WebDocumentVaultCategoryOption = {
  id: OrbitVerificationDocumentCategory;
  label: string;
};

export type WebDocumentVaultTypeOption = {
  id: OrbitVerificationDocumentTypeId;
  label: string;
  category: OrbitVerificationDocumentCategory;
  categoryLabel: string;
  requirement: 'required' | 'optional';
};

export type WebDocumentVaultUploadForm = {
  documentName: string;
  documentType: OrbitVerificationDocumentTypeId | '';
  documentCategory: OrbitVerificationDocumentCategory | '';
  reasonToUpload: string;
  selfAttestation: boolean;
};

export type WebDocumentVaultUploadInput = WebDocumentVaultUploadForm & {
  file: File | null;
};

export type WebDocumentVaultUploadActor = {
  uid: string;
  email?: string | null;
};

export type WebDocumentVaultRecord = {
  id: string;
  workspaceId: string;
  documentName: string;
  documentType: OrbitVerificationDocumentTypeId;
  documentTypeLabel: string;
  documentCategory: OrbitVerificationDocumentCategory;
  documentCategoryLabel: string;
  reasonToUpload: string;
  selfAttested: boolean;
  attestationText: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  uploadedByUid: string;
  uploadedByEmail: string | null;
  uploadedAt: string | null;
  entityType: OrbitEntityType;
  entitySubtype: OrbitEntitySubtype | null;
  verificationStatus: 'uploaded' | 'pending_review' | 'verified' | 'rejected';
  linkedProfileRevisionId: string | null;
};

type VaultRecordPayload = {
  workspace_id: string;
  document_name: string;
  document_type: OrbitVerificationDocumentTypeId;
  document_type_label: string;
  document_category: OrbitVerificationDocumentCategory;
  document_category_label: string;
  reason_to_upload: string;
  self_attested: boolean;
  attestation_text: string;
  file_name: string;
  content_type: string;
  size: number;
  storage_path: string;
  download_url: string;
  uploaded_by_uid: string;
  uploaded_by_email: string | null;
  uploaded_at: string | FieldValue;
  created_at: string | FieldValue;
  updated_at: string | FieldValue;
  entity_type: OrbitEntityType;
  entity_subtype: OrbitEntitySubtype | null;
  verification_status: 'uploaded' | 'pending_review' | 'verified' | 'rejected';
  linked_profile_revision_id: string | null;
};

export const WEB_DOCUMENT_VAULT_ATTESTATION_TEXT =
  'I confirm this document is legal, authentic, correct, and I am authorized to upload it.';

export const WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS: readonly WebDocumentVaultCategoryOption[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'address', label: 'Address' },
  { id: 'registration', label: 'Registration' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'tax', label: 'Tax' },
  { id: 'gst', label: 'GST' },
  { id: 'nonprofit_tax', label: 'Nonprofit tax' },
  { id: 'foreign_contribution', label: 'Foreign contribution' },
  { id: 'csr', label: 'CSR' },
  { id: 'bank', label: 'Bank' },
  { id: 'professional', label: 'Professional' },
  { id: 'other', label: 'Other' },
];

const CATEGORY_LABELS = WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS.reduce((labels, option) => {
  labels[option.id] = option.label;
  return labels;
}, {} as Record<OrbitVerificationDocumentCategory, string>);

export const DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM: WebDocumentVaultUploadForm = {
  documentName: '',
  documentType: '',
  documentCategory: '',
  reasonToUpload: '',
  selfAttestation: false,
};

export function buildWebDocumentVaultTypeOptions(input: {
  entityType?: OrbitEntityType | null;
  entitySubtype?: OrbitEntitySubtype | null;
  entityComplianceFlags?: Partial<OrbitEntityComplianceFlags> | null;
}): WebDocumentVaultTypeOption[] {
  return getOrbitEntityVerificationDocuments({
    entityType: input.entityType,
    entitySubtype: input.entitySubtype,
    complianceFlags: input.entityComplianceFlags,
  }).all.map((item) => ({
    id: item.id,
    label: item.label,
    category: item.category,
    categoryLabel: CATEGORY_LABELS[item.category],
    requirement: item.requirement,
  }));
}

export function getWebDocumentVaultTypeOption(
  options: readonly WebDocumentVaultTypeOption[],
  documentType: string
) {
  return options.find((option) => option.id === documentType) ?? null;
}

export function validateWebDocumentVaultUpload(input: WebDocumentVaultUploadInput) {
  const errors: string[] = [];
  if (!input.documentName.trim()) {
    errors.push('Document name is required.');
  }
  if (!input.documentType) {
    errors.push('Document type is required.');
  } else if (!ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS[input.documentType]) {
    errors.push('Choose a supported document type.');
  }
  if (!input.documentCategory) {
    errors.push('Document category is required.');
  } else if (!CATEGORY_LABELS[input.documentCategory]) {
    errors.push('Choose a supported document category.');
  }
  if (!input.reasonToUpload.trim()) {
    errors.push('Reason to upload is required.');
  }
  if (!input.selfAttestation) {
    errors.push('Self-attestation is required before upload.');
  }
  if (!input.file) {
    errors.push('Choose a PDF, PNG, or JPEG file.');
  } else {
    const fileError = validateWorkspaceVerificationDocumentFile(input.file);
    if (fileError) {
      errors.push(fileError);
    }
  }
  return errors;
}

export async function listWorkspaceDocumentVault(workspaceId: string): Promise<WebDocumentVaultRecord[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'document_vault'),
      orderBy('uploaded_at', 'desc'),
      limit(100)
    )
  );
  return snapshot.docs.map(mapDocumentVaultRecord);
}

export async function uploadWorkspaceDocumentVaultRecord(input: {
  workspace: OrbitWorkspaceSummary;
  actor: WebDocumentVaultUploadActor;
  form: WebDocumentVaultUploadForm;
  file: File;
}): Promise<WebDocumentVaultRecord> {
  const errors = validateWebDocumentVaultUpload({ ...input.form, file: input.file });
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const firestore = getWebFirestore();
  const vaultRef = doc(collection(firestore, 'workspaces', input.workspace.workspaceId, 'document_vault'));
  const typeDefinition = ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS[input.form.documentType as OrbitVerificationDocumentTypeId];
  const upload = await uploadWorkspaceVerificationDocument(input.workspace.workspaceId, vaultRef.id, input.file);
  const now = new Date().toISOString();
  const payload = buildDocumentVaultPayload({
    workspace: input.workspace,
    actor: input.actor,
    form: input.form as WebDocumentVaultUploadForm & {
      documentType: OrbitVerificationDocumentTypeId;
      documentCategory: OrbitVerificationDocumentCategory;
    },
    file: upload,
    documentTypeLabel: typeDefinition.label,
    documentCategoryLabel: CATEGORY_LABELS[input.form.documentCategory as OrbitVerificationDocumentCategory],
    timestamp: now,
  });

  await setDoc(vaultRef, {
    ...payload,
    uploaded_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return {
    id: vaultRef.id,
    workspaceId: payload.workspace_id,
    documentName: payload.document_name,
    documentType: payload.document_type,
    documentTypeLabel: payload.document_type_label,
    documentCategory: payload.document_category,
    documentCategoryLabel: payload.document_category_label,
    reasonToUpload: payload.reason_to_upload,
    selfAttested: payload.self_attested,
    attestationText: payload.attestation_text,
    fileName: payload.file_name,
    contentType: payload.content_type,
    size: payload.size,
    storagePath: payload.storage_path,
    downloadUrl: payload.download_url,
    uploadedByUid: payload.uploaded_by_uid,
    uploadedByEmail: payload.uploaded_by_email,
    uploadedAt: now,
    entityType: payload.entity_type,
    entitySubtype: payload.entity_subtype,
    verificationStatus: payload.verification_status,
    linkedProfileRevisionId: payload.linked_profile_revision_id,
  };
}

export function buildDocumentVaultPayload(input: {
  workspace: Pick<OrbitWorkspaceSummary, 'workspaceId' | 'entityType' | 'entitySubtype'>;
  actor: WebDocumentVaultUploadActor;
  form: WebDocumentVaultUploadForm & {
    documentType: OrbitVerificationDocumentTypeId;
    documentCategory: OrbitVerificationDocumentCategory;
  };
  file: {
    fileName: string;
    url: string;
    storagePath: string;
    contentType: string;
    size: number;
  };
  documentTypeLabel?: string | null;
  documentCategoryLabel?: string | null;
  timestamp: string;
}): VaultRecordPayload {
  const definition = ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS[input.form.documentType];
  return {
    workspace_id: input.workspace.workspaceId,
    document_name: input.form.documentName.trim(),
    document_type: input.form.documentType,
    document_type_label: input.documentTypeLabel || definition.label,
    document_category: input.form.documentCategory,
    document_category_label: input.documentCategoryLabel || CATEGORY_LABELS[input.form.documentCategory],
    reason_to_upload: input.form.reasonToUpload.trim(),
    self_attested: true,
    attestation_text: WEB_DOCUMENT_VAULT_ATTESTATION_TEXT,
    file_name: input.file.fileName,
    content_type: input.file.contentType,
    size: input.file.size,
    storage_path: input.file.storagePath,
    download_url: input.file.url,
    uploaded_by_uid: input.actor.uid,
    uploaded_by_email: input.actor.email ?? null,
    uploaded_at: input.timestamp,
    created_at: input.timestamp,
    updated_at: input.timestamp,
    entity_type: input.workspace.entityType ?? 'sole_proprietorship',
    entity_subtype: input.workspace.entitySubtype ?? null,
    verification_status: 'uploaded',
    linked_profile_revision_id: null,
  };
}

function mapDocumentVaultRecord(snapshot: QueryDocumentSnapshot<DocumentData>): WebDocumentVaultRecord {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    workspaceId: stringValue(data.workspace_id),
    documentName: stringValue(data.document_name),
    documentType: documentTypeValue(data.document_type),
    documentTypeLabel: stringValue(data.document_type_label),
    documentCategory: categoryValue(data.document_category),
    documentCategoryLabel: stringValue(data.document_category_label),
    reasonToUpload: stringValue(data.reason_to_upload),
    selfAttested: data.self_attested === true,
    attestationText: stringValue(data.attestation_text),
    fileName: stringValue(data.file_name),
    contentType: stringValue(data.content_type),
    size: typeof data.size === 'number' ? data.size : 0,
    storagePath: stringValue(data.storage_path),
    downloadUrl: stringValue(data.download_url),
    uploadedByUid: stringValue(data.uploaded_by_uid),
    uploadedByEmail: typeof data.uploaded_by_email === 'string' ? data.uploaded_by_email : null,
    uploadedAt: toIsoString(data.uploaded_at),
    entityType: entityTypeValue(data.entity_type),
    entitySubtype: typeof data.entity_subtype === 'string' ? (data.entity_subtype as OrbitEntitySubtype) : null,
    verificationStatus: verificationStatusValue(data.verification_status),
    linkedProfileRevisionId:
      typeof data.linked_profile_revision_id === 'string' ? data.linked_profile_revision_id : null,
  };
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function documentTypeValue(value: unknown): OrbitVerificationDocumentTypeId {
  return typeof value === 'string' && ORBIT_VERIFICATION_DOCUMENT_DEFINITIONS[value as OrbitVerificationDocumentTypeId]
    ? (value as OrbitVerificationDocumentTypeId)
    : 'other';
}

function categoryValue(value: unknown): OrbitVerificationDocumentCategory {
  return typeof value === 'string' && CATEGORY_LABELS[value as OrbitVerificationDocumentCategory]
    ? (value as OrbitVerificationDocumentCategory)
    : 'other';
}

function entityTypeValue(value: unknown): OrbitEntityType {
  if (
    value === 'freelancer_individual' ||
    value === 'sole_proprietorship' ||
    value === 'partnership_firm' ||
    value === 'llp' ||
    value === 'company' ||
    value === 'nonprofit_charity'
  ) {
    return value;
  }
  return 'sole_proprietorship';
}

function verificationStatusValue(value: unknown): WebDocumentVaultRecord['verificationStatus'] {
  if (value === 'pending_review' || value === 'verified' || value === 'rejected') {
    return value;
  }
  return 'uploaded';
}

function toIsoString(value: Timestamp | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}
