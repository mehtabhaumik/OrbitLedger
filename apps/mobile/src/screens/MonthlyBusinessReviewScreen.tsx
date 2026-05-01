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
import { getTodayDateInput } from '../forms/validation';
import { formatCurrency, formatShortDate } from '../lib/format';
import {
  buildMonthlyBusinessReview,
  shareMonthlyReviewExport,
  type MonthlyBusinessReview,
  type MonthlyReviewActionItem,
  type MonthlyReviewCustomer,
  type MonthlyReviewExportFormat,
} from '../monthlyReview';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme/theme';

type MonthlyBusinessReviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'MonthlyBusinessReview'
>;

export function MonthlyBusinessReviewScreen({ navigation }: MonthlyBusinessReviewScreenProps) {
  const [monthKey, setMonthKey] = useState(getTodayDateInput().slice(0, 7));
  const [review, setReview] = useState<MonthlyBusinessReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharingFormat, setSharingFormat] = useState<MonthlyReviewExportFormat | null>(null);
  const currency = review?.business.currency ?? 'INR';

  const loadReview = useCallback(async (targetMonthKey: string) => {
    const nextReview = await buildMonthlyBusinessReview(targetMonthKey);
    setReview(nextReview);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          const nextReview = await buildMonthlyBusinessReview(monthKey);
          if (isActive) {
            setReview(nextReview);
          }
        } catch {
          if (isActive) {
            Alert.alert('Monthly review could not load', 'Please try again.');
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
    }, [monthKey])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadReview(monthKey);
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function changeMonth(direction: -1 | 1) {
    const nextMonth = moveMonth(monthKey, direction);
    if (nextMonth > getTodayDateInput().slice(0, 7)) {
      return;
    }

    setMonthKey(nextMonth);
    try {
      setIsLoading(true);
      await loadReview(nextMonth);
    } catch {
      Alert.alert('Month could not load', 'Please choose another month.');
    } finally {
      setIsLoading(false);
    }
  }

  async function shareReview(format: MonthlyReviewExportFormat) {
    if (!review) {
      return;
    }

    try {
      setSharingFormat(format);
      const exported = await shareMonthlyReviewExport({ format, review });
      Alert.alert('Monthly review shared', `${exported.fileName} was saved and opened for sharing.`);
    } catch {
      Alert.alert(
        'Monthly review could not be shared',
        'Orbit Ledger could not prepare this export. Please try again from this device.'
      );
    } finally {
      setSharingFormat(null);
    }
  }

  function openAction(action: MonthlyReviewActionItem) {
    switch (action.target) {
      case 'get_paid':
        navigation.navigate('GetPaid');
        return;
      case 'customers':
        navigation.navigate('Customers');
        return;
      case 'statement_batch':
        navigation.navigate('StatementBatch');
        return;
      case 'reorder_assistant':
        navigation.navigate('InventoryReorderAssistant');
        return;
      case 'backup':
        navigation.navigate('BackupRestore');
        return;
      case 'compliance':
        navigation.navigate('ComplianceReports');
        return;
      case 'daily_closing':
      default:
        navigation.navigate('DailyClosingReport');
    }
  }

  if (isLoading && !review) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing monthly review</Text>
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
        <ScreenHeader
          title="Monthly Review"
          subtitle="Month-end business movement from ledger, invoice, customer, and stock data."
          backLabel="Reports"
          onBack={() => navigation.goBack()}
        />

        {review ? (
          <>
            <Card accent={review.totals.monthEndReceivable > 0 ? 'warning' : 'success'} elevated glass>
              <View style={styles.monthHeader}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  onPress={() => void changeMonth(-1)}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={({ pressed }) => [styles.monthButton, pressed ? styles.monthButtonPressed : null]}
                >
                  <Text style={styles.monthButtonText}>Previous</Text>
                </Pressable>
                <View style={styles.monthText}>
                  <Text style={styles.eyebrow}>Review month</Text>
                  <Text style={styles.heroTitle}>{review.month.label}</Text>
                  <Text style={styles.heroHelper}>
                    {formatShortDate(review.month.startDate)} to {formatShortDate(review.month.endDate)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={monthKey >= getTodayDateInput().slice(0, 7)}
                  hitSlop={touch.hitSlop}
                  onPress={() => void changeMonth(1)}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={({ pressed }) => [
                    styles.monthButton,
                    monthKey >= getTodayDateInput().slice(0, 7) ? styles.monthButtonDisabled : null,
                    pressed ? styles.monthButtonPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthButtonText,
                      monthKey >= getTodayDateInput().slice(0, 7) ? styles.monthButtonTextDisabled : null,
                    ]}
                  >
                    Next
                  </Text>
                </Pressable>
              </View>
              <MoneyText size="lg" tone={review.totals.monthEndReceivable > 0 ? 'due' : 'payment'}>
                {formatCurrency(review.totals.monthEndReceivable, currency)}
              </MoneyText>
              <Text style={styles.heroHelper}>
                Month-end receivable changed by {formatChange(review.totals.receivableChange, currency)}
                {' '}from {review.month.previousLabel}.
              </Text>
            </Card>

            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Payments"
                value={formatCurrency(review.totals.paymentsReceived, currency)}
                helper={`${formatChange(review.totals.paymentsChange, currency)} vs previous month.`}
                tone="payment"
              />
              <SummaryCard
                label="Credit given"
                value={formatCurrency(review.totals.creditGiven, currency)}
                helper={`${formatChange(review.totals.creditChange, currency)} vs previous month.`}
                tone="due"
              />
              <SummaryCard
                label="Invoice sales"
                value={formatCurrency(review.totals.invoiceSales, currency)}
                helper={`${formatChange(review.totals.salesChange, currency)} vs previous month.`}
                tone="primary"
              />
              <SummaryCard
                label="Invoice tax"
                value={formatCurrency(review.totals.invoiceTax, currency)}
                helper={`${formatChange(review.totals.taxChange, currency)} vs previous month.`}
                tone="tax"
              />
            </View>

            <Section title="Month signals" subtitle="Practical activity and risk markers for this month.">
              <View style={styles.signalGrid}>
                <SignalCard label="New customers" value={`${review.totals.newCustomers}`} tone="primary" />
                <SignalCard label="Active customers" value={`${review.totals.activeCustomers}`} tone="success" />
                <SignalCard
                  label="Reminders sent"
                  value={`${review.totals.remindersSent}`}
                  tone={review.totals.remindersSent > 0 ? 'primary' : 'neutral'}
                />
                <SignalCard
                  label="Missed promises"
                  value={`${review.totals.missedPaymentPromises}`}
                  tone={review.totals.missedPaymentPromises > 0 ? 'danger' : 'success'}
                />
                <SignalCard
                  label="Low stock"
                  value={`${review.totals.lowStockCount}`}
                  tone={review.totals.lowStockCount > 0 ? 'warning' : 'success'}
                />
                <SignalCard
                  label="Net movement"
                  value={formatChange(review.totals.netReceivableMovement, currency)}
                  tone={review.totals.netReceivableMovement > 0 ? 'warning' : 'success'}
                />
              </View>
            </Section>

            <Section title="Action list" subtitle="Use these to close the month cleanly.">
              <View style={styles.actionStack}>
                {review.actionItems.map((action) => (
                  <Card key={action.id} compact accent={getPriorityAccent(action.priority)}>
                    <View style={styles.actionHeader}>
                      <View style={styles.actionText}>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        <Text style={styles.actionMessage}>{action.message}</Text>
                      </View>
                      <StatusChip label={action.priority} tone={getPriorityAccent(action.priority)} />
                    </View>
                    <PrimaryButton variant="secondary" onPress={() => openAction(action)}>
                      {action.actionLabel}
                    </PrimaryButton>
                  </Card>
                ))}
              </View>
            </Section>

            <CustomerInsightSection
              title="Top customers by payments"
              subtitle="Customers who paid the most this month."
              customers={review.topCustomersByPayments}
              currency={currency}
              emptyTitle="No payments this month"
              emptyMessage="Payment activity will appear here after entries are recorded."
              valueKind="payments"
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerInsightSection
              title="Top customers by sales"
              subtitle="Invoice customers with the most sales this month."
              customers={review.topCustomersBySales}
              currency={currency}
              emptyTitle="No invoice sales this month"
              emptyMessage="Invoice sales will appear here after invoices are issued."
              valueKind="sales"
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerInsightSection
              title="Highest dues"
              subtitle="Largest customer balances at month end."
              customers={review.highestDues}
              currency={currency}
              emptyTitle="No dues at month end"
              emptyMessage="No outstanding customer balances were found for this month."
              valueKind="balance"
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerInsightSection
              title="Slow-paying customers"
              subtitle="Outstanding balances with weak recent payment signals."
              customers={review.slowPayingCustomers}
              currency={currency}
              emptyTitle="No slow-paying customers"
              emptyMessage="Customers with stale dues or no recent payment will appear here."
              valueKind="balance"
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <CustomerInsightSection
              title="Improved customers"
              subtitle="Customers paying down more than new credit this month."
              customers={review.improvedCustomers}
              currency={currency}
              emptyTitle="No improving customers yet"
              emptyMessage="Customers whose payments outpace new credit will appear here."
              valueKind="payments"
              onOpen={(customerId) => navigation.navigate('CustomerDetail', { customerId })}
            />

            <Card accent="primary">
              <View style={styles.exportCopy}>
                <Text style={styles.exportTitle}>Export monthly review</Text>
                <Text style={styles.exportText}>
                  Save this review and share it as JSON for systems or CSV for spreadsheets.
                </Text>
              </View>
              <View style={styles.exportActions}>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="secondary"
                  loading={sharingFormat === 'json'}
                  disabled={Boolean(sharingFormat)}
                  onPress={() => void shareReview('json')}
                >
                  Share JSON
                </PrimaryButton>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="secondary"
                  loading={sharingFormat === 'csv'}
                  disabled={Boolean(sharingFormat)}
                  onPress={() => void shareReview('csv')}
                >
                  Share CSV
                </PrimaryButton>
              </View>
            </Card>
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

function CustomerInsightSection({
  title,
  subtitle,
  customers,
  currency,
  emptyTitle,
  emptyMessage,
  valueKind,
  onOpen,
}: {
  title: string;
  subtitle: string;
  customers: MonthlyReviewCustomer[];
  currency: string;
  emptyTitle: string;
  emptyMessage: string;
  valueKind: 'payments' | 'sales' | 'balance';
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
              subtitle={`Payments ${formatCurrency(customer.paymentsReceived, currency)} · Sales ${formatCurrency(
                customer.invoiceSales,
                currency
              )}`}
              meta={
                customer.lastPaymentAt
                  ? `Last payment ${formatShortDate(customer.lastPaymentAt)}`
                  : 'No payment recorded'
              }
              right={
                <MoneyText size="sm" tone={valueKind === 'balance' ? 'due' : 'payment'} align="right">
                  {formatCurrency(getCustomerValue(customer, valueKind), currency)}
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

function getCustomerValue(
  customer: MonthlyReviewCustomer,
  valueKind: 'payments' | 'sales' | 'balance'
): number {
  if (valueKind === 'payments') {
    return customer.paymentsReceived;
  }

  if (valueKind === 'sales') {
    return customer.invoiceSales;
  }

  return customer.balance;
}

function formatChange(value: number, currency: string): string {
  if (value === 0) {
    return 'No change';
  }

  return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value), currency)}`;
}

function getPriorityAccent(priority: MonthlyReviewActionItem['priority']): 'danger' | 'warning' | 'primary' {
  if (priority === 'high') {
    return 'danger';
  }

  if (priority === 'medium') {
    return 'warning';
  }

  return 'primary';
}

function moveMonth(monthKey: string, direction: -1 | 1): string {
  const date = new Date(`${monthKey}-01T00:00:00`);
  date.setMonth(date.getMonth() + direction);
  return date.toISOString().slice(0, 7);
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
    paddingBottom: 144,
    gap: spacing.xl,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  monthText: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  monthButton: {
    minHeight: 44,
    minWidth: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  monthButtonPressed: {
    opacity: 0.82,
  },
  monthButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  monthButtonText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  monthButtonTextDisabled: {
    color: colors.textMuted,
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
    textAlign: 'center',
  },
  heroHelper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.lg,
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
  listShell: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  exportCopy: {
    gap: spacing.xs,
  },
  exportTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  exportText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  exportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exportButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
});
