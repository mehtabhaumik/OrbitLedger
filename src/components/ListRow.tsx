import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, touch, typography } from '../theme/theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  right?: ReactNode;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'tax' | 'premium' | 'neutral';
  selected?: boolean;
  onPress?: () => void;
};

export function ListRow({
  title,
  subtitle,
  meta,
  right,
  accent = 'neutral',
  selected = false,
  onPress,
}: ListRowProps) {
  const pressScale = useRef(new Animated.Value(1)).current;

  function animatePress(toValue: number) {
    Animated.spring(pressScale, {
      toValue,
      friction: 8,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }] }}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        hitSlop={onPress ? touch.hitSlop : undefined}
        onPress={onPress}
        onPressIn={() => {
          if (onPress) {
            animatePress(0.99);
          }
        }}
        onPressOut={() => animatePress(1)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [
          styles.row,
          selected ? styles.selected : null,
          styles[`${accent}Accent`],
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.textBlock}>
          <Text numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text numberOfLines={1} style={styles.meta}>
              {meta}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  selected: {
    backgroundColor: colors.primarySurface,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 21,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 152,
  },
  primaryAccent: {
    borderLeftColor: colors.primary,
  },
  successAccent: {
    borderLeftColor: colors.success,
  },
  warningAccent: {
    borderLeftColor: colors.warning,
  },
  dangerAccent: {
    borderLeftColor: colors.danger,
  },
  taxAccent: {
    borderLeftColor: colors.tax,
  },
  premiumAccent: {
    borderLeftColor: colors.premium,
  },
  neutralAccent: {
    borderLeftColor: colors.borderStrong,
  },
});
