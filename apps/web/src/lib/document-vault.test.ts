import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM,
  WEB_DOCUMENT_VAULT_ATTESTATION_TEXT,
  buildDocumentVaultPayload,
  buildWebDocumentVaultTypeOptions,
  getWebDocumentVaultTypeOption,
  validateWebDocumentVaultUpload,
} from './document-vault';

describe('document vault', () => {
  it('builds entity-aware type options without company proof for freelancers', () => {
    const options = buildWebDocumentVaultTypeOptions({
      entityType: 'freelancer_individual',
    });

    expect(options.map((option) => option.id)).toEqual(
      expect.arrayContaining(['identity_proof', 'address_proof', 'other'])
    );
    expect(options.map((option) => option.id)).not.toContain('company_incorporation_certificate');
    expect(getWebDocumentVaultTypeOption(options, 'identity_proof')).toEqual(
      expect.objectContaining({
        category: 'identity',
        categoryLabel: 'Identity',
        requirement: 'required',
      })
    );
  });

  it('validates the required vault upload metadata and self-attestation', () => {
    const errors = validateWebDocumentVaultUpload({
      ...DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM,
      file: null,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        'Document name is required.',
        'Document type is required.',
        'Document category is required.',
        'Reason to upload is required.',
        'Self-attestation is required before upload.',
        'Choose a PDF, PNG, or JPEG file.',
      ])
    );
  });

  it('rejects unsupported file types and oversized verification documents', () => {
    expect(
      validateWebDocumentVaultUpload({
        documentName: 'Logo',
        documentType: 'other',
        documentCategory: 'other',
        reasonToUpload: 'Support asked for this proof.',
        selfAttestation: true,
        file: { name: 'logo.webp', type: 'image/webp', size: 512 } as File,
      })
    ).toContain('Use a PDF, PNG, or JPEG file.');

    expect(
      validateWebDocumentVaultUpload({
        documentName: 'PAN',
        documentType: 'pan_card',
        documentCategory: 'tax',
        reasonToUpload: 'Tax identity verification.',
        selfAttestation: true,
        file: { name: 'pan.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 } as File,
      })
    ).toContain('Use a verification document smaller than 10 MB.');
  });

  it('serializes immutable metadata for admin review and audit linkage', () => {
    const payload = buildDocumentVaultPayload({
      workspace: {
        workspaceId: 'workspace-1',
        entityType: 'nonprofit_charity',
        entitySubtype: 'charitable_trust',
      },
      actor: {
        uid: 'owner-1',
        email: 'owner@example.com',
      },
      form: {
        documentName: 'Trust deed',
        documentType: 'trust_deed',
        documentCategory: 'registration',
        reasonToUpload: 'Initial verification',
        selfAttestation: true,
      },
      file: {
        fileName: 'trust-deed.pdf',
        url: 'https://storage.example/trust-deed.pdf',
        storagePath: 'workspaces/workspace-1/documents/vault/doc-1/trust-deed.pdf',
        contentType: 'application/pdf',
        size: 1024,
      },
      timestamp: '2026-06-09T18:00:00.000Z',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        workspace_id: 'workspace-1',
        document_name: 'Trust deed',
        document_type: 'trust_deed',
        document_type_label: 'Trust deed',
        document_category: 'registration',
        document_category_label: 'Registration',
        reason_to_upload: 'Initial verification',
        self_attested: true,
        attestation_text: WEB_DOCUMENT_VAULT_ATTESTATION_TEXT,
        uploaded_by_uid: 'owner-1',
        uploaded_by_email: 'owner@example.com',
        entity_type: 'nonprofit_charity',
        entity_subtype: 'charitable_trust',
        verification_status: 'uploaded',
        linked_profile_revision_id: null,
      })
    );
  });
});
