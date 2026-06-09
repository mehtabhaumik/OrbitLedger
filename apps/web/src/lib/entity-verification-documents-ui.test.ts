import { describe, expect, it } from 'vitest';

import { buildWebEntityVerificationDocumentChecklist } from './entity-verification-documents-ui';

describe('web entity verification document checklist', () => {
  it('returns freelancer documents without company proof', () => {
    const checklist = buildWebEntityVerificationDocumentChecklist({
      entityType: 'freelancer_individual',
    });

    expect(checklist.required.map((item) => item.id)).toEqual(
      expect.arrayContaining(['identity_proof', 'address_proof'])
    );
    expect([...checklist.required, ...checklist.optional].map((item) => item.id)).not.toContain(
      'company_incorporation_certificate'
    );
  });

  it('formats company document rows for the settings checklist', () => {
    const checklist = buildWebEntityVerificationDocumentChecklist({
      entityType: 'company',
      entitySubtype: 'private_limited',
      entityComplianceFlags: { gstRegistered: true },
    });

    expect(checklist.acceptedFileSummary).toBe('.pdf,.png,.jpg,.jpeg');
    expect(checklist.required).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'company_incorporation_certificate',
          categoryLabel: 'Registration',
          requirementLabel: 'Required',
          acceptedFileSummary: 'PDF, PNG, JPEG',
          maxSizeLabel: '10 MB',
        }),
        expect.objectContaining({
          id: 'gst_certificate',
          categoryLabel: 'GST',
        }),
      ])
    );
  });

  it('adds nonprofit compliance proof rows from enabled flags', () => {
    const checklist = buildWebEntityVerificationDocumentChecklist({
      entityType: 'nonprofit_charity',
      entitySubtype: 'section_8_company',
      entityComplianceFlags: {
        has12A12AB: true,
        has80G: true,
        hasFcra: true,
        acceptsCsrFunding: true,
      },
    });

    expect(checklist.required.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'section_8_incorporation_certificate',
        'twelve_a_12ab_certificate',
        'eighty_g_certificate',
        'fcra_registration',
        'csr_1_registration',
      ])
    );
  });
});
