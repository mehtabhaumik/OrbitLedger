import { describe, expect, it } from 'vitest';

import {
  buildAuditProtectedSettingsChanges,
  summarizeAuditProtectedSettingsChanges,
} from './audit-protected-settings';

describe('audit protected settings', () => {
  it('detects money and document-impacting setting changes', () => {
    const changes = buildAuditProtectedSettingsChanges(
      {
        businessName: 'Asha Traders',
        gstin: '24ABCDE1234F1Z5',
        defaultDueDays: 7,
        documentFilenameFormat: 'customer_invoice_date_revision_country',
      },
      {
        businessName: 'Asha Trading Co',
        gstin: '24ABCDE1234F9Z9',
        defaultDueDays: 15,
        documentFilenameFormat: 'invoice_customer_date',
      }
    );

    expect(changes.map((change) => change.field)).toEqual([
      'businessName',
      'gstin',
      'defaultDueDays',
      'documentFilenameFormat',
    ]);
    expect(changes.find((change) => change.field === 'gstin')?.maskedPreviousValue).toBe('********F1Z5');
    expect(summarizeAuditProtectedSettingsChanges(changes)).toBe(
      'Business name, GSTIN, Default due days, Document filename format'
    );
  });

  it('ignores unchanged normalized blank values', () => {
    expect(
      buildAuditProtectedSettingsChanges(
        {
          legalName: '',
          pan: null,
        },
        {
          legalName: '   ',
          pan: undefined,
        }
      )
    ).toEqual([]);
  });

  it('masks signature file changes without storing raw file URLs in audit summaries', () => {
    const changes = buildAuditProtectedSettingsChanges(
      { signatureUri: 'https://storage.example/old.png' },
      { signatureUri: 'https://storage.example/new.png' }
    );

    expect(changes[0]?.maskedPreviousValue).toBe('Uploaded signature file');
    expect(changes[0]?.maskedNextValue).toBe('Uploaded signature file');
  });

  it('tracks new identity compliance fields without exposing full registration values', () => {
    const changes = buildAuditProtectedSettingsChanges(
      {
        cin: 'U72900GJ2024PTC123456',
        fcraRegistrationNumber: 'FCRA-OLD-123456',
      },
      {
        cin: 'U72900GJ2024PTC654321',
        fcraRegistrationNumber: 'FCRA-NEW-654321',
      }
    );

    expect(changes.map((change) => change.label)).toEqual(['CIN', 'FCRA registration number']);
    expect(changes[0]?.maskedPreviousValue).toBe('********3456');
    expect(changes[1]?.maskedNextValue).toBe('********4321');
  });
});
