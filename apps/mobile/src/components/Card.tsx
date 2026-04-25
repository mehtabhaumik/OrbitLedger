import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { borders, colors, layout, shadows, spacing } from '../theme/theme';

type CardProps = {
  children: ReactNode;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'tax' | 'premium';
  compact?: boolean;
  elevated?: boolean;
  glass?: boolean;
  style?: ViewStyle;
};

export function Card({
  children,
  accent,
  compact = false,
  elevated = false,
  glass = false,
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        compact ? styles.compact : null,
        elevated ? styles.elevated : null,
        glass ? styles.glass : null,
        accent ? styles.withAccent : null,
        accent ? styles[accent] : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...borders.card,
    ...shadows.card,
    backgroundColor: colors.surface,
    padding: layout.cardPadding,
    gap: spacing.md,
  },
  compact: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  elevated: {
    ...shadows.raised,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(184, 196, 214, 0.72)',
  },
  withAccent: {
    borderLeftWidth: 4,
  },
  primary: {
    borderLeftColor: colors.primary,
  },
  success: {
    borderLeftColor: colors.success,
  },
  warning: {
    borderLeftColor: colors.warning,
  },
  danger: {
    borderLeftColor: colors.danger,
  },
  tax: {
    borderLeftColor: colors.tax,
  },
  premium: {
    borderLeftColor: colors.premium,
  },
});
