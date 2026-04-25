import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { registerForCloud, sendCloudPasswordReset, signInToCloud } from '../cloud';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextField } from '../components/TextField';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

const registerSchema = signInSchema.extend({
  displayName: z.string().trim().min(2, 'Enter your full name.'),
  confirmPassword: z.string().min(8, 'Confirm your password.'),
}).refine((input) => input.password === input.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type SignInValues = z.infer<typeof signInSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type CloudAuthScreenProps = NativeStackScreenProps<RootStackParamList, 'CloudAuth'>;

export function CloudAuthScreen({ navigation, route }: CloudAuthScreenProps) {
  const [mode, setMode] = useState<'sign_in' | 'register'>('sign_in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const {
    control: signInControl,
    formState: { errors: signInErrors, touchedFields: signInTouched, isSubmitted: signInSubmitted },
    getValues: getSignInValues,
    handleSubmit: handleSignInSubmit,
    trigger: triggerSignIn,
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const {
    control: registerControl,
    formState: {
      errors: registerErrors,
      touchedFields: registerTouched,
      isSubmitted: registerSubmitted,
    },
    handleSubmit: handleRegisterSubmit,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isSubmitting });
  }, [isSubmitting, navigation]);

  async function submitSignIn(input: SignInValues) {
    setIsSubmitting(true);

    try {
      await signInToCloud(input);
      Alert.alert('Cloud sync is ready', 'You are signed in. Continue setting up your synced workspace.', [
        {
          text: 'Continue',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.replace(route.params.returnTo);
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Sign-in failed', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRegister(input: RegisterValues) {
    setIsSubmitting(true);

    try {
      await registerForCloud({
        displayName: input.displayName,
        email: input.email,
        password: input.password,
      });
      Alert.alert('Account created', 'Your cloud account is ready. Continue setting up your synced workspace.', [
        {
          text: 'Continue',
          onPress: () => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.replace(route.params.returnTo);
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Account could not be created', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const emailIsValid = await triggerSignIn('email');
    if (!emailIsValid) {
      return;
    }

    setIsSendingReset(true);
    try {
      const email = getSignInValues('email').trim();
      await sendCloudPasswordReset(email);
      Alert.alert(
        'Reset email sent',
        `If ${email} is linked to Orbit Ledger cloud sync, a password reset link has been sent.`
      );
    } catch (error) {
      Alert.alert('Reset email could not be sent', getAuthErrorMessage(error));
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScreenHeader
          title="Cloud Sync Access"
          subtitle="Sign in to use Orbit Ledger across signed-in devices."
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <Card accent="primary" glass elevated>
            <Text style={styles.cardTitle}>Why sign in?</Text>
            <Text style={styles.helper}>
              Web access and future cross-device sync use a signed-in workspace. Your local ledger
              stays on this device unless you link it.
            </Text>
          </Card>

          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('sign_in')}
              style={[styles.segment, mode === 'sign_in' ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, mode === 'sign_in' ? styles.segmentTextActive : null]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('register')}
              style={[styles.segment, mode === 'register' ? styles.segmentActive : null]}
            >
              <Text style={[styles.segmentText, mode === 'register' ? styles.segmentTextActive : null]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          {mode === 'sign_in' ? (
            <Card elevated>
              <Text style={styles.cardTitle}>Sign in to your workspace</Text>
              <Controller
                control={signInControl}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    label="Email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="owner@example.com"
                    value={value}
                    error={getVisibleError(signInErrors.email?.message, signInTouched.email, signInSubmitted)}
                  />
                )}
              />
              <Controller
                control={signInControl}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    autoCapitalize="none"
                    autoComplete="password"
                    label="Password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Enter password"
                    secureTextEntry
                    value={value}
                    error={getVisibleError(
                      signInErrors.password?.message,
                      signInTouched.password,
                      signInSubmitted
                    )}
                  />
                )}
              />
              <PrimaryButton
                disabled={isSubmitting}
                loading={isSendingReset}
                onPress={() => void handlePasswordReset()}
                variant="ghost"
              >
                Reset Password
              </PrimaryButton>
              <PrimaryButton loading={isSubmitting} onPress={handleSignInSubmit(submitSignIn)}>
                Sign In
              </PrimaryButton>
            </Card>
          ) : (
            <Card elevated accent="premium">
              <Text style={styles.cardTitle}>Create a cloud account</Text>
              <Controller
                control={registerControl}
                name="displayName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    label="Full name"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Bhaumik Mehta"
                    value={value}
                    error={getVisibleError(
                      registerErrors.displayName?.message,
                      registerTouched.displayName,
                      registerSubmitted
                    )}
                  />
                )}
              />
              <Controller
                control={registerControl}
                name="email"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    label="Email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="owner@example.com"
                    value={value}
                    error={getVisibleError(
                      registerErrors.email?.message,
                      registerTouched.email,
                      registerSubmitted
                    )}
                  />
                )}
              />
              <Controller
                control={registerControl}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    autoCapitalize="none"
                    label="Password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Create password"
                    secureTextEntry
                    value={value}
                    error={getVisibleError(
                      registerErrors.password?.message,
                      registerTouched.password,
                      registerSubmitted
                    )}
                  />
                )}
              />
              <Controller
                control={registerControl}
                name="confirmPassword"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextField
                    autoCapitalize="none"
                    label="Confirm password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Re-enter password"
                    secureTextEntry
                    value={value}
                    error={getVisibleError(
                      registerErrors.confirmPassword?.message,
                      registerTouched.confirmPassword,
                      registerSubmitted
                    )}
                  />
                )}
              />
              <PrimaryButton loading={isSubmitting} onPress={handleRegisterSubmit(submitRegister)}>
                Create Account
              </PrimaryButton>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getVisibleError(message: string | undefined, touched: boolean | undefined, isSubmitted: boolean) {
  return touched || isSubmitted ? message : undefined;
}

function getAuthErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Please try again.';

  if (raw.includes('auth/invalid-credential')) {
    return 'The email or password is not correct.';
  }
  if (raw.includes('auth/invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'This email is already linked to an account.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Use a stronger password with at least 8 characters.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No account was found for that email address.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Too many attempts were made. Wait a moment and try again.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'A network connection is required to reach cloud sync right now.';
  }

  return raw;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.primary,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
