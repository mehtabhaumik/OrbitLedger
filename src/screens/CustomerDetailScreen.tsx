import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
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

import { FloatingActionButton } from '../components/FloatingActionButton';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProductivityNudge } from '../components/ProductivityNudge';
import { ScreenHeader } from '../components/ScreenHeader';
import { getBusinessSettings, getCustomerLedger, getFeatureToggles } from '../database';
import type {
  AppFeatureToggles,
  CustomerLedger,
  LedgerTransaction,
  TransactionType,
} from '../database';
import {
  formatCurrency,
  formatShortDate,
  formatSignedCurrency,
  formatTransactionType,
} from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, shadows, spacing, touch, typography } from '../theme/theme';

type CustomerDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'CustomerDetail'>;
type LedgerEntry = LedgerTransaction & {
  runningBalance: number;
  importanceLabel: string | null;
};
type LedgerDateGroup = {
  date: string;
  entries: LedgerEntry[];
  totalCredit: number;
  totalPayment: number;
};
type LedgerInsights = {
  totalCredit: number;
  totalPayment: number;
  netBalance: number;
  lastTransactionDate: string | null;
  balanceLabel: string;
  balanceHelper: string;
  balanceTone: 'due' | 'advance' | 'settled';
};
type LedgerView = {
  entries: LedgerEntry[];
  groups: LedgerDateGroup[];
  insights: LedgerInsights;
};

