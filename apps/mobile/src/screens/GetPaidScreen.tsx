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

import { sharePaymentReminderMessage } from '../collections';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PaymentPromiseModal } from '../components/PaymentPromiseModal';
import { PaymentReminderModal } from '../components/PaymentReminderModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { StatusChip } from '../components/StatusChip';
import {
  addPaymentPromise,
  addPaymentReminder,
  getBusinessSettings,
  getDashboardSummary,
  getOldestDueCustomers,
  getStaleDueCustomers,
  getTopDueCustomers,
  listUpcomingPaymentPromises,
  updatePaymentPromiseStatus,
} from '../database';
import type {
  AddPaymentPromiseInput,
  BusinessSettings,
  CollectionCustomer,
  CustomerPaymentInsight,
  DashboardSummary,
  PaymentPromiseStatus,
  PaymentPromiseWithCustomer,
  PaymentReminderTone,
  TopDueCustomer,
} from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, touch, typography } from '../theme/theme';

type GetPaidScreenProps = NativeStackScreenProps<RootStackParamList, 'GetPaid'>;

type ReminderTarget = {
  id: string;
  name: string;
  balance: number;
  latestActivityAt: string;
  lastPaymentAt: string | null;
  lastReminderAt: string | null;
  insight: CustomerPaymentInsight;
};

