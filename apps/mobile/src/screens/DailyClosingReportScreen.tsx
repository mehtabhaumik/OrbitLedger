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
  buildDailyClosingReport,
  buildDailyClosingRitualSummary,
  getDailyClosingRitualSummary,
  listDailyClosingRitualSummaries,
  saveDailyClosingRitualSummary,
  shareDailyClosingReportExport,
  type DailyClosingAction,
  type DailyClosingConfirmationKey,
  type DailyClosingExportFormat,
  type DailyClosingReport,
  type DailyClosingRitualSummary,
} from '../closing';
import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { DateInput } from '../components/DateInput';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import { TextField } from '../components/TextField';
import { getTodayDateInput, normalizeDecimalInput } from '../forms/validation';
import { formatCurrency, formatShortDate, formatTransactionType } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type DailyClosingReportScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DailyClosingReport'
>;

export function DailyClosingReportScreen({ navigation }: DailyClosingReportScreenProps) {
  const [reportDate, setReportDate] = useState(getTodayDateInput());
  const [report, setReport] = useState<DailyClosingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedClosing, setSavedClosing] = useState<DailyClosingRitualSummary | null>(null);
  const [closingHistory, setClosingHistory] = useState<DailyClosingRitualSummary[]>([]);
  const [confirmations, setConfirmations] = useState<Record<DailyClosingConfirmationKey, boolean>>(
    createDefaultConfirmations
  );
  const [countedCashInput, setCountedCashInput] = useState('');
  const [mismatchNote, setMismatchNote] = useState('');
  const [isSavingClosing, setIsSavingClosing] = useState(false);
  const [sharingFormat, setSharingFormat] = useState<DailyClosingExportFormat | null>(null);
  const currency = report?.business.currency ?? 'INR';

  const loadReport = useCallback(async (date: string) => {
    const [nextReport, nextSavedClosing, nextHistory] = await Promise.all([
      buildDailyClosingReport(date),
      getDailyClosingRitualSummary(date),
      listDailyClosingRitualSummaries(),
    ]);
    setReport(nextReport);
    setSavedClosing(nextSavedClosing);
    setClosingHistory(nextHistory);
    if (nextSavedClosing) {
      setConfirmations(confirmationsFromSummary(nextSavedClosing));
      setCountedCashInput(
        nextSavedClosing.mismatch.countedCash === null ? '' : formatAmountInput(nextSavedClosing.mismatch.countedCash)
      );
      setMismatchNote(nextSavedClosing.mismatch.note ?? '');
    } else {
      setConfirmations(createDefaultConfirmations());
      setCountedCashInput(formatAmountInput(nextReport.totals.paymentReceived));
      setMismatchNote('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          const [nextReport, nextSavedClosing, nextHistory] = await Promise.all([
            buildDailyClosingReport(reportDate),
            getDailyClosingRitualSummary(reportDate),
            listDailyClosingRitualSummaries(),
          ]);
          if (isActive) {
            setReport(nextReport);
            setSavedClosing(nextSavedClosing);
            setClosingHistory(nextHistory);
            if (nextSavedClosing) {
              setConfirmations(confirmationsFromSummary(nextSavedClosing));
              setCountedCashInput(
                nextSavedClosing.mismatch.countedCash === null
                  ? ''
                  : formatAmountInput(nextSavedClosing.mismatch.countedCash)
              );
              setMismatchNote(nextSavedClosing.mismatch.note ?? '');
            } else {
              setConfirmations(createDefaultConfirmations());
              setCountedCashInput(formatAmountInput(nextReport.totals.paymentReceived));
              setMismatchNote('');
            }
          }
        } catch {
          if (isActive) {
            Alert.alert('Closing report could not load', 'Please check your saved data and try again.');
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
    }, [reportDate])
  );

  async function changeDate(value: string) {
    setReportDate(value);
    try {
      setIsLoading(true);
      await loadReport(value);
    } catch {
      Alert.alert('Date could not load', 'Please choose another closing date.');
    } finally {
      setIsLoading(false);
    }
  }

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadReport(reportDate);
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function shareReport(format: DailyClosingExportFormat) {
    if (!report) {
      return;
    }

    try {
      setSharingFormat(format);
      const exported = await shareDailyClosingReportExport({ format, report });
      Alert.alert('Closing report shared', `${exported.fileName} was saved and opened for sharing.`);
    } catch {
      Alert.alert(
        'Closing report could not be shared',
        'Orbit Ledger could not prepare this export. Please try again from this device.'
      );
    } finally {
      setSharingFormat(null);
    }
  }

  function toggleConfirmation(key: DailyClosingConfirmationKey) {
    setConfirmations((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function saveClosingRitual() {
    if (!report) {
      return;
    }

    const countedCash = countedCashInput.trim() ? Number(countedCashInput) : null;
    if (countedCashInput.trim() && !Number.isFinite(countedCash)) {
      Alert.alert('Cash count needs a number', 'Enter the cash counted today.');
      return;
    }

    try {
      setIsSavingClosing(true);
      const summary = buildDailyClosingRitualSummary(report, {
        confirmations,
        countedCash,
        mismatchNote,
      });
      const nextHistory = await saveDailyClosingRitualSummary(summary);
      setSavedClosing(summary);
      setClosingHistory(nextHistory);
      Alert.alert('Daily closing saved', 'Tomorrow actions are ready.');
    } catch {
      Alert.alert('Closing could not be saved', 'Please check the details and try again.');
    } finally {
      setIsSavingClosing(false);
    }
  }

  function openActionTarget(target: DailyClosingAction['target']) {
    switch (target) {
      case 'get_paid':
        navigation.navigate('GetPaid');
        return;
      case 'add_payment':
        navigation.navigate('TransactionForm', { type: 'payment' });
        return;
      case 'add_credit':
        navigation.navigate('TransactionForm', { type: 'credit' });
        return;
      case 'products':
        navigation.navigate('Products');
        return;
      case 'customers':
        navigation.navigate('Customers');
        return;
      case 'reports':
      default:
        navigation.navigate('Reports');
    }
  }

  if (isLoading && !report) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing daily closing</Text>
        <View style={styles.loadingStack}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  const closingDifference = (report?.totals.closingReceivable ?? 0) - (report?.totals.openingReceivable ?? 0);
  const countedCash = countedCashInput.trim() ? Number(countedCashInput) : null;
  const cashDifference =
    report && countedCash !== null && Number.isFinite(countedCash)
      ? countedCash - report.totals.paymentReceived
      : 0;
  const hasCashMismatch = Math.abs(cashDifference) >= 0.01;
  const reportIsEmpty =
    report &&
    report.totals.transactionCount === 0 &&
    report.totals.invoiceCount === 0 &&
    report.totals.newCustomers === 0 &&
    report.totals.remindersSent === 0;

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
          title="Daily Closing"
          subtitle="End-of-day totals from your saved ledger data."
          backLabel="Reports"
          onBack={() => navigation.goBack()}
        />

        <Card accent="primary" elevated glass>
          <View style={styles.dateHeader}>
            <View style={styles.dateText}>
              <Text style={styles.eyebrow}>Closing date</Text>
              <Text style={styles.heroTitle}>{formatShortDate(reportDate)}</Text>
            </View>
            <StatusChip label="Ready" tone="success" />
          </View>
          <DateInput
            label="Select closing date"
            value={reportDate}
            onChange={changeDate}
            maximumDate={new Date()}
            helperText="Use this after recording the day's credits, payments, invoices, and follow-ups."
          />
        </Card>

        {report ? (
          <>
            <Card accent={report.totals.closingReceivable > 0 ? 'warning' : 'success'} elevated>
              <Text style={styles.eyebrow}>End of day</Text>
              <Text style={styles.heroTitle}>Closing receivable</Text>
              <MoneyText size="lg" tone={report.totals.closingReceivable > 0 ? 'due' : 'payment'}>
                {formatCurrency(report.totals.closingReceivable, currency)}
              </MoneyText>
              <Text style={styles.heroHelper}>
                Opened at {formatCurrency(report.totals.openingReceivable, currency)}.
                {' '}
                {closingDifference === 0
                  ? 'Receivables stayed flat.'
                  : `${closingDifference > 0 ? 'Increased' : 'Reduced'} by ${formatCurrency(
                      Math.abs(closingDifference),
                      currency
                    )}.`}
              </Text>
            </Card>

            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Payments received"
                value={formatCurrency(report.totals.paymentReceived, currency)}
                helper={`${report.ledgerEntries.filter((entry) => entry.type === 'payment').length} payment entries.`}
                tone="payment"
              />
              <SummaryCard
                label="Credit given"
                value={formatCurrency(report.totals.creditGiven, currency)}
                helper={`${report.ledgerEntries.filter((entry) => entry.type === 'credit').length} credit entries.`}
                tone="due"
              />
              <SummaryCard
                label="Invoice sales"
                value={formatCurrency(report.totals.invoiceSales, currency)}
                helper={`${report.totals.invoiceCount} invoices · tax ${formatCurrency(report.totals.invoiceTax, currency)}.`}
                tone="primary"
              />
              <SummaryCard
                label="Customers due"
                value={`${report.totals.outstandingCustomersAtClose}`}
                helper="Customers with a positive balance at close."
                tone={report.totals.outstandingCustomersAtClose > 0 ? 'due' : 'payment'}
              />
            </View>

            <Section title="3-minute closing" subtitle="Confirm the day before you leave.">
              <Card accent={hasCashMismatch ? 'danger' : savedClosing ? 'success' : 'primary'}>
                <View style={styles.ritualHeader}>
                  <View style={styles.ritualHeaderText}>
                    <Text style={styles.ritualTitle}>
                      {savedClosing ? 'Closing saved' : 'Close today'}
                    </Text>
                    <Text style={styles.ritualCopy}>
                      {savedClosing
                        ? `Saved ${formatShortDate(savedClosing.closedAt)}. You can update it anytime.`
                        : 'Count cash, confirm entries, and prepare tomorrow.'}
                    </Text>
                  </View>
                  <StatusChip
                    label={hasCashMismatch ? 'Check cash' : savedClosing ? 'Saved' : 'Open'}
                    tone={hasCashMismatch ? 'danger' : savedClosing ? 'success' : 'primary'}
                  />
                </View>

                <View style={styles.confirmationList}>
                  {closingConfirmationLabels.map((item) => (
                    <ClosingCheckRow
                      key={item.key}
                      checked={confirmations[item.key]}
                      label={item.label}
                      onPress={() => toggleConfirmation(item.key)}
                    />
                  ))}
                </View>

                <View style={styles.cashBox}>
                  <Text style={styles.cashBoxTitle}>Cash check</Text>
                  <Text style={styles.cashBoxCopy}>
                    Payments recorded: {formatCurrency(report.totals.paymentReceived, currency)}
                  </Text>
                  <TextField
                    label="Cash counted"
                    value={countedCashInput}
                    onChangeText={(value) => setCountedCashInput(normalizeDecimalInput(value))}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="0.00"
                    helperText={
                      countedCash === null
                        ? 'Enter counted cash to catch mismatches.'
                        : hasCashMismatch
                          ? `Difference ${formatCurrency(Math.abs(cashDifference), currency)}.`
                          : 'Cash matches recorded payments.'
                    }
                  />
                  {hasCashMismatch ? (
                    <TextField
                      label="Mismatch note"
                      value={mismatchNote}
                      onChangeText={setMismatchNote}
                      placeholder="Example: bank transfer not entered yet"
                      multiline
                    />
                  ) : null}
                </View>

                <PrimaryButton loading={isSavingClosing} disabled={isSavingClosing} onPress={saveClosingRitual}>
                  Save Daily Closing
                </PrimaryButton>
              </Card>
            </Section>

            {savedClosing ? (
              <Section title="Tomorrow actions" subtitle="What to do next after closing.">
                <View style={styles.listShell}>
                  {savedClosing.nextDayActions.map((action) => (
                    <ListRow
                      key={action.id}
                      accent={action.tone}
                      title={action.label}
                      subtitle={action.helper}
                      onPress={() => openActionTarget(action.target)}
                    />
                  ))}
                </View>
              </Section>
            ) : null}

            {reportIsEmpty ? (
              <EmptyState
                title="No activity for this date"
                message="This closing report is ready, but no credits, payments, invoices, customers, or reminders were recorded on the selected date."
                action={
                  <PrimaryButton onPress={() => navigation.navigate('TransactionForm')}>
                    Add Transaction
                  </PrimaryButton>
                }
              />
            ) : null}

            <Section title="Follow-up summary" subtitle="Promises, reminders, and stock signals for tomorrow.">
              <View style={styles.signalGrid}>
                <SignalCard
                  label="Reminders sent"
                  value={`${report.totals.remindersSent}`}
                  tone={report.totals.remindersSent > 0 ? 'primary' : 'neutral'}
                />
                <SignalCard
                  label="Promises due"
                  value={`${report.totals.promisesDue}`}
                  tone={report.totals.promisesDue > 0 ? 'warning' : 'success'}
                />
                <SignalCard
                  label="Promises fulfilled"
                  value={`${report.totals.promisesFulfilled}`}
                  tone={report.totals.promisesFulfilled > 0 ? 'success' : 'neutral'}
                />
                <SignalCard
                  label="Missed promises"
                  value={`${report.totals.promisesMissed}`}
                  tone={report.totals.promisesMissed > 0 ? 'danger' : 'success'}
                />
              </View>
            </Section>

            <Section title="Ledger activity" subtitle="Credits and payments recorded for the selected date.">
              {report.ledgerEntries.length === 0 ? (
                <EmptyState
                  title="No ledger entries"
                  message="Credits and payments recorded on this date will appear here."
                />
              ) : (
                <View style={styles.listShell}>
                  {report.ledgerEntries.map((entry) => (
                    <ListRow
                      key={entry.id}
                      accent={entry.type === 'credit' ? 'warning' : 'success'}
                      title={entry.customerName}
                      subtitle={`${formatTransactionType(entry.type)} · ${entry.note ?? 'No note'}`}
                      meta={`Saved ${formatShortDate(entry.createdAt)}`}
                      right={
                        <MoneyText size="sm" tone={entry.type === 'credit' ? 'credit' : 'payment'} align="right">
                          {formatCurrency(entry.amount, currency)}
                        </MoneyText>
                      }
                      onPress={() => navigation.navigate('CustomerDetail', { customerId: entry.customerId })}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Section title="Invoices" subtitle="Invoices issued on the selected date.">
              {report.invoices.length === 0 ? (
                <EmptyState
                  title="No invoices issued"
                  message="Invoices created for this closing date will appear here."
                  action={
                    <PrimaryButton variant="secondary" onPress={() => navigation.navigate('InvoiceForm')}>
                      Create Invoice
                    </PrimaryButton>
                  }
                />
              ) : (
                <View style={styles.listShell}>
                  {report.invoices.map((invoice) => (
                    <ListRow
                      key={invoice.id}
                      accent="primary"
                      title={invoice.invoiceNumber}
                      subtitle={invoice.customerName ?? 'Walk-in customer'}
                      meta={`Tax ${formatCurrency(invoice.taxAmount, currency)} · ${invoice.status}`}
                      right={
                        <MoneyText size="sm" align="right">
                          {formatCurrency(invoice.totalAmount, currency)}
                        </MoneyText>
                      }
                      onPress={() => navigation.navigate('InvoicePreview', { invoiceId: invoice.id })}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Section title="Top dues at close" subtitle="Largest customer balances after the selected date.">
              {report.topOutstandingCustomers.length === 0 ? (
                <EmptyState
                  title="No customer dues"
                  message="No positive customer balances were found at close."
                />
              ) : (
                <View style={styles.listShell}>
                  {report.topOutstandingCustomers.map((customer) => (
                    <ListRow
                      key={customer.id}
                      accent="warning"
                      title={customer.name}
                      subtitle={customer.phone ?? 'No phone saved'}
                      meta="Outstanding at close"
                      right={
                        <MoneyText size="sm" tone="due" align="right">
                          {formatCurrency(customer.balance, currency)}
                        </MoneyText>
                      }
                      onPress={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Section title="Low stock watch" subtitle="Inventory items at 5 units or below.">
              {report.lowStockProducts.length === 0 ? (
                <EmptyState
                  title="No low stock items"
                  message="Stock warnings will appear here when products run low."
                />
              ) : (
                <View style={styles.listShell}>
                  {report.lowStockProducts.map((product) => (
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

            <Section title="Closing history" subtitle="Recent saved closing summaries.">
              {closingHistory.length === 0 ? (
                <EmptyState
                  title="No saved closings yet"
                  message="Saved daily closings will appear here."
                />
              ) : (
                <View style={styles.listShell}>
                  {closingHistory.slice(0, 5).map((closing) => (
                    <ListRow
                      key={closing.id}
                      accent={closing.mismatch.hasMismatch ? 'danger' : 'success'}
                      title={formatShortDate(closing.reportDate)}
                      subtitle={
                        closing.mismatch.hasMismatch
                          ? `Mismatch ${formatCurrency(Math.abs(closing.mismatch.difference), currency)}`
                          : 'Closed cleanly'
                      }
                      meta={`${closing.nextDayActions.length} next action${closing.nextDayActions.length === 1 ? '' : 's'}`}
                      onPress={() => void changeDate(closing.reportDate)}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Card accent="primary">
              <View style={styles.exportCopy}>
                <Text style={styles.exportTitle}>Save or share closing report</Text>
                <Text style={styles.exportText}>
                  Export this day-end snapshot as JSON for systems or CSV for spreadsheets.
                </Text>
              </View>
              <View style={styles.exportActions}>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="secondary"
                  loading={sharingFormat === 'json'}
                  disabled={Boolean(sharingFormat)}
                  onPress={() => void shareReport('json')}
                >
                  Share JSON
                </PrimaryButton>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="secondary"
                  loading={sharingFormat === 'csv'}
                  disabled={Boolean(sharingFormat)}
                  onPress={() => void shareReport('csv')}
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

const closingConfirmationLabels: Array<{ key: DailyClosingConfirmationKey; label: string }> = [
  { key: 'cash_collected', label: 'Cash collected is counted' },
  { key: 'payments_recorded', label: 'Payments are recorded' },
  { key: 'credit_recorded', label: 'New credit is recorded' },
  { key: 'stock_checked', label: 'Stock changes are checked' },
  { key: 'followups_ready', label: 'Tomorrow follow-ups are ready' },
];

function createDefaultConfirmations(): Record<DailyClosingConfirmationKey, boolean> {
  return {
    cash_collected: false,
    payments_recorded: false,
    credit_recorded: false,
    stock_checked: false,
    followups_ready: false,
  };
}

function confirmationsFromSummary(
  summary: DailyClosingRitualSummary
): Record<DailyClosingConfirmationKey, boolean> {
  return summary.confirmations.reduce(
    (next, confirmation) => ({
      ...next,
      [confirmation.key]: confirmation.confirmed,
    }),
    createDefaultConfirmations()
  );
}

function formatAmountInput(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function ClosingCheckRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.confirmationRow,
        checked ? styles.confirmationRowChecked : null,
        pressed ? styles.confirmationRowPressed : null,
      ]}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        <Text style={[styles.checkboxMark, checked ? styles.checkboxMarkChecked : null]}>
          OK
        </Text>
      </View>
      <Text style={styles.confirmationText}>{label}</Text>
    </Pressable>
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
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dateText: {
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
  heroHelper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
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
  ritualHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ritualHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  ritualTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  ritualCopy: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  confirmationList: {
    gap: spacing.sm,
  },
  confirmationRow: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  confirmationRowChecked: {
    borderColor: colors.success,
    backgroundColor: colors.successSurface,
  },
  confirmationRowPressed: {
    opacity: 0.84,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  checkboxChecked: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  checkboxMark: {
    color: 'transparent',
    fontSize: typography.caption,
    fontWeight: '900',
  },
  checkboxMarkChecked: {
    color: colors.surface,
  },
  confirmationText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  cashBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.md,
  },
  cashBoxTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  cashBoxCopy: {
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
