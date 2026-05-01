import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  buildCustomerHealthScore,
  summarizePaymentClearance,
  summarizePaymentMode,
  type CustomerHealthScore,
} from '@orbit-ledger/core';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '../components/FloatingActionButton';
import { PaymentPromiseModal } from '../components/PaymentPromiseModal';
import { PaymentReminderModal } from '../components/PaymentReminderModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProductivityNudge } from '../components/ProductivityNudge';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { sharePaymentReminderMessage } from '../collections';
import type { GeneratedDocumentHistoryEntry } from '../documents';
import { getGeneratedDocumentHistory } from '../documents';
import {
  buildCustomerTrustTimeline,
  filterCustomerTrustTimeline,
  type CustomerTrustTimelineEvent,
  type CustomerTrustTimelineFilter,
} from '../customers/trustTimeline';
import {
  shareCustomerCsvExport,
  shareCustomerPdfExport,
  type CustomerExportProfile,
} from '../customers/customerExport';
import {
  addCustomerTimelineNote,
  addPaymentPromise,
  addPaymentReminder,
  getBusinessSettings,
  getCustomerLedger,
  getFeatureToggles,
  listCustomerTimelineNotes,
  listInvoicesForCustomer,
  listPaymentPromisesForCustomer,
  listPaymentRemindersForCustomer,
  updatePaymentPromiseStatus,
} from '../database';
import type {
  AddPaymentPromiseInput,
  AppFeatureToggles,
  CustomerLedger,
  CustomerPaymentInsight,
  CustomerTimelineNote,
  CustomerTimelineNoteKind,
  Invoice,
  LedgerTransaction,
  PaymentPromise,
  PaymentReminder,
  PaymentReminderTone,
  PaymentPromiseStatus,
  TransactionType,
} from '../database';
import { buildCustomerPaymentInsight } from '../database/customerInsights';
import {
  formatCurrency,
  formatShortDate,
  formatSignedCurrency,
  formatTransactionType,
} from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { getBusinessPaymentDetails, type BusinessPaymentDetails } from '../payments/businessPaymentDetails';
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
  lastPaymentDate: string | null;
  paymentInsight: CustomerPaymentInsight;
  health: CustomerHealthScore;
  balanceLabel: string;
  balanceHelper: string;
  balanceTone: 'due' | 'advance' | 'settled';
};
type LedgerView = {
  entries: LedgerEntry[];
  groups: LedgerDateGroup[];
  insights: LedgerInsights;
};
const INITIAL_LEDGER_GROUP_COUNT = 8;
const LEDGER_GROUP_BATCH_SIZE = 8;
const timelineFilters: Array<{ key: CustomerTrustTimelineFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'money', label: 'Money' },
  { key: 'documents', label: 'Documents' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'promises', label: 'Promises' },
  { key: 'notes', label: 'Notes' },
];

