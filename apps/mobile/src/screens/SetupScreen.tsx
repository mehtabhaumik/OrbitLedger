import { zodResolver } from '@hookform/resolvers/zod';
import { canBootstrapWorkspaceLocally, getBusinessModeDescription } from '@orbit-ledger/core';
import type { OrbitBusinessStorageMode, OrbitCloudUser, OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
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

import {
  createCloudWorkspace,
  getCurrentCloudUser,
  listCloudWorkspacesForUser,
  type WorkspaceProfileDraft,
} from '../cloud';
import { Card } from '../components/Card';
import { IdentityPreviewCard } from '../components/IdentityPreviewCard';
import { ImagePickerField } from '../components/ImagePickerField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SelectField } from '../components/SelectField';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { COUNTRY_OPTIONS, getDefaultRegionCode, getRegionOptions } from '../data/regions';
import { getBusinessSettings, saveBusinessSettings } from '../database';
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
import type { RootStackParamList } from '../navigation/types';
import { runWorkspaceSync } from '../sync';
import { brand } from '../theme/brand';
import { colors, shadows, spacing, typography } from '../theme/theme';

const setupSchema = z.object({
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

type SetupFormValues = z.infer<typeof setupSchema>;
type SetupScreenProps = NativeStackScreenProps<RootStackParamList, 'Setup'>;

const defaultValues: SetupFormValues = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: null,
  authorizedPersonName: '',
  authorizedPersonTitle: '',
  signatureUri: null,
};

const NEW_SYNCED_WORKSPACE_VALUE = '__new__';

export function SetupScreen({ navigation }: SetupScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<OrbitBusinessStorageMode>('local_only');
  const [cloudUser, setCloudUser] = useState<OrbitCloudUser | null>(null);
  const [cloudWorkspaces, setCloudWorkspaces] = useState<OrbitWorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(NEW_SYNCED_WORKSPACE_VALUE);
  const [isLoadingCloudWorkspaces, setIsLoadingCloudWorkspaces] = useState(false);
  const {
    control,
    formState: { errors, isSubmitted, isSubmitting, touchedFields },
    handleSubmit,
    reset,
    setValue,
    watch,
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const values = watch();
  const setupValidationMessages = getSetupValidationMessages(values);
  const isSetupComplete = setupValidationMessages.length === 0;
  const regionOptions = getRegionOptions(values.countryCode);
  const eligibleWorkspaces = useMemo(
    () => cloudWorkspaces.filter((workspace) => canBootstrapWorkspaceLocally(workspace.dataState)),
    [cloudWorkspaces]
  );
  const selectedExistingWorkspace =
    selectedWorkspaceId !== NEW_SYNCED_WORKSPACE_VALUE
      ? eligibleWorkspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? null
      : null;

  useEffect(() => {
    let isMounted = true;

    async function loadSetupState() {
      try {
        const [settings, signedInUser] = await Promise.all([
          getBusinessSettings(),
          Promise.resolve(getCurrentCloudUser()),
        ]);

        if (settings && isMounted) {
          const address = parseAddress(settings.address);
          reset({
            businessName: settings.businessName,
            ownerName: settings.ownerName,
            phone: settings.phone,
            email: settings.email,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            postalCode: address.postalCode,
            currency: settings.currency,
            countryCode: settings.countryCode,
            stateCode: settings.stateCode,
            logoUri: settings.logoUri,
            authorizedPersonName: settings.authorizedPersonName,
            authorizedPersonTitle: settings.authorizedPersonTitle,
            signatureUri: settings.signatureUri,
          });
          setStorageMode(settings.storageMode);
          setSelectedWorkspaceId(settings.workspaceId ?? NEW_SYNCED_WORKSPACE_VALUE);
        }

        if (isMounted) {
          setCloudUser(signedInUser);
        }

        if (signedInUser && isMounted) {
          await loadCloudWorkspaces(signedInUser.uid);
        }
      } catch {
        Alert.alert('Setup could not load', 'Please try again.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSetupState();

    const unsubscribe = navigation.addListener('focus', () => {
      const signedInUser = getCurrentCloudUser();
      setCloudUser(signedInUser);
      if (signedInUser) {
        void loadCloudWorkspaces(signedInUser.uid);
      } else {
        setCloudWorkspaces([]);
        setSelectedWorkspaceId(NEW_SYNCED_WORKSPACE_VALUE);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigation, reset]);

  async function loadCloudWorkspaces(userId: string) {
    setIsLoadingCloudWorkspaces(true);
    try {
      const workspaces = await listCloudWorkspacesForUser(userId);
      setCloudWorkspaces(workspaces);
      setSelectedWorkspaceId((current) => {
        if (current !== NEW_SYNCED_WORKSPACE_VALUE && workspaces.some((item) => item.workspaceId === current)) {
          return current;
        }
        return NEW_SYNCED_WORKSPACE_VALUE;
      });
    } catch (error) {
      console.warn('[cloud-workspaces] Workspace list could not load', error);
      Alert.alert(
        'Cloud workspace list could not load',
        'Your local setup is still safe. Check your connection and try again.'
      );
    } finally {
      setIsLoadingCloudWorkspaces(false);
    }
  }

  function applyWorkspaceToForm(workspace: OrbitWorkspaceSummary) {
    const parsed = parseAddress(workspace.address);
    reset({
      businessName: workspace.businessName,
      ownerName: workspace.ownerName,
      phone: workspace.phone,
      email: workspace.email,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2,
      city: parsed.city,
      postalCode: parsed.postalCode,
      currency: workspace.currency,
      countryCode: workspace.countryCode,
      stateCode: workspace.stateCode || getDefaultRegionCode(workspace.countryCode),
      logoUri: workspace.logoUri,
      authorizedPersonName: workspace.authorizedPersonName,
      authorizedPersonTitle: workspace.authorizedPersonTitle,
      signatureUri: workspace.signatureUri,
    });
  }

  function handleWorkspaceSelection(nextValue: string) {
    setSelectedWorkspaceId(nextValue);
    if (nextValue === NEW_SYNCED_WORKSPACE_VALUE) {
      return;
    }

    const workspace = eligibleWorkspaces.find((entry) => entry.workspaceId === nextValue);
    if (workspace) {
      applyWorkspaceToForm(workspace);
    }
  }

  async function onSubmit(input: SetupFormValues) {
    const profileDraft = toWorkspaceProfileDraft(input);

    if (storageMode === 'local_only') {
      await saveBusinessSettings({
        ...profileDraft,
        storageMode: 'local_only',
        workspaceId: null,
        syncEnabled: false,
        lastSyncedAt: null,
        taxSetupRequired: true,
        taxProfileSource: 'none',
        taxMode: 'not_configured',
      });
      navigation.replace('Dashboard');
      return;
    }

    if (!cloudUser) {
      Alert.alert('Sign in required', 'Sign in first to continue with a synced workspace.');
      return;
    }

    if (selectedExistingWorkspace) {
      await saveBusinessSettings({
        ...profileDraft,
        storageMode: 'synced',
        workspaceId: selectedExistingWorkspace.workspaceId,
        syncEnabled: true,
        lastSyncedAt: selectedExistingWorkspace.updatedAt,
        serverRevision: selectedExistingWorkspace.serverRevision,
        taxSetupRequired: true,
        taxProfileSource: 'none',
        taxMode: 'not_configured',
      });
      await runWorkspaceSync();
      navigation.replace('Dashboard');
      return;
    }

    const workspace = await createCloudWorkspace(cloudUser, profileDraft);
    await saveBusinessSettings({
      ...profileDraft,
      storageMode: 'synced',
      workspaceId: workspace.workspaceId,
      syncEnabled: true,
      lastSyncedAt: workspace.updatedAt,
      serverRevision: workspace.serverRevision,
      taxSetupRequired: true,
      taxProfileSource: 'none',
      taxMode: 'not_configured',
    });
    await runWorkspaceSync();
    navigation.replace('Dashboard');
  }

  const workspaceOptions = [
    {
      label: 'Create a new synced business',
      value: NEW_SYNCED_WORKSPACE_VALUE,
      description: 'Use the details below to create a fresh cloud workspace.',
    },
    ...eligibleWorkspaces.map((workspace) => ({
      label: workspace.businessName,
      value: workspace.workspaceId,
      description: `${workspace.countryCode} · ${workspace.currency}`,
    })),
  ];

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
          <View style={styles.header}>
            <View style={styles.brandPanel}>
              <View style={styles.brandMark}>
                <View style={styles.markOrbit} />
                <View style={styles.markDot} />
                <View style={styles.markPage}>
                  <View style={styles.markLine} />
                  <View style={styles.markLineShort} />
                  <View style={styles.markRule} />
                </View>
              </View>
              <View style={styles.brandTextBlock}>
                <Text style={styles.eyebrow}>{brand.fullName}</Text>
                <Text style={styles.brandPromise}>Serious ledger control for daily business work</Text>
              </View>
            </View>
            <View style={styles.trustRow}>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>Offline first</Text>
              </View>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>Backup ready</Text>
              </View>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>Documents included</Text>
              </View>
            </View>
            <Text style={styles.title}>Set Up Business</Text>
            <Text style={styles.subtitle}>
              Choose whether this business should stay only on this device or be linked to a
              signed-in workspace.
            </Text>
          </View>

          <Card elevated glass accent={storageMode === 'synced' ? 'premium' : 'primary'}>
            <Text style={styles.sectionTitle}>How do you want to use Orbit Ledger?</Text>
            <View style={styles.modeGrid}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStorageMode('local_only')}
                style={[
                  styles.modeCard,
                  storageMode === 'local_only' ? styles.modeCardSelected : null,
                ]}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeTitle}>Start offline</Text>
                  {storageMode === 'local_only' ? <StatusChip label="Selected" tone="primary" /> : null}
                </View>
                <Text style={styles.modeBody}>{getBusinessModeDescription('local_only')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStorageMode('synced')}
                style={[styles.modeCard, storageMode === 'synced' ? styles.modeCardSelected : null]}
              >
                <View style={styles.modeHeader}>
                  <Text style={styles.modeTitle}>Sign in to sync</Text>
                  {storageMode === 'synced' ? <StatusChip label="Selected" tone="premium" /> : null}
                </View>
                <Text style={styles.modeBody}>{getBusinessModeDescription('synced')}</Text>
              </Pressable>
            </View>
          </Card>

          {storageMode === 'synced' ? (
            <Card elevated accent="premium">
              <View style={styles.syncHeaderRow}>
                <View style={styles.syncHeaderText}>
                  <Text style={styles.sectionTitle}>Cloud workspace</Text>
                  <Text style={styles.syncBody}>
                    Sign in to create a synced business or pull an existing workspace onto this
                    device. Local records stay available, and workspace data is brought down after
                    linking.
                  </Text>
                </View>
                {cloudUser ? <StatusChip label="Signed in" tone="premium" /> : <StatusChip label="Sign-in required" tone="warning" />}
              </View>

              {cloudUser ? (
                <>
                  <Text style={styles.cloudIdentityText}>
                    {cloudUser.displayName?.trim() || cloudUser.email || 'Signed-in owner'}
                  </Text>
                  <Text style={styles.cloudIdentityHelper}>
                    {cloudUser.email || 'Your workspace account is active on this device.'}
                  </Text>

                  <SelectField
                    label="Synced workspace"
                    value={selectedWorkspaceId}
                    options={workspaceOptions}
                    onChange={handleWorkspaceSelection}
                    helperText={
                      isLoadingCloudWorkspaces
                        ? 'Checking your cloud workspaces...'
                        : 'Choose an existing synced workspace or create a new one.'
                    }
                    disabled={isLoadingCloudWorkspaces}
                  />
                </>
              ) : (
                <PrimaryButton onPress={() => navigation.navigate('CloudAuth', { returnTo: 'Setup' })}>
                  Sign in to sync
                </PrimaryButton>
              )}
            </Card>
          ) : null}

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Business Details</Text>
            <Controller
              control={control}
              name="businessName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Business name"
                  placeholder="Orbit Service Co."
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={getVisibleError(errors.businessName?.message, touchedFields.businessName, isSubmitted)}
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
                  error={getVisibleError(errors.ownerName?.message, touchedFields.ownerName, isSubmitted)}
                />
              )}
            />
            <View style={styles.twoColumn}>
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
                    error={getVisibleError(errors.phone?.message, touchedFields.phone, isSubmitted)}
                    style={styles.flexInput}
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
                    error={getVisibleError(errors.email?.message, touchedFields.email, isSubmitted)}
                    style={styles.flexInput}
                  />
                )}
              />
            </View>
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
                    error={getVisibleError(errors.addressLine1?.message, touchedFields.addressLine1, isSubmitted)}
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
                    error={getVisibleError(errors.addressLine2?.message, touchedFields.addressLine2, isSubmitted)}
                  />
                )}
              />
              <View style={styles.twoColumn}>
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
                      error={getVisibleError(errors.city?.message, touchedFields.city, isSubmitted)}
                      style={styles.flexInput}
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
                      error={getVisibleError(errors.postalCode?.message, touchedFields.postalCode, isSubmitted)}
                      style={styles.flexInput}
                    />
                  )}
                />
              </View>
            </View>
            <View style={styles.twoColumn}>
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
                    error={getVisibleError(errors.currency?.message, touchedFields.currency, isSubmitted)}
                    helperText="Used for balances and entries."
                    style={styles.flexInput}
                  />
                )}
              />
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
                    error={getVisibleError(errors.countryCode?.message, touchedFields.countryCode, isSubmitted)}
                    helperText="Used for tax packs, reports, and documents."
                  />
                )}
              />
            </View>
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
                  error={getVisibleError(errors.stateCode?.message, touchedFields.stateCode, isSubmitted)}
                  helperText="Stored for local tax profiles and country package matching."
                />
              )}
            />
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Identity Assets</Text>
            <ImagePickerField
              label="Company logo"
              helperText="Optional. If skipped, documents will use a clean text fallback."
              value={values.logoUri}
              fallbackLabel="Logo"
              assetName="logo"
              onChange={(uri) => setValue('logoUri', uri, { shouldDirty: true, shouldValidate: true })}
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
                  error={getVisibleError(
                    errors.authorizedPersonName?.message,
                    touchedFields.authorizedPersonName,
                    isSubmitted
                  )}
                />
              )}
            />
            <Controller
              control={control}
              name="authorizedPersonTitle"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Title or designation"
                  placeholder="Owner, Manager, Partner"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={getVisibleError(
                    errors.authorizedPersonTitle?.message,
                    touchedFields.authorizedPersonTitle,
                    isSubmitted
                  )}
                />
              )}
            />
            <ImagePickerField
              label="Signature image"
              helperText="Optional. Future documents will still work with a typed-name fallback."
              value={values.signatureUri}
              fallbackLabel="Signature"
              assetName="signature"
              onChange={(uri) =>
                setValue('signatureUri', uri, { shouldDirty: true, shouldValidate: true })
              }
              onError={(message) => Alert.alert('Image selection', message)}
            />
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Tax profile note</Text>
            <Text style={styles.noticeText}>
              Orbit Ledger can check online tax packs and country packages when you choose, then
              save the validated data locally for offline use.
            </Text>
          </View>

          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Document Identity Preview</Text>
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

          <PrimaryButton
            disabled={!isSetupComplete || isLoading || (storageMode === 'synced' && !cloudUser)}
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            Complete setup
          </PrimaryButton>
          {!isSetupComplete && !isLoading ? (
            <View style={styles.validationSummary}>
              <Text style={styles.validationSummaryTitle}>To complete setup</Text>
              {setupValidationMessages.slice(0, 4).map((message) => (
                <Text key={message} style={styles.validationSummaryText}>
                  {message}
                </Text>
              ))}
              <Text style={styles.validationSummaryHint}>Logo and signature are optional.</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function toWorkspaceProfileDraft(values: SetupFormValues): WorkspaceProfileDraft {
  return {
    businessName: values.businessName,
    ownerName: values.ownerName,
    phone: values.phone,
    email: values.email,
    address: composeAddress(values),
    currency: values.currency.toUpperCase(),
    countryCode: values.countryCode.toUpperCase(),
    stateCode: values.stateCode.toUpperCase(),
    logoUri: values.logoUri,
    authorizedPersonName: values.authorizedPersonName,
    authorizedPersonTitle: values.authorizedPersonTitle,
    signatureUri: values.signatureUri,
  };
}

function getSetupValidationMessages(values: SetupFormValues): string[] {
  const result = setupSchema.safeParse(values);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => issue.message);
}

function getVisibleError(
  message: string | undefined,
  isTouched: boolean | undefined,
  isSubmitted: boolean
) {
  return isTouched || isSubmitted ? message : undefined;
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
  header: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  brandPanel: {
    minHeight: 84,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markOrbit: {
    position: 'absolute',
    width: 42,
    height: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primarySurface,
    transform: [{ rotate: '-18deg' }],
  },
  markDot: {
    position: 'absolute',
    right: 8,
    top: 14,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primarySurface,
  },
  markPage: {
    width: 28,
    height: 34,
    borderRadius: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 5,
    paddingVertical: 6,
    gap: 4,
  },
  markLine: {
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  markLineShort: {
    width: 12,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  markRule: {
    marginTop: 2,
    height: 1,
    backgroundColor: colors.border,
  },
  brandTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  brandPromise: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 19,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trustPill: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexShrink: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  trustPillText: {
    color: colors.textMuted,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
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
  modeGrid: {
    gap: spacing.md,
  },
  modeCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modeTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  modeBody: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  syncHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  syncBody: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  cloudIdentityText: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  cloudIdentityHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  workspaceHint: {
    color: colors.warning,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  twoColumn: {
    gap: spacing.lg,
  },
  flexInput: {
    flex: 1,
  },
  addressSection: {
    gap: spacing.md,
  },
  subsectionTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  notice: {
    ...shadows.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noticeTitle: {
    color: colors.warning,
    fontSize: typography.label,
    fontWeight: '900',
  },
  noticeText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  validationSummary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  validationSummaryTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  validationSummaryText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  validationSummaryHint: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  previewSection: {
    gap: spacing.md,
  },
});
