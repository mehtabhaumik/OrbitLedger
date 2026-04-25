import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, radii, shadows, spacing, touch, typography } from '../theme/theme';

export type BottomNavigationTab = 'dashboard' | 'customers' | 'settings';

type BottomNavigationProps = {
  active: BottomNavigationTab;
  onDashboard: () => void;
  onCustomers: () => void;
  onSettings: () => void;
};

const tabs: Array<{
  key: BottomNavigationTab;
  label: string;
  accessibilityLabel: string;
}> = [
  {
    key: 'dashboard',
    label: 'Home',
    accessibilityLabel: 'Go to dashboard',
  },
  {
    key: 'customers',
    label: 'Customers',
    accessibilityLabel: 'Go to customers',
  },
  {
    key: 'settings',
    label: 'Settings',
    accessibilityLabel: 'Go to business profile settings',
  },
];

export function BottomNavigation({
  active,
  onDashboard,
  onCustomers,
  onSettings,
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  function getHandler(tab: BottomNavigationTab) {
    if (tab === 'dashboard') {
      return onDashboard;
    }

    if (tab === 'customers') {
      return onCustomers;
    }

    return onSettings;
  }

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.content}>
        {tabs.map((tab) => {
          const isActive = active === tab.key;

          return (
            <Pressable
              accessibilityLabel={tab.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              hitSlop={touch.hitSlop}
              key={tab.key}
              onPress={getHandler(tab.key)}
              pressRetentionOffset={touch.pressRetentionOffset}
              style={({ pressed }) => [
                styles.tab,
                isActive ? styles.tabActive : null,
                pressed ? styles.tabPressed : null,
              ]}
            >
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...shadows.raised,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  content: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    minHeight: layout.minTapTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  tabPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '900',
  },
});
