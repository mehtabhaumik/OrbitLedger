import { INDIA_COUNTRY_OPTION, INDIA_STATE_OPTIONS, getIndiaCityOptions } from '@orbit-ledger/core';

export type CountryOption = {
  code: string;
  name: string;
  currency: string;
};

export type RegionOption = {
  code: string;
  name: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: INDIA_COUNTRY_OPTION.code, name: INDIA_COUNTRY_OPTION.name, currency: INDIA_COUNTRY_OPTION.currency },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
];

export const REGION_OPTIONS_BY_COUNTRY: Record<string, RegionOption[]> = {
  IN: INDIA_STATE_OPTIONS.map((state) => ({ code: state.code, name: state.name })),
  US: [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' },
  ],
  GB: [
    { code: 'ENG', name: 'England' },
    { code: 'SCT', name: 'Scotland' },
    { code: 'WLS', name: 'Wales' },
    { code: 'NIR', name: 'Northern Ireland' },
  ],
};

export function getCountryOption(countryCode: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find((country) => country.code === countryCode.toUpperCase());
}

export function getRegionOptions(countryCode: string): RegionOption[] {
  return REGION_OPTIONS_BY_COUNTRY[countryCode.toUpperCase()] ?? [];
}

export function getRegionOption(countryCode: string, regionCode: string): RegionOption | undefined {
  return getRegionOptions(countryCode).find((region) => region.code === regionCode.toUpperCase());
}

export function getDefaultRegionCode(countryCode: string): string {
  return getRegionOptions(countryCode)[0]?.code ?? '';
}

export function getCityOptions(countryCode: string, regionCode: string): string[] {
  if (countryCode.toUpperCase() === 'IN') {
    return getIndiaCityOptions(regionCode);
  }
  return [];
}

export function getDefaultCity(countryCode: string, regionCode: string): string {
  return getCityOptions(countryCode, regionCode)[0] ?? '';
}
