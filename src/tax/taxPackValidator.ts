import type { SaveTaxPackInput, TaxPackSource } from '../database';

export type TaxPackValidationResult = {
  isValid: boolean;
  errors: string[];
  rules: Record<string, unknown> | null;
};

const taxPackSources: TaxPackSource[] = ['manual', 'remote'];

export function validateTaxPack(input: SaveTaxPackInput): TaxPackValidationResult {
  const errors: string[] = [];

  if (!input.countryCode.trim()) {
    errors.push('Country code is required.');
  }

  if (!input.taxType.trim()) {
    errors.push('Tax type is required.');
  }

  if (!input.version.trim()) {
    errors.push('Tax pack version is required.');
  }

  if (input.source && !taxPackSources.includes(input.source)) {
    errors.push('Tax pack source must be manual or remote.');
  }

  const rules = parseRules(input.rulesJson);
  if (!rules) {
    errors.push('Tax pack rules must be a valid JSON object.');
  } else if (Object.keys(rules).length === 0) {
    errors.push('Tax pack rules cannot be empty.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    rules,
  };
}

export function assertValidTaxPack(input: SaveTaxPackInput): Record<string, unknown> {
  const result = validateTaxPack(input);
  if (!result.isValid || !result.rules) {
    throw new Error(result.errors.join(' '));
  }

  return result.rules;
}

function parseRules(value: SaveTaxPackInput['rulesJson']): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(value) ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
