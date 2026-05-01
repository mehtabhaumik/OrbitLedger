import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildCollectionRecommendations,
  buildPromiseFollowUpCalendar,
  buildPromiseFollowUpReminderMessage,
  sharePaymentReminderMessage,
  type CollectionRecommendation,
  type PromiseFollowUpItem,
} from '../collections';
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
  listPaymentPromiseFollowUps,
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
import { getBusinessPaymentDetails, type BusinessPaymentDetails } from '../payments/businessPaymentDetails';
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
  const [paymentDetails, setPaymentDetails] = useState<BusinessPaymentDetails>({});
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
      savedPaymentDetails,
    ] = await Promise.all([
      getBusinessSettings(),
      getDashboardSummary(),
      getTopDueCustomers(5),
      getOldestDueCustomers(5),
      getStaleDueCustomers(5),
      listPaymentPromiseFollowUps(30),
      getBusinessPaymentDetails(),
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
    setPaymentDetails(savedPaymentDetails);
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

  async function sharePromiseFollowUp(promise: PromiseFollowUpItem) {
    if (!business) {
      return;
    }

    try {
      setIsSendingReminder(true);
      const message = buildPromiseFollowUpReminderMessage({
        businessName: business.businessName,
        currency,
        promise,
      });
      const result = await sharePaymentReminderMessage(message);
      if (!result.shared) {
        return;
      }

      await addPaymentReminder({
        balanceAtSend: promise.currentBalance,
        customerId: promise.customerId,
        message,
        sharedVia: result.sharedVia ?? 'system_share_sheet',
        tone: promise.groupKey === 'overdue' ? 'firm' : 'polite',
      });
      await loadCollections();
      Alert.alert('Reminder shared', 'The promise reminder was saved in customer history.');
    } catch {
      Alert.alert('Reminder could not be shared', 'Please try again from this device.');
    } finally {
      setIsSendingReminder(false);
    }
  }

  const recommendations = useMemo(
    () =>
      buildCollectionRecommendations({
        highestDues,
        oldestDues,
        staleDues,
        promises,
        limit: 3,
      }),
    [highestDues, oldestDues, promises, staleDues]
  );
  const promiseGroups = useMemo(
    () =>
      buildPromiseFollowUpCalendar({
        currency,
        promises,
      }),
    [currency, promises]
  );

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

        <Section title="Collect first" subtitle="The most important follow-ups for today.">
          {recommendations.length === 0 ? (
            <EmptyState
              title="Nothing urgent to collect"
              message="Payment follow-ups will appear here when a customer needs attention."
            />
          ) : (
            <View style={styles.recommendationList}>
              {recommendations.map((recommendation) => (
                <CollectionRecommendationCard
                  key={recommendation.id}
                  currency={currency}
                  recommendation={recommendation}
                  onCall={() => {
                    if (!recommendation.customerPhone) {
                      Alert.alert('No phone number', 'Add a phone number before calling this customer.');
                      return;
                    }

                    void Linking.openURL(`tel:${recommendation.customerPhone}`);
                  }}
                  onMessage={() => openReminder(recommendation)}
                  onOpen={() => navigation.navigate('CustomerDetail', { customerId: recommendation.id })}
                  onPayment={() =>
                    navigation.navigate('TransactionForm', {
                      customerId: recommendation.id,
                      promiseId: recommendation.promise?.id,
                      type: 'payment',
                    })
                  }
                  onPromise={() => openPromise(recommendation)}
                  onStatement={() =>
                    navigation.navigate('StatementPreview', {
                      customerId: recommendation.id,
                    })
                  }
                />
              ))}
            </View>
          )}
        </Section>

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

        <Section title="Follow-up calendar" subtitle="Payment promises grouped by when to act.">
          {promiseGroups.length === 0 ? (
            <EmptyState
              title="No promises to follow up"
              message="Record a payment promise when a customer commits to pay."
            />
          ) : (
            <View style={styles.promiseCalendar}>
              {promiseGroups.map((group) => (
                <View key={group.key} style={styles.promiseGroup}>
                  <View style={styles.promiseGroupHeader}>
                    <View style={styles.promiseGroupTitleBlock}>
                      <Text style={styles.promiseGroupTitle}>{group.title}</Text>
                      <Text style={styles.promiseGroupSubtitle}>{group.subtitle}</Text>
                    </View>
                    <StatusChip
                      label={`${group.items.length}`}
                      tone={group.tone === 'danger' ? 'danger' : group.tone === 'warning' ? 'warning' : 'primary'}
                    />
                  </View>
                  <View style={styles.listShell}>
                    {group.items.map((promise) => (
                      <PromiseFollowUpRow
                        key={promise.id}
                        currency={currency}
                        promise={promise}
                        onFulfilled={() => void changePromiseStatus(promise.id, 'fulfilled')}
                        onMessage={() => void sharePromiseFollowUp(promise)}
                        onMissed={() => void changePromiseStatus(promise.id, 'missed')}
                        onOpen={() =>
                          navigation.navigate('CustomerDetail', { customerId: promise.customerId })
                        }
                        onPayment={() =>
                          navigation.navigate('TransactionForm', {
                            customerId: promise.customerId,
                            type: 'payment',
                            promiseId: promise.id,
                          })
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>
      </ScrollView>

      {reminderTarget && business ? (
        <PaymentReminderModal
          balance={reminderTarget.balance}
          businessName={business.businessName}
          countryCode={business.countryCode}
          currency={currency}
          customerName={reminderTarget.name}
          isSending={isSendingReminder}
          lastPaymentDate={reminderTarget.lastPaymentAt}
          lastReminderDate={reminderTarget.lastReminderAt}
          paymentDetails={paymentDetails}
          regionCode={business.stateCode}
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

function PromiseFollowUpRow({
  currency,
  onFulfilled,
  onMessage,
  onMissed,
  onOpen,
  onPayment,
  promise,
}: {
  currency: string;
  onFulfilled: () => void;
  onMessage: () => void;
  onMissed: () => void;
  onOpen: () => void;
  onPayment: () => void;
  promise: PromiseFollowUpItem;
}) {
  return (
    <ListRow
      accent={promise.tone === 'danger' ? 'danger' : promise.tone === 'warning' ? 'warning' : 'primary'}
      title={promise.customerName}
      subtitle={promise.helper}
      meta={promise.note ?? `Current balance ${formatCurrency(promise.currentBalance, currency)}`}
      right={
        <View style={styles.rowActions}>
          <StatusChip
            label={promise.statusLabel}
            tone={promise.tone === 'danger' ? 'danger' : promise.tone === 'warning' ? 'warning' : 'primary'}
          />
          <View style={styles.inlineActions}>
            <MiniAction label="Payment" onPress={onPayment} />
            <MiniAction label="Message" onPress={onMessage} />
            {promise.status !== 'fulfilled' ? (
              <MiniAction label="Fulfilled" onPress={onFulfilled} />
            ) : null}
            {promise.status === 'open' ? <MiniAction label="Missed" onPress={onMissed} /> : null}
          </View>
        </View>
      }
      onPress={onOpen}
    />
  );
}

function CollectionRecommendationCard({
  currency,
  onCall,
  onMessage,
  onOpen,
  onPayment,
  onPromise,
  onStatement,
  recommendation,
}: {
  currency: string;
  onCall: () => void;
  onMessage: () => void;
  onOpen: () => void;
  onPayment: () => void;
  onPromise: () => void;
  onStatement: () => void;
  recommendation: CollectionRecommendation;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.recommendationCard,
        recommendation.tone === 'danger' ? styles.recommendationCardDanger : null,
        pressed ? styles.recommendationCardPressed : null,
      ]}
    >
      <View style={styles.recommendationHeader}>
        <View style={styles.recommendationTitleBlock}>
          <Text style={styles.recommendationTitle}>{recommendation.name}</Text>
          <Text style={styles.recommendationReason}>{recommendation.reason}</Text>
        </View>
        <MoneyText size="sm" tone="due" align="right">
          {formatCurrency(recommendation.balance, currency)}
        </MoneyText>
      </View>

      <Text style={styles.recommendationHelper}>{recommendation.helper}</Text>

      <View style={styles.recommendationFooter}>
        <View style={styles.recommendationBadges}>
          {recommendation.badges.map((badge) => (
            <StatusChip
              key={badge}
              label={badge}
              tone={recommendation.tone === 'danger' ? 'danger' : 'warning'}
            />
          ))}
        </View>
        <View style={styles.recommendationActions}>
          {recommendation.customerPhone ? (
            <MiniAction
              label="Call"
              emphasized={recommendation.recommendedAction === 'call'}
              onPress={onCall}
            />
          ) : null}
          <MiniAction
            label="Message"
            emphasized={recommendation.recommendedAction === 'message'}
            onPress={onMessage}
          />
          <MiniAction
            label="Statement"
            emphasized={recommendation.recommendedAction === 'statement'}
            onPress={onStatement}
          />
          <MiniAction
            label="Payment"
            emphasized={recommendation.recommendedAction === 'payment'}
            onPress={onPayment}
          />
          <MiniAction
            label="Promise"
            emphasized={recommendation.recommendedAction === 'promise'}
            onPress={onPromise}
          />
        </View>
      </View>
    </Pressable>
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

function MiniAction({
  emphasized = false,
  label,
  onPress,
}: {
  emphasized?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [
        styles.miniAction,
        emphasized ? styles.miniActionEmphasized : null,
        pressed ? styles.miniActionPressed : null,
      ]}
    >
      <Text style={[styles.miniActionText, emphasized ? styles.miniActionTextEmphasized : null]}>
        {label}
      </Text>
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
  promiseCalendar: {
    gap: spacing.lg,
  },
  promiseGroup: {
    gap: spacing.sm,
  },
  promiseGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  promiseGroupTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  promiseGroupTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  promiseGroupSubtitle: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  recommendationList: {
    gap: spacing.md,
  },
  recommendationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  recommendationCardDanger: {
    borderColor: colors.danger,
  },
  recommendationCardPressed: {
    opacity: 0.9,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recommendationTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  recommendationTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  recommendationReason: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 22,
  },
  recommendationHelper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  recommendationFooter: {
    gap: spacing.md,
  },
  recommendationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recommendationActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
    gap: spacing.sm,
  },
  insightChips: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  miniAction: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  miniActionEmphasized: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  miniActionPressed: {
    opacity: 0.82,
  },
  miniActionText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  miniActionTextEmphasized: {
    color: colors.surface,
  },
});
