import {
  getBusinessSettings,
  getCountryPackage,
  listTaxProfiles,
  type BusinessSettings,
  type TaxProfile,
} from '../database';
import { getInvoiceTaxProfile } from './invoiceTaxProfile';

const rateKeyHints = ['rate', 'taxRate', 'defaultRate', 'standardRate', 'percentage'];

export type ResolvedTaxRate = {
  rate: number;
  source: 'invoice_tax_profile' | 'country_package' | 'manual_profile' | 'none';
  label: string;
};

export type InvoiceItemTaxRateInput = {
  businessSettings?: BusinessSettings | null;
  itemName?: string | null;
};

export async function resolveDefaultInvoiceTaxRate(
  businessSettings?: BusinessSettings | null
): Promise<ResolvedTaxRate> {
  const settings = businessSettings ?? (await getBusinessSettings());
  if (!settings) {
    return noTaxRate();
  }

  if (settings.taxMode === 'not_configured') {
    return noTaxRate();
  }

  const invoiceTaxRate = await resolveRateFromInvoiceTaxProfile(settings);
  if (invoiceTaxRate) {
    return invoiceTaxRate;
  }

  const packageRate = await resolveRateFromCountryPackage(settings);
  if (packageRate) {
    return packageRate;
  }

  const manualRate = await resolveRateFromManualProfile(settings);
  return manualRate ?? noTaxRate();
}

export async function resolveInvoiceItemTaxRate(
  input: InvoiceItemTaxRateInput = {}
): Promise<ResolvedTaxRate> {
  const settings = input.businessSettings ?? (await getBusinessSettings());
  if (!settings) {
    return noTaxRate();
  }

  if (settings.taxMode === 'not_configured') {
    return noTaxRate();
  }

  const itemHint = input.itemName?.trim() || null;
  const invoiceTaxRate = await resolveRateFromInvoiceTaxProfile(settings, itemHint);
  if (invoiceTaxRate) {
    return invoiceTaxRate;
  }

  const packageRate = await resolveRateFromCountryPackage(settings, itemHint);
  if (packageRate) {
    return packageRate;
  }

  const manualRate = await resolveRateFromManualProfile(settings, itemHint);
  return manualRate ?? noTaxRate();
}

async function resolveRateFromInvoiceTaxProfile(
  settings: BusinessSettings,
  itemHint?: string | null
): Promise<ResolvedTaxRate | null> {
  const profile = await getInvoiceTaxProfile(settings);
  if (!profile?.enabled) {
    return null;
  }

  return {
    rate: profile.defaultRate,
    source: 'invoice_tax_profile',
    label: itemHint ? profile.defaultRateLabel : profile.taxType,
  };
}

async function resolveRateFromCountryPackage(
  settings: BusinessSettings,
  itemHint?: string | null
): Promise<ResolvedTaxRate | null> {
  const countryPackage = await getCountryPackage({
    countryCode: settings.countryCode,
    regionCode: settings.stateCode,
  });

  if (!countryPackage) {
    return null;
  }

  const resolvedRate = extractBestTaxRate(countryPackage.taxPack.rulesJson, itemHint);
  if (!resolvedRate) {
    return null;
  }

  return {
    rate: resolvedRate.rate,
    source: 'country_package',
    label: buildRateLabel(countryPackage.taxPack.taxType, resolvedRate),
  };
}

async function resolveRateFromManualProfile(
  settings: BusinessSettings,
  itemHint?: string | null
): Promise<ResolvedTaxRate | null> {
  const profiles = await listTaxProfiles(settings.countryCode, settings.stateCode);
  const selectedProfile = selectTaxProfile(settings, profiles);
  if (!selectedProfile) {
    return null;
  }

  const resolvedRate = extractBestTaxRate(selectedProfile.taxRulesJson, itemHint);
  if (!resolvedRate) {
    return null;
  }

  return {
    rate: resolvedRate.rate,
    source: 'manual_profile',
    label: buildRateLabel(selectedProfile.taxType, resolvedRate),
  };
}

