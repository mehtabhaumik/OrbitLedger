import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { OrbitHeaderMenu } from './OrbitHeaderMenu';
import { colors, layout, shadows, spacing, touch, typography } from '../theme/theme';

const headerIcon = require('../../assets/branding/orbit-ledger-logo-transparent.png');
const logoSize = Platform.select({
  web: { width: 84, height: 26 },
  default: { width: 76, height: 24 },
});

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
};

export function ScreenHeader({ title, subtitle, onBack, backLabel = 'Back' }: ScreenHeaderProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel={backLabel}
            accessibilityRole="button"
            hitSlop={touch.hitSlop}
            onPress={onBack}
            pressRetentionOffset={touch.pressRetentionOffset}
            style={({ pressed }) => [styles.backButton, pressed ? styles.backButtonPressed : null]}
          >
            <Text style={styles.backText}>{backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <OrbitHeaderMenu />
      </View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Image source={headerIcon} style={styles.icon} resizeMode="contain" />
          <Text style={styles.title}>{title}</Text>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...shadows.card,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(180, 194, 214, 0.72)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  header: {
    gap: spacing.md,
  },
  backSpacer: {
    minHeight: layout.minTapTarget,
    minWidth: layout.minTapTarget,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  icon: {
    width: logoSize?.width ?? 76,
    height: logoSize?.height ?? 24,
  },
  backButton: {
    minHeight: layout.minTapTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  backButtonPressed: {
    backgroundColor: colors.primarySurface,
  },
  backText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
});
