import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { colors, spacing, typography } from '../theme/theme';

type SectionProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
};

export function Section({ title, subtitle, eyebrow, action, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 24,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
});
