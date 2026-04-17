import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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

import { IdentityPreviewCard } from '../components/IdentityPreviewCard';
import { ImagePickerField } from '../components/ImagePickerField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SelectField } from '../components/SelectField';
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

export function SetupScreen({ navigation }: SetupScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const settings = await getBusinessSettings();
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
        }
      } catch {
        Alert.alert('Setup could not load', 'Please try again.');
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
  }, [reset]);

  async function onSubmit(input: SetupFormValues) {
    await saveBusinessSettings({
      ...input,
      address: composeAddress(input),
      currency: input.currency.toUpperCase(),
      countryCode: input.countryCode.toUpperCase(),
      stateCode: input.stateCode.toUpperCase(),
      taxSetupRequired: true,
      taxProfileSource: 'none',
      taxMode: 'not_configured',
    });
    navigation.replace('Dashboard');
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
                <Text style={styles.brandPromise}>Local customer dues and payments</Text>
              </View>
            </View>
            <View style={styles.trustRow}>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>Works offline</Text>
              </View>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>Local records</Text>
              </View>
              <View style={styles.trustPill}>
                <Text style={styles.trustPillText}>PDF ready</Text>
              </View>
            </View>
            <Text style={styles.title}>Set Up Business</Text>
            <Text style={styles.subtitle}>
              Add the business details that should appear across your ledger and future documents.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Business Details</Text>
            <Controller
              control={control}
              name="businessName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Business name"
                  placeholder="Bhaumik Mehta Trading Co."
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
            disabled={!isSetupComplete || isLoading}
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
              <Text style={styles.validationSummaryHint}>
                Logo and signature are optional.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
