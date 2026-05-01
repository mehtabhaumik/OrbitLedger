import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import {
  getPaymentModeConfig,
  getPaymentClearanceStatusLabel,
  getManualPaymentVerificationPlan,
  PAYMENT_MODE_CONFIGS,
  reconcileProviderPayment,
  type PaymentClearanceStatus,
  type PaymentInstrumentAttachment,
  type PaymentMode,
  type PaymentModeDetails,
  type PaymentProviderSource,
} from '@orbit-ledger/core';

import { recordUsageAnalyticsEvent } from '../analytics';
import { recordLedgerDataChangedForBackupNudge } from '../backup';
import { BottomActionBar } from '../components/BottomActionBar';
import { Card } from '../components/Card';
import { DateInput } from '../components/DateInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import {
  addTransaction,
  getBusinessSettings,
  getTransaction,
  listInvoices,
  listInvoicesForCustomer,
  listOpenPaymentPromisesForCustomer,
  searchCustomerSummaries,
  updatePaymentPromiseStatus,
  updateTransaction,
} from '../database';
import { recordRatingPositiveMoment } from '../engagement';
import type { CustomerSummary, Invoice, LedgerTransaction, PaymentPromise, TransactionType } from '../database';
import { showSuccessFeedback } from '../lib/feedback';
import { formatCurrency } from '../lib/format';
import {
  dateInputSchema,
  getTodayDateInput,
  isFutureDateInput,
  moneyInputSchema,
  normalizeDecimalInput,
} from '../forms/validation';
import { recordLedgerActivityForUpgradeNudge } from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import { colors, shadows, spacing, touch, typography } from '../theme/theme';

type TransactionFormScreenProps = NativeStackScreenProps<RootStackParamList, 'TransactionForm'>;
let rememberedTransactionType: TransactionType = 'payment';

const transactionSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer.'),
  type: z.enum(['credit', 'payment']),
  amount: moneyInputSchema,
  note: z.string().trim().max(160, 'Keep the note under 160 characters.').optional(),
  effectiveDate: dateInputSchema('transaction date').refine(
    (value) => !isFutureDateInput(value),
    'Date cannot be in the future.'
  ),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function TransactionFormScreen({ navigation, route }: TransactionFormScreenProps) {
  const initialCustomerId = route.params?.customerId;
  const initialType = route.params?.type ?? rememberedTransactionType;
  const transactionId = route.params?.transactionId;
  const initialPromiseId = route.params?.promiseId;
  const initialInvoiceId = route.params?.invoiceId;
  const initialAmount = route.params?.amount;
  const isEditing = Boolean(transactionId);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(Boolean(transactionId));
  const [loadedTransaction, setLoadedTransaction] = useState<LedgerTransaction | null>(null);
  const [openPromises, setOpenPromises] = useState<PaymentPromise[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [selectedPromiseId, setSelectedPromiseId] = useState(initialPromiseId ?? '');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentDetails, setPaymentDetails] = useState<PaymentModeDetails>({});
  const [paymentClearanceStatus, setPaymentClearanceStatus] = useState<PaymentClearanceStatus>('cleared');
  const [paymentAttachments, setPaymentAttachments] = useState<PaymentInstrumentAttachment[]>([]);
  const [workspaceInvoices, setWorkspaceInvoices] = useState<Invoice[]>([]);
  const [providerSource, setProviderSource] = useState<PaymentProviderSource>('upi');
  const [providerReference, setProviderReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [allocationStrategy, setAllocationStrategy] = useState<'ledger_only' | 'oldest_invoice' | 'selected_invoice'>(
    initialInvoiceId ? 'selected_invoice' : 'ledger_only'
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId ?? '');
  const paymentVerificationPlan = useMemo(
    () =>
      getManualPaymentVerificationPlan({
        allocationStrategy,
        clearanceStatus: paymentClearanceStatus,
      }),
    [allocationStrategy, paymentClearanceStatus]
  );
  const amountInputRef = useRef<TextInput>(null);
  const {
    control,
    formState: { errors, isSubmitting, isValid },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      customerId: initialCustomerId ?? '',
      type: initialType,
      amount: initialAmount ? formatAmountInput(initialAmount) : '',
      note: '',
      effectiveDate: getTodayDateInput(),
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const selectedCustomerId = watch('customerId');
  const selectedType = watch('type');
  const amount = Number(watch('amount') || 0);
  const isLoadingInitialData = isLoadingCustomers || isLoadingTransaction;
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const selectedPromise = openPromises.find((promise) => promise.id === selectedPromiseId);
  const openWorkspaceInvoices = useMemo(
    () =>
      workspaceInvoices.filter(
        (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
      ),
    [workspaceInvoices]
  );
  const reconciliationDecision = useMemo(
    () =>
      selectedType === 'payment'
        ? reconcileProviderPayment({
            source: providerSource,
            reference: providerReference,
            amount,
            currency,
            payerName,
            invoices: openWorkspaceInvoices,
          })
        : null,
    [amount, currency, openWorkspaceInvoices, payerName, providerReference, providerSource, selectedType]
  );
  const recentCustomers = useMemo(() => customers.slice(0, 6), [customers]);
  const visibleCustomers = useMemo(() => {
    const cleaned = customerQuery.trim().toLowerCase();
    if (!cleaned) {
      return customers.slice(0, 14);
    }

    return customers
      .filter((customer) => {
        return [customer.name, customer.phone, customer.address]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(cleaned));
      })
      .slice(0, 20);
  }, [customerQuery, customers]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [settings, activeCustomers, recentInvoices, transaction] = await Promise.all([
          getBusinessSettings(),
          searchCustomerSummaries('', 100),
          listInvoices({ limit: 100 }),
          transactionId ? getTransaction(transactionId) : Promise.resolve(null),
        ]);
        if (isMounted) {
          setCurrency(settings?.currency ?? 'INR');
          setCustomers(activeCustomers);
          setWorkspaceInvoices(recentInvoices);

          if (transactionId) {
            if (!transaction) {
              Alert.alert('Transaction not found', 'This ledger entry could not be opened.', [
                { text: 'Done', onPress: () => navigation.goBack() },
              ]);
              return;
            }

            setLoadedTransaction(transaction);
            setPaymentMode(transaction.paymentMode ?? 'cash');
            setPaymentDetails(transaction.paymentDetails ?? {});
            setPaymentClearanceStatus(transaction.paymentClearanceStatus ?? 'cleared');
            setPaymentAttachments(transaction.paymentAttachments);
            reset({
              customerId: transaction.customerId,
              type: transaction.type,
              amount: formatAmountInput(transaction.amount),
              note: transaction.note ?? '',
              effectiveDate: transaction.effectiveDate,
            });
          } else if (!initialCustomerId && activeCustomers.length === 1) {
            setValue('customerId', activeCustomers[0].id, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }
      } catch {
        Alert.alert('Customers could not load', 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoadingCustomers(false);
          setIsLoadingTransaction(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [initialCustomerId, navigation, reset, setValue, transactionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadPromises() {
      if (isEditing || selectedType !== 'payment' || !selectedCustomerId) {
        if (isMounted) {
          setOpenPromises([]);
          setSelectedPromiseId('');
        }
        return;
      }

      try {
        const promises = await listOpenPaymentPromisesForCustomer(selectedCustomerId, 8);
        if (!isMounted) {
          return;
        }

        setOpenPromises(promises);
        if (initialPromiseId && promises.some((promise) => promise.id === initialPromiseId)) {
          const promise = promises.find((item) => item.id === initialPromiseId);
          setSelectedPromiseId(initialPromiseId);
          if (promise && !watch('amount')) {
            setValue('amount', formatAmountInput(promise.promisedAmount), {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        } else if (selectedPromiseId && !promises.some((promise) => promise.id === selectedPromiseId)) {
          setSelectedPromiseId('');
        }
      } catch {
        if (isMounted) {
          setOpenPromises([]);
        }
      }
    }

    loadPromises();

    return () => {
      isMounted = false;
    };
  }, [initialPromiseId, isEditing, selectedCustomerId, selectedPromiseId, selectedType, setValue, watch]);

  useEffect(() => {
    let isMounted = true;

    async function loadInvoices() {
      if (isEditing || selectedType !== 'payment' || !selectedCustomerId) {
        if (isMounted) {
          setOpenInvoices([]);
          setSelectedInvoiceId('');
          setAllocationStrategy('ledger_only');
        }
        return;
      }

      try {
        const invoices = await listInvoicesForCustomer(selectedCustomerId, 30);
        const unpaidInvoices = invoices.filter(
          (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
        );
        if (isMounted) {
          setOpenInvoices(unpaidInvoices);
          setSelectedInvoiceId((current) => current || unpaidInvoices[0]?.id || '');
        }
      } catch {
        if (isMounted) {
          setOpenInvoices([]);
          setSelectedInvoiceId('');
        }
      }
    }

    void loadInvoices();

    return () => {
      isMounted = false;
    };
  }, [isEditing, selectedCustomerId, selectedType]);

  function selectCustomer(customerId: string) {
    setValue('customerId', customerId, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSelectedPromiseId('');
    setCustomerQuery('');
    if (customerId) {
      setTimeout(() => amountInputRef.current?.focus(), 80);
    }
  }

  function applyReconciliationMatch() {
    if (!reconciliationDecision?.invoice || reconciliationDecision.allocationStrategy !== 'selected_invoice') {
      Alert.alert('No invoice match', 'Add a payment reference that matches an open invoice.');
      return;
    }

    setValue('customerId', reconciliationDecision.invoice.customerId ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setAllocationStrategy('selected_invoice');
    setSelectedInvoiceId(reconciliationDecision.invoice.id);
    setPaymentMode(reconciliationDecision.paymentMode);
    setPaymentDetails(reconciliationDecision.paymentDetails);
    setValue('note', reconciliationDecision.note, { shouldDirty: true, shouldValidate: true });
    if (amount <= 0 && reconciliationDecision.allocationAmount > 0) {
      setValue('amount', formatAmountInput(reconciliationDecision.allocationAmount), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setCustomerQuery('');
    Alert.alert('Invoice matched', 'This payment is ready to save against the matched invoice.');
  }

  async function attachInstrumentImage(source: 'camera' | 'library') {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          source === 'camera' ? 'Camera permission is needed.' : 'Photo permission is needed.'
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.75, allowsEditing: false })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75, allowsEditing: false });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.uri) {
        return;
      }

      const copiedUri = copyInstrumentImageToLocalStorage(asset.uri);
      setPaymentAttachments((current) =>
        [
          {
            id: `instrument-${Date.now()}`,
            name: asset.fileName ?? `payment-proof-${Date.now()}.jpg`,
            url: copiedUri,
            storagePath: null,
            contentType: asset.mimeType ?? 'image/jpeg',
            size: asset.fileSize ?? null,
            uploadedAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 3)
      );
    } catch (error) {
      Alert.alert(
        'Image not attached',
        error instanceof Error ? error.message : 'Payment proof image could not be attached.'
      );
    }
  }

  async function onSubmit(input: TransactionFormValues) {
    try {
      const reconciledPaymentDetails =
        input.type === 'payment' && providerReference.trim()
          ? {
              ...paymentDetails,
              referenceNumber: paymentDetails.referenceNumber ?? providerReference.trim(),
              provider: paymentDetails.provider ?? paymentProviderLabel(providerSource),
            }
          : paymentDetails;
      if (isEditing && transactionId) {
        rememberedTransactionType = input.type;
        const updatedTransaction = await updateTransaction(transactionId, {
          type: input.type,
          amount: Number(input.amount),
          note: input.note,
          paymentMode: input.type === 'payment' ? paymentMode : null,
          paymentDetails: input.type === 'payment' ? reconciledPaymentDetails : null,
          paymentClearanceStatus: input.type === 'payment' ? paymentClearanceStatus : null,
          paymentAttachments: input.type === 'payment' ? paymentAttachments : [],
          effectiveDate: input.effectiveDate,
        });
        await recordLedgerDataChangedForBackupNudge('transaction');
        showSuccessFeedback('Transaction updated. Balance recalculated.', 'Transaction updated');
        navigation.replace('CustomerDetail', { customerId: updatedTransaction.customerId });
        return;
      }

      await addTransaction({
        customerId: input.customerId,
        type: input.type,
        amount: Number(input.amount),
        note: input.note,
        effectiveDate: input.effectiveDate,
        paymentMode: input.type === 'payment' ? paymentMode : null,
        paymentDetails: input.type === 'payment' ? reconciledPaymentDetails : null,
        paymentClearanceStatus: input.type === 'payment' ? paymentClearanceStatus : null,
        paymentAttachments: input.type === 'payment' ? paymentAttachments : [],
        allocationStrategy: input.type === 'payment' ? allocationStrategy : 'ledger_only',
        invoiceId: allocationStrategy === 'selected_invoice' ? selectedInvoiceId : null,
      });
      let promiseStatusMessage = '';
      if (input.type === 'payment' && selectedPromise) {
        if (Number(input.amount) >= selectedPromise.promisedAmount) {
          try {
            await updatePaymentPromiseStatus(selectedPromise.id, 'fulfilled');
            promiseStatusMessage = ' Promise marked fulfilled.';
          } catch {
            promiseStatusMessage = ' Promise status could not be updated.';
          }
        } else {
          promiseStatusMessage = ' Promise left open because this is a partial payment.';
        }
      }
      rememberedTransactionType = input.type;
      await recordLedgerDataChangedForBackupNudge('transaction');
      await recordLedgerActivityForUpgradeNudge();
      await recordRatingPositiveMoment('transaction_saved');
      await recordUsageAnalyticsEvent('transaction_added');
      showSuccessFeedback(`Transaction saved. Balance updated.${promiseStatusMessage}`, 'Transaction saved');
      navigation.replace('CustomerDetail', { customerId: input.customerId });
    } catch {
      Alert.alert(
        isEditing ? 'Transaction could not be updated' : 'Transaction could not be saved',
        'Please check the details and try again.'
      );
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
            subtitle={
              isEditing
                ? 'Update the saved credit or payment entry.'
                : 'Fast entry for counter use. Pick customer, type, amount, save.'
            }
            onBack={() => navigation.goBack()}
          />

          <Section title="Customer" subtitle="Recent customers appear first for faster daily entry.">
            {isEditing ? (
              <Card compact>
                <Text style={styles.selectedCustomerLabel}>Selected customer</Text>
                <Text style={styles.selectedCustomerName}>
                  {selectedCustomer?.name ?? 'Customer ledger'}
                </Text>
                <Text style={styles.choiceMeta}>Customer cannot be changed while editing.</Text>
              </Card>
            ) : initialCustomerId ? (
              <Card compact>
                <Text style={styles.selectedCustomerLabel}>Selected customer</Text>
                <Text style={styles.selectedCustomerName}>
                  {selectedCustomer?.name ?? 'Customer ledger'}
                </Text>
              </Card>
            ) : isLoadingCustomers ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading customers</Text>
              </View>
            ) : customers.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No active customers</Text>
                <Text style={styles.muted}>Add a customer before recording a transaction.</Text>
                <PrimaryButton onPress={() => navigation.navigate('CustomerForm')}>
                  Add Customer
                </PrimaryButton>
              </View>
            ) : selectedCustomer ? (
              <Card compact accent="primary">
                <View style={styles.selectedCustomerHeader}>
                  <View style={styles.choiceTextBlock}>
                    <Text style={styles.selectedCustomerLabel}>Selected customer</Text>
                    <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    onPress={() => selectCustomer('')}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={styles.changeCustomerButton}
                  >
                    <Text style={styles.changeCustomerText}>Change</Text>
                  </Pressable>
                </View>
              </Card>
            ) : (
              <View style={styles.customerPicker}>
                {recentCustomers.length > 0 ? (
                  <View style={styles.quickPickGroup}>
                    <Text style={styles.quickPickLabel}>Recent customers</Text>
                    <ScrollView
                      horizontal
                      keyboardDismissMode="on-drag"
                      keyboardShouldPersistTaps="handled"
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickPickRow}
                    >
                      {recentCustomers.map((customer) => {
                        const selected = customer.id === selectedCustomerId;
                        return (
                          <Pressable
                            accessibilityRole="button"
                            hitSlop={touch.hitSlop}
                            key={customer.id}
                            onPress={() => selectCustomer(customer.id)}
                            pressRetentionOffset={touch.pressRetentionOffset}
                            style={[styles.quickPick, selected ? styles.choiceSelected : null]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.quickPickText,
                                selected ? styles.choiceTextSelected : null,
                              ]}
                            >
                              {customer.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                <TextField
                  label="Find customer"
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  placeholder="Search name, phone, or address"
                  helperText="Recent customers appear first for faster daily entry."
                />

                <View style={styles.customerChoices}>
                  {visibleCustomers.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>No matching customers</Text>
                      <Text style={styles.muted}>Try another name, phone, or address.</Text>
                      <PrimaryButton variant="secondary" onPress={() => navigation.navigate('CustomerForm')}>
                        Add Customer
                      </PrimaryButton>
                    </View>
                  ) : (
                    visibleCustomers.map((customer) => {
                      const selected = customer.id === selectedCustomerId;
                      return (
                        <Pressable
                          key={customer.id}
                          accessibilityRole="button"
                          hitSlop={touch.hitSlop}
                          onPress={() => selectCustomer(customer.id)}
                          pressRetentionOffset={touch.pressRetentionOffset}
                          style={[styles.choice, selected ? styles.choiceSelected : null]}
                        >
                          <View style={styles.choiceTextBlock}>
                            <Text
                              style={[
                                styles.choiceText,
                                selected ? styles.choiceTextSelected : null,
                              ]}
                            >
                              {customer.name}
                            </Text>
                            <Text style={styles.choiceMeta}>
                              {customer.phone ? customer.phone : 'No phone saved'}
                            </Text>
                          </View>
                          {selected ? <Text style={styles.selectedMarker}>Selected</Text> : null}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}
            {errors.customerId ? <Text style={styles.error}>{errors.customerId.message}</Text> : null}
          </Section>

          <Section title="Entry type" subtitle="Credit increases dues. Payment reduces dues.">
            <View style={styles.typeRow}>
              {(['credit', 'payment'] as TransactionType[]).map((type) => {
                const selected = selectedType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    onPress={() => setValue('type', type, { shouldDirty: true, shouldValidate: true })}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={[
                      styles.typeButton,
                      type === 'credit' ? styles.typeButtonCredit : styles.typeButtonPayment,
                      selected ? (type === 'credit' ? styles.typeCreditSelected : styles.typePaymentSelected) : null,
                    ]}
                  >
                    <StatusChip
                      label={type === 'credit' ? 'Credit given' : 'Payment received'}
                      tone={type === 'credit' ? 'warning' : 'success'}
                    />
                    <Text
                      style={[
                        styles.choiceText,
                        selected ? (type === 'credit' ? styles.choiceCreditSelected : styles.choicePaymentSelected) : null,
                      ]}
                    >
                      {type === 'credit' ? 'Credit' : 'Payment'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {selectedType === 'payment' ? (
            <Section title="Payment mode" subtitle="Save how the confirmed payment was received.">
              <View style={styles.paymentModeGrid}>
                {PAYMENT_MODE_CONFIGS.map((config) => {
                  const selected = paymentMode === config.mode;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      key={config.mode}
                      onPress={() => {
                        setPaymentMode(config.mode);
                        setPaymentDetails({});
                      }}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={[styles.paymentModeChoice, selected ? styles.promiseChoiceSelected : null]}
                    >
                      <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
                        {config.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.choiceMeta}>{getPaymentModeConfig(paymentMode).helper}</Text>
              <PaymentModeFields
                details={paymentDetails}
                mode={paymentMode}
                onChange={setPaymentDetails}
              />
              <Text style={styles.choiceMeta}>Match from payment app or bank</Text>
              <View style={styles.paymentModeGrid}>
                {(['upi', 'payment_page', 'bank_transfer', 'card', 'wallet', 'other'] as PaymentProviderSource[]).map((source) => {
                  const selected = providerSource === source;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      key={source}
                      onPress={() => setProviderSource(source)}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={[styles.paymentModeChoice, selected ? styles.promiseChoiceSelected : null]}
                    >
                      <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
                        {paymentProviderLabel(source)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="Payment reference"
                value={providerReference}
                onChangeText={setProviderReference}
                placeholder="Reference from app or bank"
                helperText="Paste the reference shown by the payment app, bank, or card provider."
              />
              <TextField
                label="Paid by"
                value={payerName}
                onChangeText={setPayerName}
                placeholder="Optional payer name"
              />
              {reconciliationDecision && providerReference.trim() ? (
                <View style={styles.reconciliationCard}>
                  <Text style={styles.choiceText}>{reconciliationDecision.message}</Text>
                  {reconciliationDecision.invoice ? (
                    <Text style={styles.choiceMeta}>
                      {reconciliationDecision.invoice.customerName ?? 'Customer'} · Due{' '}
                      {formatCurrency(reconciliationDecision.dueAmount, currency)}
                    </Text>
                  ) : null}
                  {reconciliationDecision.allocationStrategy === 'selected_invoice' ? (
                    <PrimaryButton variant="secondary" onPress={applyReconciliationMatch}>
                      Use this match
                    </PrimaryButton>
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.choiceMeta}>Clearance status</Text>
              <View style={styles.paymentModeGrid}>
                {(['received', 'post_dated', 'deposited', 'cleared', 'bounced', 'cancelled'] as PaymentClearanceStatus[]).map((status) => {
                  const selected = paymentClearanceStatus === status;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      key={status}
                      onPress={() => setPaymentClearanceStatus(status)}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={[styles.paymentModeChoice, selected ? styles.promiseChoiceSelected : null]}
                    >
                      <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
                        {getPaymentClearanceStatusLabel(status)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.reconciliationCard}>
                <View style={styles.choiceRow}>
                  <Text style={styles.choiceText}>Verification</Text>
                  <StatusChip
                    label={paymentVerificationPlan.statusLabel}
                    tone={paymentVerificationPlan.requiresFollowUp ? 'warning' : 'success'}
                  />
                </View>
                <Text style={styles.choiceMeta}>{paymentVerificationPlan.invoiceEffect}</Text>
                <Text style={styles.choiceMeta}>{paymentVerificationPlan.customerBalanceEffect}</Text>
              </View>
              {paymentMode === 'cheque' || paymentMode === 'demand_draft' ? (
                <View style={styles.attachmentActions}>
                  <PrimaryButton variant="secondary" onPress={() => void attachInstrumentImage('camera')}>
                    Capture image
                  </PrimaryButton>
                  <PrimaryButton variant="secondary" onPress={() => void attachInstrumentImage('library')}>
                    Upload image
                  </PrimaryButton>
                </View>
              ) : null}
              {paymentAttachments.length ? (
                <View style={styles.attachmentGrid}>
                  {paymentAttachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentCard}>
                      <Image source={{ uri: attachment.url }} style={styles.attachmentImage} resizeMode="contain" />
                      <Text style={styles.choiceMeta} numberOfLines={1}>{attachment.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Section>
          ) : null}

          {!isEditing && selectedType === 'payment' && selectedCustomerId && openPromises.length > 0 ? (
            <Section title="Payment promise" subtitle="Match this payment to a customer commitment.">
              <View style={styles.promiseChoices}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  onPress={() => setSelectedPromiseId('')}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={[
                    styles.promiseChoice,
                    selectedPromiseId ? null : styles.promiseChoiceSelected,
                  ]}
                >
                  <View style={styles.choiceTextBlock}>
                    <Text style={styles.choiceText}>No promise selected</Text>
                    <Text style={styles.choiceMeta}>Save this as a regular payment.</Text>
                  </View>
                </Pressable>
                {openPromises.map((promise) => {
                  const selected = selectedPromiseId === promise.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      key={promise.id}
                      onPress={() => {
                        setSelectedPromiseId(promise.id);
                          setValue('amount', formatAmountInput(promise.promisedAmount), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setTimeout(() => amountInputRef.current?.focus(), 80);
                        }}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={[styles.promiseChoice, selected ? styles.promiseChoiceSelected : null]}
                    >
                      <View style={styles.choiceTextBlock}>
                        <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
                          {formatCurrency(promise.promisedAmount, currency)}
                        </Text>
                        <Text style={styles.choiceMeta}>
                          Promised for {promise.promisedDate}
                          {promise.note ? ` · ${promise.note}` : ''}
                        </Text>
                      </View>
                      {selected ? <StatusChip label="Selected" tone="warning" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {!isEditing && selectedType === 'payment' && selectedCustomerId ? (
            <Section title="Apply payment" subtitle="Choose how this payment should affect invoices.">
              <View style={styles.promiseChoices}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  onPress={() => setAllocationStrategy('ledger_only')}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={[
                    styles.promiseChoice,
                    allocationStrategy === 'ledger_only' ? styles.promiseChoiceSelected : null,
                  ]}
                >
                  <View style={styles.choiceTextBlock}>
                    <Text style={styles.choiceText}>Customer ledger only</Text>
                    <Text style={styles.choiceMeta}>Keep this as a general payment or advance.</Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  onPress={() => setAllocationStrategy('oldest_invoice')}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={[
                    styles.promiseChoice,
                    allocationStrategy === 'oldest_invoice' ? styles.promiseChoiceSelected : null,
                  ]}
                >
                  <View style={styles.choiceTextBlock}>
                    <Text style={styles.choiceText}>Oldest unpaid invoices</Text>
                    <Text style={styles.choiceMeta}>Apply across unpaid invoices by oldest first.</Text>
                  </View>
                </Pressable>
                {openInvoices.map((invoice) => {
                  const selected = allocationStrategy === 'selected_invoice' && selectedInvoiceId === invoice.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={touch.hitSlop}
                      key={invoice.id}
                      onPress={() => {
                        setAllocationStrategy('selected_invoice');
                        setSelectedInvoiceId(invoice.id);
                      }}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={[styles.promiseChoice, selected ? styles.promiseChoiceSelected : null]}
                    >
                      <View style={styles.choiceTextBlock}>
                        <Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>
                          {invoice.invoiceNumber}
                        </Text>
                        <Text style={styles.choiceMeta}>
                          Due {formatCurrency(Math.max(invoice.totalAmount - invoice.paidAmount, 0), currency)}
                        </Text>
                      </View>
                      {selected ? <StatusChip label="Selected" tone="success" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          ) : null}

          <Controller
            control={control}
            name="amount"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                ref={amountInputRef}
                label="Amount"
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                autoFocus={Boolean(initialCustomerId) || isEditing}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="0.00"
                error={errors.amount?.message}
                helperText={
                  amount > 0
                    ? `This entry is ${formatCurrency(amount, currency)}.`
                    : loadedTransaction
                      ? `Previous amount was ${formatCurrency(loadedTransaction.amount, currency)}.`
                      : undefined
                }
              />
            )}
          />
          <Controller
            control={control}
            name="effectiveDate"
            render={({ field: { onChange, value } }) => (
              <DateInput
                label="Date"
                value={value}
                onChange={onChange}
                maximumDate={new Date()}
                error={errors.effectiveDate?.message}
                helperText="Use the actual credit or payment date."
              />
            )}
          />
          <Controller
            control={control}
            name="note"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Note"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Cash received, goods supplied, invoice note"
                multiline
                error={errors.note?.message}
              />
            )}
          />
        </ScrollView>
        <BottomActionBar>
          <PrimaryButton
            disabled={isLoadingInitialData || (!selectedCustomerId && customers.length === 0)}
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            {isEditing
              ? 'Update transaction'
              : selectedType === 'payment'
                ? 'Save payment'
                : 'Save credit'}
          </PrimaryButton>
        </BottomActionBar>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatAmountInput(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function paymentProviderLabel(source: PaymentProviderSource): string {
  switch (source) {
    case 'upi':
      return 'UPI';
    case 'payment_page':
      return 'Payment page';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    case 'wallet':
      return 'Wallet';
    case 'other':
    default:
      return 'Other';
  }
}

function copyInstrumentImageToLocalStorage(sourceUri: string): string {
  try {
    const directory = new Directory(Paths.document, 'payment-instruments');
    directory.create({ intermediates: true, idempotent: true });

    const source = new File(sourceUri);
    const extension = source.extension || '.jpg';
    const destination = new File(directory, `instrument-${Date.now()}${extension}`);
    source.copy(destination);

    return destination.uri;
  } catch (error) {
    console.warn('[payment-instrument] Falling back to picker URI', error);
    return sourceUri;
  }
}

function PaymentModeFields({
  details,
  mode,
  onChange,
}: {
  details: PaymentModeDetails;
  mode: PaymentMode;
  onChange: (details: PaymentModeDetails) => void;
}) {
  const update = (field: keyof PaymentModeDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  if (mode === 'cash') {
    return null;
  }

  return (
    <View style={styles.paymentDetailFields}>
      {['cheque', 'demand_draft', 'bank_transfer', 'upi', 'wallet'].includes(mode) ? (
        <TextField
          label="Reference"
          value={details.referenceNumber ?? ''}
          onChangeText={(value) => update('referenceNumber', value)}
          placeholder="Transaction or instrument number"
        />
      ) : null}
      {['cheque', 'demand_draft', 'bank_transfer'].includes(mode) ? (
        <TextField
          label="Bank"
          value={details.bankName ?? ''}
          onChangeText={(value) => update('bankName', value)}
          placeholder="Bank name"
        />
      ) : null}
      {['cheque', 'demand_draft'].includes(mode) ? (
        <>
          <TextField
            label="Branch"
            value={details.branchName ?? ''}
            onChangeText={(value) => update('branchName', value)}
            placeholder="Branch name"
          />
          <DateInput
            label="Instrument date"
            value={details.instrumentDate ?? ''}
            onChange={(value) => update('instrumentDate', value)}
            maximumDate={new Date()}
          />
        </>
      ) : null}
      {mode === 'upi' ? (
        <TextField
          label="UPI ID"
          value={details.upiId ?? ''}
          onChangeText={(value) => update('upiId', value)}
          placeholder="payer@upi"
        />
      ) : null}
      {mode === 'card' ? (
        <TextField
          label="Card last 4"
          value={details.cardLastFour ?? ''}
          onChangeText={(value) => update('cardLastFour', value.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="1234"
        />
      ) : null}
      {mode === 'wallet' ? (
        <TextField
          label="Provider"
          value={details.provider ?? ''}
          onChangeText={(value) => update('provider', value)}
          placeholder="Provider name"
        />
      ) : null}
      {mode === 'other' ? (
        <TextField
          label="Payment detail"
          value={details.note ?? ''}
          onChangeText={(value) => update('note', value)}
          placeholder="How was this paid?"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 184,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  loadingCard: {
    ...shadows.card,
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  customerPicker: {
    gap: spacing.md,
  },
  quickPickGroup: {
    gap: spacing.sm,
  },
  quickPickLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  quickPickRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  quickPick: {
    minHeight: 48,
    maxWidth: 168,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickPickText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  customerChoices: {
    gap: spacing.sm,
  },
  choice: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  choiceText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  choiceTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  choiceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  choiceMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  choiceTextSelected: {
    color: colors.primary,
  },
  selectedMarker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  selectedCustomerCard: {
    ...shadows.card,
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  selectedCustomerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  selectedCustomerLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  selectedCustomerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  changeCustomerButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  changeCustomerText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  paymentModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentModeChoice: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  paymentDetailFields: {
    gap: spacing.md,
  },
  reconciliationCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  attachmentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  attachmentCard: {
    width: 132,
    gap: spacing.xs,
  },
  attachmentImage: {
    width: 132,
    height: 82,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeButton: {
    flex: 1,
    minHeight: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  typeButtonCredit: {
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  typeButtonPayment: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  typeCreditSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  typePaymentSelected: {
    borderColor: colors.success,
    backgroundColor: colors.successSurface,
  },
  promiseChoices: {
    gap: spacing.sm,
  },
  promiseChoice: {
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  promiseChoiceSelected: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSurface,
  },
  choiceCreditSelected: {
    color: colors.accent,
  },
  choicePaymentSelected: {
    color: colors.success,
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
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
  },
});
