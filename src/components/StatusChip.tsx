import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/theme';

export type StatusChipTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'tax'
  | 'premium'
  | 'neutral';

type StatusChipProps = {
  label: string;
  tone?: StatusChipTone;
};

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  return (
    <View style={[styles.chip, styles[`${tone}Chip`]]}>
      <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  text: {
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  primaryChip: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primarySurface,
  },
  successChip: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successSurface,
  },
  warningChip: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
  },
  dangerChip: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerSurface,
  },
  taxChip: {
    backgroundColor: colors.taxSurface,
    borderColor: colors.taxSurface,
  },
  premiumChip: {
    backgroundColor: colors.premiumSurface,
    borderColor: colors.premiumSurface,
  },
  neutralChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  primaryText: {
    color: colors.primary,
  },
  successText: {
    color: colors.success,
  },
  warningText: {
    color: colors.warning,
  },
  dangerText: {
    color: colors.danger,
  },
  taxText: {
    color: colors.tax,
  },
  premiumText: {
    color: colors.premium,
  },
  neutralText: {
    color: colors.textMuted,
  },
});
