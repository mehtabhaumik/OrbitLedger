export type WebAddressChangeField =
  | 'address'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'town'
  | 'postalCode'
  | 'stateCode'
  | 'registeredOfficeAddress'
  | 'principalPlaceOfBusiness'
  | 'additionalPlacesOfBusiness';

export type WebAddressChangeReasonId =
  | 'office_relocation'
  | 'registered_office_update'
  | 'gst_record_update'
  | 'mca_roc_record_update'
  | 'correction_of_typo'
  | 'billing_contact_update'
  | 'other';

export type WebAddressChangeReasonOption = {
  id: WebAddressChangeReasonId;
  label: string;
};

export type WebAddressChange = {
  field: WebAddressChangeField;
  label: string;
  previousValue: string | null;
  nextValue: string | null;
};

export type WebAddressChangeSource = Partial<Record<WebAddressChangeField, unknown>>;

export const WEB_ADDRESS_CHANGE_REASON_OPTIONS = [
  { id: 'office_relocation', label: 'Office relocation' },
  { id: 'registered_office_update', label: 'Registered office update' },
  { id: 'gst_record_update', label: 'GST record update' },
  { id: 'mca_roc_record_update', label: 'MCA / ROC record update' },
  { id: 'correction_of_typo', label: 'Correction of typo' },
  { id: 'billing_contact_update', label: 'Billing / contact update' },
  { id: 'other', label: 'Other' },
] as const satisfies readonly WebAddressChangeReasonOption[];

const addressFieldLabels: Record<WebAddressChangeField, string> = {
  address: 'Workspace address',
  addressLine1: 'Registered address line 1',
  addressLine2: 'Registered address line 2',
  city: 'Registered city',
  town: 'Registered town or village',
  postalCode: 'PIN or postcode',
  stateCode: 'State',
  registeredOfficeAddress: 'Registered office address',
  principalPlaceOfBusiness: 'Principal place of business',
  additionalPlacesOfBusiness: 'Additional places of business',
};

const addressFields = Object.keys(addressFieldLabels) as WebAddressChangeField[];

export function buildWorkspaceAddressChanges(
  previous: WebAddressChangeSource | null | undefined,
  next: WebAddressChangeSource | null | undefined
): WebAddressChange[] {
  const previousSource = previous ?? {};
  const nextSource = next ?? {};

  return addressFields
    .map((field) => {
      const previousValue = normalizeAddressValue(previousSource[field]);
      const nextValue = normalizeAddressValue(nextSource[field]);
      if (previousValue === nextValue) {
        return null;
      }

      return {
        field,
        label: addressFieldLabels[field],
        previousValue,
        nextValue,
      };
    })
    .filter((change): change is WebAddressChange => Boolean(change));
}

export function buildAddressChangeRequestKey(changes: readonly WebAddressChange[]) {
  return JSON.stringify(changes.map((change) => [
    change.field,
    change.previousValue,
    change.nextValue,
  ]));
}

export function summarizeAddressChanges(changes: readonly WebAddressChange[]) {
  if (!changes.length) {
    return 'No address changes.';
  }
  return changes.map((change) => change.label).join(', ');
}

export function isAddressChangeReasonComplete(
  reasonId: WebAddressChangeReasonId,
  otherReason: string
) {
  return reasonId !== 'other' || otherReason.trim().length >= 5;
}

export function formatAddressChangeAuditReason(
  reasonId: WebAddressChangeReasonId,
  otherReason: string,
  changes: readonly WebAddressChange[]
) {
  const option = WEB_ADDRESS_CHANGE_REASON_OPTIONS.find((entry) => entry.id === reasonId);
  const reason = reasonId === 'other' ? otherReason.trim() : option?.label ?? 'Address updated';
  return `Address change reason: ${reason}. Changed: ${summarizeAddressChanges(changes)}.`;
}

function normalizeAddressValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    const normalizedList = value
      .map((entry) => normalizeAddressValue(entry))
      .filter((entry): entry is string => Boolean(entry));
    return normalizedList.length ? normalizedList.join('\n') : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n');
  return normalized || null;
}