export function GetPaidScreen({ navigation }: GetPaidScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [highestDues, setHighestDues] = useState<TopDueCustomer[]>([]);
  const [oldestDues, setOldestDues] = useState<CollectionCustomer[]>([]);
  const [staleDues, setStaleDues] = useState<CollectionCustomer[]>([]);
  const [promises, setPromises] = useState<PaymentPromiseWithCustomer[]>([]);
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [promiseTarget, setPromiseTarget] = useState<ReminderTarget | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSavingPromise, setIsSavingPromise] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currency = business?.currency ?? 'INR';

  const loadCollections = useCallback(async () => {
    const [
      settings,
      dashboardSummary,
      topDue,
      oldestDueRows,
      staleDueRows,
      upcomingPromises,
    ] = await Promise.all([
      getBusinessSettings(),
      getDashboardSummary(),
      getTopDueCustomers(5),
      getOldestDueCustomers(5),
      getStaleDueCustomers(5),
      listUpcomingPaymentPromises(5),
    ]);

    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    setBusiness(settings);
    setSummary(dashboardSummary);
    setHighestDues(topDue);
    setOldestDues(oldestDueRows);
    setStaleDues(staleDueRows);
    setPromises(upcomingPromises);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadCollections();
        } catch {
          if (isActive) {
            Alert.alert('Get Paid could not load', 'Please try again.');
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
    }, [loadCollections])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadCollections();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function openReminder(customer: ReminderTarget) {
    setReminderTarget(customer);
  }

  function openPromise(customer: ReminderTarget) {
    setPromiseTarget(customer);
  }

  async function shareReminder(tone: PaymentReminderTone, message: string) {
    if (!reminderTarget) {
      return;
    }

    try {
      setIsSendingReminder(true);
      const result = await sharePaymentReminderMessage(message);
      if (!result.shared) {
        return;
      }

      await addPaymentReminder({
        balanceAtSend: reminderTarget.balance,
        customerId: reminderTarget.id,
        message,
        sharedVia: result.sharedVia ?? 'system_share_sheet',
        tone,
      });
      setReminderTarget(null);
      await loadCollections();
      Alert.alert('Reminder shared', 'The reminder was saved in customer history.');
    } catch {
      Alert.alert('Reminder could not be shared', 'Please try again from this device.');
    } finally {
      setIsSendingReminder(false);
    }
  }

  async function savePromise(input: AddPaymentPromiseInput) {
    try {
      setIsSavingPromise(true);
      await addPaymentPromise(input);
      setPromiseTarget(null);
      await loadCollections();
      Alert.alert('Promise saved', 'This payment promise will appear in follow-up lists.');
    } catch {
      Alert.alert('Promise could not be saved', 'Please check the details and try again.');
    } finally {
      setIsSavingPromise(false);
    }
  }

  async function changePromiseStatus(id: string, status: PaymentPromiseStatus) {
    try {
      await updatePaymentPromiseStatus(id, status);
      await loadCollections();
      Alert.alert('Promise updated', 'The payment promise status was updated.');
    } catch {
      Alert.alert('Promise could not be updated', 'Please try again.');
    }
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing collections</Text>
      </SafeAreaView>
    );
  }

  const totalReceivable = summary?.totalReceivable ?? 0;
  const followUpCount = summary?.followUpCustomerCount ?? 0;

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
          title="Get Paid"
          subtitle="Follow up dues, record payments, and keep collections moving."
          onBack={() => navigation.goBack()}
        />

        <Card accent={totalReceivable > 0 ? 'warning' : 'success'} elevated glass>
          <Text style={styles.eyebrow}>Money to collect</Text>
          <Text style={styles.heroTitle}>Collections command center</Text>
          <MoneyText size="lg" tone={totalReceivable > 0 ? 'due' : 'payment'}>
            {formatCurrency(totalReceivable, currency)}
          </MoneyText>
          <Text style={styles.heroText}>
            {followUpCount > 0
              ? `${followUpCount} customers need a follow-up based on payment activity.`
              : 'No stale dues need follow-up right now.'}
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton
              style={styles.heroButton}
              onPress={() => navigation.navigate('TransactionForm', { type: 'payment' })}
            >
              Record Payment
            </PrimaryButton>
            <PrimaryButton
              style={styles.heroButton}
              variant="secondary"
              onPress={() => navigation.navigate('Customers')}
            >
              View Customers
            </PrimaryButton>
          </View>
        </Card>

        <Section title="Highest dues" subtitle="Start with the largest balances first.">
          {highestDues.length === 0 ? (
            <EmptyState
              title="No dues to collect"
              message="Customers with outstanding balances will appear here."
              action={
                <PrimaryButton variant="secondary" onPress={() => navigation.navigate('Customers')}>
                  View Customers
                </PrimaryButton>
              }
            />
          ) : (
            <View style={styles.listShell}>
              {highestDues.map((customer) => (
                <CollectionRow
                  key={customer.id}
                  currency={currency}
                  customer={customer}
                  helper={
                    customer.lastReminderAt
                      ? `Last reminder ${formatShortDate(customer.lastReminderAt)}`
                      : 'No reminder shared yet'
                  }
                  onOpen={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                  onPayment={() =>
                    navigation.navigate('TransactionForm', {
                      customerId: customer.id,
                      type: 'payment',
                    })
                  }
                  onPromise={() => openPromise(customer)}
                  onReminder={() => openReminder(customer)}
                />
              ))}
            </View>
          )}
        </Section>

        <Section title="Oldest dues" subtitle="Balances that have been open the longest.">
          {oldestDues.length === 0 ? (
            <EmptyState
              title="No old dues found"
              message="Older outstanding credit entries will appear here."
            />
          ) : (
            <View style={styles.listShell}>
              {oldestDues.map((customer) => (
                <CollectionRow
                  key={customer.id}
                  currency={currency}
                  customer={customer}
                  helper={
                    customer.oldestCreditAt
                      ? `Oldest credit ${formatShortDate(customer.oldestCreditAt)}`
                      : `Last activity ${formatShortDate(customer.latestActivityAt)}`
                  }
                  onOpen={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                  onPayment={() =>
                    navigation.navigate('TransactionForm', {
                      customerId: customer.id,
                      type: 'payment',
                    })
                  }
                  onPromise={() => openPromise(customer)}
                  onReminder={() => openReminder(customer)}
                />
              ))}
            </View>
          )}
        </Section>

        <Section title="No recent payment" subtitle="Positive balances without a recent payment.">
          {staleDues.length === 0 ? (
            <EmptyState
              title="No stale dues right now"
              message="Customers with old unpaid balances will appear here when follow-up is useful."
            />
          ) : (
            <View style={styles.listShell}>
              {staleDues.map((customer) => (
                <CollectionRow
                  key={customer.id}
                  currency={currency}
                  customer={customer}
                  helper={
                    customer.lastPaymentAt
                      ? `Last payment ${formatShortDate(customer.lastPaymentAt)}`
                      : 'No payment recorded yet'
                  }
                  onOpen={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                  onPayment={() =>
                    navigation.navigate('TransactionForm', {
                      customerId: customer.id,
                      type: 'payment',
                    })
                  }
                  onPromise={() => openPromise(customer)}
                  onReminder={() => openReminder(customer)}
                />
              ))}
            </View>
          )}
        </Section>

        <Section
          title="Promised payments"
          subtitle="Payment promises due soon will appear here."
        >
          {promises.length === 0 ? (
            <EmptyState
              title="No payment promises yet"
              message="After promise tracking is enabled, promised payment dates will appear here so follow-up is easier."
            />
          ) : (
            <View style={styles.listShell}>
              {promises.map((promise) => (
                <ListRow
                  key={promise.id}
                  accent={promise.promisedDate <= new Date().toISOString().slice(0, 10) ? 'warning' : 'primary'}
                  title={promise.customerName}
                  subtitle={`Promised ${formatCurrency(promise.promisedAmount, currency)} on ${formatShortDate(
                    promise.promisedDate
                  )}`}
                  meta={promise.note ?? `Current balance ${formatCurrency(promise.currentBalance, currency)}`}
                  right={
                    <View style={styles.rowActions}>
                      <StatusChip
                        label={formatPromiseStatus(promise.status, promise.promisedDate)}
                        tone={getPromiseTone(promise)}
                      />
                      <View style={styles.inlineActions}>
                        <MiniAction
                          label="Payment"
                          onPress={() =>
                            navigation.navigate('TransactionForm', {
                              customerId: promise.customerId,
                              type: 'payment',
                              promiseId: promise.id,
                            })
                          }
                        />
                        {promise.status === 'open' ? (
                          <MiniAction
                            label="Fulfilled"
                            onPress={() => void changePromiseStatus(promise.id, 'fulfilled')}
                          />
                        ) : null}
                      </View>
                    </View>
                  }
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: promise.customerId })}
                />
              ))}
            </View>
          )}
        </Section>
      </ScrollView>

      {reminderTarget && business ? (
        <PaymentReminderModal
          balance={reminderTarget.balance}
          businessName={business.businessName}
          currency={currency}
          customerName={reminderTarget.name}
          isSending={isSendingReminder}
          lastPaymentDate={reminderTarget.lastPaymentAt}
          lastReminderDate={reminderTarget.lastReminderAt}
          visible={Boolean(reminderTarget)}
          onClose={() => setReminderTarget(null)}
          onSend={shareReminder}
        />
      ) : null}
      {promiseTarget && business ? (
        <PaymentPromiseModal
          customerId={promiseTarget.id}
          customerName={promiseTarget.name}
          currency={currency}
          currentBalance={promiseTarget.balance}
          isSaving={isSavingPromise}
          visible={Boolean(promiseTarget)}
          onClose={() => setPromiseTarget(null)}
          onSave={savePromise}
        />
      ) : null}
    </SafeAreaView>
  );
}

