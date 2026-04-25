import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextField } from '../components/TextField';
import { markRatingPromptActioned, submitUserFeedback } from '../engagement';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

export function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cleanedMessage = message.trim();
  const canSubmit = cleanedMessage.length >= 10;

  async function submitFeedback() {
    if (!canSubmit) {
      Alert.alert('Add a little more detail', 'Please write at least 10 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitUserFeedback(cleanedMessage);
      await markRatingPromptActioned();
      Alert.alert('Feedback ready to send', 'Thanks for helping improve Orbit Ledger.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Feedback could not be sent', 'Please try again from an email or sharing app.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Send Feedback"
          subtitle="Share what is working well or what should be improved."
          backLabel="Back"
          onBack={() => navigation.goBack()}
        />

        <View style={styles.card}>
          <Text style={styles.eyebrow}>Orbit Ledger feedback</Text>
          <Text style={styles.title}>A short note helps improve the app.</Text>
          <Text style={styles.message}>
            Feedback opens your device mail or sharing app. No ledger data is attached.
          </Text>
          <TextField
            label="Your feedback"
            multiline
            numberOfLines={7}
            placeholder="What should we improve next?"
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
            helperText="Please avoid adding private customer details."
            style={styles.feedbackInput}
          />
          <PrimaryButton loading={isSubmitting} disabled={!canSubmit} onPress={submitFeedback}>
            Submit Feedback
          </PrimaryButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 24,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  feedbackInput: {
    minHeight: 150,
  },
});
