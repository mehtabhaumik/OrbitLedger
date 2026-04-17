import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/theme';

type OrbitHelperStatusProps = {
  label?: string;
  compact?: boolean;
};

export function OrbitHelperStatus({
  label = 'Orbit Helper online',
  compact = false,
}: OrbitHelperStatusProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.85],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 0],
  });

  return (
    <View style={[styles.status, compact ? styles.compact : null]}>
      <View style={styles.dotWrap}>
        <Animated.View style={[styles.dotPulse, { opacity, transform: [{ scale }] }]} />
        <View style={styles.dot} />
      </View>
      <Text numberOfLines={compact ? 1 : 2} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderColor: colors.successSurface,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
  },
  compact: {
    minHeight: 28,
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  label: {
    color: colors.success,
    flexShrink: 1,
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
});
