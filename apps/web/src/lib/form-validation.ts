'use client';

import { formatPhoneForLocalBusinessPack, getLocalPhoneExample } from '@orbit-ledger/core';

export function sanitizeDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidName(value: string) {
  const normalized = value.trim();
  if (normalized.length < 2) {
    return false;
  }
  // Names should be alphabetic with common separators only.
  return /^[A-Za-z]+(?:[A-Za-z '&,.-]*[A-Za-z])?$/.test(normalized);
}

export function validateName(value: string, label: string, required = true) {
  const normalized = value.trim();
  if (!normalized) {
    return required ? `${label} is required.` : null;
  }
  if (!isValidName(normalized)) {
    return `${label} must use letters only.`;
  }
  return null;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateEmail(value: string, required = false) {
  const normalized = value.trim();
  if (!normalized) {
    return required ? 'Email is required.' : null;
  }
  if (!isValidEmail(normalized)) {
    return 'Enter a valid email address.';
  }
  return null;
}

function getPhoneCountry(countryCode: string) {
  return countryCode.trim().toUpperCase() || 'IN';
}

export function normalizePhoneForCountry(countryCode: string, value: string) {
  return formatPhoneForLocalBusinessPack(getPhoneCountry(countryCode), value);
}

export function isValidPhoneForCountry(countryCode: string, value: string) {
  return normalizePhoneForCountry(countryCode, value) !== null;
}

export function validatePhone(value: string, countryCode: string, required = false) {
  const normalized = value.trim();
  if (!normalized) {
    return required ? 'Phone number is required.' : null;
  }

  if (!isValidPhoneForCountry(countryCode, normalized)) {
    return `Use a valid phone number (${getLocalPhoneExample(getPhoneCountry(countryCode))}).`;
  }

  return null;
}

export function parseAmount(value: string) {
  const trimmed = value.trim().replace(/[, ]+/g, '').replace(/[₹$£]/g, '');
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validatePositiveAmount(value: string, label = 'Amount') {
  const parsed = parseAmount(value);
  if (parsed === null) {
    return `${label} is required.`;
  }
  if (parsed <= 0) {
    return `${label} must be greater than 0.`;
  }
  return null;
}