function selectTaxProfile(
  settings: BusinessSettings,
  profiles: TaxProfile[]
): TaxProfile | null {
  if (!profiles.length) {
    return null;
  }

  return (
    profiles.find(
      (profile) =>
        profile.version === settings.taxProfileVersion ||
        (settings.taxMode === 'manual' && profile.source === 'manual')
    ) ??
    profiles.find((profile) => profile.source === 'manual') ??
    profiles[0] ??
    null
  );
}

type TaxRateMatch = {
  rate: number;
  label?: string;
  score: number;
};

function extractBestTaxRate(value: string, itemHint?: string | null): TaxRateMatch | null {
  const parsed = parseJson(value);
  if (!parsed) {
    return null;
  }

  const normalizedHint = normalizeSearchText(itemHint);
  const matches: TaxRateMatch[] = [];
  collectTaxRateMatches(parsed, normalizedHint, matches);

  if (!matches.length) {
    return null;
  }

  return matches.sort((a, b) => b.score - a.score)[0] ?? null;
}

function extractFirstTaxRate(value: string): number | null {
  return extractBestTaxRate(value)?.rate ?? null;
}

function findRateInValue(value: unknown, depth = 0): number | null {
  if (depth > 6) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const rate = findRateInValue(item, depth + 1);
      if (rate !== null) {
        return rate;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of rateKeyHints) {
    const rate = normalizeRate(value[key]);
    if (rate !== null) {
      return rate;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const rate = findRateInValue(nestedValue, depth + 1);
    if (rate !== null) {
      return rate;
    }
  }

  return null;
}

function collectTaxRateMatches(value: unknown, itemHint: string, matches: TaxRateMatch[], depth = 0) {
  if (depth > 6) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTaxRateMatches(item, itemHint, matches, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const rate = getRateFromRecord(value);
  if (rate !== null) {
    const searchableText = normalizeSearchText([
      value.id,
      value.label,
      value.name,
      value.category,
      value.appliesTo,
      value.taxType,
      value.type,
      value.description,
      value.keywords,
    ]);
    matches.push({
      rate,
      label: getTextLabel(value),
      score: scoreTaxRuleMatch(itemHint, searchableText),
    });
  }

  for (const nestedValue of Object.values(value)) {
    collectTaxRateMatches(nestedValue, itemHint, matches, depth + 1);
  }
}

function getRateFromRecord(value: Record<string, unknown>): number | null {
  for (const key of rateKeyHints) {
    const rate = normalizeRate(value[key]);
    if (rate !== null) {
      return rate;
    }
  }

  return null;
}

function normalizeRate(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim().replace(/%$/, ''))
        : NaN;
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

function scoreTaxRuleMatch(itemHint: string, searchableText: string): number {
  if (!itemHint || !searchableText) {
    return 0;
  }

  if (searchableText.includes(itemHint) || itemHint.includes(searchableText)) {
    return 4;
  }

  const hintWords = itemHint.split(' ').filter((word) => word.length >= 3);
  return hintWords.reduce(
    (score, word) => score + (searchableText.includes(word) ? 1 : 0),
    0
  );
}

function normalizeSearchText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(normalizeSearchText).filter(Boolean).join(' ');
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return '';
}

function getTextLabel(value: Record<string, unknown>): string | undefined {
  for (const key of ['label', 'name', 'category', 'appliesTo']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      return value[key].trim();
    }
  }

  return undefined;
}

function buildRateLabel(taxType: string, resolvedRate: TaxRateMatch): string {
  const base = resolvedRate.label ? `${taxType} ${resolvedRate.label}` : taxType;
  return `${base} ${formatRate(resolvedRate.rate)}`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function noTaxRate(): ResolvedTaxRate {
  return {
    rate: 0,
    source: 'none',
    label: 'No tax applied',
  };
}

function formatRate(rate: number): string {
  return `${Number.isInteger(rate) ? rate : rate.toFixed(3).replace(/\.?0+$/, '')}%`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
