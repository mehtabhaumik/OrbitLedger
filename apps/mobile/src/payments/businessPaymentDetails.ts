import { normalizeManualPaymentInstructionDetails } from '@orbit-ledger/core';

import { getDatabase } from '../database';
import type { PaymentShareDetails } from '../collections/paymentRequests';

type AppPreferenceRow = {
  value: string;
};

const BUSINESS_PAYMENT_DETAILS_KEY = 'business_payment_details';

export type BusinessPaymentDetails = PaymentShareDetails;

export async function getBusinessPaymentDetails(): Promise<BusinessPaymentDetails> {
  const raw = await getPreference(BUSINESS_PAYMENT_DETAILS_KEY);
  if (!raw) {
    return {};
  }

  try {
    return normalizeBusinessPaymentDetails(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function saveBusinessPaymentDetails(
  input: BusinessPaymentDetails
): Promise<BusinessPaymentDetails> {
  const normalized = normalizeBusinessPaymentDetails(input);
  await setPreference(BUSINESS_PAYMENT_DETAILS_KEY, JSON.stringify(normalized));
  return normalized;
}

export function normalizeBusinessPaymentDetails(input: unknown): BusinessPaymentDetails {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return normalizeManualPaymentInstructionDetails({
    upiId: stringValue(record.upiId),
    paymentPageUrl: stringValue(record.paymentPageUrl),
    paymentNote: stringValue(record.paymentNote),
    bankAccountName: stringValue(record.bankAccountName),
    bankName: stringValue(record.bankName),
    bankAccountNumber: stringValue(record.bankAccountNumber),
    bankIfsc: stringValue(record.bankIfsc),
    bankBranch: stringValue(record.bankBranch),
    bankRoutingNumber: stringValue(record.bankRoutingNumber),
    bankSortCode: stringValue(record.bankSortCode),
    bankIban: stringValue(record.bankIban),
    bankSwift: stringValue(record.bankSwift),
  });
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
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
