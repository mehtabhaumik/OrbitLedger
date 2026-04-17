import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ListRenderItem, StyleProp, TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { getBusinessSettings, searchCustomerSummaries } from '../database';
import type { CustomerSummary, CustomerSummaryFilter } from '../database';
import { formatCurrency } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme/theme';

type CustomersScreenProps = NativeStackScreenProps<RootStackParamList, 'Customers'>;

const CUSTOMER_FILTERS: Array<{ label: string; value: CustomerSummaryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Outstanding', value: 'outstanding' },
  { label: 'Recent', value: 'recent_activity' },
  { label: 'Archived', value: 'archived' },
];

export function CustomersScreen({ navigation }: CustomersScreenProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CustomerSummaryFilter>('all');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchRequestIdRef = useRef(0);

  const loadCustomers = useCallback(
    async (searchQuery = query, selectedFilter = filter) => {
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      const [settings, results] = await Promise.all([
        getBusinessSettings(),
        searchCustomerSummaries({
          query: searchQuery,
          filter: selectedFilter,
          limit: selectedFilter === 'archived' ? 100 : 80,
        }),
      ]);

      if (requestId === searchRequestIdRef.current) {
        setCurrency(settings?.currency ?? 'INR');
        setCustomers(results);
      }
    },
    [filter, query]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadCustomers();
        } catch {
          if (isActive) {
            Alert.alert('Customers could not load', 'Please try again.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      load();

      return () => {
        isActive = false;
      };
    }, [loadCustomers])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadCustomers();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function onSearchChange(value: string) {
    setQuery(value);
    try {
      await loadCustomers(value, filter);
    } catch {
      Alert.alert('Search failed', 'Please try again.');
    }
  }

  async function onFilterChange(nextFilter: CustomerSummaryFilter) {
    setFilter(nextFilter);
    try {
      await loadCustomers(query, nextFilter);
    } catch {
      Alert.alert('Filter failed', 'Please try again.');
    }
  }

  const renderCustomer: ListRenderItem<CustomerSummary> = ({ item }) => {
    const balanceLabel =
      item.isArchived
        ? 'Archived'
        : item.balance > 0
          ? 'They owe you'
          : item.balance < 0
            ? 'You owe them'
            : 'Settled';
    const latestActivityDate = new Date(item.latestActivityAt);
    const activityText = Number.isNaN(latestActivityDate.getTime())
      ? 'Latest activity not available'
      : `Latest activity ${latestActivityDate.toLocaleDateString()}`;

    return (
      <Pressable
        accessibilityRole="button"
        hitSlop={touch.hitSlop}
        onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id })}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={[
          styles.customerCard,
          item.isArchived
            ? styles.customerArchived
            : item.balance > 0
              ? styles.customerDue
              : item.balance < 0
                ? styles.customerAdvance
                : styles.customerSettled,
        ]}
      >
        <View style={styles.customerText}>
          <HighlightedText
            text={item.name}
            query={query}
            style={styles.customerName}
            highlightStyle={styles.highlightText}
          />
          {item.phone ? (
            <HighlightedText
              text={item.phone}
              query={query}
              style={styles.muted}
              highlightStyle={styles.highlightText}
            />
          ) : null}
          {item.notes ? (
            <HighlightedText
              text={item.notes}
              query={query}
              numberOfLines={2}
              style={styles.noteText}
              highlightStyle={styles.highlightText}
            />
          ) : null}
          <Text style={styles.activityText}>{activityText}</Text>
        </View>
        <View style={styles.balanceBlock}>
          <StatusChip
            label={balanceLabel}
            tone={
              item.isArchived
                ? 'neutral'
                : item.balance > 0
                  ? 'warning'
                  : item.balance < 0
                    ? 'tax'
                    : 'success'
            }
          />
          <MoneyText
            size="sm"
            align="right"
            tone={item.balance > 0 ? 'due' : item.balance < 0 ? 'muted' : 'payment'}
          >
            {formatCurrency(item.balance, currency)}
          </MoneyText>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <ScreenHeader
              title="Customers"
              subtitle="Search by name, phone, or notes. Use filters to find the accounts you need now."
              backLabel="Back to home"
              onBack={() => navigation.navigate('Dashboard')}
            />
            <TextField
              label="Search customers"
              value={query}
              onChangeText={onSearchChange}
              placeholder="Name, phone, or notes"
              helperText={filter === 'recent_activity' ? 'Recent means activity in the last 30 days.' : undefined}
            />
            <View style={styles.filterRow}>
              {CUSTOMER_FILTERS.map((option) => {
                const selected = option.value === filter;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    onPress={() => onFilterChange(option.value)}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
                  >
                    <Text style={[styles.filterChipText, selected ? styles.filterChipTextSelected : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Card compact accent="primary">
              <PrimaryButton onPress={() => navigation.navigate('CustomerForm')}>
                Add Customer
              </PrimaryButton>
            </Card>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>Loading customers</Text>
              <SkeletonCard lines={2} />
            </View>
          ) : (
            <EmptyState
              title={getEmptyTitle(query, filter)}
              message={getEmptyMessage(query, filter)}
              action={
                <PrimaryButton
                  variant={query.trim() || filter !== 'all' ? 'secondary' : 'primary'}
                  onPress={() => navigation.navigate('CustomerForm')}
                >
                  Add Customer
                </PrimaryButton>
              }
            />
          )
        }
      />
      <FloatingActionButton
        bottomOffset={96}
        label="Add Transaction"
        onPress={() => navigation.navigate('TransactionForm')}
      />
      <BottomNavigation
        active="customers"
        onCustomers={() => navigation.navigate('Customers')}
        onDashboard={() => navigation.navigate('Dashboard')}
        onSettings={() => navigation.navigate('BusinessProfileSettings')}
      />
    </SafeAreaView>
  );
}

function getEmptyTitle(query: string, filter: CustomerSummaryFilter): string {
  if (query.trim()) {
    return 'No matching customers';
  }

  if (filter === 'outstanding') {
    return 'No outstanding dues';
  }

  if (filter === 'recent_activity') {
    return 'No recent activity';
  }

  if (filter === 'archived') {
    return 'No archived customers';
  }

  return 'No customers yet';
}

function getEmptyMessage(query: string, filter: CustomerSummaryFilter): string {
  if (query.trim()) {
    return 'Try a different name, phone, or note.';
  }

  if (filter === 'outstanding') {
    return 'Customers with unpaid dues will appear here.';
  }

  if (filter === 'recent_activity') {
    return 'Customers with activity in the last 30 days will appear here.';
  }

  if (filter === 'archived') {
    return 'Archived customers stay available when you need to review old records.';
  }

  return 'No customers yet. Add your first customer to start tracking.';
}

type HighlightedTextProps = {
  text: string;
  query: string;
  style: StyleProp<TextStyle>;
  highlightStyle: StyleProp<TextStyle>;
  numberOfLines?: number;
};

function HighlightedText({ text, query, style, highlightStyle, numberOfLines }: HighlightedTextProps) {
  const parts = getHighlightedParts(text, query);

  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {parts.map((part, index) => (
        <Text key={`${part.text}-${index}`} style={part.matches ? highlightStyle : null}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

function getHighlightedParts(text: string, query: string): Array<{ text: string; matches: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [{ text, matches: false }];
  }

  const haystack = text.toLowerCase();
  const parts: Array<{ text: string; matches: boolean }> = [];
  let cursor = 0;
  let matchIndex = haystack.indexOf(needle);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), matches: false });
    }

    const endIndex = matchIndex + needle.length;
    parts.push({ text: text.slice(matchIndex, endIndex), matches: true });
    cursor = endIndex;
    matchIndex = haystack.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), matches: false });
  }

  return parts.length ? parts : [{ text, matches: false }];
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 176,
  },
  headerContent: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  filterChipTextSelected: {
    color: colors.primary,
  },
  separator: {
    height: spacing.md,
  },
  loadingBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  customerCard: {
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  customerDue: {
    borderLeftColor: colors.warning,
  },
  customerAdvance: {
    borderLeftColor: colors.tax,
  },
  customerSettled: {
    borderLeftColor: colors.success,
  },
  customerArchived: {
    borderLeftColor: colors.borderStrong,
  },
  customerText: {
    flex: 1,
    gap: spacing.xs,
  },
  customerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  activityText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  noteText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  highlightText: {
    backgroundColor: colors.warningSurface,
    color: colors.text,
    fontWeight: '900',
  },
  balanceBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 132,
  },
  receivable: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '900',
  },
  settled: {
    color: colors.success,
    fontSize: typography.body,
    fontWeight: '900',
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeOutstanding: {
    backgroundColor: colors.accentSurface,
  },
  badgeSettled: {
    backgroundColor: colors.successSurface,
  },
  badgeArchived: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  badgeOutstandingText: {
    color: colors.accent,
  },
  badgeSettledText: {
    color: colors.success,
  },
  badgeArchivedText: {
    color: colors.textMuted,
  },
  emptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
