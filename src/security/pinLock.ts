import * as Crypto from 'expo-crypto';

import { getAppSecurity, saveAppSecurity } from '../database';
import {
  clearSecureValue,
  clearSecureValues,
  getSecureValue,
  storeSecureValue,
} from './secureStorage';
import { clearBiometricUnlockPreference } from './biometricAuth';

export const PIN_LENGTH = 4;
export const DEFAULT_PIN_INACTIVITY_TIMEOUT_MS = 60_000;
export const PIN_INACTIVITY_TIMEOUT_OPTIONS = [
  { label: '30s', value: 30_000 },
  { label: '1min', value: 60_000 },
  { label: '5min', value: 300_000 },
] as const;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 30_000;

type PinVerificationSuccess = {
  ok: true;
};

type PinVerificationFailure = {
  ok: false;
  reason: 'incorrect' | 'locked' | 'not_configured' | 'invalid';
  retryAfterMs?: number;
  attemptsRemaining?: number;
};

export type PinVerificationResult = PinVerificationSuccess | PinVerificationFailure;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function isSupportedPinTimeout(timeoutMs: number): boolean {
  return PIN_INACTIVITY_TIMEOUT_OPTIONS.some((option) => option.value === timeoutMs);
}

export async function getPinInactivityTimeoutMs(): Promise<number> {
  const value = await getSecureValue('pin.timeoutMs');
  const parsed = Number(value);

  return Number.isFinite(parsed) && isSupportedPinTimeout(parsed)
    ? parsed
    : DEFAULT_PIN_INACTIVITY_TIMEOUT_MS;
}

export async function savePinInactivityTimeoutMs(timeoutMs: number): Promise<void> {
  if (!isSupportedPinTimeout(timeoutMs)) {
    throw new Error('Unsupported PIN inactivity timeout.');
  }

  await storeSecureValue('pin.timeoutMs', String(timeoutMs));
}

export async function isPinLockEnabled(): Promise<boolean> {
  const security = await getAppSecurity();
  const [hash, salt] = await Promise.all([
    getSecureValue('pin.hash'),
    getSecureValue('pin.salt'),
  ]);

  if (security.pinEnabled && (!hash || !salt)) {
    await saveAppSecurity(false);
    await clearBiometricUnlockPreference();
    return false;
  }

  return security.pinEnabled && Boolean(hash && salt);
}

export async function enablePinLock(pin: string): Promise<void> {
  assertPin(pin);

  const credentials = await createPinCredentials(pin);

  try {
    await storePinCredentials(credentials);
    await clearRateLimit();
    await saveAppSecurity(true);
  } catch (error) {
    await clearPinLockSecureStateSafely();
    try {
      await saveAppSecurity(false);
    } catch {
      // Best effort rollback. The original error is more useful to the caller.
    }
    throw error;
  }
}

export async function changePinLock(
  currentPin: string,
  nextPin: string
): Promise<PinVerificationResult> {
  assertPin(nextPin);

  const previousCredentials = await readStoredPinCredentials();
  if (!previousCredentials) {
    await saveAppSecurity(false);
    await clearRateLimit();
    return { ok: false, reason: 'not_configured' };
  }

  const verification = await verifyPin(currentPin);
  if (!verification.ok) {
    return verification;
  }

  const nextCredentials = await createPinCredentials(nextPin);

  try {
    await storePinCredentials(nextCredentials);
    await clearRateLimit();
    await saveAppSecurity(true);
  } catch (error) {
    try {
      await storePinCredentials(previousCredentials);
    } catch {
      // Best effort rollback. The original error is more useful to the caller.
    }
    throw error;
  }

  return { ok: true };
}

export async function disablePinLock(currentPin: string): Promise<PinVerificationResult> {
  const verification = await verifyPin(currentPin);
  if (!verification.ok) {
    return verification;
  }

  await saveAppSecurity(false);

  try {
    await clearPinLockSecureState();
  } catch (error) {
    try {
      await saveAppSecurity(true);
    } catch {
      // Best effort rollback. The original error is more useful to the caller.
    }
    throw error;
  }

  return { ok: true };
}

