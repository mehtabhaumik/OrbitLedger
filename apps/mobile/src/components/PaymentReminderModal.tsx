import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildPaymentReminderMessage,
  paymentReminderToneDescriptions,
  paymentReminderToneLabels,
} from '../collections';
import type { PaymentReminderTone } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import { colors, radii, shadows, spacing, touch, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';
import { StatusChip } from './StatusChip';

type PaymentReminderModalProps = {
  visible: boolean;
  businessName: string;
  customerName: string;
  balance: number;
  currency: string;
  lastPaymentDate?: string | null;
  lastReminderDate?: string | null;
  isSending?: boolean;
  onClose: () => void;
  onSend: (tone: PaymentReminderTone, message: string) => void;
};

const tones: PaymentReminderTone[] = ['polite', 'firm', 'final'];

export function PaymentReminderModal({
  visible,
  businessName,
  customerName,
  balance,
  currency,
  lastPaymentDate,
  lastReminderDate,
  isSending = false,
  onClose,
  onSend,
}: PaymentReminderModalProps) {
  const [selectedTone, setSelectedTone] = useState<PaymentReminderTone>('polite');
  const message = buildPaymentReminderMessage({
    balance,
    businessName,
    currency,
    customerName,
    lastPaymentDate,
    tone: selectedTone,
  });

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>Payment follow-up</Text>
                <Text style={styles.title}>Send reminder</Text>
                <Text style={styles.subtitle}>
                  {customerName} owes {formatCurrency(Math.max(balance, 0), currency)}.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close payment reminder"
                accessibilityRole="button"
                hitSlop={touch.hitSlop}
                onPress={onClose}
                pressRetentionOffset={touch.pressRetentionOffset}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.metaRow}>
              <MetaChip label="Last payment" value={lastPaymentDate ? formatShortDate(lastPaymentDate) : 'Not recorded'} />
              <MetaChip label="Last reminder" value={lastReminderDate ? formatShortDate(lastReminderDate) : 'Never'} />
            </View>

            <View style={styles.toneGrid}>
              {tones.map((tone) => {
                const selected = tone === selectedTone;
                return (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    key={tone}
                    onPress={() => setSelectedTone(tone)}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={({ pressed }) => [
                      styles.toneCard,
                      selected ? styles.toneCardSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View style={styles.toneHeader}>
                      <Text style={[styles.toneTitle, selected ? styles.toneTitleSelected : null]}>
                        {paymentReminderToneLabels[tone]}
                      </Text>
                      {selected ? <StatusChip label="Selected" tone="primary" /> : null}
                    </View>
                    <Text style={styles.toneDescription}>
                      {paymentReminderToneDescriptions[tone]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Message preview</Text>
              <ScrollView style={styles.previewScroll}>
                <Text style={styles.previewText}>{message}</Text>
              </ScrollView>
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                loading={isSending}
                disabled={isSending || balance <= 0}
                onPress={() => onSend(selectedTone, message)}
              >
                Share Reminder
              </PrimaryButton>
              <PrimaryButton variant="ghost" disabled={isSending} onPress={onClose}>
                Not now
              </PrimaryButton>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  safeArea: {
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  closeText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metaChip: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  toneGrid: {
    gap: spacing.sm,
  },
  toneCard: {
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  toneCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  pressed: {
    opacity: 0.82,
  },
  toneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toneTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  toneTitleSelected: {
    color: colors.primary,
  },
  toneDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  previewCard: {
    minHeight: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  previewScroll: {
    maxHeight: 180,
  },
  previewText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  actions: {
    gap: spacing.sm,
  },
});
