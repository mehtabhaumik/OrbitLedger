import * as Crypto from 'expo-crypto';

export const REMOTE_UPDATE_CONTRACT_VERSION = 1;

export const DEFAULT_TAX_PACK_MANIFEST_URL =
  'https://updates.orbitledger.rudraix.com/v1/tax-packs/manifest.json';

export const DEFAULT_COUNTRY_PACKAGE_MANIFEST_URL =
  'https://updates.orbitledger.rudraix.com/v1/country-packages/manifest.json';

export const REMOTE_UPDATE_TIMEOUT_MS = 12000;

export type RemotePayloadTrustMetadata = {
  checksum: string;
  signature?: string | null;
};

export function getTaxPackManifestUrl(): string {
  return (
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_TAX_PACK_MANIFEST_URL ||
    DEFAULT_TAX_PACK_MANIFEST_URL
  );
}

export function getCountryPackageManifestUrl(): string {
  return (
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_COUNTRY_PACKAGE_MANIFEST_URL ||
    DEFAULT_COUNTRY_PACKAGE_MANIFEST_URL
  );
}

export async function fetchRemoteJson<T>(url: string): Promise<T> {
  assertHttpsUrl(url, 'remote update URL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_UPDATE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote update request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchVerifiedRemoteJson<T>(
  url: string,
  trust: RemotePayloadTrustMetadata,
  label: string
): Promise<T> {
  const payloadText = await fetchRemoteText(url);
  await verifyPayloadChecksum(payloadText, trust.checksum, label);

  try {
    return JSON.parse(payloadText) as T;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export async function fetchRemoteText(url: string): Promise<string> {
  assertHttpsUrl(url, 'remote update URL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_UPDATE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Remote update request failed with HTTP ${response.status}.`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveRemotePayloadUrl(payloadUrl: string, manifestUrl: string): string {
  const resolvedUrl = /^https?:\/\//i.test(payloadUrl)
    ? payloadUrl
    : new URL(payloadUrl, manifestUrl).toString();

  assertHttpsUrl(resolvedUrl, 'remote payload URL');
  return resolvedUrl;
}

export function assertHttpsUrl(value: string, fieldName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid HTTPS URL.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${fieldName} must use HTTPS.`);
  }

  return parsed.toString();
}

export function assertRequiredChecksum(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required for remote update integrity.`);
  }

  return normalizeSha256Checksum(value, fieldName);
}

export function assertRemotePayloadTrustMetadata(
  value: Record<string, unknown>,
  fieldPrefix: string
): RemotePayloadTrustMetadata {
  return {
    checksum: assertRequiredChecksum(value.checksum, `${fieldPrefix}.checksum`),
    signature: assertOptionalString(value.signature, `${fieldPrefix}.signature`),
  };
}

export async function verifyPayloadChecksum(
  payloadText: string,
  expectedChecksum: string,
  label: string
): Promise<void> {
  const normalizedExpected = normalizeSha256Checksum(expectedChecksum, `${label} checksum`);
  const actualChecksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payloadText,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  if (actualChecksum.toLowerCase() !== normalizedExpected) {
    throw new Error(`${label} checksum verification failed.`);
  }
}

export function describeRemoteUpdateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/checksum/i.test(message)) {
    return 'The downloaded file did not match its published checksum.';
  }

  if (/https/i.test(message)) {
    return 'The update source must use a secure HTTPS address.';
  }

  if (/http|request failed|abort|network|fetch/i.test(message)) {
    return 'The update server could not be reached.';
  }

  if (/valid json/i.test(message)) {
    return 'The downloaded file was not readable.';
  }

  if (/schemaversion|unsupported format/i.test(message)) {
    return 'The update uses an unsupported format.';
  }

  if (/country|region|scope|version|tax type|lookup|match/i.test(message)) {
    return 'The update does not match this business profile.';
  }

  if (/required|must|unsupported|non-empty|validation/i.test(message)) {
    return 'The update file did not pass validation.';
  }

  return 'The update could not be applied.';
}

export function assertRemoteContractVersion(value: unknown): void {
  if (!isRecord(value) || value.schemaVersion !== REMOTE_UPDATE_CONTRACT_VERSION) {
    throw new Error(`Remote update response must use schemaVersion ${REMOTE_UPDATE_CONTRACT_VERSION}.`);
  }
}

export function assertIsoDateLike(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be an ISO date string.`);
  }

  return value;
}

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

export function assertOptionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  return value.trim();
}

export function assertJsonObjectOrString(
  value: unknown,
  fieldName: string
): string | Record<string, unknown> {
  if (typeof value === 'string') {
    return value;
  }

  if (isRecord(value)) {
    return value;
  }

  throw new Error(`${fieldName} must be a JSON object or JSON string.`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeRemoteCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeSha256Checksum(value: string, fieldName: string): string {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, '');

  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${fieldName} must be a SHA-256 checksum.`);
  }

  return normalized;
}
