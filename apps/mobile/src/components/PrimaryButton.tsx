import type { ReactNode } from 'react';
import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing, touch, typography } from '../theme/theme';

type PrimaryButtonProps = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
};

export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const pressScale = useRef(new Animated.Value(1)).current;

  function animatePress(toValue: number) {
    Animated.spring(pressScale, {
      toValue,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={[styles.animatedShell, { transform: [{ scale: pressScale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        hitSlop={touch.hitSlop}
        onPress={onPress}
        onPressIn={() => {
          if (!isDisabled) {
            animatePress(0.985);
          }
        }}
        onPressOut={() => animatePress(1)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [
          styles.button,
          styles[variant],
          pressed && !isDisabled ? styles.pressed : null,
          isDisabled ? styles.disabled : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' || variant === 'danger' ? colors.surface : colors.primary}
          />
        ) : (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            style={[
              styles.label,
              variant === 'secondary' || variant === 'ghost' ? styles.secondaryLabel : null,
              variant === 'danger' ? styles.dangerLabel : null,
            ]}
          >
            {children}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedShell: {
    borderRadius: radii.md,
  },
  button: {
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadows.raised,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    ...shadows.card,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: colors.danger,
    ...shadows.raised,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  secondaryLabel: {
    color: colors.primary,
  },
  dangerLabel: {
    color: colors.surface,
  },
});
