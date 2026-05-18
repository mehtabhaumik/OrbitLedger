export type AuditProtectedSettingsSource = {
  businessName?: string | null;
  legalName?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  town?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  placeOfSupply?: string | null;
  stateCode?: string | null;
  defaultTaxTreatment?: string | null;
  defaultPaymentTerms?: string | null;
  defaultDueDays?: number | null;
  defaultTaxRate?: number | null;
  defaultInvoiceTemplate?: string | null;
  defaultStatementTemplate?: string | null;
  invoiceNumberPrefix?: string | null;
  invoiceNumberSeparator?: string | null;
  invoiceNumberPadding?: number | null;
  invoiceNumberNextSequence?: number | null;
  documentFilenameFormat?: string | null;
  authorizedPersonName?: string | null;
  authorizedPersonTitle?: string | null;
  signatureUri?: string | null;
};

export type AuditProtectedSettingsChange = {
  field: keyof AuditProtectedSettingsSource;
  label: string;
  previousValue: string | null;
  nextValue: string | null;
  maskedPreviousValue: string | null;
  maskedNextValue: string | null;
};

const protectedSettingLabels: Record<keyof AuditProtectedSettingsSource, string> = {
  businessName: 'Business name',
  legalName: 'Legal name',
  address: 'Company address',
  addressLine1: 'Registered address line 1',
  addressLine2: 'Registered address line 2',
  city: 'Registered city',
  town: 'Registered town or village',
  postalCode: 'PIN or postcode',
  gstin: 'GSTIN',
  pan: 'PAN',
  taxNumber: 'Tax number',
  registrationNumber: 'Business registration number',
  placeOfSupply: 'Place of supply',
  stateCode: 'State',
  defaultTaxTreatment: 'Default tax treatment',
  defaultPaymentTerms: 'Default payment terms',
  defaultDueDays: 'Default due days',
  defaultTaxRate: 'Default tax rate',
  defaultInvoiceTemplate: 'Default invoice template',
  defaultStatementTemplate: 'Default statement template',
  invoiceNumberPrefix: 'Invoice number company code',
  invoiceNumberSeparator: 'Invoice number separator',
  invoiceNumberPadding: 'Invoice number sequence digits',
  invoiceNumberNextSequence: 'Next invoice sequence',
  documentFilenameFormat: 'Document filename format',
  authorizedPersonName: 'Authorized person',
  authorizedPersonTitle: 'Authorized person title',
  signatureUri: 'Signature',
};

const sensitiveProtectedFields = new Set<keyof AuditProtectedSettingsSource>([
  'gstin',
  'pan',
  'taxNumber',
  'registrationNumber',
  'signatureUri',
]);

export function buildAuditProtectedSettingsChanges(
  previous: AuditProtectedSettingsSource | null | undefined,
  next: AuditProtectedSettingsSource | null | undefined
): AuditProtectedSettingsChange[] {
  const previousSource = previous ?? {};
  const nextSource = next ?? {};

  return (Object.keys(protectedSettingLabels) as Array<keyof AuditProtectedSettingsSource>)
    .map((field) => {
      const previousValue = normalizeAuditValue(previousSource[field]);
      const nextValue = normalizeAuditValue(nextSource[field]);
      if (previousValue === nextValue) {
        return null;
      }

      return {
        field,
        label: protectedSettingLabels[field],
        previousValue,
        nextValue,
        maskedPreviousValue: maskProtectedSettingValue(field, previousValue),
        maskedNextValue: maskProtectedSettingValue(field, nextValue),
      };
    })
    .filter((change): change is AuditProtectedSettingsChange => Boolean(change));
}

export function summarizeAuditProtectedSettingsChanges(changes: AuditProtectedSettingsChange[]) {
  if (!changes.length) {
    return 'No protected setting changes.';
  }
  return changes.map((change) => change.label).join(', ');
}

function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function maskProtectedSettingValue(field: keyof AuditProtectedSettingsSource, value: string | null) {
  if (!value) {
    return null;
  }
  if (field === 'signatureUri') {
    return value.startsWith('http') ? 'Uploaded signature file' : 'Saved signature';
  }
  if (!sensitiveProtectedFields.has(field)) {
    return value;
  }
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return `${'*'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
}
