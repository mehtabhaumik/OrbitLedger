import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { colors, layout, shadows, spacing, touch, typography } from '../theme/theme';

export function FounderFooterLink() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={() => navigation.navigate('FounderNote')}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.textBlock}>
        <Text style={styles.kicker}>Founder's Note</Text>
        <Text style={styles.title}>Why Orbit Ledger exists and where it is going.</Text>
        <Text style={styles.body}>
          Read the product vision, what business problem it is solving, and what comes next.
        </Text>
      </View>
      <Text style={styles.link}>Open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.minTapTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.primarySurface,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
});
