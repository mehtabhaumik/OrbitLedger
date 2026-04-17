import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';

type ProductivityNudgeProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
};

export function ProductivityNudge({
  title,
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
}: ProductivityNudgeProps) {
  const hasActions = (actionLabel && onAction) || (dismissLabel && onDismiss);

  return (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <Text style={styles.label}>Helpful reminder</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {hasActions ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? (
            <PrimaryButton variant="ghost" onPress={onAction}>
              {actionLabel}
            </PrimaryButton>
          ) : null}
          {dismissLabel && onDismiss ? (
            <PrimaryButton variant="ghost" onPress={onDismiss}>
              {dismissLabel}
            </PrimaryButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.lg,
    gap: spacing.md,
  },
  textBlock: {
    gap: spacing.xs,
  },
  label: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 21,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
});
