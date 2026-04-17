import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, spacing, touch, typography } from '../theme/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
};

export function ScreenHeader({ title, subtitle, onBack, backLabel = 'Back' }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          hitSlop={touch.hitSlop}
          onPress={onBack}
          pressRetentionOffset={touch.pressRetentionOffset}
          style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
        >
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
  },
  backButton: {
    minHeight: layout.minTapTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  backButtonPressed: {
    backgroundColor: colors.primarySurface,
  },
  backText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
