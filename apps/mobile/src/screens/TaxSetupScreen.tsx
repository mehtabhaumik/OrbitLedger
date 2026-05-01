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

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FounderFooterLink } from '../components/FounderFooterLink';
import { FormSection } from '../components/FormSection';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectField } from '../components/SelectField';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import {
  getBusinessSettings,
  getFeatureToggles,
  listTaxProfiles,
  saveBusinessSettings,
  saveManualTaxProfileOverride,
} from '../database';
import type { BusinessSettings, TaxPack } from '../database';
import type { RootStackParamList } from '../navigation/types';
import { normalizeDecimalInput } from '../forms/validation';
import {
  applyTaxPackUpdateFromProvider,
  getInvoiceTaxCountryMode,
  getInvoiceTaxProfile,
  inferTaxTypeForCountry,
  loadTaxPack,
  manualCheckTaxPackUpdates,
  saveInvoiceTaxProfile,
  type InvoiceTaxCountryMode,
  type InvoiceTaxProfile,
  type TaxPackLoadResult,
  type TaxPackUpdateCandidate,
  type TaxPackUpdateCheckResult,
  type TaxPackUpdateResult,
} from '../tax';
import { colors, spacing, typography } from '../theme/theme';

type TaxSetupScreenProps = NativeStackScreenProps<RootStackParamList, 'TaxSetup'>;

const taxSetupSchema = z.object({
  invoiceTaxEnabled: z.enum(['yes', 'no']),
  registrationStatus: z.string().trim().min(2, 'Choose a tax registration status.'),
  taxRegistrationNumber: z.string().trim().max(30, 'Tax number is too long.').optional(),
  legalName: z.string().trim().max(120, 'Legal name is too long.').optional(),
  registeredAddress: z.string().trim().max(240, 'Registered address is too long.').optional(),
  taxType: z
    .string()
    .trim()
    .min(2, 'Enter the tax type, for example GST or VAT.')
    .max(30, 'Tax type is too long.')
    .regex(/^[A-Za-z][A-Za-z\s-]*$/, 'Use letters, spaces, or hyphen only.'),
  taxRate: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, 'Enter a valid tax rate.')
    .refine((value) => Number(value) >= 0, 'Tax rate cannot be negative.')
    .refine((value) => Number(value) <= 100, 'Tax rate cannot be above 100%.'),
  version: z
    .string()
    .trim()
    .min(1, 'Enter a profile version.')
    .max(40, 'Profile version is too long.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, numbers, dots, hyphens, or underscores only.'),
  pricesIncludeTax: z.enum(['yes', 'no']),
  indiaGstRegistrationType: z.enum(['unregistered', 'regular', 'composition']),
  indiaDefaultSupplyType: z.enum(['auto', 'intra_state', 'inter_state']),
  indiaHsnSacEnabled: z.enum(['yes', 'no']),
  usaRegisteredStates: z.string().trim().max(180, 'Keep states under 180 characters.').optional(),
  usaSellerPermitId: z.string().trim().max(40, 'Permit ID is too long.').optional(),
  usaDefaultCustomerTaxable: z.enum(['yes', 'no']),
  usaDefaultItemsTaxable: z.enum(['yes', 'no']),
  ukVatScheme: z.enum(['standard', 'flat_rate', 'cash_accounting', 'annual_accounting']),
  ukShowTaxPoint: z.enum(['yes', 'no']),
});

type TaxSetupFormValues = z.infer<typeof taxSetupSchema>;

const defaultValues: TaxSetupFormValues = {
  invoiceTaxEnabled: 'no',
  registrationStatus: 'unregistered',
  taxRegistrationNumber: '',
  legalName: '',
  registeredAddress: '',
  taxType: '',
  taxRate: '',
  version: 'manual-1',
  pricesIncludeTax: 'no',
  indiaGstRegistrationType: 'unregistered',
  indiaDefaultSupplyType: 'auto',
  indiaHsnSacEnabled: 'yes',
  usaRegisteredStates: '',
  usaSellerPermitId: '',
  usaDefaultCustomerTaxable: 'yes',
  usaDefaultItemsTaxable: 'yes',
  ukVatScheme: 'standard',
  ukShowTaxPoint: 'yes',
};

