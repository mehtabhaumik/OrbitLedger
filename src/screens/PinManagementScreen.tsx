import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinPad } from '../components/PinPad';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import type { RootStackParamList } from '../navigation/types';
import { useAppLock } from '../security/AppLockContext';
import {
  changePinLock,
  disablePinLock,
  enablePinLock,
  verifyPin,
} from '../security/pinLock';
import type { PinVerificationResult } from '../security/pinLock';
import { colors, spacing, typography } from '../theme/theme';

type PinManagementProps = NativeStackScreenProps<RootStackParamList, 'PinManagement'>;

type PinFlowStep = 'current' | 'new' | 'confirm';

export function PinManagementScreen({ navigation, route }: PinManagementProps) {
  const { mode } = route.params;
  const { refreshPinLockState } = useAppLock();
  const [step, setStep] = useState<PinFlowStep>(mode === 'enable' ? 'new' : 'current');
  const [pin, setPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleComplete(value: string) {
    setErrorMessage(null);

    if (step === 'current') {
      await handleCurrentPin(value);
      return;
    }

    if (step === 'new') {
      setNextPin(value);
      setPin('');
      setStep('confirm');
      return;
    }

    if (value !== nextPin) {
      setPin('');
      setErrorMessage('The PINs did not match. Enter the new PIN again.');
      setStep('new');
      setNextPin('');
      return;
    }

    await saveNewPin(value);
  }

  async function handleCurrentPin(value: string) {
    setIsSaving(true);

    try {
      if (mode === 'disable') {
        const result = await verifyPin(value);
        if (!result.ok) {
          setPin('');
          setErrorMessage(getPinErrorMessage(result));
          return;
        }

        setPin('');
        Alert.alert(
          'Turn off PIN protection?',
          'Orbit Ledger will stop asking for a PIN on this device. Your ledger stays on this device, but anyone who can open the app can view it.',
          [
            {
              text: 'Keep PIN On',
              style: 'cancel',
            },
            {
              text: 'Turn Off PIN',
              style: 'destructive',
              onPress: () => {
                void confirmDisablePin(value);
              },
            },
          ]
        );
        return;
      }

      const result = await verifyPin(value);
      if (!result.ok) {
        setPin('');
        setErrorMessage(getPinErrorMessage(result));
        return;
      }

      setCurrentPin(value);
      setPin('');
      setStep('new');
    } catch {
      setPin('');
      setErrorMessage(
        mode === 'disable'
          ? 'We could not turn off PIN protection. Try again.'
          : 'We could not check the PIN. Try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDisablePin(currentPinValue: string) {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const result = await disablePinLock(currentPinValue);
      if (!result.ok) {
        setPin('');
        setErrorMessage(getPinErrorMessage(result));
        return;
      }

      await refreshPinLockState({ lockIfEnabled: false });
      Alert.alert('PIN disabled', 'Orbit Ledger will no longer ask for a PIN on this device.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      setPin('');
      setErrorMessage('We could not turn off PIN protection. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveNewPin(value: string) {
    setIsSaving(true);

    try {
      if (mode === 'change') {
        const result = await changePinLock(currentPin, value);
        if (!result.ok) {
          setPin('');
          setErrorMessage(getPinErrorMessage(result));
          setStep('current');
          setCurrentPin('');
          setNextPin('');
          return;
        }
      } else {
        await enablePinLock(value);
      }

      await refreshPinLockState({ lockIfEnabled: false });
      Alert.alert(
        mode === 'change' ? 'PIN changed' : 'PIN enabled',
        mode === 'change'
          ? 'Your PIN was updated on this device.'
          : 'Orbit Ledger will ask for this PIN when you open the app and after inactivity.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch {
      setPin('');
      setErrorMessage('We could not save the PIN. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetStep() {
    setPin('');
    setCurrentPin('');
    setNextPin('');
    setErrorMessage(null);
    setStep(mode === 'enable' ? 'new' : 'current');
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={getTitle(mode)} subtitle={getSubtitle(mode)} onBack={() => navigation.goBack()} />

        <View style={styles.card}>
          <Text style={styles.stepLabel}>{getStepLabel(mode, step)}</Text>
          <Text style={styles.stepText}>{getStepText(mode, step)}</Text>

          <PinPad
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            disabled={isSaving}
            errorMessage={errorMessage}
            helperText="Your PIN is never shown. Keep backup files private because they may include app lock settings."
          />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>PIN protection</Text>
          <Text style={styles.noticeText}>
            Orbit Ledger asks for your PIN when the app opens and after the time you choose in
            settings. Extra tries are briefly paused to help protect your ledger.
          </Text>
        </View>

        <PrimaryButton variant="ghost" disabled={isSaving} onPress={resetStep}>
          Start over
        </PrimaryButton>
      </ScrollView>
    </SafeAreaView>
  );
}

function getTitle(mode: PinManagementProps['route']['params']['mode']): string {
  if (mode === 'change') {
    return 'Change PIN';
  }

  if (mode === 'disable') {
    return 'Disable PIN';
  }

  return 'Enable PIN';
}

function getSubtitle(mode: PinManagementProps['route']['params']['mode']): string {
  if (mode === 'change') {
    return 'Enter your current PIN, then choose a new 4-digit PIN.';
  }

  if (mode === 'disable') {
    return 'Enter your PIN before turning protection off.';
  }

  return 'Protect your ledger with a 4-digit PIN.';
}

function getStepLabel(mode: PinManagementProps['route']['params']['mode'], step: PinFlowStep): string {
  if (step === 'current') {
    return mode === 'disable' ? 'Confirm PIN' : 'Current PIN';
  }

  if (step === 'confirm') {
    return 'Confirm new PIN';
  }

  return mode === 'enable' ? 'Create PIN' : 'New PIN';
}

function getStepText(mode: PinManagementProps['route']['params']['mode'], step: PinFlowStep): string {
  if (step === 'current') {
    return mode === 'disable'
      ? 'Enter your PIN to turn protection off.'
      : 'Enter your current PIN first.';
  }

  if (step === 'confirm') {
    return 'Enter the same PIN one more time.';
  }

  return 'Enter a 4-digit PIN.';
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
    return 'Enter exactly 4 digits.';
  }

  if (result.reason === 'not_configured') {
    return 'PIN protection is not active on this device.';
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
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  stepLabel: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    textAlign: 'center',
  },
  stepText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  notice: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
});
