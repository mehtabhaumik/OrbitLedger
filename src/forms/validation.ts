import { z } from 'zod';

export const PERSON_NAME_PATTERN = /^[A-Za-z][A-Za-z\s.'-]*$/;
export const BUSINESS_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s&.,'()/-]*$/;
export const ADDRESS_TEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s#.,'()/-]*$/;
export const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,19}$/;
export const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;
export const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
export const REGION_CODE_PATTERN = /^[A-Z0-9-]{1,6}$/;
export const DECIMAL_2_PATTERN = /^\d+(\.\d{1,2})?$/;
export const DECIMAL_3_PATTERN = /^\d+(\.\d{1,3})?$/;
export const SIGNED_DECIMAL_2_PATTERN = /^-?\d+(\.\d{1,2})?$/;
export const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const personNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter ${label}.`)
    .regex(PERSON_NAME_PATTERN, `${capitalize(label)} can use letters, spaces, apostrophes, hyphens, and dots only.`);

export const businessNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter ${label}.`)
    .max(90, `${capitalize(label)} is too long.`)
    .regex(BUSINESS_NAME_PATTERN, `${capitalize(label)} can use letters, numbers, spaces, and simple business punctuation only.`);

export const optionalBusinessTextSchema = (label: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${capitalize(label)} is too long.`)
    .optional()
    .refine(
      (value) => !value || ADDRESS_TEXT_PATTERN.test(value),
      `${capitalize(label)} can use letters, numbers, spaces, and simple punctuation only.`
    );

export const requiredAddressLineSchema = z
  .string()
  .trim()
  .min(3, 'Enter address line 1.')
  .max(120, 'Address line 1 is too long.')
  .regex(ADDRESS_TEXT_PATTERN, 'Address line 1 can use letters, numbers, spaces, and simple punctuation only.');

export const optionalAddressLineSchema = optionalBusinessTextSchema('address line 2', 120);

export const requiredCitySchema = personNameSchema('city').max(60, 'City is too long.');

export const postalCodeSchema = z
  .string()
  .trim()
  .min(3, 'Enter postal code.')
  .max(12, 'Postal code is too long.')
  .regex(POSTAL_CODE_PATTERN, 'Enter a valid postal code.');

export const optionalPostalCodeSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || POSTAL_CODE_PATTERN.test(value), 'Enter a valid postal code.');

export const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number.')
  .max(20, 'Phone number is too long.')
  .regex(PHONE_PATTERN, 'Use digits and phone symbols only.');

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || PHONE_PATTERN.test(value), 'Use digits and phone symbols only.');

export const currencyCodeSchema = z
  .string()
  .trim()
  .regex(CURRENCY_CODE_PATTERN, 'Use a 3 letter currency code, for example INR.');

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(COUNTRY_CODE_PATTERN, 'Choose a valid country.');

export const regionCodeSchema = z
  .string()
  .trim()
  .regex(REGION_CODE_PATTERN, 'Choose a valid state or region.');

export const moneyInputSchema = z
  .string()
  .trim()
  .regex(DECIMAL_2_PATTERN, 'Enter a valid amount with up to 2 decimals.')
  .refine((value) => Number(value) > 0, 'Amount must be greater than zero.')
  .refine((value) => Number(value) <= 999999999.99, 'Amount is too large.');

export const signedMoneyInputSchema = z
  .string()
  .trim()
  .regex(SIGNED_DECIMAL_2_PATTERN, 'Enter a valid amount with up to 2 decimals.');

export const dateInputSchema = (label: string) =>
  z
    .string()
    .trim()
    .regex(DATE_INPUT_PATTERN, `Choose ${label}.`)
    .refine(isValidDateInput, `Choose a real ${label}.`);

export function getTodayDateInput(): string {
  const today = new Date();
  const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function getDateInputFromDate(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export function dateInputToDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function isValidDateInput(value: string): boolean {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return false;
  }

  const parsed = dateInputToDate(value);
  return !Number.isNaN(parsed.getTime()) && value === getDateInputFromDate(parsed);
}

export function isFutureDateInput(value: string): boolean {
  return value > getTodayDateInput();
}

export function normalizeDigitsAndPhoneSymbols(value: string): string {
  return value.replace(/[^\d+()\-\s]/g, '');
}

export function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
}

export function normalizeSignedDecimalInput(value: string): string {
  const isNegative = value.trim().startsWith('-');
  const normalized = normalizeDecimalInput(value);
  return isNegative ? `-${normalized}` : normalized;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
