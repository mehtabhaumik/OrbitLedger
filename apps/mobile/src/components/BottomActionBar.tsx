import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows, spacing } from '../theme/theme';

type BottomActionBarProps = {
  children: ReactNode;
};

export function BottomActionBar({ children }: BottomActionBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom + spacing.sm, spacing.lg) }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    ...shadows.raised,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
});
