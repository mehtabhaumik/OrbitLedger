import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { colors, layout, shadows, spacing, touch, typography } from '../theme/theme';

type MenuItem = {
  key: string;
  label: string;
  helper: string;
  screen: keyof RootStackParamList;
  params?: RootStackParamList[keyof RootStackParamList];
};

const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    label: 'Home',
    helper: 'Daily priorities and quick actions.',
    screen: 'Dashboard',
  },
  {
    key: 'customers',
    label: 'Customers',
    helper: 'Search ledgers and follow up dues.',
    screen: 'Customers',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    helper: 'Create, review, and share invoices.',
    screen: 'Invoices',
  },
  {
    key: 'reports',
    label: 'Reports',
    helper: 'Business review, compliance, and exports.',
    screen: 'Reports',
  },
  {
    key: 'settings',
    label: 'Settings',
    helper: 'Business profile, security, backups, and tax.',
    screen: 'BusinessProfileSettings',
  },
  {
    key: 'founder-note',
    label: "Founder's Note",
    helper: 'Vision, product direction, and future plan.',
    screen: 'FounderNote',
  },
  {
    key: 'helper',
    label: 'Orbit Helper',
    helper: 'Guided help for daily workflows.',
    screen: 'OrbitHelper',
    params: { screenContext: 'menu' },
  },
  {
    key: 'backup',
    label: 'Backup & Restore',
    helper: 'Protect and recover business records.',
    screen: 'BackupRestore',
  },
];

export function OrbitHeaderMenu() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [visible, setVisible] = useState(false);

  const items = useMemo(
    () =>
      menuItems.map((item) => ({
        ...item,
        active: route.name === item.screen,
      })),
    [route.name]
  );

  function handleSelect(item: MenuItem) {
    setVisible(false);
    if (route.name === item.screen) {
      return;
    }
    if (item.params === undefined) {
      navigation.navigate(item.screen);
      return;
    }
    navigation.navigate(item.screen, item.params);
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Open app menu"
        accessibilityRole="button"
        hitSlop={touch.hitSlop}
        onPress={() => setVisible(true)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
      >
        <View style={styles.triggerBars}>
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.barShort} />
        </View>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.sheet}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Orbit Ledger</Text>
              <Text style={styles.sheetSubtitle}>Shortcuts for your main work.</Text>
            </View>
            <View style={styles.sheetList}>
              {items.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  key={item.key}
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    item.active ? styles.menuItemActive : null,
                    pressed ? styles.menuItemPressed : null,
                  ]}
                >
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuHelper}>{item.helper}</Text>
                  </View>
                  <Text style={styles.menuChevron}>{item.active ? 'Open' : 'Go'}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: layout.minTapTarget,
    minWidth: layout.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.84)',
    borderWidth: 1,
    borderColor: 'rgba(180, 194, 214, 0.82)',
    ...shadows.card,
  },
  triggerPressed: {
    backgroundColor: 'rgba(237, 243, 252, 0.96)',
  },
  triggerBars: {
    gap: 4,
  },
  bar: {
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
  barShort: {
    width: 12,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    padding: spacing.lg,
    justifyContent: 'flex-start',
  },
  sheet: {
    marginTop: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(182, 194, 212, 0.74)',
    backgroundColor: 'rgba(252, 253, 255, 0.97)',
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.raised,
  },
  sheetHeader: {
    gap: spacing.xs,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  sheetList: {
    gap: spacing.sm,
  },
  menuItem: {
    minHeight: layout.minTapTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  menuItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  menuItemPressed: {
    opacity: 0.9,
  },
  menuText: {
    flex: 1,
    gap: spacing.xs,
  },
  menuLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  menuHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  menuChevron: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
});
