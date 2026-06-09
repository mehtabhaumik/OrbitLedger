import { describe, expect, it } from 'vitest';

import {
  ORBIT_VERIFICATION_DOCUMENT_ACCEPT,
  ORBIT_VERIFICATION_DOCUMENT_UPLOAD_FIELDS,
  getOrbitEntityVerificationDocuments,
  validateOrbitVerificationDocumentFile,
} from './entityVerificationDocuments';

describe('entity verification documents', () => {
  it('keeps freelancer checklists free of company-only documents', () => {
    const checklist = getOrbitEntityVerificationDocuments({
      entityType: 'freelancer_individual',
    });
    const ids = checklist.all.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(['identity_proof', 'address_proof']));
    expect(ids).not.toEqual(expect.arrayContaining([
      'company_incorporation_certificate',
      'company_pan_proof',
      'registered_office_proof',
      'llp_incorporation_certificate',
    ]));
  });

  it('requires GST certificate and PAN proof for GST-registered freelancers', () => {
    const checklist = getOrbitEntityVerificationDocuments({
      entityType: 'freelancer_individual',
      complianceFlags: { gstRegistered: true },
    });

    expect(checklist.required.map((item) => item.id)).toEqual(
      expect.arrayContaining(['identity_proof', 'address_proof', 'pan_card', 'gst_certificate'])
    );
  });

  it('requires incorporation, PAN, office, and authorization proof for companies', () => {
    const checklist = getOrbitEntityVerificationDocuments({
      entityType: 'company',
      entitySubtype: 'private_limited',
      complianceFlags: { gstRegistered: true, hasUdyam: true },
    });

    expect(checklist.required.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'company_incorporation_certificate',
        'company_pan_proof',
        'registered_office_proof',
        'board_resolution',
        'authorized_signatory_proof',
        'gst_certificate',
        'udyam_certificate',
      ])
    );
  });

  it('uses LLP-specific proof without showing CIN-era company documents', () => {
    const checklist = getOrbitEntityVerificationDocuments({ entityType: 'llp' });
    const requiredIds = checklist.required.map((item) => item.id);
    const allIds = checklist.all.map((item) => item.id);

    expect(requiredIds).toEqual(
      expect.arrayContaining(['llp_incorporation_certificate', 'llp_agreement', 'pan_card'])
    );
    expect(allIds).not.toContain('company_incorporation_certificate');
  });

  it('changes nonprofit registration proof by subtype', () => {
    expect(getOrbitEntityVerificationDocuments({
      entityType: 'nonprofit_charity',
      entitySubtype: 'charitable_trust',
    }).required.map((item) => item.id)).toContain('trust_deed');

    expect(getOrbitEntityVerificationDocuments({
      entityType: 'nonprofit_charity',
      entitySubtype: 'registered_society',
    }).required.map((item) => item.id)).toContain('society_registration_certificate');

    expect(getOrbitEntityVerificationDocuments({
      entityType: 'nonprofit_charity',
      entitySubtype: 'section_8_company',
    }).required.map((item) => item.id)).toEqual(
      expect.arrayContaining(['section_8_incorporation_certificate', 'company_pan_proof'])
    );
  });

  it('adds nonprofit compliance documents only when the matching flags are enabled', () => {
    const checklist = getOrbitEntityVerificationDocuments({
      entityType: 'nonprofit_charity',
      entitySubtype: 'charitable_trust',
      complianceFlags: {
        donationReceiptsEnabled: true,
        has12A12AB: true,
        receivesForeignContribution: true,
        acceptsCsrFunding: true,
      },
    });

    expect(checklist.required.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'twelve_a_12ab_certificate',
        'eighty_g_certificate',
        'fcra_registration',
        'csr_1_registration',
      ])
    );
  });

  it('publishes required upload metadata fields for the vault phase', () => {
    expect(ORBIT_VERIFICATION_DOCUMENT_UPLOAD_FIELDS.map((field) => field.id)).toEqual([
      'documentName',
      'documentType',
      'documentCategory',
      'reasonToUpload',
      'file',
      'selfAttestation',
    ]);
    expect(ORBIT_VERIFICATION_DOCUMENT_UPLOAD_FIELDS.every((field) => field.required)).toBe(true);
  });

  it('allows only PDF, PNG, and JPEG up to ten MB', () => {
    expect(ORBIT_VERIFICATION_DOCUMENT_ACCEPT).toBe('.pdf,.png,.jpg,.jpeg');
    expect(validateOrbitVerificationDocumentFile({ type: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull();
    expect(validateOrbitVerificationDocumentFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateOrbitVerificationDocumentFile({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validateOrbitVerificationDocumentFile({ type: 'image/webp', size: 1024 })).toBe('Use a PDF, PNG, or JPEG file.');
    expect(validateOrbitVerificationDocumentFile({ type: 'application/pdf', size: 10 * 1024 * 1024 + 1 })).toBe(
      'Use a verification document smaller than 10 MB.'
    );
  });
});
