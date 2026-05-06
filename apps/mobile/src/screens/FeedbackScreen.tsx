import {
  buildFounderSafeDiagnosticSummary,
  buildFounderSafeSupportDraft,
  type FounderSafeDiagnosticInput,
  type FounderSafeSupportKind,
} from '@orbit-ledger/core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { markRatingPromptActioned, submitUserFeedback } from '../engagement';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme/theme';

type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

const supportKinds: Array<{
  label: string;
  value: FounderSafeSupportKind;
}> = [
  { value: 'general_feedback', label: 'Feedback' },
  { value: 'invoice_issue', label: 'Invoice' },
  { value: 'payment_issue', label: 'Payment' },
  { value: 'restore_help', label: 'Backup' },
  { value: 'purchase_help', label: 'Purchase' },
  { value: 'feature_request', label: 'Idea' },
];

export function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const [kind, setKind] = useState<FounderSafeSupportKind>('general_feedback');
  const [message, setMessage] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [privacyReviewed, setPrivacyReviewed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cleanedMessage = message.trim();

  const diagnosticInput = useMemo<FounderSafeDiagnosticInput>(
    () => ({
        appVersion: 'mobile',
        connectivity: 'unknown',
        osName: `${Platform.OS} ${Platform.Version}`,
        platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unknown',
        screen: 'Support',
      }),
    []
  );
  const diagnosticSummary = useMemo(
    () => buildFounderSafeDiagnosticSummary(diagnosticInput),
    [diagnosticInput]
  );
  const draft = useMemo(
    () =>
      buildFounderSafeSupportDraft({
        diagnostic: diagnosticInput,
        includeDiagnostics,
        kind,
        message,
        screen: 'Support',
        userApprovedDiagnostics: includeDiagnostics && privacyReviewed,
      }),
    [diagnosticInput, includeDiagnostics, kind, message, privacyReviewed]
  );
  const needsReview = draft.requiresPrivacyReview || (includeDiagnostics && !privacyReviewed);
  const canSubmit = cleanedMessage.length >= 10 && (!needsReview || privacyReviewed);

  async function submitFeedback() {
    if (!canSubmit) {
      setStatusMessage(
        cleanedMessage.length < 10
          ? 'Add a short message before sending.'
          : 'Review what will be shared before sending.'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('');
      await submitUserFeedback(
        buildSupportMessage({
          diagnosticSummary,
          draft,
          includeDiagnostics,
        })
      );
      await markRatingPromptActioned();
      setStatusMessage('Your support request is ready in your mail or sharing app.');
    } catch {
      setStatusMessage('Support request could not be opened. Please try again from your mail app.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateKind(nextKind: FounderSafeSupportKind) {
    setKind(nextKind);
    setPrivacyReviewed(false);
    setStatusMessage('');
  }

  function updateMessage(nextMessage: string) {
    setMessage(nextMessage);
    setPrivacyReviewed(false);
    setStatusMessage('');
  }

  function updateDiagnostics(nextValue: boolean) {
    setIncludeDiagnostics(nextValue);
    setPrivacyReviewed(false);
    setStatusMessage('');
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Support"
          subtitle="Send feedback or ask for help after reviewing what will be shared."
          backLabel="Back"
          onBack={() => navigation.goBack()}
        />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleBlock}>
              <Text style={styles.eyebrow}>Founder-safe support</Text>
              <Text style={styles.title}>No business records are attached automatically.</Text>
            </View>
            <StatusChip label="Review first" tone="success" />
          </View>
          <Text style={styles.message}>
            Choose the topic, write a short note, and review the preview. Private-looking details are
            removed from the message before it opens in your mail or sharing app.
          </Text>

          <View style={styles.kindGrid}>
            {supportKinds.map((option) => (
              <Pressable
                accessibilityRole="button"
                hitSlop={touch.hitSlop}
                key={option.value}
                onPress={() => updateKind(option.value)}
                pressRetentionOffset={touch.pressRetentionOffset}
                style={[
                  styles.kindChip,
                  kind === option.value ? styles.kindChipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.kindChipText,
                    kind === option.value ? styles.kindChipTextActive : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Message"
            multiline
            numberOfLines={7}
            placeholder="What were you trying to do, what happened, and what did you expect?"
            textAlignVertical="top"
            value={message}
            onChangeText={updateMessage}
            helperText="Please avoid customer details, tax IDs, bank details, private keys, or backup contents."
            style={styles.feedbackInput}
          />

          <SupportCheckbox
            checked={includeDiagnostics}
            label="Include safe diagnostic summary"
            onPress={() => updateDiagnostics(!includeDiagnostics)}
          />

          {needsReview ? (
            <SupportCheckbox
              checked={privacyReviewed}
              label="I reviewed what will be shared"
              onPress={() => {
                setPrivacyReviewed(!privacyReviewed);
                setStatusMessage('');
              }}
            />
          ) : null}

          {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}

          <PrimaryButton loading={isSubmitting} disabled={!canSubmit} onPress={submitFeedback}>
            Send Request
          </PrimaryButton>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleBlock}>
              <Text style={styles.eyebrow}>Preview</Text>
              <Text style={styles.title}>What will be shared</Text>
            </View>
            <StatusChip
              label={draft.privateDataWarnings.length > 0 ? 'Review' : 'Looks safe'}
              tone={draft.privateDataWarnings.length > 0 ? 'warning' : 'success'}
            />
          </View>

          {draft.privateDataWarnings.length > 0 ? (
            <Text style={styles.warningText}>
              Private-looking details detected: {draft.privateDataWarnings.join(', ')}. The preview
              below removes them.
            </Text>
          ) : (
            <Text style={styles.message}>No private-looking details detected in the message.</Text>
          )}

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Message preview</Text>
            <Text style={styles.previewText}>
              {draft.sanitizedMessage || 'Your reviewed message will appear here.'}
            </Text>
          </View>

          {includeDiagnostics ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Safe diagnostic summary</Text>
              {Object.entries(diagnosticSummary.safeFields).map(([label, value]) => (
                <View style={styles.diagnosticRow} key={label}>
                  <Text style={styles.diagnosticLabel}>{formatDiagnosticLabel(label)}</Text>
                  <Text style={styles.diagnosticValue}>
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </Text>
                </View>
              ))}
              <Text style={styles.previewText}>{diagnosticSummary.privacyNote}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SupportCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={[styles.checkboxRow, checked ? styles.checkboxRowActive : null]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxActive : null]}>
        <Text style={[styles.checkboxMark, checked ? styles.checkboxMarkActive : null]}>✓</Text>
      </View>
      <Text style={styles.checkboxText}>{label}</Text>
    </Pressable>
  );
}

function buildSupportMessage(input: {
  draft: ReturnType<typeof buildFounderSafeSupportDraft>;
  diagnosticSummary: ReturnType<typeof buildFounderSafeDiagnosticSummary>;
  includeDiagnostics: boolean;
}) {
  const lines = [
    'Hello Orbit Ledger team,',
    '',
    input.draft.summary,
    '',
    'Message:',
    input.draft.sanitizedMessage,
  ];

  if (input.includeDiagnostics) {
    lines.push('', 'Safe diagnostic summary:');
    for (const [label, value] of Object.entries(input.diagnosticSummary.safeFields)) {
      lines.push(`- ${formatDiagnosticLabel(label)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }
    lines.push('', input.diagnosticSummary.privacyNote);
  }

  lines.push('', 'No customer records, invoices, payment proof, backups, or private keys are attached automatically.');
  return lines.join('\n');
}

function formatDiagnosticLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
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
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
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
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  kindChip: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  kindChipActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  kindChipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  kindChipTextActive: {
    color: colors.primary,
  },
  feedbackInput: {
    minHeight: 150,
  },
  checkboxRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkboxRowActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: 'transparent',
    fontSize: typography.caption,
    fontWeight: '900',
  },
  checkboxMarkActive: {
    color: colors.surface,
  },
  checkboxText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.label,
    fontWeight: '900',
    lineHeight: 20,
  },
  statusMessage: {
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.warningSurface,
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
    padding: spacing.md,
  },
  warningText: {
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.warningSurface,
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
    padding: spacing.md,
  },
  previewBox: {
    backgroundColor: 'rgba(248, 251, 255, 0.9)',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  diagnosticRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  diagnosticLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  diagnosticValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
});
