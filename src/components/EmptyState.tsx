import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { colors, spacing, typography } from '../theme/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <Card compact style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
  },
  title: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
    lineHeight: 22,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  action: {
    marginTop: spacing.xs,
  },
});
