import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../theme/theme';

type MoneyTextProps = {
  children: string;
  tone?: 'default' | 'credit' | 'payment' | 'due' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
};

export function MoneyText({ children, tone = 'default', size = 'md', align = 'left' }: MoneyTextProps) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={0.76}
      numberOfLines={2}
      style={[styles.base, styles[tone], styles[size], align === 'right' ? styles.right : null]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sm: {
    fontSize: typography.body,
    lineHeight: 21,
  },
  md: {
    fontSize: typography.amount,
    lineHeight: 30,
  },
  lg: {
    fontSize: typography.balance,
    lineHeight: 36,
  },
  default: {
    color: colors.text,
  },
  credit: {
    color: colors.accent,
  },
  due: {
    color: colors.accent,
  },
  payment: {
    color: colors.success,
  },
  muted: {
    color: colors.textMuted,
  },
  right: {
    textAlign: 'right',
  },
});