const yesNoOptions = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

const indiaGstRegistrationOptions = [
  { label: 'Unregistered', value: 'unregistered', description: 'Do not show GSTIN on invoices.' },
  { label: 'Regular GST', value: 'regular', description: 'Use GSTIN and regular GST invoices.' },
  { label: 'Composition', value: 'composition', description: 'Composition scheme invoice setup.' },
];

const indiaSupplyTypeOptions = [
  { label: 'Auto', value: 'auto', description: 'Decide from customer place of supply later.' },
  { label: 'Intra-state', value: 'intra_state', description: 'CGST + SGST style supply.' },
  { label: 'Inter-state', value: 'inter_state', description: 'IGST style supply.' },
];

const ukVatSchemeOptions = [
  { label: 'Standard VAT', value: 'standard' },
  { label: 'Flat rate', value: 'flat_rate' },
  { label: 'Cash accounting', value: 'cash_accounting' },
  { label: 'Annual accounting', value: 'annual_accounting' },
];

export function TaxSetupScreen({ navigation }: TaxSetupScreenProps) {
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [taxModuleEnabled, setTaxModuleEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isCheckingTaxPack, setIsCheckingTaxPack] = useState(false);
  const [isApplyingTaxPack, setIsApplyingTaxPack] = useState(false);
  const [taxPackStatus, setTaxPackStatus] = useState<TaxPackLoadResult | null>(null);
  const [taxPackUpdateStatus, setTaxPackUpdateStatus] =
    useState<TaxPackUpdateCheckResult | null>(null);
  const [taxPackUpdateResult, setTaxPackUpdateResult] =
    useState<TaxPackUpdateResult | null>(null);
  const [taxPackUpdateError, setTaxPackUpdateError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting, isValid },
    handleSubmit,
    reset,
    watch,
  } = useForm<TaxSetupFormValues>({
    resolver: zodResolver(taxSetupSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const taxTypeValue = watch('taxType');
  const invoiceTaxEnabled = watch('invoiceTaxEnabled');
  const countryMode = getInvoiceTaxCountryMode(businessSettings?.countryCode ?? '');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [settings, featureToggles] = await Promise.all([
          getBusinessSettings(),
          getFeatureToggles(),
        ]);
        if (!settings) {
          navigation.replace('Setup');
          return;
        }

        if (!featureToggles.tax) {
          if (isMounted) {
            setBusinessSettings(settings);
            setTaxModuleEnabled(false);
          }
          return;
        }

        const existingProfiles = await listTaxProfiles(settings.countryCode, settings.stateCode);
        const existingProfile =
          existingProfiles.find((profile) => profile.source === 'manual') ??
          existingProfiles[0] ??
          null;
        const invoiceTaxProfile = await getInvoiceTaxProfile(settings);
        const activeTaxType = existingProfile?.taxType ?? inferTaxTypeForCountry(settings.countryCode);
        const loadedPack = await loadTaxPack({
          countryCode: settings.countryCode,
          regionCode: settings.stateCode,
          taxType: activeTaxType,
        });

        if (isMounted) {
          setBusinessSettings(settings);
          setTaxModuleEnabled(true);
          if (existingProfile) {
            reset({
              ...defaultValues,
              ...invoiceTaxProfileToFormValues(invoiceTaxProfile),
              taxType: existingProfile.taxType,
              taxRate: readFirstManualRate(existingProfile.taxRulesJson),
              version: existingProfile.version,
            });
          } else {
            reset({
              ...defaultValues,
              ...invoiceTaxProfileToFormValues(invoiceTaxProfile),
              taxType: activeTaxType,
              taxRate: loadedPack.taxPack ? readFirstRate(loadedPack.taxPack.rulesJson) : '',
              version: loadedPack.taxPack?.version ?? 'manual-1',
            });
          }

          if (isMounted) {
            setTaxPackStatus(loadedPack);
          }
        }
      } catch {
        Alert.alert('Tax setup could not load', 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [navigation, reset]);

  async function saveManualProfile(input: TaxSetupFormValues) {
    if (!businessSettings) {
      return;
    }

    const normalizedTaxType = input.taxType.trim().toUpperCase();
    const normalizedVersion = input.version.trim();
    const rate = Number(input.taxRate);
    const savedAt = new Date().toISOString();

    try {
      await saveInvoiceTaxProfile({
        enabled: input.invoiceTaxEnabled === 'yes',
        countryCode: businessSettings.countryCode,
        regionCode: businessSettings.stateCode,
        taxType: normalizedTaxType,
        registrationStatus:
          businessSettings.countryCode.toUpperCase() === 'IN'
            ? input.indiaGstRegistrationType
            : input.registrationStatus.trim(),
        taxRegistrationNumber: input.taxRegistrationNumber?.trim() || null,
        legalName: input.legalName?.trim() || businessSettings.businessName,
        registeredAddress: input.registeredAddress?.trim() || businessSettings.address,
        defaultRate: rate,
        defaultRateLabel: `${normalizedTaxType} ${input.taxRate}%`,
        pricesIncludeTax: input.pricesIncludeTax === 'yes',
        india:
          businessSettings.countryCode.toUpperCase() === 'IN'
            ? {
                gstRegistrationType: input.indiaGstRegistrationType,
                gstStateCode: businessSettings.stateCode,
                defaultSupplyType: input.indiaDefaultSupplyType,
                hsnSacEnabled: input.indiaHsnSacEnabled === 'yes',
              }
            : undefined,
        usa:
          businessSettings.countryCode.toUpperCase() === 'US'
            ? {
                registeredStates: input.usaRegisteredStates
                  ?.split(',')
                  .map((state) => state.trim().toUpperCase())
                  .filter(Boolean) ?? [],
                sellerPermitId: input.usaSellerPermitId?.trim() || null,
                defaultCustomerTaxable: input.usaDefaultCustomerTaxable === 'yes',
                defaultItemsTaxable: input.usaDefaultItemsTaxable === 'yes',
              }
            : undefined,
        uk:
          businessSettings.countryCode.toUpperCase() === 'GB'
            ? {
                vatScheme: input.ukVatScheme,
                showTaxPoint: input.ukShowTaxPoint === 'yes',
              }
            : undefined,
      });

      if (input.invoiceTaxEnabled !== 'yes') {
        await saveBusinessSettings({
          ...businessSettings,
          taxMode: 'not_configured',
          taxProfileVersion: null,
          taxProfileSource: 'none',
          taxLastSyncedAt: null,
          taxSetupRequired: true,
        });
        Alert.alert('Invoice tax profile saved', 'Invoice tax is off. You can enable it later from this screen.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      await saveManualTaxProfileOverride({
        countryCode: businessSettings.countryCode,
        stateCode: businessSettings.stateCode,
        taxType: normalizedTaxType,
        version: normalizedVersion,
        lastUpdated: savedAt,
        taxRulesJson: {
          source: 'manual',
          rules: [
            {
              label: normalizedTaxType,
              rate,
            },
          ],
        },
      });

      await saveBusinessSettings({
        ...businessSettings,
        taxMode: 'manual',
        taxProfileVersion: normalizedVersion,
        taxProfileSource: 'local',
        taxLastSyncedAt: null,
        taxSetupRequired: false,
      });

      Alert.alert('Invoice tax setup saved', 'Your invoice tax setup is ready.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        'Invoice tax profile could not be saved',
        error instanceof Error ? error.message : 'Please check the tax details and try again.'
      );
    }
  }

  async function skipForNow() {
    if (!businessSettings) {
      return;
    }

    setIsSkipping(true);

    try {
      await saveBusinessSettings({
        ...businessSettings,
        taxMode: 'not_configured',
        taxProfileVersion: null,
        taxProfileSource: 'none',
        taxLastSyncedAt: null,
        taxSetupRequired: true,
      });
      Alert.alert('Tax setup skipped', 'You can keep using Orbit Ledger and set up tax later.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Tax setup could not be skipped', 'Please try again.');
    } finally {
      setIsSkipping(false);
    }
  }

  async function checkTaxPackUpdates() {
    if (!businessSettings) {
      return;
    }

    const taxType = taxTypeValue.trim().toUpperCase();
    if (!taxType) {
      Alert.alert('Enter tax type first', 'Add a tax type such as GST or VAT before checking for updates.');
      return;
    }

    setIsCheckingTaxPack(true);
    try {
      setTaxPackUpdateError(null);
      const result = await manualCheckTaxPackUpdates({
        countryCode: businessSettings.countryCode,
        regionCode: businessSettings.stateCode,
        taxType,
      });
      setTaxPackUpdateStatus(result);
      setTaxPackUpdateResult(null);

      if (result.updateAvailable) {
        Alert.alert(
          'Tax update available',
          'A newer tax setup can be checked and applied now.',
          [
            { text: 'Not now' },
            {
              text: 'Apply',
              onPress: () => {
                if (result.candidate) {
                  void applyTaxPackUpdate(result.candidate);
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert('No tax update available', result.message);
    } catch {
      setTaxPackUpdateError('Update check failed. Your current tax setup was not changed.');
      Alert.alert('Update check failed', 'Your current tax setup was not changed.');
    } finally {
      setIsCheckingTaxPack(false);
    }
  }

  async function applyTaxPackUpdate(candidate: TaxPackUpdateCandidate) {
    if (!businessSettings) {
      return;
    }

    const taxType = taxTypeValue.trim().toUpperCase();
    if (!taxType) {
      Alert.alert('Enter tax type first', 'Add a tax type such as GST or VAT before applying tax details.');
      return;
    }

    setIsApplyingTaxPack(true);
    try {
      setTaxPackUpdateError(null);
      const result = await applyTaxPackUpdateFromProvider(
        {
          countryCode: businessSettings.countryCode,
          regionCode: businessSettings.stateCode,
          taxType,
        },
        candidate
      );
      setTaxPackUpdateResult(result);

      if (result.status === 'saved' && result.taxPack) {
        const packedRate = Number(readFirstRate(result.taxPack.rulesJson) || 0);
        const existingInvoiceTaxProfile = await getInvoiceTaxProfile(businessSettings);
        await saveInvoiceTaxProfile({
          enabled: existingInvoiceTaxProfile?.enabled ?? false,
          countryCode: businessSettings.countryCode,
          regionCode: businessSettings.stateCode,
          taxType: result.taxPack.taxType,
          registrationStatus:
            existingInvoiceTaxProfile?.registrationStatus ??
            (businessSettings.countryCode.toUpperCase() === 'IN' ? 'unregistered' : 'manual'),
          taxRegistrationNumber: existingInvoiceTaxProfile?.taxRegistrationNumber ?? null,
          legalName: existingInvoiceTaxProfile?.legalName ?? businessSettings.businessName,
          registeredAddress: existingInvoiceTaxProfile?.registeredAddress ?? businessSettings.address,
          defaultRate: packedRate,
          defaultRateLabel: `${result.taxPack.taxType} ${packedRate}%`,
          pricesIncludeTax: existingInvoiceTaxProfile?.pricesIncludeTax ?? false,
          india:
            businessSettings.countryCode.toUpperCase() === 'IN'
              ? {
                  gstRegistrationType:
                    existingInvoiceTaxProfile?.india?.gstRegistrationType ?? 'unregistered',
                  gstStateCode: businessSettings.stateCode,
                  defaultSupplyType:
                    existingInvoiceTaxProfile?.india?.defaultSupplyType ?? 'auto',
                  hsnSacEnabled: existingInvoiceTaxProfile?.india?.hsnSacEnabled ?? true,
                }
              : undefined,
          usa:
            businessSettings.countryCode.toUpperCase() === 'US'
              ? {
                  registeredStates:
                    existingInvoiceTaxProfile?.usa?.registeredStates ??
                    [businessSettings.stateCode].filter(Boolean),
                  sellerPermitId: existingInvoiceTaxProfile?.usa?.sellerPermitId ?? null,
                  defaultCustomerTaxable:
                    existingInvoiceTaxProfile?.usa?.defaultCustomerTaxable ?? true,
                  defaultItemsTaxable:
                    existingInvoiceTaxProfile?.usa?.defaultItemsTaxable ?? true,
                }
              : undefined,
          uk:
            businessSettings.countryCode.toUpperCase() === 'GB'
              ? {
                  vatScheme: existingInvoiceTaxProfile?.uk?.vatScheme ?? 'standard',
                  showTaxPoint: existingInvoiceTaxProfile?.uk?.showTaxPoint ?? true,
                }
              : undefined,
        });
        const savedSettings = await saveBusinessSettings({
          ...businessSettings,
          taxMode: 'manual',
          taxProfileVersion: result.taxPack.version,
          taxProfileSource: 'remote',
          taxLastSyncedAt: result.taxPack.lastUpdated,
          taxSetupRequired: false,
        });
        setBusinessSettings(savedSettings);
        setTaxPackStatus({
          taxPack: result.taxPack,
          source: 'active',
        });
        reset({
          ...defaultValues,
          ...invoiceTaxProfileToFormValues(await getInvoiceTaxProfile(savedSettings)),
          taxType: result.taxPack.taxType,
          taxRate: readFirstRate(result.taxPack.rulesJson),
          version: result.taxPack.version,
        });
        Alert.alert('Tax setup applied', result.message);
        return;
      }

      setTaxPackStatus({
        taxPack: result.taxPack,
        source: result.taxPack ? 'fallback' : 'missing',
      });
      Alert.alert('Tax setup not applied', result.message);
    } catch {
      setTaxPackUpdateError('Tax setup could not be applied. Your current tax setup was not changed.');
      Alert.alert('Tax setup could not be applied', 'Your current tax setup was not changed.');
    } finally {
      setIsApplyingTaxPack(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>Loading tax setup</Text>
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  if (!taxModuleEnabled) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.disabledContent}>
          <ScreenHeader
            title="Tax is off"
            subtitle="Tax setup is hidden while this module is disabled."
            onBack={() => navigation.goBack()}
          />
          <EmptyState
            title="Tax module is turned off"
            message="Enable tax in business profile settings when you want to set up invoice tax."
            action={
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                Open Settings
              </PrimaryButton>
            }
          />
        </View>
      </SafeAreaView>
    );
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
            title="Tax Setup"
            subtitle="Set basic invoice tax details without changing daily ledger access."
            onBack={() => navigation.goBack()}
          />

          <Card glass elevated accent="tax">
            <Text style={styles.noticeTitle}>Online tax updates</Text>
            <Text style={styles.noticeText}>
              You can check for newer tax setup details and keep using the last working setup when
              you do not have internet.
            </Text>
            <StatusChip label="Works without internet" tone="tax" />
          </Card>

          <Card compact accent="primary">
            <Text style={styles.overline}>Current region</Text>
            <Text style={styles.regionValue}>
              {businessSettings?.countryCode || 'Country not set'} /{' '}
              {businessSettings?.stateCode || 'Region not set'}
            </Text>
            <Text style={styles.muted}>
              Tax rules are stored against this country and state or region.
            </Text>
          </Card>

          <FormSection
            title={formatInvoiceTaxProfileTitle(countryMode)}
            subtitle="These details are used only for invoice tax calculation and document display."
            accent="tax"
          >
            <Controller
              control={control}
              name="invoiceTaxEnabled"
              render={({ field: { onChange, value } }) => (
                <SelectField
                  label="Enable invoice tax"
                  value={value}
                  onChange={onChange}
                  options={yesNoOptions}
                  helperText="Turn this on when invoices should show GST, VAT, or sales tax."
                />
              )}
            />
            {countryMode === 'IN' ? null : (
              <Controller
                control={control}
                name="registrationStatus"
                render={({ field: { onChange, value } }) => (
                  <SelectField
                    label="Registration status"
                    value={value}
                    onChange={onChange}
                    options={getRegistrationStatusOptions(countryMode)}
                    disabled={invoiceTaxEnabled !== 'yes'}
                    error={errors.registrationStatus?.message}
                  />
                )}
              />
            )}
            <Controller
              control={control}
              name="taxRegistrationNumber"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label={formatTaxRegistrationLabel(countryMode)}
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  autoCapitalize="characters"
                  editable={invoiceTaxEnabled === 'yes'}
                  placeholder={formatTaxRegistrationPlaceholder(countryMode)}
                  error={errors.taxRegistrationNumber?.message}
                  helperText={formatTaxRegistrationHelper(countryMode)}
                />
              )}
            />
            <Controller
              control={control}
              name="legalName"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Tax legal name"
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  editable={invoiceTaxEnabled === 'yes'}
                  placeholder={businessSettings?.businessName ?? 'Business legal name'}
                  error={errors.legalName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="registeredAddress"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Registered tax address"
                  value={value ?? ''}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  editable={invoiceTaxEnabled === 'yes'}
                  multiline
                  placeholder={businessSettings?.address ?? 'Registered tax address'}
                  error={errors.registeredAddress?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="pricesIncludeTax"
              render={({ field: { onChange, value } }) => (
                <SelectField
                  label="Prices include tax"
                  value={value}
                  onChange={onChange}
                  options={yesNoOptions}
                  disabled={invoiceTaxEnabled !== 'yes'}
                  helperText="Most invoices use tax-exclusive prices. Turn on only if your entered item price already includes tax."
                />
              )}
            />
            {countryMode === 'IN' ? (
              <View style={styles.countryTaxBox}>
                <Text style={styles.countryTaxTitle}>India GST invoice details</Text>
                <Controller
                  control={control}
                  name="indiaGstRegistrationType"
                  render={({ field: { onChange, value } }) => (
                    <SelectField
                      label="GST registration type"
                      value={value}
                      onChange={onChange}
                      options={indiaGstRegistrationOptions}
                      disabled={invoiceTaxEnabled !== 'yes'}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="indiaDefaultSupplyType"
                  render={({ field: { onChange, value } }) => (
                    <SelectField
                      label="Default supply type"
                      value={value}
                      onChange={onChange}
                      options={indiaSupplyTypeOptions}
                      disabled={invoiceTaxEnabled !== 'yes'}
                      helperText="Auto keeps GST flexible. Final CGST/SGST or IGST depends on place of supply."
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="indiaHsnSacEnabled"
                  render={({ field: { onChange, value } }) => (
                    <SelectField
                      label="Use HSN/SAC on items later"
                      value={value}
                      onChange={onChange}
                      options={yesNoOptions}
                      disabled={invoiceTaxEnabled !== 'yes'}
                    />
                  )}
                />
              </View>
            ) : null}
            {countryMode === 'US' ? (
              <View style={styles.countryTaxBox}>
                <Text style={styles.countryTaxTitle}>US sales tax invoice details</Text>
                <Controller
                  control={control}
                  name="usaRegisteredStates"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextField
                      label="States where you collect tax"
                      value={value ?? ''}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      editable={invoiceTaxEnabled === 'yes'}
                      placeholder="CA, TX, NY"
                      helperText="Use comma-separated state codes. Exact rates should be verified."
                      error={errors.usaRegisteredStates?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="usaSellerPermitId"
                  render={({ field: { onBlur, onChange, value } }) => (
                    <TextField
                      label="Seller permit / tax ID"
                      value={value ?? ''}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      editable={invoiceTaxEnabled === 'yes'}
                      placeholder="Optional"
                      error={errors.usaSellerPermitId?.message}
                    />
                  )}
                />
              </View>
            ) : null}
            {countryMode === 'GB' ? (
              <View style={styles.countryTaxBox}>
                <Text style={styles.countryTaxTitle}>UK VAT invoice details</Text>
                <Controller
                  control={control}
                  name="ukVatScheme"
                  render={({ field: { onChange, value } }) => (
                    <SelectField
                      label="VAT scheme"
                      value={value}
                      onChange={onChange}
                      options={ukVatSchemeOptions}
                      disabled={invoiceTaxEnabled !== 'yes'}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="ukShowTaxPoint"
                  render={({ field: { onChange, value } }) => (
                    <SelectField
                      label="Show tax point later"
                      value={value}
                      onChange={onChange}
                      options={yesNoOptions}
                      disabled={invoiceTaxEnabled !== 'yes'}
                    />
                  )}
                />
              </View>
            ) : null}
            <Text style={styles.muted}>
              Orbit Ledger uses this profile to calculate and display invoice tax. It does not file
              tax returns or guarantee legal treatment.
            </Text>
          </FormSection>

          <FormSection
            title="Tax Updates"
            subtitle="Checked packages stay ready after they are applied."
            accent="tax"
          >
            <Text style={styles.muted}>
              Download tax details for this region when you choose. They are checked before use and
              remain available after they are applied.
            </Text>
            <StatusInfoRow
              label="Applied version"
              value={formatTaxPackVersion(taxPackStatus?.taxPack)}
            />
            <StatusInfoRow
              label="Last updated"
              value={formatTaxPackLastUpdated(taxPackStatus?.taxPack)}
            />
            <StatusInfoRow
              label="Last checked"
              value={formatOptionalDateTime(taxPackUpdateStatus?.checkedAt)}
            />
            <StatusInfoRow
              label="Latest online version"
              value={taxPackUpdateStatus?.latestVersion ?? 'Not checked yet'}
            />
            {taxPackUpdateResult ? (
              <View
                style={
                  taxPackUpdateResult.status === 'saved'
                    ? styles.statusSuccess
                    : styles.statusWarning
                }
              >
                <Text style={styles.statusText}>{taxPackUpdateResult.message}</Text>
              </View>
            ) : null}
            {taxPackUpdateError ? (
              <View style={styles.statusWarning}>
                <Text style={styles.statusText}>{taxPackUpdateError}</Text>
              </View>
            ) : null}
            <PrimaryButton
              variant="secondary"
              disabled={isCheckingTaxPack || isApplyingTaxPack}
              loading={isCheckingTaxPack}
              onPress={() => void checkTaxPackUpdates()}
            >
              Check Online Tax Pack
            </PrimaryButton>
            {taxPackUpdateStatus?.updateAvailable && taxPackUpdateStatus.candidate ? (
              <PrimaryButton
                disabled={isCheckingTaxPack || isApplyingTaxPack}
                loading={isApplyingTaxPack}
                onPress={() => void applyTaxPackUpdate(taxPackUpdateStatus.candidate!)}
              >
                Apply Tax Pack v{taxPackUpdateStatus.latestVersion}
              </PrimaryButton>
            ) : null}
          </FormSection>

          <FormSection
            title="Default Invoice Tax Rate"
            subtitle="Rates are auto-filled from the active setup when available. Use this only when you need to adjust them."
            accent="primary"
          >
            <Controller
              control={control}
              name="taxType"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Tax type"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  autoCapitalize="characters"
                  placeholder="GST, VAT, Sales Tax"
                  error={errors.taxType?.message}
                  helperText="Auto-filled from your country when possible. You can still change it."
                />
              )}
            />
            <Controller
              control={control}
              name="taxRate"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Tax rate"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="18"
                  error={errors.taxRate?.message}
                  helperText="Your saved region setup can fill this automatically. Change it only when needed."
                />
              )}
            />
            <Controller
              control={control}
              name="version"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Profile version"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  placeholder="manual-1"
                  error={errors.version?.message}
                  helperText="A simple label so this setup can be replaced later."
                />
              )}
            />
          </FormSection>

          <PrimaryButton
            disabled={isSubmitting || isSkipping}
            loading={isSubmitting}
            onPress={handleSubmit(saveManualProfile)}
          >
            Save Invoice Tax Profile
          </PrimaryButton>
          <PrimaryButton
            variant="ghost"
            disabled={isSubmitting || isSkipping}
            loading={isSkipping}
            onPress={() => void skipForNow()}
          >
            Skip For Now
          </PrimaryButton>

          <FounderFooterLink />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function readFirstManualRate(taxRulesJson: string): string {
  return readFirstRate(taxRulesJson);
}

function readFirstRate(taxRulesJson: string): string {
  try {
    const parsed = JSON.parse(taxRulesJson) as {
      rules?: Array<{ rate?: unknown }>;
    };
    const rate = parsed.rules?.[0]?.rate;
    return typeof rate === 'number' && Number.isFinite(rate) ? String(rate) : '';
  } catch {
    return '';
  }
}

function formatTaxPackVersion(taxPack: TaxPack | null | undefined): string {
  return taxPack ? `${taxPack.taxType} v${taxPack.version}` : 'No tax setup applied';
}

function formatTaxPackLastUpdated(taxPack: TaxPack | null | undefined): string {
  return taxPack ? formatOptionalDateTime(taxPack.lastUpdated) : 'Not available';
}

function formatOptionalDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not checked yet';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function StatusInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusInfoRow}>
      <Text style={styles.statusInfoLabel}>{label}</Text>
      <Text style={styles.statusInfoValue}>{value}</Text>
    </View>
  );
}

function invoiceTaxProfileToFormValues(
  profile: InvoiceTaxProfile | null
): Partial<TaxSetupFormValues> {
  if (!profile) {
    return {};
  }

  return {
    invoiceTaxEnabled: profile.enabled ? 'yes' : 'no',
    registrationStatus: profile.registrationStatus,
    taxRegistrationNumber: profile.taxRegistrationNumber ?? '',
    legalName: profile.legalName ?? '',
    registeredAddress: profile.registeredAddress ?? '',
    taxType: profile.taxType,
    taxRate: String(profile.defaultRate),
    pricesIncludeTax: profile.pricesIncludeTax ? 'yes' : 'no',
    indiaGstRegistrationType: profile.india?.gstRegistrationType ?? 'unregistered',
    indiaDefaultSupplyType: profile.india?.defaultSupplyType ?? 'auto',
    indiaHsnSacEnabled: profile.india?.hsnSacEnabled === false ? 'no' : 'yes',
    usaRegisteredStates: profile.usa?.registeredStates.join(', ') ?? '',
    usaSellerPermitId: profile.usa?.sellerPermitId ?? '',
    usaDefaultCustomerTaxable: profile.usa?.defaultCustomerTaxable === false ? 'no' : 'yes',
    usaDefaultItemsTaxable: profile.usa?.defaultItemsTaxable === false ? 'no' : 'yes',
    ukVatScheme: profile.uk?.vatScheme ?? 'standard',
    ukShowTaxPoint: profile.uk?.showTaxPoint === false ? 'no' : 'yes',
  };
}

function getRegistrationStatusOptions(countryMode: InvoiceTaxCountryMode) {
  if (countryMode === 'IN') {
    return [
      { label: 'Unregistered', value: 'unregistered' },
      { label: 'Regular GST registered', value: 'regular' },
      { label: 'Composition GST registered', value: 'composition' },
    ];
  }

  if (countryMode === 'GB') {
    return [
      { label: 'Not VAT registered', value: 'not_registered' },
      { label: 'VAT registered', value: 'registered' },
    ];
  }

  if (countryMode === 'US') {
    return [
      { label: 'Manual sales tax', value: 'manual' },
      { label: 'State sales tax registered', value: 'state_registered' },
    ];
  }

  return [
    { label: 'Manual tax setup', value: 'manual' },
    { label: 'Registered', value: 'registered' },
  ];
}

function formatInvoiceTaxProfileTitle(countryMode: InvoiceTaxCountryMode): string {
  if (countryMode === 'IN') {
    return 'India GST Invoice Profile';
  }
  if (countryMode === 'US') {
    return 'US Sales Tax Invoice Profile';
  }
  if (countryMode === 'GB') {
    return 'UK VAT Invoice Profile';
  }
  return 'Invoice Tax Profile';
}

function formatTaxRegistrationLabel(countryMode: InvoiceTaxCountryMode): string {
  if (countryMode === 'IN') {
    return 'GSTIN';
  }
  if (countryMode === 'GB') {
    return 'VAT registration number';
  }
  if (countryMode === 'US') {
    return 'Sales tax ID';
  }
  return 'Tax registration number';
}

function formatTaxRegistrationPlaceholder(countryMode: InvoiceTaxCountryMode): string {
  if (countryMode === 'IN') {
    return '27ABCDE1234F1Z5';
  }
  if (countryMode === 'GB') {
    return 'GB123456789';
  }
  return 'Optional';
}

function formatTaxRegistrationHelper(countryMode: InvoiceTaxCountryMode): string {
  if (countryMode === 'IN') {
    return 'Required for regular or composition GST invoices.';
  }
  if (countryMode === 'GB') {
    return 'Required when VAT registered.';
  }
  if (countryMode === 'US') {
    return 'Optional. Sales tax registration varies by state.';
  }
  return 'Optional unless your country requires it on invoices.';
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
  disabledContent: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noticeCard: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 21,
  },
  noticeText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  regionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  overline: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  regionValue: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  statusInfoRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  statusInfoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  statusInfoValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  statusSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  statusWarning: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  statusText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  countryTaxBox: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  countryTaxTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
});
