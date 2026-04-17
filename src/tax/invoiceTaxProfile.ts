import { getDatabase, getBusinessSettings, type BusinessSettings } from '../database';

type AppPreferenceRow = {
  key: string;
  value: string;
  updated_at: string;
};

export type InvoiceTaxCountryMode = 'IN' | 'US' | 'GB' | 'OTHER';

export type InvoiceTaxProfile = {
  enabled: boolean;
  countryCode: string;
  regionCode: string;
  taxType: string;
  registrationStatus: string;
  taxRegistrationNumber: string | null;
  legalName: string | null;
  registeredAddress: string | null;
  defaultRate: number;
  defaultRateLabel: string;
  pricesIncludeTax: boolean;
  india?: {
    gstRegistrationType: 'unregistered' | 'regular' | 'composition';
    gstStateCode: string;
    defaultSupplyType: 'auto' | 'intra_state' | 'inter_state';
    hsnSacEnabled: boolean;
  };
  usa?: {
    registeredStates: string[];
    sellerPermitId: string | null;
    defaultCustomerTaxable: boolean;
    defaultItemsTaxable: boolean;
  };
  uk?: {
    vatScheme: 'standard' | 'flat_rate' | 'cash_accounting' | 'annual_accounting';
    showTaxPoint: boolean;
  };
  updatedAt: string;
};

export type SaveInvoiceTaxProfileInput = Omit<InvoiceTaxProfile, 'updatedAt'>;

const INVOICE_TAX_PROFILE_KEY_PREFIX = 'invoice_tax_profile';

export async function getInvoiceTaxProfile(
  businessSettings?: BusinessSettings | null
): Promise<InvoiceTaxProfile | null> {
  const settings = businessSettings ?? (await getBusinessSettings());
  if (!settings) {
    return null;
  }

  const stored = await getStoredInvoiceTaxProfile(settings.countryCode, settings.stateCode);
  return stored ?? buildDefaultInvoiceTaxProfile(settings);
}

export async function saveInvoiceTaxProfile(
  input: SaveInvoiceTaxProfileInput
): Promise<InvoiceTaxProfile> {
  const normalized = normalizeInvoiceTaxProfile({
    ...input,
    updatedAt: new Date().toISOString(),
  });
  assertValidInvoiceTaxProfile(normalized);
  await setPreference(buildInvoiceTaxProfileKey(normalized.countryCode, normalized.regionCode), JSON.stringify(normalized));
  return normalized;
}

export function buildDefaultInvoiceTaxProfile(settings: BusinessSettings): InvoiceTaxProfile {
  const mode = getInvoiceTaxCountryMode(settings.countryCode);
  const base = {
    enabled: false,
    countryCode: settings.countryCode.toUpperCase(),
    regionCode: settings.stateCode.toUpperCase(),
    taxRegistrationNumber: null,
    legalName: settings.businessName,
    registeredAddress: settings.address,
    pricesIncludeTax: false,
    updatedAt: new Date().toISOString(),
  };

  if (mode === 'IN') {
    return {
      ...base,
      taxType: 'GST',
      registrationStatus: 'unregistered',
      defaultRate: 18,
      defaultRateLabel: 'GST 18%',
      india: {
        gstRegistrationType: 'unregistered',
        gstStateCode: settings.stateCode.toUpperCase(),
        defaultSupplyType: 'auto',
        hsnSacEnabled: true,
      },
    };
  }

  if (mode === 'US') {
    return {
      ...base,
      taxType: 'Sales Tax',
      registrationStatus: 'manual',
      defaultRate: 0,
      defaultRateLabel: 'Manual sales tax',
      usa: {
        registeredStates: settings.stateCode ? [settings.stateCode.toUpperCase()] : [],
        sellerPermitId: null,
        defaultCustomerTaxable: true,
        defaultItemsTaxable: true,
      },
    };
  }

  if (mode === 'GB') {
    return {
      ...base,
      taxType: 'VAT',
      registrationStatus: 'not_registered',
      defaultRate: 20,
      defaultRateLabel: 'VAT standard 20%',
      uk: {
        vatScheme: 'standard',
        showTaxPoint: true,
      },
    };
  }

  return {
    ...base,
    taxType: 'Tax',
    registrationStatus: 'manual',
    defaultRate: 0,
    defaultRateLabel: 'Manual tax',
  };
}