export function CustomerDetailScreen({ navigation, route }: CustomerDetailScreenProps) {
  const { customerId } = route.params;
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ledgerView = useMemo<LedgerView>(() => {
    if (!ledger) {
      return {
        entries: [],
        groups: [],
        insights: createLedgerInsights(null, 0, 0, null),
      };
    }

    const chronologicalEntries: Array<Omit<LedgerEntry, 'importanceLabel'>> = [];
    let runningBalance = ledger.openingBalance;
    let totalCredit = 0;
    let totalPayment = 0;
    let lastTransaction: LedgerTransaction | null = null;

    for (let index = ledger.transactions.length - 1; index >= 0; index -= 1) {
      const transaction = ledger.transactions[index];
      if (transaction.type === 'credit') {
        totalCredit += transaction.amount;
        runningBalance += transaction.amount;
      } else {
        totalPayment += transaction.amount;
        runningBalance -= transaction.amount;
      }

      if (!lastTransaction || isTransactionNewer(transaction, lastTransaction)) {
        lastTransaction = transaction;
      }

      chronologicalEntries.push({
        ...transaction,
        runningBalance,
      });
    }

    const largestAmount = chronologicalEntries.reduce(
      (largest, entry) => Math.max(largest, entry.amount),
      0
    );
    const newestFirstEntries = chronologicalEntries
      .reverse()
      .map((entry) => ({
        ...entry,
        importanceLabel:
          entry.id === lastTransaction?.id
            ? 'Latest'
            : largestAmount > 0 && entry.amount === largestAmount && chronologicalEntries.length > 1
              ? 'Largest'
              : null,
      }));

    return {
      entries: newestFirstEntries,
      groups: groupLedgerEntries(newestFirstEntries),
      insights: createLedgerInsights(ledger, totalCredit, totalPayment, lastTransaction),
    };
  }, [ledger]);
  const ledgerEntries = ledgerView.entries;
  const ledgerGroups = ledgerView.groups;
  const insights = ledgerView.insights;

  const loadLedger = useCallback(async () => {
    const [settings, customerLedger, toggles] = await Promise.all([
      getBusinessSettings(),
      getCustomerLedger(customerId),
      getFeatureToggles(),
    ]);
    setCurrency(settings?.currency ?? 'INR');
    setLedger(customerLedger);
    setFeatureToggles(toggles);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadLedger();
        } catch {
          if (isActive) {
            Alert.alert('Ledger could not load', 'Please try again.');
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
    }, [loadLedger])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadLedger();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function openAddTransaction(type: TransactionType) {
    navigation.navigate('TransactionForm', { customerId, type });
  }

  function openEditTransaction(transaction: LedgerTransaction) {
    navigation.navigate('TransactionForm', {
      customerId: transaction.customerId,
      transactionId: transaction.id,
    });
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={ledger ? [1] : undefined}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <ScreenHeader
          title={ledger?.customer.name ?? 'Customer Ledger'}
          subtitle={ledger?.customer.phone ?? 'Local customer ledger'}
          onBack={() => navigation.goBack()}
        />

        {ledger ? (
          <View style={styles.stickyBalanceShell}>
            <View style={styles.balanceCard}>
              <View style={styles.balanceTopRow}>
                <View style={styles.balanceMain}>
                  <Text style={styles.balanceLabel}>Current balance</Text>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    numberOfLines={2}
                    style={ledger.balance > 0 ? styles.receivable : styles.settled}
                  >
                    {formatCurrency(ledger.balance, currency)}
                  </Text>
                  <Text style={styles.balanceHelper}>{insights.balanceHelper}</Text>
                </View>
                <View
                  style={[
                    styles.balanceStatusPill,
                    insights.balanceTone === 'due'
                      ? styles.balanceStatusDue
                      : insights.balanceTone === 'advance'
                        ? styles.balanceStatusAdvance
                        : styles.balanceStatusSettled,
                  ]}
                >
                  <Text
                    style={[
                      styles.balanceStatusText,
                      insights.balanceTone === 'due'
                        ? styles.balanceStatusDueText
                        : insights.balanceTone === 'advance'
                          ? styles.balanceStatusAdvanceText
                          : styles.balanceStatusSettledText,
                    ]}
                  >
                    {insights.balanceLabel}
                  </Text>
                </View>
              </View>
              <Text style={styles.muted}>
                Opening balance {formatCurrency(ledger.openingBalance, currency)}
              </Text>
            </View>
          </View>
        ) : null}

        {isLoading && !ledger ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.muted}>Loading ledger</Text>
          </View>
        ) : ledger ? (
          <>
            <View style={styles.quickActionGrid}>
              <PrimaryButton
                style={styles.quickActionButton}
                onPress={() => openAddTransaction('credit')}
              >
                Add Credit
              </PrimaryButton>
              <PrimaryButton
                style={styles.quickActionButton}
                variant="secondary"
                onPress={() => openAddTransaction('payment')}
              >
                Add Payment
              </PrimaryButton>
              {featureToggles?.invoices ?? true ? (
                <PrimaryButton
                  style={styles.quickActionButton}
                  variant="secondary"
                  onPress={() => navigation.navigate('InvoiceForm', { customerId })}
                >
                  Create Invoice
                </PrimaryButton>
              ) : null}
              <PrimaryButton
                style={styles.quickActionButton}
                variant="secondary"
                onPress={() => navigation.navigate('StatementPreview', { customerId })}
              >
                Generate Statement
              </PrimaryButton>
              <PrimaryButton
                style={styles.quickActionButton}
                variant="ghost"
                onPress={() => navigation.navigate('CustomerForm', { customerId })}
              >
                Edit Customer
              </PrimaryButton>
            </View>

            {insights.balanceTone === 'due' ? (
              <ProductivityNudge
                actionLabel="Record Payment"
                message={`${ledger.customer.name} still owes ${formatCurrency(
                  ledger.balance,
                  currency
                )}. Record a payment when it is collected.`}
                onAction={() => openAddTransaction('payment')}
                title="This customer has outstanding dues."
              />
            ) : ledgerEntries.length === 0 ? (
              <ProductivityNudge
                actionLabel="Add First Entry"
                message="Add a credit or payment so this customer ledger has a clear starting record."
                onAction={() => openAddTransaction('credit')}
                title="No transactions recorded for this customer yet."
              />
            ) : null}

            <View style={styles.statusStrip}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, styles.creditDot]} />
                <View style={styles.statusTextBlock}>
                  <Text style={styles.statusLabel}>Credit</Text>
                  <Text style={styles.statusHelper}>Given to customer. Increases dues.</Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, styles.paymentDot]} />
                <View style={styles.statusTextBlock}>
                  <Text style={styles.statusLabel}>Payment</Text>
                  <Text style={styles.statusHelper}>Received from customer. Reduces dues.</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightGrid}>
              <InsightCard
                label="Total credit given"
                value={formatCurrency(insights.totalCredit, currency)}
                helper="Credit increases dues."
                tone="credit"
              />
              <InsightCard
                label="Total payment received"
                value={formatCurrency(insights.totalPayment, currency)}
                helper="Payments reduce dues."
                tone="payment"
              />
              <InsightCard
                label="Net balance"
                value={formatCurrency(insights.netBalance, currency)}
                helper={insights.balanceLabel}
                tone={
                  insights.balanceTone === 'due'
                    ? 'credit'
                    : insights.balanceTone === 'advance'
                      ? 'payment'
                      : 'neutral'
                }
              />
              <InsightCard
                label="Last transaction"
                value={
                  insights.lastTransactionDate ? formatShortDate(insights.lastTransactionDate) : 'No entries'
                }
                helper={insights.lastTransactionDate ?? 'Add a credit or payment.'}
                tone="neutral"
              />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Customer Info</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{ledger.customer.phone ?? 'No phone saved'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{ledger.customer.address ?? 'No address saved'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notes</Text>
                <Text style={styles.infoValue}>{ledger.customer.notes ?? 'No notes saved'}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ledger Entries</Text>
              {ledgerEntries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No entries yet</Text>
                  <Text style={styles.muted}>Add a credit or payment to start the ledger.</Text>
                  <View style={styles.emptyActions}>
                    <PrimaryButton style={styles.emptyActionButton} onPress={() => openAddTransaction('credit')}>
                      Add Credit
                    </PrimaryButton>
                    <PrimaryButton
                      style={styles.emptyActionButton}
                      variant="secondary"
                      onPress={() => openAddTransaction('payment')}
                    >
                      Add Payment
                    </PrimaryButton>
                  </View>
                </View>
              ) : (
                <View style={styles.transactionList}>
                  {ledgerGroups.map((group) => (
                    <View key={group.date} style={styles.transactionGroup}>
                      <View style={styles.groupHeader}>
                        <Text style={styles.groupDate}>{formatLedgerGroupDate(group.date)}</Text>
                        <Text style={styles.groupTotals}>
                          Credit {formatCurrency(group.totalCredit, currency)} · Payment{' '}
                          {formatCurrency(group.totalPayment, currency)}
                        </Text>
                      </View>
                      {group.entries.map((transaction) => {
                        const isCredit = transaction.type === 'credit';
                        return (
                          <Pressable
                            accessibilityHint="Opens this ledger entry for editing"
                            accessibilityLabel={`Edit ${formatTransactionType(transaction.type)} for ${formatCurrency(
                              transaction.amount,
                              currency
                            )}`}
                            accessibilityRole="button"
                            hitSlop={touch.hitSlop}
                            key={transaction.id}
                            onPress={() => openEditTransaction(transaction)}
                            pressRetentionOffset={touch.pressRetentionOffset}
                            style={({ pressed }) => [
                              styles.transactionItem,
                              transaction.importanceLabel ? styles.transactionItemImportant : null,
                              pressed ? styles.transactionItemPressed : null,
                            ]}
                          >
                            <View
                              style={[
                                styles.transactionTypeRail,
                                isCredit ? styles.creditRail : styles.paymentRail,
                              ]}
                            />
                            <View style={styles.transactionText}>
                              <View style={styles.transactionTitleRow}>
                                <Text style={styles.transactionTitle}>
                                  {formatTransactionType(transaction.type)}
                                </Text>
                                {transaction.importanceLabel ? (
                                  <Text style={styles.importantBadge}>
                                    {transaction.importanceLabel}
                                  </Text>
                                ) : null}
                              </View>
                              {transaction.note ? (
                                <Text style={styles.transactionNote}>{transaction.note}</Text>
                              ) : (
                                <Text style={styles.transactionNoteMuted}>No note added</Text>
                              )}
                              <Text style={styles.runningBalance}>
                                Balance after entry{' '}
                                {formatCurrency(transaction.runningBalance, currency)}
                              </Text>
                            </View>
                            <View style={styles.amountBlock}>
                              <View style={isCredit ? styles.creditPill : styles.paymentPill}>
                                <Text style={isCredit ? styles.creditPillText : styles.paymentPillText}>
                                  {isCredit ? 'Credit' : 'Payment'}
                                </Text>
                              </View>
                              <Text
                                adjustsFontSizeToFit
                                minimumFontScale={0.82}
                                numberOfLines={2}
                                style={isCredit ? styles.creditAmount : styles.paymentAmount}
                              >
                                {formatSignedCurrency(transaction.amount, currency, transaction.type)}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
      {ledger ? (
        <FloatingActionButton
          label="Add Credit"
          onPress={() => openAddTransaction('credit')}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createLedgerInsights(
  ledger: CustomerLedger | null,
  totalCredit: number,
  totalPayment: number,
  lastTransaction: LedgerTransaction | null
): LedgerInsights {
  if (!ledger) {
    return {
      totalCredit,
      totalPayment,
      netBalance: 0,
      lastTransactionDate: null,
      balanceLabel: 'Settled',
      balanceHelper: 'No dues are outstanding.',
      balanceTone: 'settled',
    };
  }

  if (ledger.balance > 0) {
    return {
      totalCredit,
      totalPayment,
      netBalance: ledger.balance,
      lastTransactionDate: lastTransaction?.effectiveDate ?? null,
      balanceLabel: 'Customer owes you',
      balanceHelper: `${ledger.customer.name} has outstanding dues.`,
      balanceTone: 'due',
    };
  }

  if (ledger.balance < 0) {
    return {
      totalCredit,
      totalPayment,
      netBalance: ledger.balance,
      lastTransactionDate: lastTransaction?.effectiveDate ?? null,
      balanceLabel: 'You owe customer',
      balanceHelper: `${ledger.customer.name} has an advance balance.`,
      balanceTone: 'advance',
    };
  }

  return {
    totalCredit,
    totalPayment,
    netBalance: ledger.balance,
    lastTransactionDate: lastTransaction?.effectiveDate ?? null,
    balanceLabel: 'Settled',
    balanceHelper: 'No dues are outstanding.',
    balanceTone: 'settled',
  };
}

function groupLedgerEntries(entries: LedgerEntry[]): LedgerDateGroup[] {
  const groups: LedgerDateGroup[] = [];
  const groupIndexByDate = new Map<string, number>();

  for (const entry of entries) {
    const groupIndex = groupIndexByDate.get(entry.effectiveDate);

    if (groupIndex === undefined) {
      groupIndexByDate.set(entry.effectiveDate, groups.length);
      groups.push({
        date: entry.effectiveDate,
        entries: [entry],
        totalCredit: entry.type === 'credit' ? entry.amount : 0,
        totalPayment: entry.type === 'payment' ? entry.amount : 0,
      });
      continue;
    }

    const group = groups[groupIndex];
    group.entries.push(entry);
    if (entry.type === 'credit') {
      group.totalCredit += entry.amount;
    } else {
      group.totalPayment += entry.amount;
    }
  }

  return groups;
}

function formatLedgerGroupDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function InsightCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'credit' | 'payment' | 'neutral';
}) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={2}
        style={[
          styles.insightValue,
          tone === 'credit' ? styles.insightCredit : tone === 'payment' ? styles.insightPayment : null,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.insightHelper}>{helper}</Text>
    </View>
  );
}

function isTransactionNewer(transaction: LedgerTransaction, currentLatest: LedgerTransaction): boolean {
  const dateComparison = transaction.effectiveDate.localeCompare(currentLatest.effectiveDate);
  if (dateComparison !== 0) {
    return dateComparison > 0;
  }

  return transaction.createdAt.localeCompare(currentLatest.createdAt) > 0;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 104,
    gap: spacing.lg,
  },
  loadingBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  balanceCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
    elevation: 2,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  stickyBalanceShell: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
    zIndex: 5,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  balanceMain: {
    flex: 1,
    gap: spacing.xs,
  },
  infoCard: {
    ...shadows.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  infoValue: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textTransform: 'uppercase',
    fontWeight: '900',
    letterSpacing: 0,
  },
  receivable: {
    color: colors.accent,
    fontSize: typography.balance,
    fontWeight: '900',
  },
  settled: {
    color: colors.success,
    fontSize: typography.balance,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  balanceStatusPill: {
    borderRadius: 8,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: 156,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  balanceStatusDue: {
    backgroundColor: colors.accentSurface,
  },
  balanceStatusAdvance: {
    backgroundColor: colors.successSurface,
  },
  balanceStatusSettled: {
    backgroundColor: colors.primarySurface,
  },
  balanceStatusText: {
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  balanceStatusDueText: {
    color: colors.accent,
  },
  balanceStatusAdvanceText: {
    color: colors.success,
  },
  balanceStatusSettledText: {
    color: colors.primary,
  },
  balanceHelper: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  insightCard: {
    ...shadows.card,
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 148,
    minHeight: 118,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  insightLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  insightValue: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  insightCredit: {
    color: colors.accent,
  },
  insightPayment: {
    color: colors.success,
  },
  insightHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActionButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  statusStrip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.md,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  creditDot: {
    backgroundColor: colors.accent,
  },
  paymentDot: {
    backgroundColor: colors.success,
  },
  statusTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  statusHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  emptyState: {
    ...shadows.card,
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
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  emptyActionButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  transactionList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  transactionGroup: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupHeader: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  groupDate: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  groupTotals: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  transactionItem: {
    minHeight: 78,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  transactionItemImportant: {
    backgroundColor: colors.warningSurface,
  },
  transactionItemPressed: {
    opacity: 0.82,
  },
  transactionTypeRail: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 4,
  },
  creditRail: {
    backgroundColor: colors.accent,
  },
  paymentRail: {
    backgroundColor: colors.success,
  },
  transactionText: {
    flex: 1,
    gap: 3,
  },
  transactionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  transactionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  importantBadge: {
    borderRadius: 8,
    backgroundColor: colors.warningBorder,
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  transactionNote: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  transactionNoteMuted: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontStyle: 'italic',
  },
  runningBalance: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 132,
  },
  creditPill: {
    borderRadius: 8,
    backgroundColor: colors.accentSurface,
    flexShrink: 1,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  paymentPill: {
    borderRadius: 8,
    backgroundColor: colors.successSurface,
    flexShrink: 1,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  creditPillText: {
    color: colors.accent,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 16,
  },
  paymentPillText: {
    color: colors.success,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 16,
  },
  creditAmount: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '900',
  },
  paymentAmount: {
    color: colors.success,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
