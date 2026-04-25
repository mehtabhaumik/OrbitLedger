import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, touch, typography } from '../theme/theme';

type FloatingActionButtonProps = {
  label: string;
  onPress: () => void;
  bottomOffset?: number;
  compact?: boolean;
};

export function FloatingActionButton({
  label,
  onPress,
  bottomOffset = spacing.lg,
  compact = false,
}: FloatingActionButtonProps) {
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
    <Animated.View
      style={[styles.shell, { bottom: bottomOffset, transform: [{ scale: pressScale }] }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={touch.hitSlop}
        onPress={onPress}
        onPressIn={() => animatePress(0.985)}
        onPressOut={() => animatePress(1)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [
          styles.button,
          compact ? styles.buttonCompact : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={styles.plus}>+</Text>
        {compact ? null : (
          <Text numberOfLines={1} style={styles.label}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    right: spacing.lg,
    borderRadius: radii.md,
  },
  button: {
    minHeight: 56,
    maxWidth: 220,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    elevation: 4,
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonCompact: {
    width: 58,
    height: 58,
    paddingHorizontal: 0,
  },
  pressed: {
    backgroundColor: colors.primaryPressed,
  },
  plus: {
    color: colors.surface,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 28,
  },
  label: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
