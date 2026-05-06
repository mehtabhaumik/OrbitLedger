export type AddressFormFields = {
  addressLine1: string;
  addressLine2?: string;
  town?: string;
  city: string;
  stateCode?: string;
  countryCode?: string;
  postalCode?: string;
};

export function composeAddress(fields: AddressFormFields): string {
  return [
    fields.addressLine1.trim(),
    fields.addressLine2?.trim() ?? '',
    fields.town?.trim() ?? '',
    fields.city.trim(),
    fields.stateCode?.trim() ?? '',
    fields.countryCode?.trim() ?? '',
    fields.postalCode?.trim() ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseAddress(address?: string | null): AddressFormFields {
  const lines = (address ?? '')
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    addressLine1: lines[0] ?? '',
    addressLine2: lines[1] ?? '',
    town: lines.length >= 6 ? lines[2] : '',
    city: lines.length >= 6 ? lines[3] : lines.length > 3 ? lines[lines.length - 2] : lines[2] ?? '',
    stateCode: lines.length >= 6 ? lines[4] : '',
    countryCode: lines.length >= 6 ? lines[5] : '',
    postalCode: lines.length >= 6 ? lines[6] ?? '' : lines.length > 3 ? lines[lines.length - 1] : lines[3] ?? '',
  };
}
