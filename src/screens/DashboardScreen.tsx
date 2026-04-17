import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  dismissBackupTrustNudge,
  getBackupTrustNudge,
  type BackupTrustNudge,
} from '../backup';
import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MoneyText } from '../components/MoneyText';
import { OrbitHelperStatus } from '../components/OrbitHelperStatus';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProductivityNudge } from '../components/ProductivityNudge';
import { QuickActionGrid } from '../components/QuickActionGrid';
import { Section } from '../components/Section';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import {
  getBusinessSettings,
  getDashboardSummary,
  getFeatureToggles,
  getRecentTransactions,
  getTopDueCustomers,
  listProducts,
} from '../database';
import type {
  AppFeatureToggles,
  BusinessSettings,
  DashboardSummary,
  Product,
  RecentTransaction,
  TopDueCustomer,
} from '../database';
import {
  formatCurrency,
  formatShortDate,
  formatSignedCurrency,
  formatTransactionType,
} from '../lib/format';
import {
  dismissRetentionNudge,
  dismissRatingPrompt,
  getDismissedRetentionNudgeIds,
  getRatingPrompt,
  markRatingCompleted,
  markRatingPromptActioned,
  markRatingPromptShown,
  openPlayStoreRating,
  type RatingPrompt,
  type RetentionNudgeId,
} from '../engagement';
import {
  dismissUpgradeNudge,
  getUpgradeNudge,
  recordUpgradeNudgeActioned,
  type UpgradeNudge,
} from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme/theme';

type DashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
type DashboardNudge = {
  id: RetentionNudgeId;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  dismissLabel: string;
  onDismiss: () => void;
};