function CollectionRow({
  customer,
  currency,
  helper,
  onOpen,
  onPayment,
  onPromise,
  onReminder,
}: {
  customer: ReminderTarget;
  currency: string;
  helper: string;
  onOpen: () => void;
  onPayment: () => void;
  onPromise: () => void;
  onReminder: () => void;
}) {
  return (
    <ListRow
      accent="warning"
      title={customer.name}
      subtitle={helper}
      meta={`Last activity ${formatShortDate(customer.latestActivityAt)}`}
      onPress={onOpen}
      right={
        <View style={styles.rowActions}>
          <MoneyText size="sm" tone="due" align="right">
            {formatCurrency(customer.balance, currency)}
          </MoneyText>
          <View style={styles.insightChips}>
            <StatusChip label={customer.insight.behaviorLabel} tone={customer.insight.behaviorTone} />
            <StatusChip
              label={customer.insight.dueAgingLabel}
              tone={customer.insight.dueAgingBucket === 'thirty_plus' ? 'danger' : 'warning'}
            />
          </View>
          <View style={styles.inlineActions}>
            <MiniAction label="Remind" onPress={onReminder} />
            <MiniAction label="Promise" onPress={onPromise} />
            <MiniAction label="Payment" onPress={onPayment} />
          </View>
        </View>
      }
    />
  );
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

function getPromiseTone(
  promise: PaymentPromiseWithCustomer
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (promise.status === 'fulfilled') {
    return 'success';
  }

  if (
    promise.status === 'missed' ||
    (promise.status === 'open' && promise.promisedDate <= new Date().toISOString().slice(0, 10))
  ) {
    return 'danger';
  }

  if (promise.status === 'cancelled') {
    return 'neutral';
  }

  return 'warning';
}

function MiniAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [styles.miniAction, pressed ? styles.miniActionPressed : null]}
    >
      <Text style={styles.miniActionText}>{label}</Text>
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
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
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
  heroText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  heroButton: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  listShell: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    maxWidth: 164,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  insightChips: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  miniAction: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  miniActionPressed: {
    opacity: 0.82,
  },
  miniActionText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
});
