import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { BottomNavigation } from '../components/BottomNavigation';
import { IdentityPreviewCard } from '../components/IdentityPreviewCard';
import { ImagePickerField } from '../components/ImagePickerField';
import { OrbitHelperStatus } from '../components/OrbitHelperStatus';
import { PinConfirmationModal } from '../components/PinConfirmationModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { COUNTRY_OPTIONS, getDefaultRegionCode, getRegionOptions } from '../data/regions';
import {
  applyCountryPackageUpdateFromProvider,
  loadInstalledCountryPackage,
  manualCheckCountryPackageUpdates,
  type CountryPackageUpdateCheckResult,
  type CountryPackageUpdateCandidate,
  type CountryPackageUpdateResult,
} from '../countryPackages';
import {
  getBusinessSettings,
  getFeatureToggles,
  saveBusinessSettings,
  saveFeatureToggles,
  seedDevelopmentData,
} from '../database';
import type { AppFeatureToggles, BusinessSettings, CountryPackageWithComponents } from '../database';
import { shareOrbitLedgerReferral } from '../engagement';
import {
  PRO_BRAND_THEMES,
  getActiveProBrandTheme,
  getSubscriptionStatus,
  saveActiveProBrandTheme,
} from '../monetization';
import type { ProBrandTheme, ProBrandThemeKey, SubscriptionStatus } from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import { composeAddress, parseAddress } from '../forms/address';
import {
  businessNameSchema,
  countryCodeSchema,
  currencyCodeSchema,
  normalizeDigitsAndPhoneSymbols,
  optionalAddressLineSchema,
  personNameSchema,
  phoneSchema,
  postalCodeSchema,
  regionCodeSchema,
  requiredAddressLineSchema,
  requiredCitySchema,
} from '../forms/validation';
import { useAppLock } from '../security/AppLockContext';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  type BiometricCapability,
} from '../security/biometricAuth';
import { PIN_INACTIVITY_TIMEOUT_OPTIONS } from '../security/pinLock';
import { colors, shadows, spacing, touch, typography } from '../theme/theme';

