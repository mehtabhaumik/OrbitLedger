import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { recordLedgerDataChangedForBackupNudge } from '../backup';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { addCustomer, getCustomerLedger, updateCustomer } from '../database';
import { COUNTRY_OPTIONS, getCityOptions, getDefaultCity, getDefaultRegionCode, getRegionOptions } from '../data/regions';
import { composeAddress, parseAddress } from '../forms/address';
import {
  normalizeDigitsAndPhoneSymbols,
  normalizeSignedDecimalInput,
  optionalAddressLineSchema,
  optionalPhoneSchema,
  optionalPostalCodeSchema,
  personNameSchema,
  requiredAddressLineSchema,
  requiredCitySchema,
  countryCodeSchema,
  regionCodeSchema,
  signedMoneyInputSchema,
} from '../forms/validation';
import { showSuccessFeedback } from '../lib/feedback';
import type { RootStackParamList } from '../navigation/types';
import { colors, shadows, spacing, typography } from '../theme/theme';

type CustomerFormScreenProps = NativeStackScreenProps<RootStackParamList, 'CustomerForm'>;

const customerSchema = z.object({
  name: personNameSchema('customer name'),
  phone: optionalPhoneSchema,
  addressLine1: requiredAddressLineSchema,
  addressLine2: optionalAddressLineSchema,
  town: optionalAddressLineSchema,
  countryCode: countryCodeSchema,
  stateCode: regionCodeSchema,
  city: requiredCitySchema,
  postalCode: optionalPostalCodeSchema,
  notes: z.string().trim().optional(),
  openingBalance: signedMoneyInputSchema,
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const defaultValues: CustomerFormValues = {
  name: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  countryCode: 'IN',
  stateCode: 'GJ',
  city: '',
  postalCode: '',
  notes: '',
  openingBalance: '0',
};

export function CustomerFormScreen({ navigation, route }: CustomerFormScreenProps) {
  const customerId = route.params?.customerId;
  const [isLoading, setIsLoading] = useState(Boolean(customerId));
  const {
    control,
    formState: { errors, isSubmitting, isValid },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const values = watch();
  const countryOptions = COUNTRY_OPTIONS.filter((country) => country.code === 'IN');
  const regionOptions = getRegionOptions(values.countryCode || 'IN');
  const cityOptions = getCityOptions(values.countryCode || 'IN', values.stateCode || 'GJ');

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      if (!customerId) {
        return;
      }

      try {
        const ledger = await getCustomerLedger(customerId);
        if (isMounted) {
          const address = parseAddress(ledger.customer.address);
          reset({
            name: ledger.customer.name,
            phone: ledger.customer.phone ?? '',
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            town: address.town ?? '',
            countryCode: address.countryCode || 'IN',
            stateCode: address.stateCode || 'GJ',
            city: address.city,
            postalCode: address.postalCode,
            notes: ledger.customer.notes ?? '',
            openingBalance: String(ledger.customer.openingBalance),
          });
        }
      } catch {
        Alert.alert('Customer could not load', 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [customerId, reset]);

  async function onSubmit(input: CustomerFormValues) {
    try {
      const payload = {
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: composeAddress(input),
        notes: input.notes?.trim() || null,
        openingBalance: Number(input.openingBalance),
      };

      if (customerId) {
        await updateCustomer(customerId, payload);
        showSuccessFeedback('Customer details saved.', 'Customer saved');
        navigation.replace('CustomerDetail', { customerId });
        return;
      }

      const customer = await addCustomer(payload);
      await recordLedgerDataChangedForBackupNudge('customer');
      showSuccessFeedback('Customer added. You can start recording dues and payments.', 'Customer added');
      navigation.replace('CustomerDetail', { customerId: customer.id });
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('same name and phone')
          ? error.message
          : 'Please check the details and try again.';
      Alert.alert(
        'Customer could not be saved',
        message
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
            title={customerId ? 'Edit Customer' : 'Add Customer'}
            subtitle="Opening balance can be positive for dues or negative for advance held."
            onBack={() => navigation.goBack()}
          />
          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Loading customer details</Text>
            </View>
          ) : null}
          <Controller
            control={control}
            name="name"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Customer name"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Aarav Kirana Store"
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Phone"
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(normalizeDigitsAndPhoneSymbols(text))}
                keyboardType="phone-pad"
                inputMode="tel"
                placeholder="+91 98765 43210"
                error={errors.phone?.message}
              />
            )}
          />
          <View style={styles.addressSection}>
            <Text style={styles.subsectionTitle}>Customer address</Text>
            <Controller
              control={control}
              name="addressLine1"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Address line 1"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Shop number, building, street"
                  error={errors.addressLine1?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="addressLine2"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Address line 2"
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Area or landmark"
                  error={errors.addressLine2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="town"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Town or village"
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="Optional local town or village"
                  error={errors.town?.message}
                />
              )}
            />
            <View style={styles.twoColumn}>
              <Controller
                control={control}
                name="countryCode"
                render={({ field: { onChange, value } }) => (
                  <SelectField
                    label="Country"
                    value={value}
                    options={countryOptions.map((country) => ({
                      label: country.name,
                      value: country.code,
                      description: 'Active at launch',
                    }))}
                    onChange={(countryCode) => {
                      const lockedCountry = countryCode || 'IN';
                      onChange(lockedCountry);
                      const nextRegion = getDefaultRegionCode(lockedCountry);
                      setValue('stateCode', nextRegion, { shouldDirty: true, shouldValidate: true });
                      setValue('city', getDefaultCity(lockedCountry, nextRegion), { shouldDirty: true, shouldValidate: true });
                    }}
                    error={errors.countryCode?.message}
                    helperText="India is active for launch."
                  />
                )}
              />
              <Controller
                control={control}
                name="stateCode"
                render={({ field: { onChange, value } }) => (
                  <SelectField
                    label="State"
                    value={value}
                    options={regionOptions.map((region) => ({
                      label: region.name,
                      value: region.code,
                      description: region.code,
                    }))}
                    onChange={(stateCode) => {
                      onChange(stateCode);
                      setValue('city', getDefaultCity(values.countryCode || 'IN', stateCode), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    error={errors.stateCode?.message}
                  />
                )}
              />
            </View>
            <View style={styles.twoColumn}>
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, value } }) => (
                  <SelectField
                    label="City"
                    value={value}
                    options={cityOptions.map((city) => ({
                      label: city,
                      value: city,
                      description: values.stateCode,
                    }))}
                    onChange={onChange}
                    error={errors.city?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="postalCode"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    label="Postal code"
                    value={value ?? ''}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="380001"
                    error={errors.postalCode?.message}
                    style={styles.flexInput}
                  />
                )}
              />
            </View>
          </View>
          <Controller
            control={control}
            name="openingBalance"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Opening balance"
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(normalizeSignedDecimalInput(text))}
                keyboardType="numbers-and-punctuation"
                inputMode="decimal"
                placeholder="0"
                error={errors.openingBalance?.message}
                helperText="Positive means customer owes you. Negative means advance balance."
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Notes"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Payment preference or reminder"
                multiline
                error={errors.notes?.message}
              />
            )}
          />
          <PrimaryButton
            disabled={isLoading}
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            {customerId ? 'Save customer' : 'Add customer'}
          </PrimaryButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
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
  addressSection: {
    gap: spacing.md,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flexInput: {
    flex: 1,
    minWidth: 0,
  },
});
