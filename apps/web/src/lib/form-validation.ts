'use client';

type PhoneFormatRule = {
  dialCode: string;
  nationalLength: number;
  displayExample: string;
  formatNational(digits: string): string;
};

const PHONE_RULES: Record<string, PhoneFormatRule> = {
  IN: {
    dialCode: '+91',
    nationalLength: 10,
    displayExample: '+91 98765 43210',
    formatNational(digits) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    },
  },
  US: {
    dialCode: '+1',
    nationalLength: 10,
    displayExample: '+1 415 555 0123',
    formatNational(digits) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    },
  },
  UK: {
    dialCode: '+44',
    nationalLength: 10,
    displayExample: '+44 7400 123456',
    formatNational(digits) {
      return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    },
  },
};

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

function getPhoneRule(countryCode: string) {
  const normalizedCode = countryCode.trim().toUpperCase();
  return PHONE_RULES[normalizedCode] ?? PHONE_RULES.IN;
}

export function normalizePhoneForCountry(countryCode: string, value: string) {
  const rule = getPhoneRule(countryCode);
  let digits = sanitizeDigits(value);

  const dialDigits = sanitizeDigits(rule.dialCode);
  if (digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  if (digits.length > rule.nationalLength) {
    digits = digits.slice(-rule.nationalLength);
  }

  if (digits.length !== rule.nationalLength) {
    return null;
  }

  return `${rule.dialCode} ${rule.formatNational(digits)}`;
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
    const rule = getPhoneRule(countryCode);
    return `Use a valid phone number (${rule.displayExample}).`;
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
