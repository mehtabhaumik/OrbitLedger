import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import { buildBusinessHealthSnapshot } from '../health';
import type { BusinessHealthActionItem, BusinessHealthCustomer, BusinessHealthSnapshot } from '../health';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type BusinessHealthSnapshotScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'BusinessHealthSnapshot'
>;

export function BusinessHealthSnapshotScreen({ navigation }: BusinessHealthSnapshotScreenProps) {
  const [snapshot, setSnapshot] = useState<BusinessHealthSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currency = snapshot?.business.currency ?? 'INR';

  const loadSnapshot = useCallback(async () => {
    const nextSnapshot = await buildBusinessHealthSnapshot();
    setSnapshot(nextSnapshot);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          const nextSnapshot = await buildBusinessHealthSnapshot();
          if (isActive) {
            setSnapshot(nextSnapshot);
          }
        } catch {
          if (isActive) {
            Alert.alert('Business health could not load', 'Please try again.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void load();

      return () => {
        isActive = false;
      };
    }, [])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadSnapshot();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function openAction(action: BusinessHealthActionItem) {
    switch (action.target) {
      case 'get_paid':
        navigation.navigate('GetPaid');
        return;
      case 'products':
        navigation.navigate('Products');
        return;
      case 'daily_closing':
        navigation.navigate('DailyClosingReport');
        return;
      case 'customers':
        navigation.navigate('Customers');
        return;
      case 'reports':
      default:
        navigation.navigate('Reports');
    }
  }

  if (isLoading && !snapshot) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Checking business health</Text>
        <View style={styles.loadingStack}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  const healthTone = getScoreTone(snapshot?.score.tone ?? 'watch');
  const receivableChangedBy = snapshot?.totals.receivableChange ?? 0;
  const salesChange = (snapshot?.totals.invoiceSales ?? 0) - (snapshot?.totals.previousInvoiceSales ?? 0);
  const paymentsChange =
    (snapshot?.totals.paymentsReceived ?? 0) - (snapshot?.totals.previousPaymentsReceived ?? 0);

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
        <ScreenHeader
          title="Business Health"
          subtitle="A simple local snapshot of collections, sales, dues, and follow-up risk."
          backLabel="Reports"
          onBack={() => navigation.goBack()}
        />

        {snapshot ? (
          <>
            <Card accent={healthTone} elevated glass>
              <View style={styles.scoreHeader}>
                <View style={styles.scoreText}>
                  <Text style={styles.eyebrow}>{snapshot.period.label}</Text>
                  <Text style={styles.heroTitle}>{snapshot.score.label}</Text>
                  <Text style={styles.scoreHelper}>{snapshot.score.helper}</Text>
                </View>
                <View style={[styles.scoreBadge, styles[`${snapshot.score.tone}ScoreBadge`]]}>
                  <Text style={[styles.scoreValue, styles[`${snapshot.score.tone}ScoreText`]]}>
                    {snapshot.score.value}
                  </Text>
                  <Text style={[styles.scoreLabel, styles[`${snapshot.score.tone}ScoreText`]]}>
                    score
                  </Text>
                </View>
              </View>
              <Text style={styles.periodText}>
                {formatShortDate(snapshot.period.startDate)} to {formatShortDate(snapshot.period.endDate)}
              </Text>
            </Card>

            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Receivable"
                value={formatCurrency(snapshot.totals.currentReceivable, currency)}
                helper={`${formatChange(receivableChangedBy, currency)} vs previous period.`}
                tone={snapshot.totals.currentReceivable > 0 ? 'due' : 'payment'}
              />
              <SummaryCard
                label="Collection rate"
                value={`${snapshot.totals.collectionRate}%`}
                helper="Payments compared with dues, credits, and collections."
                tone={snapshot.totals.collectionRate >= 45 ? 'payment' : 'due'}
              />
              <SummaryCard
                label="Invoice sales"
                value={formatCurrency(snapshot.totals.invoiceSales, currency)}
                helper={`${formatChange(salesChange, currency)} vs previous period.`}
                tone="primary"
              />
              <SummaryCard
                label="Payments"
                value={formatCurrency(snapshot.totals.paymentsReceived, currency)}
                helper={`${formatChange(paymentsChange, currency)} vs previous period.`}
                tone="payment"
              />
            </View>

            <Section title="Recommended actions" subtitle="Highest-value next steps from local data.">
              <View style={styles.actionStack}>
                {snapshot.actionItems.map((action) => (
                  <Card key={action.id} compact accent={getActionAccent(action.priority)}>
                    <View style={styles.actionHeader}>
                      <View style={styles.actionText}>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        <Text style={styles.actionMessage}>{action.message}</Text>
                      </View>
                      <StatusChip label={action.priority} tone={getActionAccent(action.priority)} />
                    </View>
                    <PrimaryButton variant="secondary" onPress={() => openAction(action)}>
                      {action.actionLabel}
                    </PrimaryButton>
                  </Card>
                ))}
              </View>
            </Section>

            <Section title="Business signals" subtitle="Dues, promises, customers, and stock to watch.">
              <View style={styles.signalGrid}>
                <SignalCard
                  label="Outstanding customers"
                  value={`${snapshot.totals.outstandingCustomerCount}`}
                  tone={snapshot.totals.outstandingCustomerCount > 0 ? 'warning' : 'success'}
                />
                <SignalCard
                  label="Risky customers"
                  value={`${snapshot.totals.riskyCustomerCount}`}
                  tone={snapshot.totals.riskyCustomerCount > 0 ? 'danger' : 'success'}
                />
                <SignalCard
                  label="Improving customers"
                  value={`${snapshot.totals.improvingCustomerCount}`}
                  tone={snapshot.totals.improvingCustomerCount > 0 ? 'success' : 'neutral'}
                />
                <SignalCard
                  label="Low stock"
                  value={`${snapshot.totals.lowStockProductCount}`}
                  tone={snapshot.totals.lowStockProductCount > 0 ? 'warning' : 'success'}
                />
              </View>
            </Section>

            <CustomerSection
              title="Customers to watch"
              subtitle="Balances with weak payment signals."
              customers={snapshot.riskyCustomers}
              currency={currency}
              emptyTitle="No risky customers"
              emptyMessage="Customers with stale dues or weak recent payment signals will appear here."
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerSection
              title="Improving customers"
              subtitle="Customers paying down more than new credit this period."
              customers={snapshot.improvingCustomers}
              currency={currency}
              emptyTitle="No improving customers yet"
              emptyMessage="Customers making stronger payments than new credit will appear here."
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerSection
              title="Best customers"
              subtitle="Most useful customer activity in the current period."
              customers={snapshot.bestCustomers}
              currency={currency}
              emptyTitle="No customer activity yet"
              emptyMessage="Payments, credit entries, and invoice sales will build this list."
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <Section title="Low stock watch" subtitle="Restock before invoices slow down.">
              {snapshot.lowStockProducts.length === 0 ? (
                <EmptyState
                  title="Stock looks fine"
                  message="Low-stock products will appear here when inventory reaches 5 units or below."
                />
              ) : (
                <View style={styles.listShell}>
                  {snapshot.lowStockProducts.map((product) => (
                    <ListRow
                      key={product.id}
                      accent="warning"
                      title={product.name}
                      subtitle={`${product.stockQuantity} ${product.unit} left`}
                      meta="Low stock"
                      onPress={() => navigation.navigate('InventoryReorderAssistant')}
                    />
                  ))}
                </View>
              )}
            </Section>
          </>
        ) : null}
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

function CustomerSection({
  title,
  subtitle,
  customers,
  currency,
  emptyTitle,
  emptyMessage,
  onOpen,
}: {
  title: string;
  subtitle: string;
  customers: BusinessHealthCustomer[];
  currency: string;
  emptyTitle: string;
  emptyMessage: string;
  onOpen: (customerId: string) => void;
}) {
  return (
    <Section title={title} subtitle={subtitle}>
      {customers.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <View style={styles.listShell}>
          {customers.map((customer) => (
            <ListRow
              key={customer.id}
              accent={customer.balance > 0 ? 'warning' : 'success'}
              title={customer.name}
              subtitle={`Payments ${formatCurrency(customer.paymentsReceived, currency)} · Credit ${formatCurrency(
                customer.creditGiven,
                currency
              )}`}
              meta={
                customer.lastPaymentAt
                  ? `Last payment ${formatShortDate(customer.lastPaymentAt)}`
                  : 'No payment recorded'
              }
              right={
                <MoneyText size="sm" tone={customer.balance > 0 ? 'due' : 'payment'} align="right">
                  {formatCurrency(customer.balance, currency)}
                </MoneyText>
              }
              onPress={() => onOpen(customer.id)}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

function SignalCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <View style={styles.signalCard}>
      <Text style={styles.signalLabel}>{label}</Text>
      <StatusChip label={value} tone={tone} />
    </View>
  );
}

function formatChange(value: number, currency: string): string {
  if (value === 0) {
    return 'No change';
  }

  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value), currency)}`;
}

function getScoreTone(tone: BusinessHealthSnapshot['score']['tone']) {
  if (tone === 'healthy') {
    return 'success';
  }

  if (tone === 'action') {
    return 'danger';
  }

  return 'warning';
}

function getActionAccent(priority: BusinessHealthActionItem['priority']) {
  if (priority === 'high') {
    return 'danger';
  }

  if (priority === 'medium') {
    return 'warning';
  }

  return 'primary';
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
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '800',
  },
  loadingStack: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 112,
    gap: spacing.xl,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  scoreText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 30,
  },
  scoreHelper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  periodText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  scoreBadge: {
    width: 86,
    minHeight: 86,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  healthyScoreBadge: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successSurface,
  },
  watchScoreBadge: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
  },
  actionScoreBadge: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerSurface,
  },
  scoreValue: {
    fontSize: typography.balance,
    fontWeight: '900',
    lineHeight: 36,
  },
  scoreLabel: {
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  healthyScoreText: {
    color: colors.success,
  },
  watchScoreText: {
    color: colors.warning,
  },
  actionScoreText: {
    color: colors.danger,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.lg,
  },
  actionStack: {
    gap: spacing.md,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  actionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  actionMessage: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  signalCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 148,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  signalLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  listShell: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
});
