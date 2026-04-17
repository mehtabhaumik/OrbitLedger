import type { SaveTaxPackInput, TaxPackLookup } from '../database';
import type { TaxPackUpdateCandidate, TaxPackUpdateProvider } from './taxPackService';

export const LOCAL_TAX_CATALOG_VERSION = '2026.04.1';
export const LOCAL_TAX_CATALOG_UPDATED_AT = '2026-04-13T00:00:00.000Z';

export const bundledTaxPackUpdateProvider: TaxPackUpdateProvider = {
  async checkLatestVersion(lookup) {
    return buildBundledTaxPackCandidate(lookup);
  },
  async fetchTaxPack(lookup, candidate) {
    return buildBundledTaxPack(lookup, candidate);
  },
};

export function buildBundledTaxPackCandidate(
  lookup: TaxPackLookup
): TaxPackUpdateCandidate {
  return {
    version: LOCAL_TAX_CATALOG_VERSION,
    lastUpdated: LOCAL_TAX_CATALOG_UPDATED_AT,
  };
}

export function buildBundledTaxPack(
  lookup: TaxPackLookup,
  candidate: TaxPackUpdateCandidate = buildBundledTaxPackCandidate(lookup)
): SaveTaxPackInput {
  const countryCode = normalizeCatalogCode(lookup.countryCode);
  const regionCode = normalizeCatalogCode(lookup.regionCode ?? '');
  const taxType = normalizeCatalogCode(lookup.taxType);
  const rate = inferBundledRate(countryCode, taxType);
  const reducedRate = inferBundledReducedRate(countryCode, taxType, rate);

  return {
    countryCode,
    regionCode,
    taxType,
    version: candidate.version,
    lastUpdated: candidate.lastUpdated ?? LOCAL_TAX_CATALOG_UPDATED_AT,
    source: 'remote',
    isActive: true,
    rulesJson: {
      provider: 'orbit_ledger_bundled_tax_catalog',
      providerMode: 'local_import',
      catalogVersion: LOCAL_TAX_CATALOG_VERSION,
      countryCode,
      regionCode,
      taxType,
      rules: [
        {
          id: 'standard',
          label: `${taxType} standard`,
          rate,
          keywords: ['standard', 'general', 'default'],
          appliesTo: 'standard',
          calculation: 'percentage',
        },
        {
          id: 'services',
          label: `${taxType} services`,
          rate,
          keywords: [
            'service',
            'services',
            'consulting',
            'consultancy',
            'repair',
            'maintenance',
            'design',
            'development',
            'professional',
            'labor',
            'labour',
            'hour',
          ],
          appliesTo: 'services',
          calculation: 'percentage',
        },
        {
          id: 'reduced_goods',
          label: `${taxType} reduced goods`,
          rate: reducedRate,
          keywords: [
            'food',
            'grocery',
            'grain',
            'medicine',
            'book',
            'essential',
            'reduced',
          ],
          appliesTo: 'reduced_goods',
          calculation: 'percentage',
        },
      ],
      offlineAvailable: true,
      notes:
        'Bundled starter tax pack for offline setup. Replace with an official online profile when available.',
    },
  };
}

export function inferTaxTypeForCountry(countryCode: string): string {
  const normalizedCountryCode = normalizeCatalogCode(countryCode);
  if (normalizedCountryCode === 'IN') {
    return 'GST';
  }

  return 'VAT';
}

export function normalizeCatalogCode(value: string): string {
  return value.trim().toUpperCase();
}

function inferBundledRate(countryCode: string, taxType: string): number {
  if (countryCode === 'IN' && taxType === 'GST') {
    return 18;
  }

  if (taxType === 'VAT') {
    return 20;
  }

  if (taxType.includes('SALES')) {
    return 8.25;
  }

  return 10;
}

function inferBundledReducedRate(countryCode: string, taxType: string, standardRate: number): number {
  if (countryCode === 'IN' && taxType === 'GST') {
    return 5;
  }

  if (taxType === 'VAT') {
    return Math.min(standardRate, 5);
  }

  return Math.min(standardRate, 5);
}