export function CustomerDetailScreen({ navigation, route }: CustomerDetailScreenProps) {
  const { customerId } = route.params;
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [businessName, setBusinessName] = useState('Orbit Ledger');
  const [currency, setCurrency] = useState('INR');
  const [countryCode, setCountryCode] = useState('IN');
  const [regionCode, setRegionCode] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<BusinessPaymentDetails>({});
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timelineNotes, setTimelineNotes] = useState<CustomerTimelineNote[]>([]);
  const [timelineDocuments, setTimelineDocuments] = useState<GeneratedDocumentHistoryEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<CustomerTrustTimelineFilter>('all');
  const [isReminderModalVisible, setIsReminderModalVisible] = useState(false);
  const [isPromiseModalVisible, setIsPromiseModalVisible] = useState(false);
  const [isTimelineNoteModalVisible, setIsTimelineNoteModalVisible] = useState(false);
  const [timelineNoteKind, setTimelineNoteKind] = useState<CustomerTimelineNoteKind>('note');
  const [timelineNoteText, setTimelineNoteText] = useState('');
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSavingPromise, setIsSavingPromise] = useState(false);
  const [isSavingTimelineNote, setIsSavingTimelineNote] = useState(false);
  const [sharingCustomerExport, setSharingCustomerExport] = useState<'csv' | 'pdf' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleLedgerGroupCount, setVisibleLedgerGroupCount] = useState(INITIAL_LEDGER_GROUP_COUNT);
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
    let lastPayment: LedgerTransaction | null = null;
    const chronologicalTransactions = [...ledger.transactions].reverse();

    for (const transaction of chronologicalTransactions) {
      if (transaction.type === 'credit') {
        totalCredit += transaction.amount;
        runningBalance += transaction.amount;
      } else {
        totalPayment += transaction.amount;
        runningBalance -= transaction.amount;
        if (!lastPayment || isTransactionNewer(transaction, lastPayment)) {
          lastPayment = transaction;
        }
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
      insights: createLedgerInsights(
        ledger,
        totalCredit,
        totalPayment,
        lastTransaction,
        lastPayment,
        calculateOldestOpenDueDate(ledger.openingBalance, ledger.customer.createdAt, chronologicalTransactions)
      ),
    };
  }, [ledger]);
  const ledgerEntries = ledgerView.entries;
  const ledgerGroups = ledgerView.groups;
  const visibleLedgerGroups = ledgerGroups.slice(0, visibleLedgerGroupCount);
  const hiddenLedgerEntryCount = ledgerGroups
    .slice(visibleLedgerGroupCount)
    .reduce((count, group) => count + group.entries.length, 0);
  const insights = ledgerView.insights;
  const timelineEvents = useMemo(() => {
    if (!ledger) {
      return [];
    }

    return buildCustomerTrustTimeline({
      currency,
      customerName: ledger.customer.name,
      documents: timelineDocuments,
      invoices,
      notes: timelineNotes,
      promises,
      reminders,
      transactions: ledger.transactions,
    });
  }, [currency, invoices, ledger, promises, reminders, timelineDocuments, timelineNotes]);
  const visibleTimelineEvents = useMemo(
    () => filterCustomerTrustTimeline(timelineEvents, timelineFilter),
    [timelineEvents, timelineFilter]
  );

  const loadLedger = useCallback(async () => {
    const [
      settings,
      customerLedger,
      toggles,
      reminderHistory,
      promiseHistory,
      invoiceHistory,
      noteHistory,
      documentHistory,
      savedPaymentDetails,
    ] = await Promise.all([
      getBusinessSettings(),
      getCustomerLedger(customerId),
      getFeatureToggles(),
      listPaymentRemindersForCustomer(customerId, 20),
      listPaymentPromisesForCustomer(customerId, 20),
      listInvoicesForCustomer(customerId, 20),
      listCustomerTimelineNotes(customerId, 20),
      Promise.resolve(getGeneratedDocumentHistory()),
      getBusinessPaymentDetails(),
    ]);
    setBusinessName(settings?.businessName ?? 'Orbit Ledger');
    setCurrency(settings?.currency ?? 'INR');
    setCountryCode(settings?.countryCode ?? 'IN');
    setRegionCode(settings?.stateCode ?? '');
    setPaymentDetails(savedPaymentDetails);
    setLedger(customerLedger);
    setFeatureToggles(toggles);
    setReminders(reminderHistory);
    setPromises(promiseHistory);
    setInvoices(invoiceHistory);
    setTimelineNotes(noteHistory);
    setTimelineDocuments(documentHistory);
    setVisibleLedgerGroupCount(INITIAL_LEDGER_GROUP_COUNT);
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

  async function shareReminder(tone: PaymentReminderTone, message: string) {
    if (!ledger || ledger.balance <= 0) {
      return;
    }

    try {
      setIsSendingReminder(true);
      const result = await sharePaymentReminderMessage(message);
      if (!result.shared) {
        return;
      }

      await addPaymentReminder({
        balanceAtSend: ledger.balance,
        customerId: ledger.customer.id,
        message,
        sharedVia: result.sharedVia ?? 'system_share_sheet',
        tone,
      });
      await loadLedger();
      setIsReminderModalVisible(false);
      Alert.alert('Reminder shared', 'The reminder was saved in this customer history.');
    } catch {
      Alert.alert('Reminder could not be shared', 'Please try again from this device.');
    } finally {
      setIsSendingReminder(false);
    }
  }

  async function savePaymentPromise(input: AddPaymentPromiseInput) {
    try {
      setIsSavingPromise(true);
      await addPaymentPromise(input);
      await loadLedger();
      setIsPromiseModalVisible(false);
      Alert.alert('Promise saved', 'This payment promise is now tracked for follow-up.');
    } catch {
      Alert.alert('Promise could not be saved', 'Please check the details and try again.');
    } finally {
      setIsSavingPromise(false);
    }
  }

  async function changePromiseStatus(id: string, status: PaymentPromiseStatus) {
    try {
      await updatePaymentPromiseStatus(id, status);
      await loadLedger();
      Alert.alert(
        status === 'fulfilled' ? 'Promise fulfilled' : 'Promise updated',
        status === 'fulfilled'
          ? 'This promise was marked fulfilled.'
          : 'The promise status was updated.'
      );
    } catch {
      Alert.alert('Promise could not be updated', 'Please try again.');
    }
  }

  function openTimelineNote(kind: CustomerTimelineNoteKind) {
    setTimelineNoteKind(kind);
    setTimelineNoteText('');
    setIsTimelineNoteModalVisible(true);
  }

  async function saveTimelineNote() {
    if (!ledger) {
      return;
    }

    const body = timelineNoteText.trim();
    if (!body) {
      Alert.alert('Add a note first', 'Write the detail you want to remember.');
      return;
    }

    try {
      setIsSavingTimelineNote(true);
      await addCustomerTimelineNote({
        body,
        customerId: ledger.customer.id,
        kind: timelineNoteKind,
      });
      await loadLedger();
      setIsTimelineNoteModalVisible(false);
      setTimelineNoteText('');
      Alert.alert(
        timelineNoteKind === 'dispute' ? 'Dispute saved' : 'Note saved',
        'This memory was added to the customer timeline.'
      );
    } catch {
      Alert.alert('Note could not be saved', 'Please try again.');
    } finally {
      setIsSavingTimelineNote(false);
    }
  }

  async function shareCustomerProfile(format: 'csv' | 'pdf') {
    if (!ledger) {
      return;
    }

    const profile = buildCustomerExportProfile(ledger, insights.health);

    try {
      setSharingCustomerExport(format);
      if (format === 'csv') {
        await shareCustomerCsvExport({ businessName, currency, customers: [profile] });
      } else {
        await shareCustomerPdfExport({ businessName, currency, customers: [profile] });
      }
    } catch {
      Alert.alert('Customer export failed', 'Please try again from this device.');
    } finally {
      setSharingCustomerExport(null);
    }
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
              {invoices[0] ? (
                <PrimaryButton
                  style={styles.quickActionButton}
                  variant="secondary"
                  onPress={() => navigation.navigate('InvoicePreview', { invoiceId: invoices[0].id })}
                >
                  Share Latest Invoice
                </PrimaryButton>
              ) : null}
              <PrimaryButton
                style={styles.quickActionButton}
                variant="secondary"
                onPress={() => navigation.navigate('StatementPreview', { customerId })}
              >
                Share Statement
              </PrimaryButton>
              <PrimaryButton
                disabled={sharingCustomerExport !== null}
                loading={sharingCustomerExport === 'pdf'}
                style={styles.quickActionButton}
                variant="secondary"
                onPress={() => void shareCustomerProfile('pdf')}
              >
                Export PDF
              </PrimaryButton>
              <PrimaryButton
                disabled={sharingCustomerExport !== null}
                loading={sharingCustomerExport === 'csv'}
                style={styles.quickActionButton}
                variant="secondary"
                onPress={() => void shareCustomerProfile('csv')}
              >
                Export CSV
              </PrimaryButton>
              {ledger.balance > 0 ? (
                <PrimaryButton
                  style={styles.quickActionButton}
                  variant="secondary"
                  onPress={() => setIsReminderModalVisible(true)}
                >
                  Send Reminder
                </PrimaryButton>
              ) : null}
              {ledger.balance > 0 ? (
                <PrimaryButton
                  style={styles.quickActionButton}
                  variant="secondary"
                  onPress={() => setIsPromiseModalVisible(true)}
                >
                  Record Promise
                </PrimaryButton>
              ) : null}
              <PrimaryButton
                style={styles.quickActionButton}
                variant="ghost"
                onPress={() => navigation.navigate('CustomerForm', { customerId })}
              >
                Edit Customer
              </PrimaryButton>
              <PrimaryButton
                style={styles.quickActionButton}
                variant="ghost"
                onPress={() => openTimelineNote('note')}
              >
                Add Note
              </PrimaryButton>
              <PrimaryButton
                style={styles.quickActionButton}
                variant="ghost"
                onPress={() => openTimelineNote('dispute')}
              >
                Add Dispute
              </PrimaryButton>
            </View>

            {insights.balanceTone === 'due' ? (
              <ProductivityNudge
                actionLabel="Send Reminder"
                message={`${ledger.customer.name} still owes ${formatCurrency(
                  ledger.balance,
                  currency
                )}. Share a professional follow-up message when needed.`}
                onAction={() => setIsReminderModalVisible(true)}
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
              <InsightCard
                label="Customer health"
                value={`${insights.health.label} ${insights.health.score}/100`}
                helper={insights.health.helper}
                tone={insights.health.tone}
              />
              <InsightCard
                label="Due aging"
                value={insights.paymentInsight.dueAgingLabel}
                helper={insights.paymentInsight.dueAgingHelper}
                tone={
                  insights.paymentInsight.dueAgingBucket === 'thirty_plus'
                    ? 'danger'
                    : insights.paymentInsight.dueAgingBucket === 'none'
                      ? 'success'
                      : 'warning'
                }
              />
              <InsightCard
                label="Payment pattern"
                value={insights.paymentInsight.behaviorLabel}
                helper={insights.paymentInsight.behaviorHelper}
                tone={insights.paymentInsight.behaviorTone}
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

            <View style={styles.infoCard}>
              <View style={styles.timelineHeader}>
                <View style={styles.timelineTitleBlock}>
                  <Text style={styles.sectionTitle}>Trust Timeline</Text>
                  <Text style={styles.muted}>
                    Money, documents, reminders, promises, and important notes in one place.
                  </Text>
                </View>
                <PrimaryButton variant="secondary" onPress={() => openTimelineNote('note')}>
                  Add Note
                </PrimaryButton>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timelineFilters}
              >
                {timelineFilters.map((filter) => (
                  <TimelineFilterChip
                    key={filter.key}
                    label={filter.label}
                    selected={timelineFilter === filter.key}
                    onPress={() => setTimelineFilter(filter.key)}
                  />
                ))}
              </ScrollView>
              {visibleTimelineEvents.length === 0 ? (
                <Text style={styles.muted}>
                  No timeline items for this view yet. Add a note or record activity to build the story.
                </Text>
              ) : (
                <View style={styles.timelineList}>
                  {visibleTimelineEvents.map((event) => (
                    <TrustTimelineItem key={event.id} event={event} />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Payment Promises</Text>
              {promises.length === 0 ? (
                <Text style={styles.muted}>
                  No payment promises recorded yet. Save a promised amount and date when the customer commits to pay.
                </Text>
              ) : (
                <View style={styles.promiseList}>
                  {promises.map((promise) => (
                    <View key={promise.id} style={styles.promiseItem}>
                      <View style={styles.promiseHeader}>
                        <View style={styles.promiseText}>
                          <Text style={styles.promiseTitle}>
                            {formatCurrency(promise.promisedAmount, currency)} promised
                          </Text>
                          <Text style={styles.promiseMeta}>
                            Due {formatShortDate(promise.promisedDate)}
                          </Text>
                          {promise.note ? (
                            <Text style={styles.promiseNote}>{promise.note}</Text>
                          ) : null}
                        </View>
                        <StatusChip
                          label={formatPromiseStatus(promise.status, promise.promisedDate)}
                          tone={getPromiseStatusTone(promise.status, promise.promisedDate)}
                        />
                      </View>
                      {promise.status === 'open' ? (
                        <View style={styles.promiseActions}>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="secondary"
                            onPress={() =>
                              navigation.navigate('TransactionForm', {
                                customerId,
                                type: 'payment',
                                promiseId: promise.id,
                              })
                            }
                          >
                            Record Payment
                          </PrimaryButton>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="ghost"
                            onPress={() => void changePromiseStatus(promise.id, 'fulfilled')}
                          >
                            Mark Fulfilled
                          </PrimaryButton>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="ghost"
                            onPress={() => void changePromiseStatus(promise.id, 'missed')}
                          >
                            Mark Missed
                          </PrimaryButton>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="ghost"
                            onPress={() => void changePromiseStatus(promise.id, 'cancelled')}
                          >
                            Cancel Promise
                          </PrimaryButton>
                        </View>
                      ) : null}
                      {promise.status === 'missed' ? (
                        <View style={styles.promiseActions}>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="secondary"
                            onPress={() =>
                              navigation.navigate('TransactionForm', {
                                customerId,
                                type: 'payment',
                                promiseId: promise.id,
                              })
                            }
                          >
                            Record Payment
                          </PrimaryButton>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="ghost"
                            onPress={() => void changePromiseStatus(promise.id, 'fulfilled')}
                          >
                            Mark Fulfilled
                          </PrimaryButton>
                          <PrimaryButton
                            style={styles.promiseActionButton}
                            variant="ghost"
                            onPress={() => void changePromiseStatus(promise.id, 'cancelled')}
                          >
                            Cancel Promise
                          </PrimaryButton>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Reminder History</Text>
              {reminders.length === 0 ? (
                <Text style={styles.muted}>
                  No reminders shared yet. Shared reminders will appear here with tone and balance.
                </Text>
              ) : (
                <View style={styles.reminderList}>
                  {reminders.map((reminder) => (
                    <View key={reminder.id} style={styles.reminderItem}>
                      <View style={styles.reminderText}>
                        <Text style={styles.reminderTitle}>
                          {formatReminderTone(reminder.tone)} reminder
                        </Text>
                        <Text style={styles.reminderMeta}>
                          {formatShortDate(reminder.createdAt)} ·{' '}
                          {formatCurrency(reminder.balanceAtSend, currency)}
                        </Text>
                      </View>
                      <Text style={styles.reminderChannel}>Shared</Text>
                    </View>
                  ))}
                </View>
              )}
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
                  {visibleLedgerGroups.map((group) => (
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
                              {transaction.type === 'payment' ? (
                                <Text style={styles.runningBalance}>
                                  {summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)}
                                  {' - '}
                                  {summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}
                                </Text>
                              ) : null}
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
                  {hiddenLedgerEntryCount > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      onPress={() =>
                        setVisibleLedgerGroupCount((current) => current + LEDGER_GROUP_BATCH_SIZE)
                      }
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={styles.loadMoreLedgerButton}
                    >
                      <Text style={styles.loadMoreLedgerText}>
                        Show {Math.min(hiddenLedgerEntryCount, LEDGER_GROUP_BATCH_SIZE * 4)} more entries
                      </Text>
                      <Text style={styles.loadMoreLedgerMeta}>
                        {hiddenLedgerEntryCount} older entr{hiddenLedgerEntryCount === 1 ? 'y' : 'ies'} hidden for speed.
                      </Text>
                    </Pressable>
                  ) : null}
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
      {ledger ? (
        <PaymentPromiseModal
          customerId={ledger.customer.id}
          customerName={ledger.customer.name}
          currency={currency}
          currentBalance={ledger.balance}
          isSaving={isSavingPromise}
          visible={isPromiseModalVisible}
          onClose={() => setIsPromiseModalVisible(false)}
          onSave={savePaymentPromise}
        />
      ) : null}
      {ledger ? (
        <PaymentReminderModal
          balance={ledger.balance}
          businessName={businessName}
          countryCode={countryCode}
          currency={currency}
          customerName={ledger.customer.name}
          isSending={isSendingReminder}
          lastPaymentDate={insights.lastPaymentDate}
          lastReminderDate={reminders[0]?.createdAt ?? null}
          paymentDetails={paymentDetails}
          regionCode={regionCode}
          visible={isReminderModalVisible}
          onClose={() => setIsReminderModalVisible(false)}
          onSend={shareReminder}
        />
      ) : null}
      {ledger ? (
        <TimelineNoteModal
          body={timelineNoteText}
          isSaving={isSavingTimelineNote}
          kind={timelineNoteKind}
          visible={isTimelineNoteModalVisible}
          onChangeBody={setTimelineNoteText}
          onChangeKind={setTimelineNoteKind}
          onClose={() => setIsTimelineNoteModalVisible(false)}
          onSave={() => void saveTimelineNote()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TimelineFilterChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [
        styles.timelineFilterChip,
        selected ? styles.timelineFilterChipSelected : null,
        pressed ? styles.timelineFilterChipPressed : null,
      ]}
    >
      <Text
        style={[
          styles.timelineFilterChipText,
          selected ? styles.timelineFilterChipTextSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TrustTimelineItem({ event }: { event: CustomerTrustTimelineEvent }) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineRail, timelineRailStyle(event.tone)]} />
      <View style={styles.timelineContent}>
        <View style={styles.timelineItemHeader}>
          <View style={styles.timelineItemTitleBlock}>
            <Text style={styles.timelineItemTitle}>{event.title}</Text>
            <Text style={styles.timelineItemMeta}>{formatShortDate(event.occurredAt)}</Text>
          </View>
          <StatusChip label={event.meta} tone={statusToneForTimeline(event.tone)} />
        </View>
        <Text style={styles.timelineItemDetail}>{event.detail}</Text>
      </View>
    </View>
  );
}

function TimelineNoteModal({
  body,
  isSaving,
  kind,
  onChangeBody,
  onChangeKind,
  onClose,
  onSave,
  visible,
}: {
  body: string;
  isSaving: boolean;
  kind: CustomerTimelineNoteKind;
  onChangeBody: (value: string) => void;
  onChangeKind: (kind: CustomerTimelineNoteKind) => void;
  onClose: () => void;
  onSave: () => void;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.noteModalBackdrop}>
        <View style={styles.noteModalSheet}>
          <View style={styles.noteModalHeader}>
            <View style={styles.noteModalTitleBlock}>
              <Text style={styles.noteModalEyebrow}>Customer memory</Text>
              <Text style={styles.noteModalTitle}>
                {kind === 'dispute' ? 'Add dispute' : 'Add note'}
              </Text>
            </View>
            <PrimaryButton variant="ghost" disabled={isSaving} onPress={onClose}>
              Close
            </PrimaryButton>
          </View>
          <View style={styles.noteKindRow}>
            <TimelineFilterChip
              label="Note"
              selected={kind === 'note'}
              onPress={() => onChangeKind('note')}
            />
            <TimelineFilterChip
              label="Dispute"
              selected={kind === 'dispute'}
              onPress={() => onChangeKind('dispute')}
            />
          </View>
          <TextField
            label={kind === 'dispute' ? 'What is disputed?' : 'What should be remembered?'}
            value={body}
            onChangeText={onChangeBody}
            placeholder="Write the important detail"
            multiline
            helperText="This appears in the customer timeline."
          />
          <View style={styles.noteModalActions}>
            <PrimaryButton disabled={!body.trim() || isSaving} loading={isSaving} onPress={onSave}>
              Save
            </PrimaryButton>
            <PrimaryButton variant="ghost" disabled={isSaving} onPress={onClose}>
              Not now
            </PrimaryButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createLedgerInsights(
  ledger: CustomerLedger | null,
  totalCredit: number,
  totalPayment: number,
  lastTransaction: LedgerTransaction | null,
  lastPayment: LedgerTransaction | null = null,
  oldestOpenDueAt: string | null = null
): LedgerInsights {
  const paymentInsight = buildCustomerPaymentInsight({
    balance: ledger?.balance ?? 0,
    latestActivityAt: lastTransaction?.createdAt ?? ledger?.customer.updatedAt ?? null,
    lastPaymentAt: lastPayment?.effectiveDate ?? null,
    oldestDueAt: oldestOpenDueAt,
    paymentCount: countPayments(ledger?.transactions ?? []),
    totalCredit,
    totalPayment,
  });
  const health = buildCustomerHealthScore({
    balance: ledger?.balance ?? 0,
    daysOutstanding: paymentInsight.daysOutstanding,
    latestActivityAt: lastTransaction?.createdAt ?? ledger?.customer.updatedAt ?? null,
    lastPaymentAt: lastPayment?.effectiveDate ?? null,
    paymentCount: paymentInsight.paymentCount,
    totalCredit,
    totalPayment,
  });

  if (!ledger) {
    return {
      totalCredit,
      totalPayment,
      netBalance: 0,
      lastTransactionDate: null,
      lastPaymentDate: null,
      paymentInsight,
      health,
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
      lastPaymentDate: lastPayment?.effectiveDate ?? null,
      paymentInsight,
      health,
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
      lastPaymentDate: lastPayment?.effectiveDate ?? null,
      paymentInsight,
      health,
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
    lastPaymentDate: lastPayment?.effectiveDate ?? null,
    paymentInsight,
    health,
    balanceLabel: 'Settled',
    balanceHelper: 'No dues are outstanding.',
    balanceTone: 'settled',
  };
}

function buildCustomerExportProfile(
  ledger: CustomerLedger,
  health: CustomerHealthScore
): CustomerExportProfile {
  const latestActivityAt = ledger.transactions[0]?.createdAt ?? ledger.customer.updatedAt;

  return {
    id: ledger.customer.id,
    name: ledger.customer.name,
    phone: ledger.customer.phone,
    address: ledger.customer.address,
    notes: ledger.customer.notes,
    openingBalance: ledger.openingBalance,
    balance: ledger.balance,
    isArchived: ledger.customer.isArchived,
    updatedAt: ledger.customer.updatedAt,
    latestActivityAt,
    health,
  };
}

function countPayments(transactions: LedgerTransaction[]): number {
  return transactions.reduce(
    (count, transaction) => count + (transaction.type === 'payment' ? 1 : 0),
    0
  );
}

function calculateOldestOpenDueDate(
  openingBalance: number,
  customerCreatedAt: string,
  chronologicalTransactions: LedgerTransaction[]
): string | null {
  const openCredits: Array<{ date: string; amount: number }> = [];
  if (openingBalance > 0) {
    openCredits.push({ amount: openingBalance, date: customerCreatedAt.slice(0, 10) });
  }

  for (const transaction of chronologicalTransactions) {
    if (transaction.type === 'credit') {
      openCredits.push({ amount: transaction.amount, date: transaction.effectiveDate });
      continue;
    }

    let remainingPayment = transaction.amount;
    while (remainingPayment > 0 && openCredits.length > 0) {
      const oldestCredit = openCredits[0];
      const appliedAmount = Math.min(oldestCredit.amount, remainingPayment);
      oldestCredit.amount -= appliedAmount;
      remainingPayment -= appliedAmount;
      if (oldestCredit.amount <= 0.0001) {
        openCredits.shift();
      }
    }
  }

  return openCredits[0]?.date ?? null;
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

function formatReminderTone(tone: PaymentReminderTone): string {
  if (tone === 'final') {
    return 'Final';
  }

  if (tone === 'firm') {
    return 'Firm';
  }

  return 'Polite';
}

function formatPromiseStatus(status: PaymentPromiseStatus, promisedDate?: string): string {
  if (status === 'fulfilled') {
    return 'Fulfilled';
  }

  if (status === 'missed') {
    return 'Missed';
  }

  if (status === 'cancelled') {
    return 'Cancelled';
  }

  const today = new Date().toISOString().slice(0, 10);
  if (promisedDate && promisedDate < today) {
    return 'Missed';
  }

  if (promisedDate && promisedDate === today) {
    return 'Due today';
  }

  return 'Open';
}

function getPromiseStatusTone(
  status: PaymentPromiseStatus,
  promisedDate: string
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'fulfilled') {
    return 'success';
  }

  if (
    status === 'missed' ||
    (status === 'open' && promisedDate < new Date().toISOString().slice(0, 10))
  ) {
    return 'danger';
  }

  if (status === 'cancelled') {
    return 'neutral';
  }

  return 'warning';
}

function statusToneForTimeline(
  tone: CustomerTrustTimelineEvent['tone']
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  return tone;
}

function timelineRailStyle(tone: CustomerTrustTimelineEvent['tone']) {
  if (tone === 'success') {
    return styles.timelineRailSuccess;
  }

  if (tone === 'warning') {
    return styles.timelineRailWarning;
  }

  if (tone === 'danger') {
    return styles.timelineRailDanger;
  }

  if (tone === 'primary') {
    return styles.timelineRailPrimary;
  }

  return styles.timelineRailNeutral;
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
  tone: 'credit' | 'payment' | 'neutral' | 'warning' | 'danger' | 'success' | 'primary' | 'tax';
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
          tone === 'credit' || tone === 'warning'
            ? styles.insightCredit
            : tone === 'payment' || tone === 'success'
              ? styles.insightPayment
              : tone === 'danger'
                ? styles.insightDanger
                : tone === 'primary'
                  ? styles.insightPrimary
                  : tone === 'tax'
                    ? styles.insightTax
                    : null,
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
  reminderList: {
    gap: spacing.sm,
  },
  reminderItem: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reminderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reminderTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  reminderMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  reminderChannel: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.successSurface,
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: '900',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timelineTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  timelineFilters: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  timelineFilterChip: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  timelineFilterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  timelineFilterChipPressed: {
    opacity: 0.82,
  },
  timelineFilterChipText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  timelineFilterChipTextSelected: {
    color: colors.surface,
  },
  timelineList: {
    gap: spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  timelineRail: {
    width: 5,
  },
  timelineRailSuccess: {
    backgroundColor: colors.success,
  },
  timelineRailWarning: {
    backgroundColor: colors.warning,
  },
  timelineRailDanger: {
    backgroundColor: colors.danger,
  },
  timelineRailPrimary: {
    backgroundColor: colors.primary,
  },
  timelineRailNeutral: {
    backgroundColor: colors.textMuted,
  },
  timelineContent: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  timelineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  timelineItemTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timelineItemTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  timelineItemMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  timelineItemDetail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  noteModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  noteModalSheet: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  noteModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  noteModalTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  noteModalEyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  noteModalTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  noteKindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  noteModalActions: {
    gap: spacing.sm,
  },
  promiseList: {
    gap: spacing.md,
  },
  promiseItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    gap: spacing.md,
  },
  promiseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  promiseText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  promiseTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  promiseMeta: {
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  promiseNote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  promiseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  promiseActionButton: {
    flexGrow: 1,
    flexBasis: '47%',
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
  insightDanger: {
    color: colors.danger,
  },
  insightPrimary: {
    color: colors.primary,
  },
  insightTax: {
    color: colors.tax,
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
  loadMoreLedgerButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceRaised,
  },
  loadMoreLedgerText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  loadMoreLedgerMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
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
