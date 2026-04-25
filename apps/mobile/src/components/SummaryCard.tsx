import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { borders, colors, layout, shadows, spacing, typography } from '../theme/theme';

type SummaryCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'due' | 'payment' | 'primary' | 'premium' | 'tax';
  style?: StyleProp<ViewStyle>;
};

export function SummaryCard({ label, value, helper, tone = 'default', style }: SummaryCardProps) {
  return (
    <View style={[styles.card, styles[`${tone}Accent`], style]}>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={2}
        style={[styles.value, styles[`${tone}Value`]]}
      >
        {value}
      </Text>
      {helper ? (
        <Text numberOfLines={3} style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 156,
    minWidth: 148,
    ...borders.card,
    ...shadows.card,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    padding: layout.cardPadding,
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  defaultAccent: {
    borderLeftColor: colors.borderStrong,
  },
  dueAccent: {
    borderLeftColor: colors.accent,
  },
  paymentAccent: {
    borderLeftColor: colors.success,
  },
  primaryAccent: {
    borderLeftColor: colors.primary,
  },
  premiumAccent: {
    borderLeftColor: colors.premium,
  },
  taxAccent: {
    borderLeftColor: colors.tax,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 17,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: typography.amount,
    fontWeight: '900',
    lineHeight: 30,
  },
  defaultValue: {
    color: colors.text,
  },
  dueValue: {
    color: colors.accent,
  },
  paymentValue: {
    color: colors.success,
  },
  primaryValue: {
    color: colors.primary,
  },
  premiumValue: {
    color: colors.premium,
  },
  taxValue: {
    color: colors.tax,
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
    marginTop: 'auto',
  },
});