export function getInvoiceTaxCountryMode(countryCode: string): InvoiceTaxCountryMode {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN' || normalized === 'US' || normalized === 'GB') {
    return normalized;
  }

  return 'OTHER';
}

export function getInvoiceTaxDocumentLabels(profile: InvoiceTaxProfile | null): {
  taxColumnLabel: string;
  taxSummaryLabel: string;
  taxRegistrationNumber: string | null;
  taxRegistrationLabel: string;
  taxSectionMessage: string;
  taxBreakdownMessage: string;
  taxBreakdownMode: 'india_intra_state' | 'india_inter_state' | 'us_sales_tax' | 'uk_vat' | 'generic';
  placeOfSupply: string | null;
  taxPointLabel: string | undefined;
  taxPointDate: string | null;
} {
  if (!profile?.enabled) {
    return {
      taxColumnLabel: 'Tax',
      taxSummaryLabel: 'Tax',
      taxRegistrationNumber: null,
      taxRegistrationLabel: 'Tax ID',
      taxSectionMessage: 'Invoice tax is not enabled for this business profile.',
      taxBreakdownMessage: 'Enable invoice tax setup when you need tax amounts on invoices.',
      taxBreakdownMode: 'generic',
      placeOfSupply: null,
      taxPointLabel: undefined,
      taxPointDate: null,
    };
  }

  if (profile.countryCode === 'IN') {
    const supplyType = profile.india?.defaultSupplyType === 'inter_state'
      ? 'india_inter_state'
      : 'india_intra_state';
    return {
      taxColumnLabel: 'GST',
      taxSummaryLabel: 'GST',
      taxRegistrationNumber: profile.taxRegistrationNumber,
      taxRegistrationLabel: 'GSTIN',
      taxSectionMessage:
        profile.india?.defaultSupplyType === 'inter_state'
          ? 'GST is applied as IGST for inter-state supply when selected.'
          : 'GST is applied from the saved invoice tax profile. Split CGST/SGST or IGST should be verified for the final supply location.',
      taxBreakdownMessage:
        'GST category, HSN/SAC, and place of supply can affect the final tax treatment. Verify category and rate if unsure.',
      taxBreakdownMode: supplyType,
      placeOfSupply: profile.regionCode || profile.india?.gstStateCode || null,
      taxPointLabel: undefined,
      taxPointDate: null,
    };
  }

  if (profile.countryCode === 'US') {
    return {
      taxColumnLabel: 'Sales tax',
      taxSummaryLabel: 'Sales tax',
      taxRegistrationNumber: profile.usa?.sellerPermitId ?? profile.taxRegistrationNumber,
      taxRegistrationLabel: 'Seller permit',
      taxSectionMessage:
        'Sales tax is applied from your saved manual or state tax setup.',
      taxBreakdownMessage:
        'US sales tax can vary by state and local jurisdiction. Verify the rate before sharing invoices.',
      taxBreakdownMode: 'us_sales_tax',
      placeOfSupply: profile.regionCode || profile.usa?.registeredStates[0] || null,
      taxPointLabel: undefined,
      taxPointDate: null,
    };
  }

  if (profile.countryCode === 'GB') {
    return {
      taxColumnLabel: 'VAT',
      taxSummaryLabel: 'VAT',
      taxRegistrationNumber: profile.taxRegistrationNumber,
      taxRegistrationLabel: 'VAT reg no.',
      taxSectionMessage:
        'VAT is applied from your saved invoice tax profile.',
      taxBreakdownMessage:
        'VAT category can vary by goods or service type. Verify reduced, zero, exempt, or out-of-scope treatment if unsure.',
      taxBreakdownMode: 'uk_vat',
      placeOfSupply: profile.regionCode || null,
      taxPointLabel: profile.uk?.showTaxPoint ? 'Tax point' : undefined,
      taxPointDate: null,
    };
  }

  return {
    taxColumnLabel: profile.taxType || 'Tax',
    taxSummaryLabel: profile.taxType || 'Tax',
    taxRegistrationNumber: profile.taxRegistrationNumber,
    taxRegistrationLabel: `${profile.taxType || 'Tax'} ID`,
    taxSectionMessage: `${profile.taxType || 'Tax'} is applied from your saved invoice tax profile.`,
    taxBreakdownMessage: 'Verify tax category and rate before sharing invoices.',
    taxBreakdownMode: 'generic',
    placeOfSupply: profile.regionCode || null,
    taxPointLabel: undefined,
    taxPointDate: null,
  };
}

