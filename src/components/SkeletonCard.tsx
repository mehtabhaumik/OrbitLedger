import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Card } from './Card';
import { colors, spacing } from '../theme/theme';

type SkeletonCardProps = {
  lines?: number;
};

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.48)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.48,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Card compact>
      <Animated.View style={[styles.block, styles.title, { opacity }]} />
      {Array.from({ length: lines }).map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.block,
            { opacity, width: `${Math.max(44, 92 - index * 16)}%` },
          ]}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: {
    height: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    marginVertical: spacing.xs,
  },
  title: {
    height: 20,
    width: '58%',
  },
});
