import * as LocalAuthentication from 'expo-local-authentication';

import { clearSecureValue, getSecureValue, storeSecureValue } from './secureStorage';

export type BiometricCapability = {
  hasHardware: boolean;
  isEnrolled: boolean;
  isAvailable: boolean;
  label: string;
  unavailableReason: string | null;
};

export type BiometricAuthResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'cancelled' | 'unavailable' | 'failed';
      message: string;
    };

const BIOMETRIC_ENABLED_VALUE = 'true';

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const label = getBiometricLabel(supportedTypes);

    if (!hasHardware) {
      return {
        hasHardware,
        isEnrolled,
        isAvailable: false,
        label,
        unavailableReason: 'This device does not support biometric unlock.',
      };
    }

    if (!isEnrolled) {
      return {
        hasHardware,
        isEnrolled,
        isAvailable: false,
        label,
        unavailableReason: 'Set up Face ID, Touch ID, or fingerprint unlock in device settings first.',
      };
    }

    return {
      hasHardware,
      isEnrolled,
      isAvailable: true,
      label,
      unavailableReason: null,
    };
  } catch {
    return {
      hasHardware: false,
      isEnrolled: false,
      isAvailable: false,
      label: 'Biometric unlock',
      unavailableReason: 'Biometric unlock could not be checked on this device.',
    };
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  return (await getSecureValue('biometric.unlockEnabled')) === BIOMETRIC_ENABLED_VALUE;
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await storeSecureValue('biometric.unlockEnabled', BIOMETRIC_ENABLED_VALUE);
    return;
  }

  await clearBiometricUnlockPreference();
}

export async function clearBiometricUnlockPreference(): Promise<void> {
  await clearSecureValue('biometric.unlockEnabled');
}

export async function canUseBiometricUnlock(): Promise<BiometricCapability & { enabled: boolean }> {
  const [enabled, capability] = await Promise.all([
    isBiometricUnlockEnabled(),
    getBiometricCapability(),
  ]);

  return {
    ...capability,
    enabled,
    isAvailable: enabled && capability.isAvailable,
  };
}

export async function authenticateWithBiometrics(
  promptMessage = 'Unlock Orbit Ledger',
  options: { requireEnabled?: boolean } = {}
): Promise<BiometricAuthResult> {
  const { requireEnabled = true } = options;
  const state = requireEnabled
    ? await canUseBiometricUnlock()
    : {
        ...(await getBiometricCapability()),
        enabled: true,
      };

  if (requireEnabled && !state.enabled) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Biometric unlock is not enabled.',
    };
  }

  if (!state.isAvailable) {
    return {
      ok: false,
      reason: 'unavailable',
      message: state.unavailableReason ?? 'Biometric unlock is not available.',
    };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: 'Orbit Ledger',
      promptDescription: 'Confirm it is you before opening your ledger.',
      cancelLabel: 'Use PIN',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: true,
      requireConfirmation: true,
      biometricsSecurityLevel: 'weak',
    });

    if (result.success) {
      return { ok: true };
    }

    if (
      result.error === 'user_cancel' ||
      result.error === 'system_cancel' ||
      result.error === 'app_cancel' ||
      result.error === 'user_fallback'
    ) {
      return {
        ok: false,
        reason: 'cancelled',
        message: 'Use your PIN to continue.',
      };
    }

    return {
      ok: false,
      reason: result.error === 'not_available' || result.error === 'not_enrolled'
        ? 'unavailable'
        : 'failed',
      message: getAuthenticationErrorMessage(result.error),
    };
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: 'Biometric unlock could not be completed. Use your PIN instead.',
    };
  }
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const hasIris = types.includes(LocalAuthentication.AuthenticationType.IRIS);

  if (hasFace && hasFingerprint) {
    return 'Face or fingerprint unlock';
  }

  if (hasFace) {
    return 'Face unlock';
  }

  if (hasFingerprint) {
    return 'Fingerprint unlock';
  }

  if (hasIris) {
    return 'Iris unlock';
  }

  return 'Biometric unlock';
}

function getAuthenticationErrorMessage(error: LocalAuthentication.LocalAuthenticationError): string {
  if (error === 'lockout') {
    return 'Biometric unlock is temporarily locked. Use your PIN instead.';
  }

  if (error === 'not_enrolled') {
    return 'No biometric unlock is set up on this device. Use your PIN instead.';
  }

  if (error === 'not_available' || error === 'passcode_not_set') {
    return 'Biometric unlock is not available right now. Use your PIN instead.';
  }

  if (error === 'timeout') {
    return 'Biometric unlock timed out. Use your PIN instead.';
  }

  return 'Biometric unlock did not match. Use your PIN instead.';
}
