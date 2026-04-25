import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import type { AddPaymentPromiseInput, PaymentPromise } from '../database';
import {
  dateInputSchema,
  getTodayDateInput,
  moneyInputSchema,
  normalizeDecimalInput,
} from '../forms/validation';
import { formatCurrency } from '../lib/format';
import { colors, radii, shadows, spacing, typography } from '../theme/theme';
import { DateInput } from './DateInput';
import { PrimaryButton } from './PrimaryButton';
import { StatusChip } from './StatusChip';
import { TextField } from './TextField';

const paymentPromiseSchema = z.object({
  promisedAmount: moneyInputSchema,
  promisedDate: dateInputSchema('promise date'),
  note: z.string().trim().max(160, 'Keep the note under 160 characters.').optional(),
});

type PaymentPromiseValues = z.infer<typeof paymentPromiseSchema>;

type PaymentPromiseModalProps = {
  visible: boolean;
  customerId: string;
  customerName: string;
  currency: string;
  currentBalance?: number;
  initialPromise?: PaymentPromise | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (input: AddPaymentPromiseInput) => void;
};

export function PaymentPromiseModal({
  visible,
  customerId,
  customerName,
  currency,
  currentBalance = 0,
  initialPromise,
  isSaving = false,
  onClose,
  onSave,
}: PaymentPromiseModalProps) {
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    reset,
    watch,
  } = useForm<PaymentPromiseValues>({
    resolver: zodResolver(paymentPromiseSchema),
    defaultValues: getDefaultValues(initialPromise),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const promisedAmount = Number(watch('promisedAmount') || 0);

  useEffect(() => {
    if (visible) {
      reset(getDefaultValues(initialPromise));
    }
  }, [initialPromise, reset, visible]);

  function submit(values: PaymentPromiseValues) {
    onSave({
      customerId,
      promisedAmount: Number(values.promisedAmount),
      promisedDate: values.promisedDate,
      note: values.note,
    });
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>Payment promise</Text>
                <Text style={styles.title}>
                  {initialPromise ? 'Update promise' : 'Record promise'}
                </Text>
                <Text style={styles.subtitle}>
                  Track when {customerName} says they will pay, then match it when payment is saved.
                </Text>
              </View>
              <PrimaryButton variant="ghost" disabled={isSaving} onPress={onClose}>
                Close
              </PrimaryButton>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Current balance</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(Math.max(currentBalance, 0), currency)}
                </Text>
              </View>
              {initialPromise ? <StatusChip label={initialPromise.status} tone="primary" /> : null}
            </View>

            <ScrollView
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              style={styles.formScroll}
              contentContainerStyle={styles.form}
            >
              <Controller
                control={control}
                name="promisedAmount"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    label="Promised amount"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                    placeholder="0.00"
                    error={errors.promisedAmount?.message}
                    helperText={
                      promisedAmount > 0
                        ? `${formatCurrency(promisedAmount, currency)} promised.`
                        : 'Use the amount the customer committed to pay.'
                    }
                  />
                )}
              />
              <Controller
                control={control}
                name="promisedDate"
                render={({ field: { onChange, value } }) => (
                  <DateInput
                    label="Promise date"
                    value={value}
                    onChange={onChange}
                    minimumDate={new Date()}
                    error={errors.promisedDate?.message}
                    helperText="Follow-up will prioritize promises due soon."
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
                    placeholder="Promised by call, partial payment, bank transfer"
                    multiline
                    error={errors.note?.message}
                  />
                )}
              />
            </ScrollView>

            <View style={styles.actions}>
              <PrimaryButton
                disabled={!isValid || isSaving}
                loading={isSaving}
                onPress={handleSubmit(submit)}
              >
                {initialPromise ? 'Update Promise' : 'Save Promise'}
              </PrimaryButton>
              <PrimaryButton variant="ghost" disabled={isSaving} onPress={onClose}>
                Not now
              </PrimaryButton>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function getDefaultValues(initialPromise?: PaymentPromise | null): PaymentPromiseValues {
  return {
    promisedAmount: initialPromise ? formatAmountInput(initialPromise.promisedAmount) : '',
    promisedDate: initialPromise?.promisedDate ?? getTodayDateInput(),
    note: initialPromise?.note ?? '',
  };
}

function formatAmountInput(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  safeArea: {
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  summaryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.warning,
    fontSize: typography.title,
    fontWeight: '900',
  },
  formScroll: {
    maxHeight: 360,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
