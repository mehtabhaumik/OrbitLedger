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

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SelectField } from '../components/SelectField';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { getBusinessSettings, searchCustomerSummaries } from '../database';
import type { BusinessSettings, CustomerSummary } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  defaultMobileRecurringEmailBody,
  defaultMobileRecurringEmailSubject,
  listMobileRecurringEmailQueue,
  listMobileRecurringInvoiceRules,
  pauseMobileRecurringInvoiceRule,
  saveMobileRecurringInvoiceRule,
  type MobileRecurringEmailQueueItem,
  type MobileRecurringInvoiceRule,
} from '../recurring/recurringInvoiceRules';
import { colors, spacing, typography } from '../theme/theme';

type RecurringInvoiceEmailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RecurringInvoiceEmail'
>;

type RuleDraft = {
  id?: string;
  name: string;
  customerId: string;
  startDate: string;
  endDate: string;
  invoiceDay: string;
  dueDays: string;
  invoiceNumberPrefix: string;
  notes: string;
  emailEnabled: boolean;
  emailRecipient: string;
  emailDay: string;
  emailSubject: string;
  emailBody: string;
  emailIncludePaymentLink: boolean;
  emailAttachPdf: boolean;
  emailCurrentMonthOnly: boolean;
  approveEmailAutomation: boolean;
  itemName: string;
  itemDescription: string;
  quantity: string;
  price: string;
  taxRate: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyDraft: RuleDraft = {
  name: '',
  customerId: '',
  startDate: today,
  endDate: '',
  invoiceDay: '1',
  dueDays: '7',
  invoiceNumberPrefix: 'AUTO',
  notes: '',
  emailEnabled: true,
  emailRecipient: '',
  emailDay: '1',
  emailSubject: defaultMobileRecurringEmailSubject(),
  emailBody: defaultMobileRecurringEmailBody(),
  emailIncludePaymentLink: true,
  emailAttachPdf: true,
  emailCurrentMonthOnly: true,
  approveEmailAutomation: false,
  itemName: '',
  itemDescription: '',
  quantity: '1',
  price: '',
  taxRate: '18',
};

export function RecurringInvoiceEmailScreen({ navigation }: RecurringInvoiceEmailScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [rules, setRules] = useState<MobileRecurringInvoiceRule[]>([]);
  const [queue, setQueue] = useState<MobileRecurringEmailQueueItem[]>([]);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const currency = business?.currency ?? 'INR';

  const customerOptions = useMemo(
    () => customers.map((customer) => ({ label: customer.name, value: customer.id, description: customer.phone ?? undefined })),
    [customers]
  );
  const selectedCustomer = customers.find((customer) => customer.id === draft.customerId) ?? null;
  const estimate = useMemo(() => {
    const quantity = numericValue(draft.quantity);
    const price = numericValue(draft.price);
    const taxRate = numericValue(draft.taxRate);
    const subtotal = quantity * price;
    const tax = subtotal * (taxRate / 100);
    return subtotal + tax;
  }, [draft.price, draft.quantity, draft.taxRate]);

  const loadData = useCallback(async () => {
    const settings = await getBusinessSettings();
    setBusiness(settings);
    const customerResults = await searchCustomerSummaries({ limit: 80, filter: 'all' });
    setCustomers(customerResults.filter((customer) => !customer.isArchived));

    if (!settings?.workspaceId) {
      setRules([]);
      setQueue([]);
      return;
    }

    const [nextRules, nextQueue] = await Promise.all([
      listMobileRecurringInvoiceRules(settings.workspaceId),
      listMobileRecurringEmailQueue(settings.workspaceId),
    ]);
    setRules(nextRules);
    setQueue(nextQueue);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function load() {
        try {
          setIsLoading(true);
          await loadData();
        } catch {
          if (isActive) {
            Alert.alert('Monthly email rules could not load', 'Please try again.');
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
    }, [loadData])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadData();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function updateDraft<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === 'customerId') {
        const customer = customers.find((entry) => entry.id === value);
        if (!next.name && customer) {
          next.name = `${customer.name} monthly invoice`;
        }
      }
      if (key === 'invoiceDay' && !current.id) {
        next.emailDay = String(value);
      }
      if (key !== 'approveEmailAutomation' && key !== 'emailCurrentMonthOnly') {
        next.approveEmailAutomation = false;
      }
      return next;
    });
  }

  function editRule(rule: MobileRecurringInvoiceRule) {
    const firstItem = rule.items[0];
    setDraft({
      id: rule.id,
      name: rule.name,
      customerId: rule.customerId,
      startDate: rule.startDate,
      endDate: rule.endDate ?? '',
      invoiceDay: String(rule.invoiceDay),
      dueDays: String(rule.dueDays),
      invoiceNumberPrefix: rule.invoiceNumberPrefix,
      notes: rule.notes ?? '',
      emailEnabled: rule.emailEnabled,
      emailRecipient: rule.emailRecipient ?? '',
      emailDay: String(rule.emailDay ?? rule.invoiceDay),
      emailSubject: rule.emailSubject ?? defaultMobileRecurringEmailSubject(),
      emailBody: rule.emailBody ?? defaultMobileRecurringEmailBody(),
      emailIncludePaymentLink: rule.emailIncludePaymentLink,
      emailAttachPdf: rule.emailAttachPdf,
      emailCurrentMonthOnly: rule.emailCurrentMonthOnly,
      approveEmailAutomation: rule.emailAutomationApproved && !rule.emailApprovalRequired,
      itemName: firstItem?.name ?? '',
      itemDescription: firstItem?.description ?? '',
      quantity: String(firstItem?.quantity ?? 1),
      price: String(firstItem?.price ?? ''),
      taxRate: String(firstItem?.taxRate ?? 18),
    });
  }

  async function saveRule() {
    if (!business?.workspaceId) {
      Alert.alert('Cloud workspace needed', 'Connect this business to cloud sync before setting up monthly emails.');
      return;
    }

    setIsSaving(true);
    try {
      await saveMobileRecurringInvoiceRule(
        business.workspaceId,
        {
          name: draft.name,
          customerId: draft.customerId,
          customerName: selectedCustomer?.name ?? null,
          startDate: draft.startDate,
          endDate: draft.endDate || null,
          invoiceDay: numericValue(draft.invoiceDay) || 1,
          dueDays: numericValue(draft.dueDays) || 0,
          invoiceNumberPrefix: draft.invoiceNumberPrefix,
          notes: draft.notes,
          emailEnabled: draft.emailEnabled,
          emailRecipient: draft.emailRecipient,
          emailDay: numericValue(draft.emailDay) || numericValue(draft.invoiceDay) || 1,
          emailSubject: draft.emailSubject,
          emailBody: draft.emailBody,
          emailIncludePaymentLink: draft.emailIncludePaymentLink,
          emailAttachPdf: draft.emailAttachPdf,
          emailCurrentMonthOnly: draft.emailCurrentMonthOnly,
          approveEmailAutomation: draft.approveEmailAutomation,
          items: [
            {
              name: draft.itemName,
              description: draft.itemDescription,
              quantity: numericValue(draft.quantity),
              price: numericValue(draft.price),
              taxRate: numericValue(draft.taxRate),
            },
          ],
        },
        draft.id
      );
      setDraft(emptyDraft);
      await loadData();
      Alert.alert('Monthly email saved', 'The rule is ready with the latest approval state.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Please review the rule and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function pauseRule(rule: MobileRecurringInvoiceRule) {
    if (!business?.workspaceId) {
      return;
    }
    Alert.alert('Pause monthly email?', 'Automatic preparation and sending will stop for this customer rule.', [
      { text: 'Keep active', style: 'cancel' },
      {
        text: 'Pause',
        style: 'destructive',
        onPress: () => void confirmPauseRule(rule.id),
      },
    ]);
  }

  async function confirmPauseRule(ruleId: string) {
    if (!business?.workspaceId) {
      return;
    }
    try {
      await pauseMobileRecurringInvoiceRule(business.workspaceId, ruleId);
      await loadData();
      Alert.alert('Monthly email paused', 'This rule will not send until you save it again.');
    } catch {
      Alert.alert('Pause failed', 'Please try again.');
    }
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading monthly emails</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Monthly Auto Email"
          subtitle="Create customer-specific monthly invoice rules with approval before any email is sent."
          backLabel="Invoices"
          onBack={() => navigation.navigate('Invoices')}
        />

        {!business?.workspaceId ? (
          <EmptyState
            title="Cloud workspace needed"
            message="Monthly invoice email rules are saved to your synced business so web and mobile stay aligned."
            action={
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                Open Settings
              </PrimaryButton>
            }
          />
        ) : (
          <>
            <Section
              title="Auto email list"
              subtitle="Review each customer's rule before changing the setup."
            >
              {rules.length ? (
                rules.map((rule) => (
                  <Card key={rule.id} compact accent={rule.status === 'active' ? 'primary' : 'warning'}>
                    <View style={styles.row}>
                      <View style={styles.rowCopy}>
                        <Text style={styles.ruleTitle}>{rule.name}</Text>
                        <Text style={styles.ruleMeta}>
                          {rule.customerName ?? 'Customer'} | invoice day {rule.invoiceDay}
                          {rule.emailEnabled ? ` | email day ${rule.emailDay ?? rule.invoiceDay}` : ' | email off'}
                        </Text>
                        <Text style={styles.ruleMeta}>
                          {rule.nextEmailDate ? `Next email ${formatShortDate(rule.nextEmailDate)}` : 'No email scheduled'}
                        </Text>
                      </View>
                      <View style={styles.ruleBadges}>
                        <StatusChip
                          label={rule.status === 'active' ? 'Active' : 'Paused'}
                          tone={rule.status === 'active' ? 'success' : 'warning'}
                        />
                        <StatusChip
                          label={rule.emailAutomationApproved && !rule.emailApprovalRequired ? 'Approved' : 'Needs approval'}
                          tone={rule.emailAutomationApproved && !rule.emailApprovalRequired ? 'success' : 'warning'}
                        />
                      </View>
                    </View>
                    {rule.emailAutomationApprovedAt ? (
                      <Text style={styles.approvalText}>
                        Approved on {formatShortDate(rule.emailAutomationApprovedAt)}. Changes require a fresh approval.
                      </Text>
                    ) : null}
                    <View style={styles.buttonRow}>
                      <PrimaryButton variant="secondary" onPress={() => editRule(rule)}>
                        View / Edit
                      </PrimaryButton>
                      <PrimaryButton variant="ghost" onPress={() => pauseRule(rule)} disabled={rule.status !== 'active'}>
                        Pause
                      </PrimaryButton>
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="No monthly emails yet"
                  message="Add a customer rule when a fixed service needs a regular invoice."
                />
              )}
            </Section>

            <Section title="Queue and send history" subtitle="Scheduled and sent invoice emails appear here after preparation.">
              {queue.length ? (
                queue.slice(0, 8).map((item) => (
                  <Card key={item.id} compact accent={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'tax'}>
                    <View style={styles.row}>
                      <View style={styles.rowCopy}>
                        <Text style={styles.ruleTitle}>{item.invoiceNumber ?? 'Monthly invoice email'}</Text>
                        <Text style={styles.ruleMeta}>{item.recipientEmail ?? 'No recipient'} | {queueStatusLabel(item.status)}</Text>
                        <Text style={styles.ruleMeta}>
                          {item.sentAt
                            ? `Sent ${formatShortDate(item.sentAt)}`
                            : item.scheduledFor
                              ? `Scheduled ${formatShortDate(item.scheduledFor)}`
                              : 'No schedule date'}
                        </Text>
                      </View>
                      <StatusChip label={queueStatusLabel(item.status)} tone={item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'tax'} />
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="No scheduled emails"
                  message="Prepared monthly invoice emails will appear here before they are sent."
                />
              )}
            </Section>

            <Section
              title={draft.id ? 'Edit customer rule' : 'Add customer rule'}
              subtitle="Every meaningful change pauses automatic sending until you approve the rule again."
            >
              <Card>
                <Text style={styles.groupTitle}>Invoice setup</Text>
                <SelectField
                  label="Customer"
                  value={draft.customerId}
                  options={customerOptions}
                  onChange={(value) => updateDraft('customerId', value)}
                  placeholder="Choose customer"
                />
                <TextField
                  label="Rule name"
                  value={draft.name}
                  onChangeText={(value) => updateDraft('name', value)}
                  placeholder="Sonali Traders monthly invoice"
                />
                <View style={styles.grid}>
                  <TextField
                    label="Start date"
                    value={draft.startDate}
                    onChangeText={(value) => updateDraft('startDate', value)}
                    placeholder="YYYY-MM-DD"
                  />
                  <TextField
                    label="End date"
                    value={draft.endDate}
                    onChangeText={(value) => updateDraft('endDate', value)}
                    placeholder="Optional"
                  />
                  <TextField
                    label="Invoice day"
                    value={draft.invoiceDay}
                    onChangeText={(value) => updateDraft('invoiceDay', value)}
                    keyboardType="number-pad"
                    helperText="Day 31 uses the last valid day in shorter months."
                  />
                  <TextField
                    label="Due days"
                    value={draft.dueDays}
                    onChangeText={(value) => updateDraft('dueDays', value)}
                    keyboardType="number-pad"
                  />
                  <TextField
                    label="Invoice prefix"
                    value={draft.invoiceNumberPrefix}
                    onChangeText={(value) => updateDraft('invoiceNumberPrefix', value)}
                    autoCapitalize="characters"
                  />
                </View>
              </Card>

              <Card>
                <Text style={styles.groupTitle}>Line item</Text>
                <TextField
                  label="Item"
                  value={draft.itemName}
                  onChangeText={(value) => updateDraft('itemName', value)}
                  placeholder="Monthly service"
                />
                <TextField
                  label="Description"
                  value={draft.itemDescription}
                  onChangeText={(value) => updateDraft('itemDescription', value)}
                  placeholder="Optional detail"
                />
                <View style={styles.grid}>
                  <TextField
                    label="Qty"
                    value={draft.quantity}
                    onChangeText={(value) => updateDraft('quantity', value)}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label="Price"
                    value={draft.price}
                    onChangeText={(value) => updateDraft('price', value)}
                    keyboardType="decimal-pad"
                  />
                  <TextField
                    label="Tax %"
                    value={draft.taxRate}
                    onChangeText={(value) => updateDraft('taxRate', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.estimate}>Estimated invoice total: {formatCurrency(estimate, currency)}</Text>
              </Card>

              <Card>
                <Text style={styles.groupTitle}>Email settings</Text>
                <CheckRow
                  label="Send invoice email automatically"
                  value={draft.emailEnabled}
                  onChange={(value) => updateDraft('emailEnabled', value)}
                />
                <CheckRow
                  label="Do not email past-month catch-up invoices automatically"
                  value={draft.emailCurrentMonthOnly}
                  onChange={(value) => updateDraft('emailCurrentMonthOnly', value)}
                />
                <TextField
                  label="Recipient email"
                  value={draft.emailRecipient}
                  onChangeText={(value) => updateDraft('emailRecipient', value)}
                  placeholder="billing@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextField
                  label="Send email on day"
                  value={draft.emailDay}
                  onChangeText={(value) => updateDraft('emailDay', value)}
                  keyboardType="number-pad"
                  helperText="Day 31 uses the final day for shorter months."
                />
                <CheckRow
                  label="Attach invoice PDF"
                  value={draft.emailAttachPdf}
                  onChange={(value) => updateDraft('emailAttachPdf', value)}
                />
                <CheckRow
                  label="Include payment link"
                  value={draft.emailIncludePaymentLink}
                  onChange={(value) => updateDraft('emailIncludePaymentLink', value)}
                />
                <TextField
                  label="Email subject"
                  value={draft.emailSubject}
                  onChangeText={(value) => updateDraft('emailSubject', value)}
                />
                <TextField
                  label="Email body"
                  value={draft.emailBody}
                  onChangeText={(value) => updateDraft('emailBody', value)}
                  multiline
                  style={styles.emailBody}
                />
                <Text style={styles.tokenText}>
                  Tokens: {'{{customerName}}, {{invoiceNumber}}, {{invoiceDate}}, {{dueDate}}, {{amountDue}}, {{paymentLink}}, {{businessName}}'}
                </Text>
                <CheckRow
                  label="I approve this automatic invoice email rule"
                  value={draft.approveEmailAutomation}
                  onChange={(value) => updateDraft('approveEmailAutomation', value)}
                />
                <Text style={styles.approvalText}>
                  Orbit Ledger prepares the invoice before the email date and sends only when this rule is approved.
                </Text>
                <View style={styles.buttonRow}>
                  <PrimaryButton loading={isSaving} disabled={isSaving} onPress={() => void saveRule()}>
                    {draft.id ? 'Save Rule' : 'Create Rule'}
                  </PrimaryButton>
                  {draft.id ? (
                    <PrimaryButton variant="ghost" onPress={() => setDraft(emptyDraft)}>
                      New Rule
                    </PrimaryButton>
                  ) : null}
                </View>
              </Card>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.checkRow, pressed ? styles.checkPressed : null]}
    >
      <View style={[styles.checkBox, value ? styles.checkBoxActive : null]}>
        <Text style={styles.checkMark}>{value ? 'OK' : ''}</Text>
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function numericValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function queueStatusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'sending':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Scheduled';
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 210,
  },
  ruleTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  ruleMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  ruleBadges: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  approvalText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  groupTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  grid: {
    gap: spacing.md,
  },
  estimate: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  emailBody: {
    minHeight: 156,
    textAlignVertical: 'top',
  },
  tokenText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  checkRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  checkPressed: {
    backgroundColor: colors.primarySurface,
  },
  checkBox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  checkLabel: {
    color: colors.text,
    flex: 1,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
});