export async function clearPinLockSecureState(): Promise<void> {
  await Promise.all([
    clearSecureValue('pin.hash'),
    clearSecureValue('pin.salt'),
    clearBiometricUnlockPreference(),
    clearRateLimit(),
  ]);
}

export async function verifyPin(pin: string): Promise<PinVerificationResult> {
  if (!isValidPin(pin)) {
    return { ok: false, reason: 'invalid' };
  }

  const lockedUntil = await getLockedUntil();
  const now = Date.now();
  if (lockedUntil && lockedUntil > now) {
    return {
      ok: false,
      reason: 'locked',
      retryAfterMs: lockedUntil - now,
    };
  }

  const [hash, salt] = await Promise.all([
    getSecureValue('pin.hash'),
    getSecureValue('pin.salt'),
  ]);

  if (!hash || !salt) {
    await saveAppSecurity(false);
    await clearBiometricUnlockPreference();
    await clearRateLimit();
    return { ok: false, reason: 'not_configured' };
  }

  const candidateHash = await hashPin(pin, salt);
  if (timingSafeEqual(candidateHash, hash)) {
    await clearRateLimit();
    return { ok: true };
  }

  return recordFailedAttempt();
}

async function createSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(24);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

type StoredPinCredentials = {
  hash: string;
  salt: string;
};

async function createPinCredentials(pin: string): Promise<StoredPinCredentials> {
  const salt = await createSalt();
  const hash = await hashPin(pin, salt);
  return { hash, salt };
}

async function readStoredPinCredentials(): Promise<StoredPinCredentials | null> {
  const [hash, salt] = await Promise.all([
    getSecureValue('pin.hash'),
    getSecureValue('pin.salt'),
  ]);

  return hash && salt ? { hash, salt } : null;
}

async function storePinCredentials(credentials: StoredPinCredentials): Promise<void> {
  await storeSecureValue('pin.salt', credentials.salt);
  await storeSecureValue('pin.hash', credentials.hash);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  let digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:orbit-ledger:${pin}`
  );

  for (let index = 0; index < 12; index += 1) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${digest}:orbit-ledger-pin`
    );
  }

  return digest;
}

async function recordFailedAttempt(): Promise<PinVerificationResult> {
  const attempts = (await getAttemptCount()) + 1;
  const attemptsRemaining = Math.max(PIN_MAX_ATTEMPTS - attempts, 0);

  await storeSecureValue('pin.failedAttempts', String(attempts));

  if (attempts >= PIN_MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + PIN_LOCKOUT_MS;
    await storeSecureValue('pin.lockedUntil', String(lockedUntil));

    return {
      ok: false,
      reason: 'locked',
      retryAfterMs: PIN_LOCKOUT_MS,
      attemptsRemaining: 0,
    };
  }

  return {
    ok: false,
    reason: 'incorrect',
    attemptsRemaining,
  };
}

async function getAttemptCount(): Promise<number> {
  const value = await getSecureValue('pin.failedAttempts');
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function getLockedUntil(): Promise<number | null> {
  const value = await getSecureValue('pin.lockedUntil');
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > Date.now()) {
    return parsed;
  }

  if (Number.isFinite(parsed)) {
    await clearRateLimit();
  }

  return null;
}

async function clearRateLimit(): Promise<void> {
  await clearSecureValues(['pin.failedAttempts', 'pin.lockedUntil']);
}

async function clearPinLockSecureStateSafely(): Promise<void> {
  try {
    await clearPinLockSecureState();
  } catch {
    // Best effort cleanup after a failed PIN setup.
  }
}

function assertPin(pin: string): void {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }
}

function timingSafeEqual(left: string, right: string): boolean {
  let result = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    result |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return result === 0;
}
