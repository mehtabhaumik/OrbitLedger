import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinPad } from '../components/PinPad';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  authenticateWithBiometrics,
  canUseBiometricUnlock,
  type BiometricCapability,
} from '../security/biometricAuth';
import { verifyPin } from '../security/pinLock';
import type { PinVerificationResult } from '../security/pinLock';
import { useSensitiveScreenPrivacy } from '../security/screenPrivacy';
import { colors, spacing, typography } from '../theme/theme';

type PinLockScreenProps = {
  onUnlocked: () => void;
  onLockUnavailable: () => void;
};

export function PinLockScreen({ onUnlocked, onLockUnavailable }: PinLockScreenProps) {
  useSensitiveScreenPrivacy('orbit-ledger-pin-lock-screen');

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [biometricState, setBiometricState] =
    useState<(BiometricCapability & { enabled: boolean }) | null>(null);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareBiometricUnlock() {
      const state = await canUseBiometricUnlock();
      if (!isMounted) {
        return;
      }

      setBiometricState(state);
      if (state.isAvailable) {
        void handleBiometricUnlock(false);
      }
    }

    void prepareBiometricUnlock();

    return () => {
      isMounted = false;
    };
    // Run only when the lock screen is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePinChange(value: string) {
    setPin(value);
    if (errorMessage) {
      setErrorMessage(null);
    }
  }

  async function handleComplete(value: string) {
    setIsChecking(true);
    setErrorMessage(null);

    try {
      const result = await verifyPin(value);

      if (result.ok) {
        setPin('');
        onUnlocked();
        return;
      }

      if (result.reason === 'not_configured') {
        setPin('');
        onLockUnavailable();
        return;
      }

      setPin('');
      setErrorMessage(getPinErrorMessage(result));
    } catch {
      setPin('');
      setErrorMessage('We could not check the PIN. Try again.');
    } finally {
      setIsChecking(false);
    }
  }

  async function handleBiometricUnlock(showErrors = true) {
    setIsCheckingBiometric(true);
    if (showErrors) {
      setErrorMessage(null);
    }

    try {
      const result = await authenticateWithBiometrics();
      if (result.ok) {
        setPin('');
        onUnlocked();
        return;
      }

      if (showErrors && result.reason !== 'cancelled') {
        setErrorMessage(result.message);
      }
    } finally {
      setIsCheckingBiometric(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Orbit Ledger</Text>
          <Text style={styles.title}>Enter your PIN</Text>
          <Text style={styles.subtitle}>Enter your PIN to continue.</Text>
        </View>

        <View style={styles.card}>
          <PinPad
            value={pin}
            onChange={handlePinChange}
            onComplete={handleComplete}
            disabled={isChecking || isCheckingBiometric}
            errorMessage={errorMessage}
            helperText="Use the 4-digit PIN for this device."
          />
          {biometricState?.isAvailable ? (
            <PrimaryButton
              disabled={isChecking || isCheckingBiometric}
              loading={isCheckingBiometric}
              onPress={() => void handleBiometricUnlock(true)}
              variant="secondary"
            >
              Unlock with {biometricState.label}
            </PrimaryButton>
          ) : null}
          {isChecking ? (
            <View style={styles.checking}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.checkingText}>Checking PIN</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

function getPinErrorMessage(result: PinVerificationResult): string {
  if (result.ok) {
    return '';
  }

  if (result.reason === 'locked') {
    const seconds = Math.max(Math.ceil((result.retryAfterMs ?? 0) / 1000), 1);
    return `Please wait ${seconds} seconds before trying again.`;
  }

  if (result.reason === 'invalid') {
    return 'Enter your 4-digit PIN.';
  }

  const attemptsText =
    typeof result.attemptsRemaining === 'number' && result.attemptsRemaining > 0
      ? ` You can try ${result.attemptsRemaining} more times.`
      : '';
  return `That PIN did not match.${attemptsText}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  kicker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  checking: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  checkingText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '700',
  },
});