function normalizeInvoiceTaxProfile(profile: InvoiceTaxProfile): InvoiceTaxProfile {
  const countryCode = profile.countryCode.trim().toUpperCase();
  const regionCode = profile.regionCode.trim().toUpperCase();
  return {
    ...profile,
    enabled: Boolean(profile.enabled),
    countryCode,
    regionCode,
    taxType: profile.taxType.trim(),
    registrationStatus: profile.registrationStatus.trim(),
    taxRegistrationNumber: cleanNullable(profile.taxRegistrationNumber)?.toUpperCase() ?? null,
    legalName: cleanNullable(profile.legalName),
    registeredAddress: cleanNullable(profile.registeredAddress),
    defaultRate: roundRate(profile.defaultRate),
    defaultRateLabel: profile.defaultRateLabel.trim() || profile.taxType.trim(),
    pricesIncludeTax: Boolean(profile.pricesIncludeTax),
    india:
      countryCode === 'IN'
        ? {
            gstRegistrationType: profile.india?.gstRegistrationType ?? 'unregistered',
            gstStateCode: (profile.india?.gstStateCode || regionCode).trim().toUpperCase(),
            defaultSupplyType: profile.india?.defaultSupplyType ?? 'auto',
            hsnSacEnabled: profile.india?.hsnSacEnabled ?? true,
          }
        : undefined,
    usa:
      countryCode === 'US'
        ? {
            registeredStates: (profile.usa?.registeredStates ?? [])
              .map((state) => state.trim().toUpperCase())
              .filter(Boolean),
            sellerPermitId: cleanNullable(profile.usa?.sellerPermitId),
            defaultCustomerTaxable: profile.usa?.defaultCustomerTaxable ?? true,
            defaultItemsTaxable: profile.usa?.defaultItemsTaxable ?? true,
          }
        : undefined,
    uk:
      countryCode === 'GB'
        ? {
            vatScheme: profile.uk?.vatScheme ?? 'standard',
            showTaxPoint: profile.uk?.showTaxPoint ?? true,
          }
        : undefined,
  };
}

function assertValidInvoiceTaxProfile(profile: InvoiceTaxProfile): void {
  if (!profile.countryCode) {
    throw new Error('Country is required for invoice tax setup.');
  }
  if (!profile.regionCode) {
    throw new Error('Region is required for invoice tax setup.');
  }
  if (!profile.taxType) {
    throw new Error('Tax type is required.');
  }
  if (!Number.isFinite(profile.defaultRate) || profile.defaultRate < 0 || profile.defaultRate > 100) {
    throw new Error('Default tax rate must be between 0 and 100.');
  }

  if (profile.enabled && profile.countryCode === 'IN' && profile.registrationStatus !== 'unregistered') {
    const gstin = profile.taxRegistrationNumber ?? '';
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      throw new Error('Enter a valid 15-character GSTIN.');
    }
  }

  if (profile.enabled && profile.countryCode === 'GB' && profile.registrationStatus === 'registered') {
    const vatNumber = profile.taxRegistrationNumber?.replace(/\s+/g, '') ?? '';
    if (!/^(GB)?[0-9]{9}([0-9]{3})?$/.test(vatNumber)) {
      throw new Error('Enter a valid UK VAT number.');
    }
  }
}

async function getStoredInvoiceTaxProfile(
  countryCode: string,
  regionCode: string
): Promise<InvoiceTaxProfile | null> {
  try {
    const raw = await getPreference(buildInvoiceTaxProfileKey(countryCode, regionCode));
    if (!raw) {
      return null;
    }

    return normalizeInvoiceTaxProfile(JSON.parse(raw) as InvoiceTaxProfile);
  } catch {
    return null;
  }
}

function buildInvoiceTaxProfileKey(countryCode: string, regionCode: string): string {
  return `${INVOICE_TAX_PROFILE_KEY_PREFIX}:${countryCode.trim().toUpperCase()}:${regionCode
    .trim()
    .toUpperCase()}`;
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT * FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}

function cleanNullable(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function roundRate(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