export function DashboardScreen({ navigation }: DashboardScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [topDueCustomers, setTopDueCustomers] = useState<TopDueCustomer[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [backupNudge, setBackupNudge] = useState<BackupTrustNudge | null>(null);
  const [upgradeNudge, setUpgradeNudge] = useState<UpgradeNudge | null>(null);
  const [ratingPrompt, setRatingPrompt] = useState<RatingPrompt | null>(null);
  const [dismissedRetentionNudges, setDismissedRetentionNudges] = useState<RetentionNudgeId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currency = business?.currency ?? 'INR';

  const loadDashboard = useCallback(async () => {
    const settings = await getBusinessSettings();
    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    const [
      dashboardSummary,
      recent,
      topDue,
      toggles,
      nudge,
      proNudge,
      appRatingPrompt,
      dismissedNudgeIds,
      productsForAttention,
    ] = await Promise.all([
      getDashboardSummary(),
      getRecentTransactions(8),
      getTopDueCustomers(3),
      getFeatureToggles(),
      getBackupTrustNudge(),
      getUpgradeNudge(),
      getRatingPrompt(),
      getDismissedRetentionNudgeIds(),
      listProducts({ limit: 100 }).catch(() => []),
    ]);

    setBusiness(settings);
    setSummary(dashboardSummary);
    setRecentTransactions(recent);
    setTopDueCustomers(topDue);
    setLowStockProducts(productsForAttention.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= 5).slice(0, 2));
    setFeatureToggles(toggles);
    setBackupNudge(nudge);
    setUpgradeNudge(proNudge);
    setRatingPrompt(appRatingPrompt);
    setDismissedRetentionNudges(dismissedNudgeIds);
    if (appRatingPrompt) {
      await markRatingPromptShown();
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadDashboard();
        } catch {
          if (isActive) {
            Alert.alert('Dashboard could not load', 'Please try again.');
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
    }, [loadDashboard])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadDashboard();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function dismissBackupNudge() {
    setBackupNudge(null);
    await dismissBackupTrustNudge();
  }

  async function openUpgradeFromNudge() {
    setUpgradeNudge(null);
    await recordUpgradeNudgeActioned();
    navigation.navigate('Upgrade');
  }

  async function dismissProNudge() {
    setUpgradeNudge(null);
    await dismissUpgradeNudge();
  }

  async function rateFromDashboard() {
    try {
      await openPlayStoreRating();
      await markRatingCompleted();
      setRatingPrompt(null);
    } catch {
      Alert.alert('Play Store unavailable', 'Please try again later from your device.');
    }
  }

  async function openFeedbackFromDashboard() {
    setRatingPrompt(null);
    await markRatingPromptActioned();
    navigation.navigate('Feedback');
  }

  async function dismissRatingNudge() {
    setRatingPrompt(null);
    await dismissRatingPrompt();
  }

  async function dismissRetentionReminder(id: RetentionNudgeId) {
    setDismissedRetentionNudges((currentIds) =>
      currentIds.includes(id) ? currentIds : [...currentIds, id]
    );
    await dismissRetentionNudge(id);
  }

  const trend = getActivityTrend(summary);
  const nudges = getDashboardNudges({
    summary,
    topDueCustomers,
    currency,
    dismissedNudgeIds: dismissedRetentionNudges,
    onAddTransaction: () => navigation.navigate('TransactionForm'),
    onOpenCustomer: (customerId) => navigation.navigate('CustomerDetail', { customerId }),
    onDismissNudge: dismissRetentionReminder,
  });
  const invoicesEnabled = featureToggles?.invoices ?? true;
  const productsEnabled = invoicesEnabled && (featureToggles?.inventory ?? true);
  const receivableTone = (summary?.totalReceivable ?? 0) > 0 ? 'warning' : 'success';
  const attentionCount =
    topDueCustomers.length + (summary?.followUpCustomerCount ?? 0) + (productsEnabled ? lowStockProducts.length : 0);
  const attentionRows: Array<{
    helper: string;
    label: string;
    tone: 'success' | 'warning' | 'neutral';
    value: string;
  }> = [
    {
      label: 'Stale dues',
      value: `${summary?.followUpCustomerCount ?? 0}`,
      helper: 'Positive balances without payment in 30 days.',
      tone: (summary?.followUpCustomerCount ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      label: 'Activity trend',
      value: trend.label,
      helper: trend.helper,
      tone: trend.isUp ? 'success' : 'neutral',
    },
    ...(productsEnabled
      ? [
          {
            label: 'Low stock',
            value: `${lowStockProducts.length}`,
            helper:
              lowStockProducts.length > 0
                ? lowStockProducts.map((product) => product.name).join(', ')
                : 'No low stock items found.',
            tone: lowStockProducts.length > 0 ? 'warning' : 'success',
          } as const,
        ]
      : []),
  ];

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading your ledger</Text>
        <View style={styles.loadingStack}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.eyebrow}>Orbit Ledger</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={2}
              style={styles.businessName}
            >
              {business?.businessName ?? 'Business'}
            </Text>
          </View>
          <View style={styles.headerMeta}>
            <StatusChip label="On-device" tone="neutral" />
            <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        <Card accent={receivableTone} elevated glass style={styles.heroMoneyCard}>
          <View style={styles.heroMoneyTop}>
            <View style={styles.heroMoneyText}>
              <Text style={styles.eyebrow}>Money to collect</Text>
              <Text style={styles.heroTitle}>Total receivable</Text>
              <MoneyText size="lg" tone={(summary?.totalReceivable ?? 0) > 0 ? 'due' : 'payment'}>
                {formatCurrency(summary?.totalReceivable ?? 0, currency)}
              </MoneyText>
              <Text style={styles.heroHelper}>
                {(summary?.followUpCustomerCount ?? 0) > 0
                  ? `${summary?.followUpCustomerCount ?? 0} customers need follow-up.`
                  : 'No overdue follow-up needed right now.'}
              </Text>
            </View>
            <StatusChip
              label={(summary?.totalReceivable ?? 0) > 0 ? 'Dues open' : 'Clear'}
              tone={receivableTone}
            />
          </View>
        </Card>

        <Section title="Fast counter actions" subtitle="Record the most common work in a few taps.">
          <QuickActionGrid>
            <PrimaryButton style={styles.quickActionButton} onPress={() => navigation.navigate('TransactionForm', { type: 'payment' })}>
              Add Payment
            </PrimaryButton>
            <PrimaryButton style={styles.quickActionButton} variant="secondary" onPress={() => navigation.navigate('TransactionForm', { type: 'credit' })}>
              Add Credit
            </PrimaryButton>
            <PrimaryButton style={styles.quickActionButton} variant="secondary" onPress={() => navigation.navigate('CustomerForm')}>
              Add Customer
            </PrimaryButton>
          </QuickActionGrid>
        </Section>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Recent payments"
            value={formatCurrency(summary?.recentPaymentsReceived ?? 0, currency)}
            helper="Payments received in the last 7 days."
            tone="payment"
          />
          <SummaryCard
            label="Outstanding"
            value={`${summary?.customersWithOutstandingBalance ?? 0}`}
            helper="Customers with a positive balance."
            tone={(summary?.customersWithOutstandingBalance ?? 0) > 0 ? 'due' : 'payment'}
          />
          <SummaryCard
            label="Today's entries"
            value={`${summary?.todayEntries ?? 0}`}
            helper="Transactions added today."
            tone="primary"
          />
        </View>

        <Section
          title="Needs attention"
          subtitle={attentionCount > 0 ? `${attentionCount} business signals to review.` : 'No urgent action right now.'}
        >
          <Card compact accent={attentionCount > 0 ? 'warning' : 'success'}>
            <View style={styles.insightList}>
              {attentionRows.map((row) => (
                <View key={row.label} style={styles.attentionRow}>
                  <View style={styles.attentionText}>
                    <Text style={styles.attentionLabel}>{row.label}</Text>
                    <Text style={styles.attentionHelper}>{row.helper}</Text>
                  </View>
                  <StatusChip label={row.value} tone={row.tone === 'neutral' ? 'neutral' : row.tone} />
                </View>
              ))}
            </View>
          </Card>
        </Section>

        {nudges.length > 0 ? (
          <ProductivityNudge
            actionLabel={nudges[0].actionLabel}
            message={nudges[0].message}
            dismissLabel={nudges[0].dismissLabel}
            onAction={nudges[0].onAction}
            onDismiss={nudges[0].onDismiss}
            title={nudges[0].title}
          />
        ) : backupNudge ? (
          <View style={styles.backupNudge}>
            <Text style={styles.backupNudgeLabel}>Backup reminder</Text>
            <Text style={styles.backupNudgeTitle}>{backupNudge.title}</Text>
            <Text style={styles.backupNudgeText}>{backupNudge.message}</Text>
            <View style={styles.backupNudgeActions}>
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BackupRestore')}>
                Export Backup
              </PrimaryButton>
              <PrimaryButton variant="ghost" onPress={() => void dismissBackupNudge()}>
                Not now
              </PrimaryButton>
            </View>
          </View>
        ) : null}

        {upgradeNudge ? (
          <View style={styles.upgradeNudge}>
            <Text style={styles.upgradeNudgeLabel}>Pro tip</Text>
            <Text style={styles.upgradeNudgeTitle}>{upgradeNudge.title}</Text>
            <Text style={styles.upgradeNudgeText}>{upgradeNudge.message}</Text>
            <View style={styles.backupNudgeActions}>
              <PrimaryButton variant="secondary" onPress={() => void openUpgradeFromNudge()}>
                View Pro Benefits
              </PrimaryButton>
              <PrimaryButton variant="ghost" onPress={() => void dismissProNudge()}>
                Not now
              </PrimaryButton>
            </View>
          </View>
        ) : null}

        {ratingPrompt ? (
          <View style={styles.ratingNudge}>
            <Text style={styles.ratingNudgeLabel}>Feedback</Text>
            <Text style={styles.ratingNudgeTitle}>{ratingPrompt.title}</Text>
            <Text style={styles.ratingNudgeText}>{ratingPrompt.message}</Text>
            <View style={styles.ratingNudgeActions}>
              <PrimaryButton variant="secondary" onPress={() => void rateFromDashboard()}>
                Rate Orbit Ledger
              </PrimaryButton>
              <PrimaryButton variant="secondary" onPress={() => void openFeedbackFromDashboard()}>
                Send Feedback
              </PrimaryButton>
              <PrimaryButton variant="ghost" onPress={() => void dismissRatingNudge()}>
                Not now
              </PrimaryButton>
            </View>
          </View>
        ) : null}

        <Section title="Highest dues" subtitle="Customers to follow up first.">
          {topDueCustomers.length === 0 ? (
            <EmptyState
              title="No dues to collect"
              message="Customers with the highest positive balances will appear here."
              action={
                <PrimaryButton variant="secondary" onPress={() => navigation.navigate('CustomerForm')}>
                  Add Customer
                </PrimaryButton>
              }
            />
          ) : (
            <View style={styles.dueList}>
              {topDueCustomers.map((customer, index) => (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  key={customer.id}
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={styles.dueItem}
                >
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.dueCustomerText}>
                    <Text style={styles.customerName}>{customer.name}</Text>
                    <Text style={styles.transactionMeta}>
                      Last activity {formatShortDate(customer.latestActivityAt)}
                    </Text>
                  </View>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                    numberOfLines={2}
                    style={styles.dueAmount}
                  >
                    {formatCurrency(customer.balance, currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Section>

        <Section title="Recent activity" subtitle="Latest ledger entries saved on this device.">
          {recentTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              message="Add your first credit or payment entry to start tracking balances offline."
              action={
                <PrimaryButton onPress={() => navigation.navigate('TransactionForm')}>
                  Add Transaction
                </PrimaryButton>
              }
            />
          ) : (
            <View style={styles.transactionList}>
              {recentTransactions.map((transaction) => {
                const isCredit = transaction.type === 'credit';
                return (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionText}>
                      <Text style={styles.customerName}>{transaction.customerName}</Text>
                      <Text style={styles.transactionMeta}>
                        {formatTransactionType(transaction.type)} ·{' '}
                        {formatShortDate(transaction.effectiveDate)}
                      </Text>
                      {transaction.note ? (
                        <Text style={styles.transactionNote}>{transaction.note}</Text>
                      ) : null}
                    </View>
                    <View style={styles.recentAmountBlock}>
                      <StatusChip label={isCredit ? 'Credit' : 'Payment'} tone={isCredit ? 'warning' : 'success'} />
                      <MoneyText size="sm" tone={isCredit ? 'credit' : 'payment'} align="right">
                        {formatSignedCurrency(transaction.amount, currency, transaction.type)}
                      </MoneyText>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Section>

        <Section title="Business tools" subtitle="Documents, reports, safety, and setup.">
          <View style={styles.moduleGrid}>
            {invoicesEnabled ? (
              <ModuleLink
                label="Invoices"
                description="Create, preview, and share sales records."
                tone="tax"
                onPress={() => navigation.navigate('Invoices')}
              />
            ) : null}
            {productsEnabled ? (
              <ModuleLink
                label="Products"
                description="Manage stock used in invoices."
                tone="success"
                onPress={() => navigation.navigate('Products')}
              />
            ) : null}
            <ModuleLink
              label="Reports"
              description="Sales, dues, and compliance summaries."
              tone="primary"
              onPress={() => navigation.navigate('Reports')}
            />
            <ModuleLink
              label="Backup"
              description="Export or restore your ledger safely."
              tone="warning"
              onPress={() => navigation.navigate('BackupRestore')}
            />
            <ModuleLink
              label="Orbit Helper"
              description="Offline help for payments, invoices, backups, tax, and PIN."
              tone="primary"
              helperOnline
              onPress={() => navigation.navigate('OrbitHelper', { screenContext: 'Dashboard' })}
            />
            <ModuleLink
              label="Tax & country"
              description="Tax packs, templates, and country packages."
              tone="tax"
              onPress={() => navigation.navigate('CountryPackageStore')}
            />
          </View>
        </Section>

        <View style={styles.taxNote}>
          <Text style={styles.taxNoteText}>
            Tax-ready tools use validated local packs. You can check online updates from settings,
            and installed packs keep working offline.
          </Text>
        </View>
      </ScrollView>
      <BottomNavigation
        active="dashboard"
        onCustomers={() => navigation.navigate('Customers')}
        onDashboard={() => navigation.navigate('Dashboard')}
        onSettings={() => navigation.navigate('BusinessProfileSettings')}
      />
    </SafeAreaView>
  );
}

function getDashboardNudges({
  summary,
  topDueCustomers,
  currency,
  dismissedNudgeIds,
  onAddTransaction,
  onOpenCustomer,
  onDismissNudge,
}: {
  summary: DashboardSummary | null;
  topDueCustomers: TopDueCustomer[];
  currency: string;
  dismissedNudgeIds: RetentionNudgeId[];
  onAddTransaction: () => void;
  onOpenCustomer: (customerId: string) => void;
  onDismissNudge: (id: RetentionNudgeId) => void;
}): DashboardNudge[] {
  const nudges: DashboardNudge[] = [];

  if (
    (summary?.todayEntries ?? 0) === 0 &&
    !dismissedNudgeIds.includes('record_today_transactions')
  ) {
    nudges.push({
      id: 'record_today_transactions',
      title: "Record today's transactions",
      message: "Add today's credit or payment entries while they are fresh.",
      actionLabel: 'Add Transaction',
      onAction: onAddTransaction,
      dismissLabel: 'Not now',
      onDismiss: () => onDismissNudge('record_today_transactions'),
    });
  }

  const highestDueCustomer = topDueCustomers[0];
  if (highestDueCustomer?.balance > 0 && !dismissedNudgeIds.includes('pending_dues')) {
    nudges.push({
      id: 'pending_dues',
      title: 'You have pending dues',
      message: `${highestDueCustomer.name} has ${formatCurrency(highestDueCustomer.balance, currency)} still receivable.`,
      actionLabel: 'View Customer',
      onAction: () => onOpenCustomer(highestDueCustomer.id),
      dismissLabel: 'Not now',
      onDismiss: () => onDismissNudge('pending_dues'),
    });
  }

  return nudges.slice(0, 2);
}

function getActivityTrend(summary: DashboardSummary | null): {
  label: string;
  helper: string;
  isUp: boolean;
} {
  const recent = summary?.recentActivityCount ?? 0;
  const previous = summary?.previousActivityCount ?? 0;
  const delta = recent - previous;

  if (delta > 0) {
    return {
      label: `Up ${delta}`,
      helper: `${recent} entries in the last 7 days.`,
      isUp: true,
    };
  }

  if (delta < 0) {
    return {
      label: `Down ${Math.abs(delta)}`,
      helper: `${recent} entries in the last 7 days.`,
      isUp: false,
    };
  }

  return {
    label: 'Steady',
    helper: `${recent} entries in the last 7 days.`,
    isUp: false,
  };
}

function ModuleLink({
  description,
  helperOnline = false,
  label,
  tone,
  onPress,
}: {
  description: string;
  helperOnline?: boolean;
  label: string;
  tone: 'primary' | 'success' | 'warning' | 'tax' | 'premium';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={[styles.moduleCard, styles[`${tone}Module`]]}
    >
      <View style={styles.moduleHeader}>
        <View style={[styles.moduleIcon, styles[`${tone}ModuleIcon`]]} />
        <Text style={styles.moduleTitle}>{label}</Text>
      </View>
      <Text style={styles.moduleDescription}>{description}</Text>
      {helperOnline ? <OrbitHelperStatus label="Online" compact /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  loadingStack: {
    alignSelf: 'stretch',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 176,
    gap: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  businessName: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 32,
  },
  date: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  headerMeta: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: spacing.xs,
    maxWidth: 124,
  },
  heroMoneyCard: {
    minHeight: 184,
  },
  heroMoneyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroMoneyText: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  heroHelper: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  quickActionButton: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 148,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.lg,
    marginBottom: spacing.xs,
  },
  insightList: {
    gap: spacing.md,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  attentionText: {
    flex: 1,
    gap: 2,
  },
  attentionLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  attentionHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  insightCard: {
    flex: 1,
    minWidth: 148,
    minHeight: 112,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  insightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  indicatorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  indicatorDue: {
    backgroundColor: colors.accent,
  },
  indicatorUp: {
    backgroundColor: colors.success,
  },
  indicatorFlat: {
    backgroundColor: colors.borderStrong,
  },
  insightLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  insightValue: {
    color: colors.text,
    fontSize: typography.amount,
    fontWeight: '900',
  },
  insightHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  nudgeList: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  actionGrid: {
    gap: spacing.md,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  moduleCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 148,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 118,
    padding: spacing.lg,
  },
  primaryModule: {
    borderLeftColor: colors.primary,
  },
  successModule: {
    borderLeftColor: colors.success,
  },
  warningModule: {
    borderLeftColor: colors.warning,
  },
  taxModule: {
    borderLeftColor: colors.tax,
  },
  premiumModule: {
    borderLeftColor: colors.premium,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moduleIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  primaryModuleIcon: {
    backgroundColor: colors.primary,
  },
  successModuleIcon: {
    backgroundColor: colors.success,
  },
  warningModuleIcon: {
    backgroundColor: colors.warning,
  },
  taxModuleIcon: {
    backgroundColor: colors.tax,
  },
  premiumModuleIcon: {
    backgroundColor: colors.premium,
  },
  moduleTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  moduleDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  transactionList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dueList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dueItem: {
    minHeight: 72,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  dueCustomerText: {
    flex: 1,
    gap: spacing.xs,
  },
  dueAmount: {
    maxWidth: 136,
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: '900',
    textAlign: 'right',
  },
  transactionItem: {
    minHeight: 78,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transactionText: {
    flex: 1,
    gap: 3,
  },
  customerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  transactionMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  transactionNote: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  amount: {
    fontSize: typography.label,
    fontWeight: '900',
  },
  recentAmountBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 140,
  },
  credit: {
    color: colors.accent,
  },
  payment: {
    color: colors.success,
  },
  backupNudge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  backupNudgeLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  backupNudgeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  backupNudgeText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  backupNudgeActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  upgradeNudge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySurface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  upgradeNudgeLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  upgradeNudgeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  upgradeNudgeText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  ratingNudge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ratingNudgeLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  ratingNudgeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  ratingNudgeText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  ratingNudgeActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  taxNote: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  taxNoteText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