const profileSchema = z.object({
  businessName: businessNameSchema('business name'),
  ownerName: personNameSchema('owner name'),
  phone: phoneSchema,
  email: z.string().trim().email('Enter a valid email address.'),
  addressLine1: requiredAddressLineSchema,
  addressLine2: optionalAddressLineSchema,
  city: requiredCitySchema,
  postalCode: postalCodeSchema,
  currency: currencyCodeSchema,
  countryCode: countryCodeSchema,
  stateCode: regionCodeSchema,
  logoUri: z.string().nullable().optional(),
  authorizedPersonName: personNameSchema('authorized person name'),
  authorizedPersonTitle: personNameSchema('title or designation'),
  signatureUri: z.string().nullable().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type BusinessProfileSettingsProps = NativeStackScreenProps<
  RootStackParamList,
  'BusinessProfileSettings'
>;

const defaultValues: ProfileFormValues = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  currency: 'INR',
  countryCode: '',
  stateCode: '',
  logoUri: null,
  authorizedPersonName: '',
  authorizedPersonTitle: '',
  signatureUri: null,
};

const criticalProfileFields: Array<keyof ProfileFormValues> = [
  'businessName',
  'ownerName',
  'currency',
  'countryCode',
  'stateCode',
  'authorizedPersonName',
  'authorizedPersonTitle',
];

export function BusinessProfileSettingsScreen({ navigation }: BusinessProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingTimeout, setIsSavingTimeout] = useState(false);
  const [savedProfile, setSavedProfile] = useState<ProfileFormValues | null>(null);
  const [settingsSnapshot, setSettingsSnapshot] = useState<BusinessSettings | null>(null);
  const [pendingProfile, setPendingProfile] = useState<ProfileFormValues | null>(null);
  const [isProfilePinConfirmationVisible, setIsProfilePinConfirmationVisible] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [proBrandTheme, setProBrandTheme] = useState<ProBrandTheme | null>(null);
  const [isSavingProTheme, setIsSavingProTheme] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [isSavingFeatureToggles, setIsSavingFeatureToggles] = useState(false);
  const [isSeedingDevelopmentData, setIsSeedingDevelopmentData] = useState(false);
  const [countryPackage, setCountryPackage] = useState<CountryPackageWithComponents | null>(null);
  const [countryPackageUpdateStatus, setCountryPackageUpdateStatus] =
    useState<CountryPackageUpdateCheckResult | null>(null);
  const [isCheckingCountryPackageUpdate, setIsCheckingCountryPackageUpdate] = useState(false);
  const [isApplyingCountryPackageUpdate, setIsApplyingCountryPackageUpdate] = useState(false);
  const [countryPackageUpdateResult, setCountryPackageUpdateResult] =
    useState<CountryPackageUpdateResult | null>(null);
  const [countryPackageUpdateError, setCountryPackageUpdateError] = useState<string | null>(null);
  const [biometricCapability, setBiometricCapability] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isSavingBiometric, setIsSavingBiometric] = useState(false);
  const { pinEnabled, setPinInactivityTimeoutMs, timeoutMs } = useAppLock();
  const {
    control,
    formState: { errors, isSubmitting, isValid },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const values = watch();
  const regionOptions = getRegionOptions(values.countryCode);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [
          settings,
          subscription,
          activeProTheme,
          savedFeatureToggles,
          biometricCapabilityState,
          savedBiometricEnabled,
        ] = await Promise.all([
          getBusinessSettings(),
          getSubscriptionStatus(),
          getActiveProBrandTheme(),
          getFeatureToggles(),
          getBiometricCapability(),
          isBiometricUnlockEnabled(),
        ]);
        if (!settings) {
          navigation.replace('Setup');
          return;
        }

        const installedCountryPackage = await loadCountryPackageForSettings(settings);

        if (isMounted) {
          const address = parseAddress(settings.address);
          const loadedProfile: ProfileFormValues = {
            businessName: settings.businessName,
            ownerName: settings.ownerName,
            phone: settings.phone,
            email: settings.email,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            postalCode: address.postalCode ?? '',
            currency: settings.currency,
            countryCode: settings.countryCode,
            stateCode: settings.stateCode,
            logoUri: settings.logoUri,
            authorizedPersonName: settings.authorizedPersonName,
            authorizedPersonTitle: settings.authorizedPersonTitle,
            signatureUri: settings.signatureUri,
          };

          reset(loadedProfile);
          setSavedProfile(loadedProfile);
          setSettingsSnapshot(settings);
          setSubscriptionStatus(subscription);
          setProBrandTheme(activeProTheme);
          setFeatureToggles(savedFeatureToggles);
          setCountryPackage(installedCountryPackage);
          setBiometricCapability(biometricCapabilityState);
          setBiometricEnabled(savedBiometricEnabled);
        }
      } catch {
        Alert.alert('Business profile could not load', 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [navigation, reset]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void Promise.all([
        getBusinessSettings(),
        getSubscriptionStatus(),
        getActiveProBrandTheme(),
        getBiometricCapability(),
        isBiometricUnlockEnabled(),
      ])
        .then(([settings, subscription, activeProTheme, capability, savedBiometricEnabled]) => {
          setSettingsSnapshot(settings);
          setSubscriptionStatus(subscription);
          setProBrandTheme(activeProTheme);
          setBiometricCapability(capability);
          setBiometricEnabled(savedBiometricEnabled);
          if (settings) {
            const loadedProfile = businessSettingsToFormValues(settings);
            reset(loadedProfile);
            setSavedProfile(loadedProfile);
            void loadCountryPackageForSettings(settings)
              .then(setCountryPackage)
              .catch(() => setCountryPackage(null));
          }
        })
        .catch(() => undefined);
    });

    return unsubscribe;
  }, [navigation, reset]);

  async function onSubmit(input: ProfileFormValues) {
    const normalizedInput = normalizeProfileForSave(input);

    if (
      pinEnabled &&
      savedProfile &&
      hasCriticalProfileChange(savedProfile, normalizedInput)
    ) {
      Alert.alert(
        'Save important business changes?',
        'These details are used across your ledger and documents. Enter your PIN to continue.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: () => {
              setPendingProfile(normalizedInput);
              setIsProfilePinConfirmationVisible(true);
            },
          },
        ]
      );
      return;
    }

    await saveProfile(normalizedInput);
  }

  async function saveProfile(input: ProfileFormValues) {
    setIsSavingProfile(true);

    try {
      const saved = await saveBusinessSettings({
        ...input,
        address: composeAddress(input),
      });
      const savedFormValues = businessSettingsToFormValues(saved);
      setSavedProfile(savedFormValues);
      setSettingsSnapshot(saved);
      setCountryPackage(await loadCountryPackageForSettings(saved));
      setCountryPackageUpdateStatus(null);
      reset(savedFormValues);

      Alert.alert('Business profile saved', 'Your changes were saved on this device.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Business profile could not be saved', 'Please check the details and try again.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleTimeoutChange(nextTimeoutMs: number) {
    setIsSavingTimeout(true);

    try {
      await setPinInactivityTimeoutMs(nextTimeoutMs);
    } catch {
      Alert.alert('PIN setting could not be saved', 'Please try again.');
    } finally {
      setIsSavingTimeout(false);
    }
  }

  function confirmDisablePin() {
    Alert.alert(
      'Disable PIN?',
      'Orbit Ledger will stop asking for a PIN on this device after you enter your current PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => navigation.navigate('PinManagement', { mode: 'disable' }),
        },
      ]
    );
  }

  async function handleBiometricToggle() {
    if (!pinEnabled) {
      Alert.alert(
        'Enable PIN first',
        'Biometric unlock works as a faster way to unlock after a PIN is set.'
      );
      return;
    }

    setIsSavingBiometric(true);

    try {
      const capability = await getBiometricCapability();
      setBiometricCapability(capability);

      if (!biometricEnabled && !capability.isAvailable) {
        Alert.alert(
          'Biometric unlock is not ready',
          capability.unavailableReason ?? 'Set up biometric unlock in device settings first.'
        );
        return;
      }

      if (biometricEnabled) {
        await setBiometricUnlockEnabled(false);
        setBiometricEnabled(false);
        Alert.alert('Biometric unlock off', 'You can still unlock Orbit Ledger with your PIN.');
        return;
      }

      const verification = await authenticateWithBiometrics('Enable biometric unlock', {
        requireEnabled: false,
      });
      if (!verification.ok) {
        Alert.alert('Biometric unlock not enabled', verification.message);
        return;
      }

      await setBiometricUnlockEnabled(true);
      setBiometricEnabled(true);
      Alert.alert(
        'Biometric unlock enabled',
        'You can unlock Orbit Ledger faster with biometrics. Your PIN remains the fallback.'
      );
    } catch {
      Alert.alert('Biometric setting could not be saved', 'Please try again.');
    } finally {
      setIsSavingBiometric(false);
    }
  }

  async function shareOrbitLedger() {
    try {
      const result = await shareOrbitLedgerReferral();
      if (result.shared) {
        Alert.alert('Thanks for sharing', 'Orbit Ledger is ready to share with another business.');
      }
    } catch {
      Alert.alert('Share failed', 'Orbit Ledger could not be shared from this device right now.');
    }
  }

  function confirmSeedDevelopmentData() {
    if (!__DEV__) {
      return;
    }

    Alert.alert(
      'Seed demo data?',
      'This development-only action adds sample business data, customers, ledger entries, and a local tax profile only where demo data is missing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Demo Data',
          onPress: () => {
            void runSeedDevelopmentData();
          },
        },
      ]
    );
  }

  async function runSeedDevelopmentData() {
    if (!__DEV__ || isSeedingDevelopmentData) {
      return;
    }

    setIsSeedingDevelopmentData(true);

    try {
      await seedDevelopmentData();

      const [settings, subscription, activeProTheme, savedFeatureToggles] = await Promise.all([
        getBusinessSettings(),
        getSubscriptionStatus(),
        getActiveProBrandTheme(),
        getFeatureToggles(),
      ]);

      setSettingsSnapshot(settings);
      setSubscriptionStatus(subscription);
      setProBrandTheme(activeProTheme);
      setFeatureToggles(savedFeatureToggles);

      if (settings) {
        const loadedProfile = businessSettingsToFormValues(settings);
        reset(loadedProfile);
        setSavedProfile(loadedProfile);
        setCountryPackage(await loadCountryPackageForSettings(settings));
      }

      Alert.alert('Demo data ready', 'Development seed data is available on this device.');
    } catch (error) {
      console.warn('[development-seed] Demo data could not be seeded', error);
      Alert.alert('Demo data could not be seeded', 'Please check the development logs and try again.');
    } finally {
      setIsSeedingDevelopmentData(false);
    }
  }

  async function selectProBrandTheme(key: ProBrandThemeKey) {
    setIsSavingProTheme(true);

    try {
      const savedTheme = await saveActiveProBrandTheme(key);
      setProBrandTheme(savedTheme);
    } catch {
      Alert.alert('Theme could not be saved', 'Please try again.');
    } finally {
      setIsSavingProTheme(false);
    }
  }

  async function toggleModule(module: keyof AppFeatureToggles) {
    if (!featureToggles || isSavingFeatureToggles) {
      return;
    }

    const nextEnabled = !featureToggles[module];
    setFeatureToggles({ ...featureToggles, [module]: nextEnabled });
    setIsSavingFeatureToggles(true);

    try {
      const saved = await saveFeatureToggles({ [module]: nextEnabled });
      setFeatureToggles(saved);
    } catch {
      setFeatureToggles(featureToggles);
      Alert.alert('Module setting could not be saved', 'Please try again.');
    } finally {
      setIsSavingFeatureToggles(false);
    }
  }

  async function checkCountryPackageUpdates() {
    const settings = settingsSnapshot;
    if (!settings || isCheckingCountryPackageUpdate) {
      return;
    }

    setIsCheckingCountryPackageUpdate(true);

    try {
      setCountryPackageUpdateError(null);
      const result = await manualCheckCountryPackageUpdates({
        countryCode: settings.countryCode,
        regionCode: settings.stateCode,
      });
      setCountryPackageUpdateStatus(result);
      setCountryPackageUpdateResult(null);

      if (result.updateAvailable) {
        Alert.alert(
          'Country package update available',
          'An online business logic package can be downloaded, validated, and stored locally for offline use.',
          [
            { text: 'Not now' },
            {
              text: 'Apply',
              onPress: () => {
                if (result.candidate) {
                  void applyCountryPackageUpdate(result.candidate);
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert('Country package is up to date', result.message);
    } catch {
      setCountryPackageUpdateError(
        'Update check failed. Your current local country package was not changed.'
      );
      Alert.alert('Update check failed', 'Your current local country package was not changed.');
    } finally {
      setIsCheckingCountryPackageUpdate(false);
    }
  }

  async function applyCountryPackageUpdate(candidate: CountryPackageUpdateCandidate) {
    const settings = settingsSnapshot;
    if (!settings || isApplyingCountryPackageUpdate) {
      return;
    }

    setIsApplyingCountryPackageUpdate(true);

    try {
      setCountryPackageUpdateError(null);
      const result = await applyCountryPackageUpdateFromProvider(
        {
          countryCode: settings.countryCode,
          regionCode: settings.stateCode,
        },
        candidate
      );
      setCountryPackageUpdateResult(result);

      if (result.status === 'installed' && result.countryPackage) {
        setCountryPackage(result.countryPackage);
        const savedSettings = await saveBusinessSettings({
          ...settings,
          taxMode: 'manual',
          taxProfileVersion: result.countryPackage.taxPack.version,
          taxProfileSource: 'remote',
          taxLastSyncedAt: result.countryPackage.taxPack.lastUpdated,
          taxSetupRequired: false,
        });
        setSettingsSnapshot(savedSettings);
        setCountryPackageUpdateStatus(null);
        Alert.alert('Country package applied', result.message);
        return;
      }

      setCountryPackage(result.countryPackage);
      Alert.alert('Country package not applied', result.message);
    } catch {
      setCountryPackageUpdateError(
        'Country package could not be applied. Your current local country package was not changed.'
      );
      Alert.alert(
        'Country package could not be applied',
        'Your current local country package was not changed.'
      );
    } finally {
      setIsApplyingCountryPackageUpdate(false);
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
            title="Business Profile"
            subtitle="Edit the business identity used across Orbit Ledger."
            backLabel="Back"
            onBack={() => navigation.goBack()}
          />

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Business Details</Text>
            <Controller
              control={control}
              name="businessName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Business name"
                  placeholder="Rudraix Trading Co."
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.businessName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="ownerName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Owner name"
                  placeholder="Full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.ownerName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Phone"
                  keyboardType="phone-pad"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={value}
                  onChangeText={(text) => onChange(normalizeDigitsAndPhoneSymbols(text))}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="billing@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />
            <View style={styles.addressSection}>
              <Text style={styles.subsectionTitle}>Business address</Text>
              <Controller
                control={control}
                name="addressLine1"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField
                    label="Address line 1"
                    placeholder="Shop number, building, street"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.addressLine1?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="addressLine2"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField
                    label="Address line 2"
                    placeholder="Area or landmark"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.addressLine2?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField
                    label="City"
                    placeholder="Ahmedabad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.city?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="postalCode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextField
                    label="Postal code"
                    placeholder="380001"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.postalCode?.message}
                  />
                )}
              />
            </View>
            <Controller
              control={control}
              name="currency"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Currency"
                  autoCapitalize="characters"
                  maxLength={3}
                  placeholder="INR"
                  value={value}
                  onChangeText={(text) => onChange(text.toUpperCase())}
                  onBlur={onBlur}
                  error={errors.currency?.message}
                  helperText="Used for customer balances and transactions."
                />
              )}
            />
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Country and Region</Text>
            <View style={styles.currentRegion}>
              <Text style={styles.regionLabel}>Current values</Text>
              <Text style={styles.regionValue}>
                {values.countryCode || 'Country not set'} / {values.stateCode || 'Region not set'}
              </Text>
            </View>
            <Controller
              control={control}
              name="countryCode"
              render={({ field: { onChange, value } }) => (
                <SelectField
                  label="Country"
                  value={value}
                  options={COUNTRY_OPTIONS.map((country) => ({
                    label: country.name,
                    value: country.code,
                    description: `${country.code} - ${country.currency}`,
                  }))}
                  onChange={(countryCode) => {
                    const selectedCountry = COUNTRY_OPTIONS.find((country) => country.code === countryCode);
                    onChange(countryCode);
                    setValue('stateCode', getDefaultRegionCode(countryCode), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (selectedCountry) {
                      setValue('currency', selectedCountry.currency, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  error={errors.countryCode?.message}
                  helperText="Used for tax packs, reports, and documents."
                />
              )}
            />
            <Controller
              control={control}
              name="stateCode"
              render={({ field: { onChange, value } }) => (
                <SelectField
                  label="State or region"
                  value={value}
                  options={regionOptions.map((region) => ({
                    label: region.name,
                    value: region.code,
                    description: region.code,
                  }))}
                  onChange={onChange}
                  error={errors.stateCode?.message}
                />
              )}
            />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Tax packs and country packages can be downloaded, validated, and stored for offline
              use. Your last valid installed package remains active if an update fails.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.countryPackageHeader}>
              <View style={styles.countryPackageHeaderText}>
                <Text style={styles.sectionTitle}>Country Management</Text>
                <Text style={styles.countryPackageText}>
                  Country packages keep tax rules, document templates, and compliance settings
                  together for the selected region.
                </Text>
              </View>
              <View style={countryPackage ? styles.statusPillEnabled : styles.statusPill}>
                <Text
                  style={
                    countryPackage ? styles.statusPillTextEnabled : styles.statusPillText
                  }
                >
                  {countryPackage ? 'Installed' : 'Not set'}
                </Text>
              </View>
            </View>

            <View style={styles.countryPackageSummary}>
              <SettingsInfoRow
                label="Country / region"
                value={`${values.countryCode || 'Country not set'} / ${
                  values.stateCode || 'Region not set'
                }`}
              />
              <SettingsInfoRow
                label="Package"
                value={
                  countryPackage
                    ? `${countryPackage.packageName} v${countryPackage.version}`
                    : 'No country package installed'
                }
              />
              <SettingsInfoRow
                label="Tax pack status"
                value={
                  countryPackage
                    ? `${countryPackage.taxPack.taxType} v${countryPackage.taxPack.version}`
                    : settingsSnapshot?.taxMode === 'manual'
                      ? `Manual profile ${settingsSnapshot.taxProfileVersion ?? 'saved'}`
                      : 'No active tax pack'
                }
              />
              <SettingsInfoRow
                label="Template version"
                value={formatTemplateVersions(countryPackage)}
              />
              <SettingsInfoRow
                label="Compliance config"
                value={
                  countryPackage
                    ? `v${countryPackage.complianceConfig.version}`
                    : 'Default local rules'
                }
              />
              <SettingsInfoRow
                label="Update status"
                value={formatCountryPackageUpdateStatus(countryPackageUpdateStatus)}
              />
              <SettingsInfoRow
                label="Last checked"
                value={formatOptionalCountryPackageDate(countryPackageUpdateStatus?.checkedAt)}
              />
              <SettingsInfoRow
                label="Latest online version"
                value={countryPackageUpdateStatus?.latestVersion ?? 'Not checked yet'}
              />
              <SettingsInfoRow
                label="Last updated"
                value={
                  countryPackage
                    ? formatShortDateTime(countryPackage.taxPack.lastUpdated)
                    : 'Not available'
                }
              />
            </View>

            {countryPackageUpdateResult ? (
              <View
                style={
                  countryPackageUpdateResult.status === 'installed'
                    ? styles.countryPackageStatusSuccess
                    : styles.countryPackageStatusWarning
                }
              >
                <Text style={styles.countryPackageStatusText}>
                  {countryPackageUpdateResult.message}
                </Text>
              </View>
            ) : null}
            {countryPackageUpdateError ? (
              <View style={styles.countryPackageStatusWarning}>
                <Text style={styles.countryPackageStatusText}>{countryPackageUpdateError}</Text>
              </View>
            ) : null}
            <Text style={styles.countryPackageFootnote}>
              Country packages are validated, installed locally, and remain available offline after
              they are applied.
            </Text>
            <PrimaryButton
              variant="secondary"
              onPress={() => navigation.navigate('CountryPackageStore')}
            >
              Open Country Store
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              disabled={
                !settingsSnapshot || isCheckingCountryPackageUpdate || isApplyingCountryPackageUpdate
              }
              loading={isCheckingCountryPackageUpdate}
              onPress={() => void checkCountryPackageUpdates()}
            >
              Check Online Package
            </PrimaryButton>
            {countryPackageUpdateStatus?.updateAvailable && countryPackageUpdateStatus.candidate ? (
              <PrimaryButton
                disabled={
                  !settingsSnapshot ||
                  isCheckingCountryPackageUpdate ||
                  isApplyingCountryPackageUpdate
                }
                loading={isApplyingCountryPackageUpdate}
                onPress={() =>
                  void applyCountryPackageUpdate(countryPackageUpdateStatus.candidate!)
                }
              >
                Apply Package v{countryPackageUpdateStatus.latestVersion}
              </PrimaryButton>
            ) : null}
          </View>

          <View style={styles.formCard}>
            <View style={styles.moduleHeader}>
              <View style={styles.moduleHeaderText}>
                <Text style={styles.sectionTitle}>Modules</Text>
                <Text style={styles.moduleText}>
                  Keep Orbit Ledger focused by showing only the tools your business uses.
                </Text>
              </View>
            </View>
            <View style={styles.moduleList}>
              <ModuleToggleRow
                description="Create simple invoices and include sales in reports."
                disabled={!featureToggles || isSavingFeatureToggles}
                enabled={featureToggles?.invoices ?? true}
                label="Invoices"
                onPress={() => void toggleModule('invoices')}
              />
              <ModuleToggleRow
                description="Use saved products while creating invoices."
                disabled={!featureToggles || isSavingFeatureToggles || !featureToggles.invoices}
                enabled={(featureToggles?.inventory ?? true) && (featureToggles?.invoices ?? true)}
                label="Inventory"
                onPress={() => void toggleModule('inventory')}
              />
              <ModuleToggleRow
                description="Show tax setup and local manual tax profiles."
                disabled={!featureToggles || isSavingFeatureToggles}
                enabled={featureToggles?.tax ?? true}
                label="Tax"
                onPress={() => void toggleModule('tax')}
              />
            </View>
            {!featureToggles?.invoices ? (
              <Text style={styles.moduleFootnote}>
                Inventory is hidden while invoices are off because products are used during invoice entry.
              </Text>
            ) : null}
          </View>

          {featureToggles?.tax ? (
            <View style={styles.formCard}>
              <View style={styles.taxHeader}>
                <View style={styles.taxHeaderText}>
                  <Text style={styles.sectionTitle}>Tax Setup</Text>
                  <Text style={styles.taxText}>
                    Tax is optional. You can check online tax packs, validate them, and store them
                    locally for offline invoices and reports.
                  </Text>
                </View>
                <View
                  style={
                    settingsSnapshot?.taxMode === 'manual'
                      ? styles.statusPillEnabled
                      : styles.statusPill
                  }
                >
                  <Text
                    style={
                      settingsSnapshot?.taxMode === 'manual'
                        ? styles.statusPillTextEnabled
                        : styles.statusPillText
                    }
                  >
                    {settingsSnapshot?.taxMode === 'manual' ? 'Manual' : 'Off'}
                  </Text>
                </View>
              </View>
              <View style={styles.taxInfoBox}>
                <Text style={styles.taxInfoTitle}>
                  {settingsSnapshot?.taxMode === 'manual'
                    ? 'Manual tax profile saved locally'
                    : 'One-time setup can be done later'}
                </Text>
                <Text style={styles.taxInfoText}>
                  {settingsSnapshot?.taxMode === 'manual'
                    ? `Profile version ${settingsSnapshot.taxProfileVersion ?? 'manual'} is saved on this device.`
                    : 'Manual entry and online tax pack checks are available now and do not block app usage.'}
                </Text>
              </View>
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('TaxSetup')}>
                {settingsSnapshot?.taxMode === 'manual' ? 'Edit Tax Setup' : 'Enable Tax'}
              </PrimaryButton>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Logo and Signature</Text>
            <ImagePickerField
              label="Company logo"
              helperText="Replace or remove the logo used in future documents."
              value={values.logoUri}
              fallbackLabel="Logo"
              assetName="logo"
              onChange={(uri) =>
                setValue('logoUri', uri, { shouldDirty: true, shouldValidate: true })
              }
              onError={(message) => Alert.alert('Image selection', message)}
            />
            <Controller
              control={control}
              name="authorizedPersonName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Authorized person full name"
                  placeholder="Full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.authorizedPersonName?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="authorizedPersonTitle"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Authorized person title"
                  placeholder="Owner, Manager, Partner"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.authorizedPersonTitle?.message}
                />
              )}
            />
            <ImagePickerField
              label="Signature image"
              helperText="Replace or remove the authorized signature image."
              value={values.signatureUri}
              fallbackLabel="Signature"
              assetName="signature"
              onChange={(uri) =>
                setValue('signatureUri', uri, { shouldDirty: true, shouldValidate: true })
              }
              onError={(message) => Alert.alert('Image selection', message)}
            />
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <IdentityPreviewCard
              businessName={values.businessName}
              ownerName={values.ownerName}
              address={composeAddress(values)}
              phone={values.phone}
              email={values.email}
              logoUri={values.logoUri}
              authorizedPersonName={values.authorizedPersonName}
              authorizedPersonTitle={values.authorizedPersonTitle}
              signatureUri={values.signatureUri}
            />
          </View>

          <View style={styles.formCard}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderText}>
                <Text style={styles.sectionTitle}>Plan</Text>
                <Text style={styles.planText}>
                  Orbit Ledger keeps daily ledger work available on the Free plan. Pro adds branded
                  document polish without changing core ledger access.
                </Text>
              </View>
              <View
                style={
                  subscriptionStatus?.isPro ? styles.statusPillEnabled : styles.statusPill
                }
              >
                <Text
                  style={
                    subscriptionStatus?.isPro
                      ? styles.statusPillTextEnabled
                      : styles.statusPillText
                  }
                >
                  {subscriptionStatus?.tierLabel ?? 'Free'}
                </Text>
              </View>
            </View>
            <View style={styles.planIncludedBox}>
              <Text style={styles.planIncludedTitle}>Included now</Text>
              <Text style={styles.planIncludedText}>
                Customers, transactions, PDF statements, backup and restore, and PIN protection
                remain available for Free users.
              </Text>
            </View>
            {subscriptionStatus?.isPro ? (
              <View style={styles.proIdentityBox}>
                <Text style={styles.proIdentityLabel}>Pro identity</Text>
                <Text style={styles.proIdentityText}>
                  Choose a restrained theme for statement previews and branded PDFs.
                </Text>
                <View style={styles.proThemeOptions}>
                  {Object.values(PRO_BRAND_THEMES).map((theme) => {
                    const isSelected = proBrandTheme?.key === theme.key;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSavingProTheme}
                        hitSlop={touch.hitSlop}
                        key={theme.key}
                        onPress={() => selectProBrandTheme(theme.key)}
                        pressRetentionOffset={touch.pressRetentionOffset}
                        style={({ pressed }) => [
                          styles.proThemeOption,
                          {
                            borderColor: isSelected ? theme.accentColor : colors.border,
                          },
                          isSelected ? { backgroundColor: theme.surfaceColor } : null,
                          pressed && !isSavingProTheme ? styles.proThemeOptionPressed : null,
                          isSavingProTheme ? styles.proThemeOptionDisabled : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.proThemeSwatch,
                            { backgroundColor: theme.accentColor },
                          ]}
                        />
                        <View style={styles.proThemeCopy}>
                          <Text
                            style={[
                              styles.proThemeName,
                              isSelected ? { color: theme.accentColor } : null,
                            ]}
                          >
                            {theme.label}
                          </Text>
                          <Text style={styles.proThemeDescription}>{theme.description}</Text>
                        </View>
                        {isSelected ? (
                          <Text style={[styles.proThemeSelected, { color: theme.accentColor }]}>
                            Active
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <Text style={styles.planFootnote}>
              No current core ledger action is blocked by plan status.
            </Text>
            <PrimaryButton variant="secondary" onPress={() => navigation.navigate('Upgrade')}>
              View Pro Benefits
            </PrimaryButton>
            <PrimaryButton variant="secondary" onPress={() => void shareOrbitLedger()}>
              Share Orbit Ledger
            </PrimaryButton>
            <PrimaryButton variant="ghost" onPress={() => navigation.navigate('Feedback')}>
              Send Feedback
            </PrimaryButton>
          </View>

          <View style={styles.formCard}>
            <View style={styles.helperSettingsHeader}>
              <View style={styles.helperSettingsText}>
                <Text style={styles.sectionTitle}>Orbit Helper</Text>
                <Text style={styles.helperSettingsCopy}>
                  Offline help for payments, invoices, backups, tax packs, country packages,
                  and PIN protection. It stays quiet unless you open it.
                </Text>
              </View>
              <OrbitHelperStatus label="Online" compact />
            </View>
            <PrimaryButton
              variant="secondary"
              onPress={() =>
                navigation.navigate('OrbitHelper', { screenContext: 'BusinessProfileSettings' })
              }
            >
              Ask Orbit Helper
            </PrimaryButton>
          </View>

          <View style={styles.formCard}>
            <View style={styles.securityHeader}>
              <View style={styles.securityHeaderText}>
                <Text style={styles.sectionTitle}>PIN Protection</Text>
                <Text style={styles.securityText}>
                  Protect your ledger with a 4-digit PIN. Orbit Ledger asks for it when you open
                  the app and after inactivity.
                </Text>
              </View>
              <View style={pinEnabled ? styles.statusPillEnabled : styles.statusPill}>
                <Text style={pinEnabled ? styles.statusPillTextEnabled : styles.statusPillText}>
                  {pinEnabled ? 'Active' : 'Off'}
                </Text>
              </View>
            </View>

            <View style={styles.timeoutGroup}>
              <Text style={styles.timeoutLabel}>Ask for PIN after inactivity</Text>
              <View style={styles.timeoutOptions}>
                {PIN_INACTIVITY_TIMEOUT_OPTIONS.map((option) => {
                  const isSelected = option.value === timeoutMs;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isSavingTimeout}
                      hitSlop={touch.hitSlop}
                      key={option.value}
                      onPress={() => handleTimeoutChange(option.value)}
                      pressRetentionOffset={touch.pressRetentionOffset}
                      style={({ pressed }) => [
                        styles.timeoutOption,
                        isSelected ? styles.timeoutOptionSelected : null,
                        pressed && !isSavingTimeout ? styles.timeoutOptionPressed : null,
                        isSavingTimeout ? styles.timeoutOptionDisabled : null,
                      ]}
                    >
                      <Text
                        style={
                          isSelected
                            ? styles.timeoutOptionTextSelected
                            : styles.timeoutOptionText
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {pinEnabled ? (
              <View style={styles.securityActions}>
                <PrimaryButton
                  variant="secondary"
                  onPress={() => navigation.navigate('PinManagement', { mode: 'change' })}
                >
                  Change PIN
                </PrimaryButton>
                <PrimaryButton
                  variant="ghost"
                  onPress={confirmDisablePin}
                >
                  Disable PIN
                </PrimaryButton>
              </View>
            ) : (
              <PrimaryButton
                variant="secondary"
                onPress={() => navigation.navigate('PinManagement', { mode: 'enable' })}
              >
                Enable PIN
              </PrimaryButton>
            )}

            <View style={styles.biometricPanel}>
              <View style={styles.biometricPanelHeader}>
                <View style={styles.biometricPanelText}>
                  <Text style={styles.biometricTitle}>Face ID / fingerprint unlock</Text>
                  <Text style={styles.biometricDescription}>
                    Unlock faster with biometrics when this device supports it. Your biometric data
                    stays on this device, and your PIN always remains the fallback.
                  </Text>
                </View>
                <View
                  style={
                    biometricEnabled && pinEnabled
                      ? styles.statusPillEnabled
                      : styles.statusPill
                  }
                >
                  <Text
                    style={
                      biometricEnabled && pinEnabled
                        ? styles.statusPillTextEnabled
                        : styles.statusPillText
                    }
                  >
                    {biometricEnabled && pinEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
              <Text style={styles.biometricMeta}>
                {pinEnabled
                  ? biometricCapability?.isAvailable
                    ? `${biometricCapability.label} is available on this device.`
                    : biometricCapability?.unavailableReason ??
                      'Biometric unlock could not be checked on this device.'
                  : 'Enable PIN protection first to use biometric unlock.'}
              </Text>
              <PrimaryButton
                disabled={isSavingBiometric || !pinEnabled}
                loading={isSavingBiometric}
                onPress={() => void handleBiometricToggle()}
                variant={biometricEnabled ? 'ghost' : 'secondary'}
              >
                {biometricEnabled ? 'Turn Off Biometric Unlock' : 'Enable Biometric Unlock'}
              </PrimaryButton>
            </View>
          </View>

          {__DEV__ ? (
            <View style={styles.developmentCard}>
              <Text style={styles.developmentLabel}>Development only</Text>
              <Text style={styles.sectionTitle}>Demo seed data</Text>
              <Text style={styles.developmentText}>
                Add sample customers, ledger entries, a demo business profile, and a local tax
                profile for emulator testing. This section is hidden in production builds.
              </Text>
              <PrimaryButton
                variant="secondary"
                loading={isSeedingDevelopmentData}
                disabled={isLoading || isSavingProfile}
                onPress={confirmSeedDevelopmentData}
              >
                Seed Demo Data
              </PrimaryButton>
            </View>
          ) : null}

          <PrimaryButton
            disabled={isLoading || isSavingProfile}
            loading={isSubmitting || isSavingProfile}
            onPress={handleSubmit(onSubmit)}
          >
            Save business profile
          </PrimaryButton>

          <PinConfirmationModal
            visible={isProfilePinConfirmationVisible}
            title="Confirm business changes"
            message="Enter your PIN to save these business profile changes. These details are used across your ledger and documents."
            onCancel={() => {
              setIsProfilePinConfirmationVisible(false);
              setPendingProfile(null);
            }}
            onConfirmed={() => {
              const profileToSave = pendingProfile;
              setIsProfilePinConfirmationVisible(false);
              setPendingProfile(null);

              if (profileToSave) {
                void saveProfile(profileToSave);
              }
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavigation
        active="settings"
        onCustomers={() => navigation.navigate('Customers')}
        onDashboard={() => navigation.navigate('Dashboard')}
        onSettings={() => navigation.navigate('BusinessProfileSettings')}
      />
    </SafeAreaView>
  );
}

function normalizeProfileForSave(input: ProfileFormValues): ProfileFormValues {
  return {
    ...input,
    businessName: input.businessName.trim(),
    ownerName: input.ownerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2?.trim() ?? '',
    city: input.city.trim(),
    postalCode: input.postalCode.trim(),
    currency: input.currency.trim().toUpperCase(),
    countryCode: input.countryCode.trim().toUpperCase(),
    stateCode: input.stateCode.trim().toUpperCase(),
    logoUri: input.logoUri ?? null,
    authorizedPersonName: input.authorizedPersonName.trim(),
    authorizedPersonTitle: input.authorizedPersonTitle.trim(),
    signatureUri: input.signatureUri ?? null,
  };
}

function businessSettingsToFormValues(settings: BusinessSettings): ProfileFormValues {
  const address = parseAddress(settings.address);
  return {
    businessName: settings.businessName,
    ownerName: settings.ownerName,
    phone: settings.phone,
    email: settings.email,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    postalCode: address.postalCode ?? '',
    currency: settings.currency,
    countryCode: settings.countryCode,
    stateCode: settings.stateCode,
    logoUri: settings.logoUri,
    authorizedPersonName: settings.authorizedPersonName,
    authorizedPersonTitle: settings.authorizedPersonTitle,
    signatureUri: settings.signatureUri,
  };
}

function hasCriticalProfileChange(
  previousProfile: ProfileFormValues,
  nextProfile: ProfileFormValues
): boolean {
  const previous = normalizeProfileForSave(previousProfile);
  const next = normalizeProfileForSave(nextProfile);

  return criticalProfileFields.some((field) => previous[field] !== next[field]);
}

async function loadCountryPackageForSettings(
  settings: BusinessSettings
): Promise<CountryPackageWithComponents | null> {
  return loadInstalledCountryPackage({
    countryCode: settings.countryCode,
    regionCode: settings.stateCode,
  });
}

function formatTemplateVersions(countryPackage: CountryPackageWithComponents | null): string {
  if (!countryPackage?.templates.length) {
    return 'Default templates';
  }

  return countryPackage.templates
    .map((template) => `${formatTemplateType(template.templateType)} v${template.version}`)
    .join(', ');
}

function formatTemplateType(templateType: string): string {
  return templateType === 'invoice' ? 'Invoice' : 'Statement';
}

function formatCountryPackageUpdateStatus(
  status: CountryPackageUpdateCheckResult | null
): string {
  if (!status) {
    return 'Not checked yet';
  }

  if (status.updateAvailable) {
    const componentLabels = [
      status.componentUpdates.taxPack ? 'tax pack' : null,
      status.componentUpdates.complianceConfig ? 'compliance rules' : null,
      ...Object.entries(status.componentUpdates.templates)
        .filter(([, hasUpdate]) => hasUpdate)
        .map(([templateType]) => `${formatTemplateType(templateType)} template`),
    ].filter((label): label is string => Boolean(label));

    return componentLabels.length
      ? `Update available for ${componentLabels.join(', ')}`
      : 'Update available';
  }

  return `Checked ${formatShortDateTime(status.checkedAt)}. No update available.`;
}

function formatOptionalCountryPackageDate(value: string | null | undefined): string {
  return value ? formatShortDateTime(value) : 'Not checked yet';
}

function formatShortDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function SettingsInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingsInfoRow}>
      <Text style={styles.settingsInfoLabel}>{label}</Text>
      <Text style={styles.settingsInfoValue}>{value}</Text>
    </View>
  );
}

function ModuleToggleRow({
  description,
  disabled,
  enabled,
  label,
  onPress,
}: {
  description: string;
  disabled: boolean;
  enabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [
        styles.moduleRow,
        pressed && !disabled ? styles.moduleRowPressed : null,
        disabled ? styles.moduleRowDisabled : null,
      ]}
    >
      <View style={styles.moduleRowText}>
        <Text style={styles.moduleRowTitle}>{label}</Text>
        <Text style={styles.moduleRowDescription}>{description}</Text>
      </View>
      <View style={enabled ? styles.statusPillEnabled : styles.statusPill}>
        <Text style={enabled ? styles.statusPillTextEnabled : styles.statusPillText}>
          {enabled ? 'Active' : 'Off'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 112,
    gap: spacing.lg,
  },
  formCard: {
    ...shadows.card,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  addressSection: {
    gap: spacing.md,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  currentRegion: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs,
  },
  regionLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  regionValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  notice: {
    ...shadows.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
    padding: spacing.lg,
  },
  noticeText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  countryPackageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  countryPackageHeaderText: {
    flex: 1,
    gap: spacing.sm,
  },
  countryPackageText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  countryPackageSummary: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
  },
  settingsInfoRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  settingsInfoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  settingsInfoValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  countryPackageFootnote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  countryPackageStatusSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  countryPackageStatusWarning: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  countryPackageStatusText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  previewSection: {
    gap: spacing.md,
  },
  planHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  planHeaderText: {
    flex: 1,
    gap: spacing.sm,
  },
  planText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  planIncludedBox: {
    ...shadows.card,
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  planIncludedTitle: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  planIncludedText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  proIdentityBox: {
    ...shadows.card,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  proIdentityLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  proIdentityText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  proThemeOptions: {
    gap: spacing.sm,
  },
  proThemeOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  proThemeOptionPressed: {
    opacity: 0.82,
  },
  proThemeOptionDisabled: {
    opacity: 0.55,
  },
  proThemeSwatch: {
    borderRadius: 8,
    height: 36,
    width: 36,
  },
  proThemeCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  proThemeName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  proThemeDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  proThemeSelected: {
    fontSize: typography.caption,
    fontWeight: '900',
  },
  planFootnote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  helperSettingsHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  helperSettingsText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  helperSettingsCopy: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  developmentCard: {
    ...shadows.card,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  developmentLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  developmentText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  securityHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  securityHeaderText: {
    flex: 1,
    gap: spacing.sm,
  },
  securityText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  taxHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  taxHeaderText: {
    flex: 1,
    gap: spacing.sm,
  },
  taxText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  taxInfoBox: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  taxInfoTitle: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  taxInfoText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  moduleHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  moduleHeaderText: {
    flex: 1,
    gap: spacing.sm,
  },
  moduleText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  moduleList: {
    gap: spacing.sm,
  },
  moduleRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 72,
    padding: spacing.md,
  },
  moduleRowPressed: {
    opacity: 0.82,
  },
  moduleRowDisabled: {
    opacity: 0.58,
  },
  moduleRowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  moduleRowTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  moduleRowDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  moduleFootnote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  securityActions: {
    gap: spacing.md,
  },
  biometricPanel: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  biometricPanelHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  biometricPanelText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  biometricTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  biometricDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  biometricMeta: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  timeoutGroup: {
    gap: spacing.sm,
  },
  timeoutLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  timeoutOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeoutOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 76,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeoutOptionSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  timeoutOptionPressed: {
    opacity: 0.82,
  },
  timeoutOptionDisabled: {
    opacity: 0.55,
  },
  timeoutOptionText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  timeoutOptionTextSelected: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  statusPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  statusPillEnabled: {
    backgroundColor: colors.successSurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  statusPillText: {
    color: colors.textMuted,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  statusPillTextEnabled: {
    color: colors.success,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
});
