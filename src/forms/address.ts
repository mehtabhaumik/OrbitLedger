export type AddressFormFields = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode?: string;
};

export function composeAddress(fields: AddressFormFields): string {
  return [
    fields.addressLine1.trim(),
    fields.addressLine2?.trim() ?? '',
    fields.city.trim(),
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
    addressLine2: lines.length > 3 ? lines.slice(1, -2).join(', ') : lines[1] ?? '',
    city: lines.length > 3 ? lines[lines.length - 2] : lines[2] ?? '',
    postalCode: lines.length > 3 ? lines[lines.length - 1] : lines[3] ?? '',
  };
}
