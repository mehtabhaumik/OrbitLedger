import * as SecureStore from 'expo-secure-store';

// Sensitive local values only. Non-sensitive app state belongs in SQLite.
const SECURE_STORAGE_SERVICE = 'orbit-ledger-pin';

type SecureValueKey =
  | 'pin.hash'
  | 'pin.salt'
  | 'pin.failedAttempts'
  | 'pin.lockedUntil'
  | 'pin.timeoutMs'
  | 'biometric.unlockEnabled';

const keyMap: Record<SecureValueKey, string> = {
  'pin.hash': 'orbit_ledger_pin_hash',
  'pin.salt': 'orbit_ledger_pin_salt',
  'pin.failedAttempts': 'orbit_ledger_pin_attempts',
  'pin.lockedUntil': 'orbit_ledger_pin_locked_until',
  'pin.timeoutMs': 'orbit_ledger_pin_timeout_ms',
  'biometric.unlockEnabled': 'orbit_ledger_biometric_unlock_enabled',
};

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: SECURE_STORAGE_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function storeSecureValue(key: SecureValueKey, value: string): Promise<void> {
  await SecureStore.setItemAsync(keyMap[key], value, secureStoreOptions);
}

export async function getSecureValue(key: SecureValueKey): Promise<string | null> {
  return SecureStore.getItemAsync(keyMap[key], secureStoreOptions);
}

export async function clearSecureValue(key: SecureValueKey): Promise<void> {
  await SecureStore.deleteItemAsync(keyMap[key], secureStoreOptions);
}

export async function clearSecureValues(keys: SecureValueKey[]): Promise<void> {
  await Promise.all(keys.map((key) => clearSecureValue(key)));
}
