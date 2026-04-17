import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  authenticateWithBiometrics,
  canUseBiometricUnlock,
  type BiometricCapability,
} from '../security/biometricAuth';
import { verifyPin } from '../security/pinLock';
import type { PinVerificationResult } from '../security/pinLock';
import { useSensitiveScreenPrivacy } from '../security/screenPrivacy';
import { colors, layout, radii, spacing, touch, typography } from '../theme/theme';
import { PinPad } from './PinPad';

type PinConfirmationModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirmed: () => void;
};

export function PinConfirmationModal({
  visible,
  title,
  message,
  onCancel,
  onConfirmed,
}: PinConfirmationModalProps) {
  useSensitiveScreenPrivacy('orbit-ledger-pin-confirmation-modal', visible);

  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [biometricState, setBiometricState] =
    useState<(BiometricCapability & { enabled: boolean }) | null>(null);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPin('');
      setErrorMessage(null);
      setIsChecking(false);
      setIsCheckingBiometric(false);
      return;
    }

    void canUseBiometricUnlock()
      .then(setBiometricState)
      .catch(() => setBiometricState(null));
  }, [visible]);

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
        onConfirmed();
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

  async function handleBiometricConfirm() {
    setIsCheckingBiometric(true);
    setErrorMessage(null);

    try {
      const result = await authenticateWithBiometrics('Confirm sensitive action');
      if (result.ok) {
        setPin('');
        onConfirmed();
        return;
      }

      if (result.reason !== 'cancelled') {
        setErrorMessage(result.message);
      }
    } finally {
      setIsCheckingBiometric(false);
    }
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <PinPad
            value={pin}
            onChange={handlePinChange}
            onComplete={handleComplete}
            disabled={isChecking || isCheckingBiometric}
            errorMessage={errorMessage}
            helperText="Enter your 4-digit PIN to continue."
          />
          {biometricState?.isAvailable ? (
            <Pressable
              accessibilityRole="button"
              disabled={isChecking || isCheckingBiometric}
              hitSlop={touch.hitSlop}
              onPress={() => void handleBiometricConfirm()}
              pressRetentionOffset={touch.pressRetentionOffset}
              style={({ pressed }) => [
                styles.biometricButton,
                pressed && !isCheckingBiometric ? styles.biometricButtonPressed : null,
                isChecking || isCheckingBiometric ? styles.cancelButtonDisabled : null,
              ]}
            >
              <Text style={styles.biometricText}>
                {isCheckingBiometric
                  ? 'Checking biometric unlock'
                  : `Use ${biometricState.label}`}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isChecking || isCheckingBiometric}
            hitSlop={touch.hitSlop}
            onPress={onCancel}
            pressRetentionOffset={touch.pressRetentionOffset}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && !isChecking && !isCheckingBiometric ? styles.cancelButtonPressed : null,
              isChecking || isCheckingBiometric ? styles.cancelButtonDisabled : null,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backdrop,
    padding: layout.screenPadding,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: layout.cardPadding,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cancelButtonPressed: {
    backgroundColor: colors.primarySurface,
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  biometricButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  biometricButtonPressed: {
    opacity: 0.78,
  },
  biometricText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'center',
  },
  cancelText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '800',
  },
});
