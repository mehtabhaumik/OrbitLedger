'use client';

import Link from 'next/link';
import {
  getManualPaymentInstructionTemplate,
  type ManualPaymentInstructionDetails,
} from '@orbit-ledger/core';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type RefObject,
} from 'react';

import { AppShell } from '@/components/app-shell';
import { getWebDocumentTemplates, type WebDocumentTemplate } from '@/lib/web-documents';
import {
  buildAuditProtectedSettingsChanges,
  summarizeAuditProtectedSettingsChanges,
} from '@/lib/audit-protected-settings';
import { WEB_PRO_BRAND_THEMES } from '@/lib/web-monetization';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateBusinessName,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES, getDefaultIndianCity, getIndianCityOptions } from '@/lib/india';
import {
  DEFAULT_WEB_USER_SETTINGS,
  loadWebUserSettings,
  saveWebUserSettings,
  type WebUserSettings,
} from '@/lib/user-settings';
import {
  buildPaymentInstructionAuditChanges,
  summarizePaymentInstructionChanges,
  validateManualPaymentSettings,
} from '@/lib/payment-settings-hardening';
import { DEFAULT_NOTIFICATION_REMINDER_PREFERENCES } from '@/lib/notification-preferences';
import {
  deleteWorkspaceStorageFile,
  uploadWorkspaceIdentityImage,
  validateWorkspaceIdentityImage,
  type WorkspaceIdentityAssetKind,
} from '@/lib/workspace-storage';
import {
  updateWorkspacePaymentInstructionsAudited,
  updateWorkspaceProfile,
  updateWorkspaceProfileAudited,
} from '@/lib/workspaces';
import { useAuth } from '@/providers/auth-provider';
import { useConfirmDialog } from '@/providers/confirm-dialog-provider';
import { useWebDeviceSettings } from '@/providers/device-settings-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWebLock } from '@/providers/web-lock-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type ProfileFormState = {
  businessName: string;
  legalName: string;
  ownerName: string;
  contactPerson: string;
  businessType: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  town: string;
  postalCode: string;
  gstin: string;
  pan: string;
  taxNumber: string;
  registrationNumber: string;
  placeOfSupply: string;
  defaultTaxTreatment: string;
  defaultPaymentTerms: string;
  defaultDueDays: string;
  defaultTaxRate: string;
  defaultInvoiceTemplate: string;
  defaultStatementTemplate: string;
  defaultInvoiceNotes: string;
  defaultRecurringEmailSubject: string;
  defaultRecurringEmailBody: string;
  defaultRecurringEmailIncludePaymentLink: boolean;
  defaultRecurringEmailAttachPdf: boolean;
  defaultRecurringEmailCurrentMonthOnly: boolean;
  defaultRecurringEmailSendDayBehavior: 'same_day' | 'custom_day';
  defaultRecurringEmailDay: string;
  documentFilenameFormat: string;
  documentFooterPreference: string;
  documentBrandHeaderColor: string;
  documentBrandBackgroundColor: string;
  documentBrandFontColor: string;
  reminderStyle: string;
  overdueAlertTiming: string;
  followUpCadenceDays: string;
  paymentNoticeTone: string;
  urgentPaymentStampDefault: boolean;
  backupReminderFrequency: string;
  whatsappReminderTemplate: string;
  emailReminderTemplate: string;
  paymentThankYouTemplate: string;
  bouncedPaymentTemplate: string;
  defaultLanguage: string;
  stateCode: string;
  logoUri: string | null;
  documentWatermarkType: 'none' | 'text' | 'logo' | 'image';
  documentWatermarkText: string;
  documentWatermarkImageUri: string | null;
  documentWatermarkOpacity: string;
  signatureUri: string | null;
};

type PaymentFieldKey = keyof ManualPaymentInstructionDetails;

type ProfileFieldKey = 'businessName' | 'ownerName' | 'phone' | 'email' | 'stateCode';
type UserSettingsSaveState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const settingsHubLinks = [
  { href: '#my-settings', label: 'My Settings' },
  { href: '#company-settings', label: 'Company Settings' },
  { href: '#invoice-document-settings', label: 'Invoice & Documents' },
  { href: '#payment-settings', label: 'Payment Settings' },
  { href: '#security-settings', label: 'Security' },
  { href: '#backup-data-settings', label: 'Backup & Data' },
  { href: '#notifications-reminders-settings', label: 'Notifications & Reminders' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { activeWorkspace, refresh } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { isEnabled, timeoutMs, enableLock, disableLock, setTimeoutMs, lockNow } = useWebLock();
  const { settings: deviceSettings, updateSetting: updateDeviceSetting } = useWebDeviceSettings();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const watermarkInputRef = useRef<HTMLInputElement | null>(null);
  const userSettingsReadyRef = useRef(false);
  const userSettingsSignatureRef = useRef('');
  const [profile, setProfile] = useState<ProfileFormState>({
    businessName: '',
    legalName: '',
    ownerName: '',
    contactPerson: '',
    businessType: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    address: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    town: '',
    postalCode: '',
    gstin: '',
    pan: '',
    taxNumber: '',
    registrationNumber: '',
    placeOfSupply: '',
    defaultTaxTreatment: '',
    defaultPaymentTerms: '',
    defaultDueDays: '',
    defaultTaxRate: '',
    defaultInvoiceTemplate: '',
    defaultStatementTemplate: '',
    defaultInvoiceNotes: '',
    defaultRecurringEmailSubject: defaultRecurringEmailSubject(),
    defaultRecurringEmailBody: defaultRecurringEmailBody(),
    defaultRecurringEmailIncludePaymentLink: true,
    defaultRecurringEmailAttachPdf: true,
    defaultRecurringEmailCurrentMonthOnly: true,
    defaultRecurringEmailSendDayBehavior: 'same_day',
    defaultRecurringEmailDay: '',
    documentFilenameFormat: 'customer_invoice_date_revision_country',
    documentFooterPreference: 'auto',
    documentBrandHeaderColor: WEB_PRO_BRAND_THEMES.ledger_green.accentColor,
    documentBrandBackgroundColor: WEB_PRO_BRAND_THEMES.ledger_green.surfaceColor,
    documentBrandFontColor: WEB_PRO_BRAND_THEMES.ledger_green.textColor,
    reminderStyle: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.reminderStyle,
    overdueAlertTiming: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.overdueAlertTiming,
    followUpCadenceDays: String(DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.followUpCadenceDays),
    paymentNoticeTone: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentNoticeTone,
    urgentPaymentStampDefault: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.urgentPaymentStampDefault,
    backupReminderFrequency: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.backupReminderFrequency,
    whatsappReminderTemplate: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.whatsappReminderTemplate,
    emailReminderTemplate: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.emailReminderTemplate,
    paymentThankYouTemplate: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentThankYouTemplate,
    bouncedPaymentTemplate: DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.bouncedPaymentTemplate,
    defaultLanguage: '',
    stateCode: 'GJ',
    logoUri: null,
    documentWatermarkType: 'none',
    documentWatermarkText: '',
    documentWatermarkImageUri: null,
    documentWatermarkOpacity: '0.08',
    signatureUri: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<ProfileFieldKey, string | null>>({
    businessName: null,
    ownerName: null,
    phone: null,
    email: null,
    stateCode: null,
  });
  const [touched, setTouched] = useState<Record<ProfileFieldKey, boolean>>({
    businessName: false,
    ownerName: false,
    phone: false,
    email: false,
    stateCode: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<WorkspaceIdentityAssetKind | null>(null);
  const [userSettings, setUserSettings] = useState<WebUserSettings>(DEFAULT_WEB_USER_SETTINGS);
  const [isLoadingUserSettings, setIsLoadingUserSettings] = useState(false);
  const [userSettingsSaveState, setUserSettingsSaveState] = useState<UserSettingsSaveState>('idle');
  const [userSettingsSaveMessage, setUserSettingsSaveMessage] = useState('My Settings are ready.');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<ManualPaymentInstructionDetails>({});
  const [paymentAuditReason, setPaymentAuditReason] = useState('');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    setProfile({
      businessName: activeWorkspace.businessName,
      legalName: activeWorkspace.legalName ?? '',
      ownerName: activeWorkspace.ownerName,
      contactPerson: activeWorkspace.contactPerson ?? '',
      businessType: activeWorkspace.businessType ?? '',
      phone: activeWorkspace.phone,
      whatsapp: activeWorkspace.whatsapp ?? '',
      email: activeWorkspace.email,
      website: activeWorkspace.website ?? '',
      address: activeWorkspace.address,
      addressLine1: activeWorkspace.addressLine1 ?? '',
      addressLine2: activeWorkspace.addressLine2 ?? '',
      city: activeWorkspace.city ?? getDefaultIndianCity(activeWorkspace.stateCode || 'GJ'),
      town: activeWorkspace.town ?? '',
      postalCode: activeWorkspace.postalCode ?? '',
      gstin: activeWorkspace.gstin ?? '',
      pan: activeWorkspace.pan ?? '',
      taxNumber: activeWorkspace.taxNumber ?? '',
      registrationNumber: activeWorkspace.registrationNumber ?? '',
      placeOfSupply: activeWorkspace.placeOfSupply ?? '',
      defaultTaxTreatment: activeWorkspace.defaultTaxTreatment ?? '',
      defaultPaymentTerms: activeWorkspace.defaultPaymentTerms ?? '',
      defaultDueDays: activeWorkspace.defaultDueDays !== null && activeWorkspace.defaultDueDays !== undefined ? String(activeWorkspace.defaultDueDays) : '',
      defaultTaxRate: activeWorkspace.defaultTaxRate !== null && activeWorkspace.defaultTaxRate !== undefined ? String(activeWorkspace.defaultTaxRate) : '',
      defaultInvoiceTemplate: activeWorkspace.defaultInvoiceTemplate ?? '',
      defaultStatementTemplate: activeWorkspace.defaultStatementTemplate ?? '',
      defaultInvoiceNotes: activeWorkspace.defaultInvoiceNotes ?? '',
      defaultRecurringEmailSubject: activeWorkspace.defaultRecurringEmailSubject ?? defaultRecurringEmailSubject(),
      defaultRecurringEmailBody: activeWorkspace.defaultRecurringEmailBody ?? defaultRecurringEmailBody(),
      defaultRecurringEmailIncludePaymentLink: activeWorkspace.defaultRecurringEmailIncludePaymentLink !== false,
      defaultRecurringEmailAttachPdf: activeWorkspace.defaultRecurringEmailAttachPdf !== false,
      defaultRecurringEmailCurrentMonthOnly: activeWorkspace.defaultRecurringEmailCurrentMonthOnly !== false,
      defaultRecurringEmailSendDayBehavior: activeWorkspace.defaultRecurringEmailSendDayBehavior ?? 'same_day',
      defaultRecurringEmailDay:
        activeWorkspace.defaultRecurringEmailDay !== null && activeWorkspace.defaultRecurringEmailDay !== undefined
          ? String(activeWorkspace.defaultRecurringEmailDay)
          : '',
      documentFilenameFormat: activeWorkspace.documentFilenameFormat ?? 'customer_invoice_date_revision_country',
      documentFooterPreference: activeWorkspace.documentFooterPreference ?? 'auto',
      documentBrandHeaderColor: activeWorkspace.documentBrandHeaderColor ?? WEB_PRO_BRAND_THEMES.ledger_green.accentColor,
      documentBrandBackgroundColor: activeWorkspace.documentBrandBackgroundColor ?? WEB_PRO_BRAND_THEMES.ledger_green.surfaceColor,
      documentBrandFontColor: activeWorkspace.documentBrandFontColor ?? WEB_PRO_BRAND_THEMES.ledger_green.textColor,
      reminderStyle: activeWorkspace.reminderStyle ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.reminderStyle,
      overdueAlertTiming: activeWorkspace.overdueAlertTiming ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.overdueAlertTiming,
      followUpCadenceDays:
        activeWorkspace.followUpCadenceDays !== null && activeWorkspace.followUpCadenceDays !== undefined
          ? String(activeWorkspace.followUpCadenceDays)
          : String(DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.followUpCadenceDays),
      paymentNoticeTone: activeWorkspace.paymentNoticeTone ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentNoticeTone,
      urgentPaymentStampDefault: Boolean(activeWorkspace.urgentPaymentStampDefault),
      backupReminderFrequency: activeWorkspace.backupReminderFrequency ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.backupReminderFrequency,
      whatsappReminderTemplate: activeWorkspace.whatsappReminderTemplate ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.whatsappReminderTemplate,
      emailReminderTemplate: activeWorkspace.emailReminderTemplate ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.emailReminderTemplate,
      paymentThankYouTemplate: activeWorkspace.paymentThankYouTemplate ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.paymentThankYouTemplate,
      bouncedPaymentTemplate: activeWorkspace.bouncedPaymentTemplate ?? DEFAULT_NOTIFICATION_REMINDER_PREFERENCES.bouncedPaymentTemplate,
      defaultLanguage: activeWorkspace.defaultLanguage ?? '',
      stateCode: activeWorkspace.stateCode || 'GJ',
      logoUri: activeWorkspace.logoUri,
      documentWatermarkType: activeWorkspace.documentWatermarkType ?? 'none',
      documentWatermarkText: activeWorkspace.documentWatermarkText ?? '',
      documentWatermarkImageUri: activeWorkspace.documentWatermarkImageUri ?? null,
      documentWatermarkOpacity:
        activeWorkspace.documentWatermarkOpacity !== null && activeWorkspace.documentWatermarkOpacity !== undefined
          ? String(activeWorkspace.documentWatermarkOpacity)
          : '0.08',
      signatureUri: activeWorkspace.signatureUri,
    });
    setFieldErrors({
      businessName: null,
      ownerName: null,
      phone: null,
      email: null,
      stateCode: null,
    });
    setTouched({
      businessName: false,
      ownerName: false,
      phone: false,
      email: false,
      stateCode: false,
    });
    setPaymentInstructions(activeWorkspace.paymentInstructions);
    setPaymentAuditReason('');
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || !user) {
      setUserSettings(DEFAULT_WEB_USER_SETTINGS);
      userSettingsReadyRef.current = false;
      userSettingsSignatureRef.current = '';
      setUserSettingsSaveState('idle');
      setUserSettingsSaveMessage('Sign in and choose a business to save My Settings.');
      return;
    }

    let isMounted = true;
    userSettingsReadyRef.current = false;
    userSettingsSignatureRef.current = '';
    setUserSettings(DEFAULT_WEB_USER_SETTINGS);
    setIsLoadingUserSettings(true);
    setUserSettingsSaveState('loading');
    setUserSettingsSaveMessage('Loading My Settings...');
    void loadWebUserSettings(user.uid, activeWorkspace.workspaceId)
      .then((settings) => {
        if (isMounted) {
          setUserSettings(settings);
          userSettingsSignatureRef.current = buildUserSettingsSignature(settings);
          userSettingsReadyRef.current = true;
          setUserSettingsSaveState('saved');
          setUserSettingsSaveMessage(settings.updatedAt ? 'My Settings are saved.' : 'Using default My Settings.');
        }
      })
      .catch((error) => {
        if (isMounted) {
          userSettingsReadyRef.current = false;
          setUserSettingsSaveState('error');
          setUserSettingsSaveMessage(error instanceof Error ? error.message : 'My Settings could not be loaded.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingUserSettings(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.workspaceId, showToast, user?.uid]);

  const userSettingsSignature = buildUserSettingsSignature(userSettings);

  useEffect(() => {
    if (!activeWorkspace || !user || !userSettingsReadyRef.current || isLoadingUserSettings) {
      return;
    }

    if (userSettingsSignature === userSettingsSignatureRef.current) {
      return;
    }

    const pendingSignature = userSettingsSignature;
    setUserSettingsSaveState('saving');
    setUserSettingsSaveMessage('Saving My Settings...');

    const timer = window.setTimeout(() => {
      void saveWebUserSettings(user.uid, activeWorkspace.workspaceId, userSettings)
        .then((saved) => {
          userSettingsSignatureRef.current = pendingSignature;
          setUserSettings((current) =>
            buildUserSettingsSignature(current) === pendingSignature
              ? { ...current, updatedAt: saved.updatedAt }
              : current
          );
          setUserSettingsSaveState('saved');
          setUserSettingsSaveMessage('My Settings are saved.');
        })
        .catch((error) => {
          setUserSettingsSaveState('error');
          setUserSettingsSaveMessage(error instanceof Error ? error.message : 'My Settings could not be saved.');
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeWorkspace?.workspaceId, isLoadingUserSettings, user?.uid, userSettings, userSettingsSignature]);

  if (!activeWorkspace) {
    return null;
  }

  const workspace = activeWorkspace;
  const paymentTemplate = getManualPaymentInstructionTemplate(workspace.countryCode);
  const invoiceTemplates = getWebDocumentTemplates(workspace, 'invoice');
  const statementTemplates = getWebDocumentTemplates(workspace, 'statement');
  const paymentInstructionChanges = buildPaymentInstructionAuditChanges(workspace.paymentInstructions, paymentInstructions);
  const paymentInstructionSummary = summarizePaymentInstructionChanges(paymentInstructionChanges);

  function validateField(field: ProfileFieldKey, candidate = profile) {
    if (field === 'businessName') {
      return validateBusinessName(candidate.businessName, 'Business name', true);
    }
    if (field === 'ownerName') {
      return validateName(candidate.ownerName, 'Owner name', true);
    }
    if (field === 'phone') {
      return validatePhone(candidate.phone, INDIA_COUNTRY.code, false);
    }
    if (field === 'email') {
      return validateEmail(candidate.email, false);
    }
    return candidate.stateCode.trim() ? null : 'Choose a valid state.';
  }

  function handleFieldChange(field: keyof ProfileFormState, value: string) {
    const next =
      field === 'stateCode'
        ? {
            ...profile,
            stateCode: value,
            city: getIndianCityOptions(value).includes(profile.city)
              ? profile.city
              : getDefaultIndianCity(value),
          }
        : { ...profile, [field]: value };
    setProfile(next);

    if (field in touched && touched[field as ProfileFieldKey]) {
      const nextError = validateField(field as ProfileFieldKey, next);
      setFieldErrors((current) => ({ ...current, [field as ProfileFieldKey]: nextError }));
    }
  }

  function handleFieldBlur(field: ProfileFieldKey) {
    let next = profile;
    if (field === 'phone') {
      const formatted = normalizePhoneForCountry(INDIA_COUNTRY.code, profile.phone);
      if (formatted) {
        next = { ...profile, phone: formatted };
        setProfile(next);
      }
    }

    setTouched((current) => ({ ...current, [field]: true }));
    const nextError = validateField(field, next);
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function buildWorkspaceProfileInput(nextProfile = profile) {
    return {
      businessName: nextProfile.businessName.trim(),
      legalName: nextProfile.legalName,
      ownerName: nextProfile.ownerName.trim(),
      contactPerson: nextProfile.contactPerson,
      businessType: nextProfile.businessType,
      phone: nextProfile.phone.trim(),
      whatsapp: nextProfile.whatsapp,
      email: nextProfile.email.trim(),
      website: nextProfile.website,
      address: nextProfile.address.trim(),
      addressLine1: nextProfile.addressLine1,
      addressLine2: nextProfile.addressLine2,
      city: nextProfile.city,
      town: nextProfile.town,
      postalCode: nextProfile.postalCode,
      gstin: nextProfile.gstin,
      pan: nextProfile.pan,
      taxNumber: nextProfile.taxNumber,
      registrationNumber: nextProfile.registrationNumber,
      placeOfSupply: nextProfile.placeOfSupply,
      defaultTaxTreatment: nextProfile.defaultTaxTreatment,
      defaultPaymentTerms: nextProfile.defaultPaymentTerms,
      defaultDueDays: parseAmount(nextProfile.defaultDueDays),
      defaultTaxRate: parseAmount(nextProfile.defaultTaxRate),
      defaultInvoiceTemplate: nextProfile.defaultInvoiceTemplate,
      defaultStatementTemplate: nextProfile.defaultStatementTemplate,
      defaultInvoiceNotes: nextProfile.defaultInvoiceNotes,
      defaultRecurringEmailSubject: nextProfile.defaultRecurringEmailSubject,
      defaultRecurringEmailBody: nextProfile.defaultRecurringEmailBody,
      defaultRecurringEmailIncludePaymentLink: nextProfile.defaultRecurringEmailIncludePaymentLink,
      defaultRecurringEmailAttachPdf: nextProfile.defaultRecurringEmailAttachPdf,
      defaultRecurringEmailCurrentMonthOnly: nextProfile.defaultRecurringEmailCurrentMonthOnly,
      defaultRecurringEmailSendDayBehavior: nextProfile.defaultRecurringEmailSendDayBehavior,
      defaultRecurringEmailDay: parseAmount(nextProfile.defaultRecurringEmailDay),
      documentFilenameFormat: nextProfile.documentFilenameFormat,
      documentFooterPreference: nextProfile.documentFooterPreference,
      documentBrandHeaderColor: nextProfile.documentBrandHeaderColor,
      documentBrandBackgroundColor: nextProfile.documentBrandBackgroundColor,
      documentBrandFontColor: nextProfile.documentBrandFontColor,
      reminderStyle: nextProfile.reminderStyle,
      overdueAlertTiming: nextProfile.overdueAlertTiming,
      followUpCadenceDays: parseAmount(nextProfile.followUpCadenceDays),
      paymentNoticeTone: nextProfile.paymentNoticeTone,
      urgentPaymentStampDefault: nextProfile.urgentPaymentStampDefault,
      backupReminderFrequency: nextProfile.backupReminderFrequency,
      whatsappReminderTemplate: nextProfile.whatsappReminderTemplate,
      emailReminderTemplate: nextProfile.emailReminderTemplate,
      paymentThankYouTemplate: nextProfile.paymentThankYouTemplate,
      bouncedPaymentTemplate: nextProfile.bouncedPaymentTemplate,
      defaultLanguage: nextProfile.defaultLanguage,
      currency: INDIA_COUNTRY.currency,
      countryCode: INDIA_COUNTRY.code,
      stateCode: nextProfile.stateCode,
      logoUri: nextProfile.logoUri,
      documentWatermarkType: nextProfile.documentWatermarkType,
      documentWatermarkText: nextProfile.documentWatermarkText,
      documentWatermarkImageUri: nextProfile.documentWatermarkImageUri,
      documentWatermarkOpacity: parseAmount(nextProfile.documentWatermarkOpacity),
      authorizedPersonName: workspace.authorizedPersonName,
      authorizedPersonTitle: workspace.authorizedPersonTitle,
      signatureUri: nextProfile.signatureUri,
      paymentInstructions,
    };
  }

  async function saveWorkspaceProfile(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const nextErrors: Record<ProfileFieldKey, string | null> = {
      businessName: validateField('businessName'),
      ownerName: validateField('ownerName'),
      phone: validateField('phone'),
      email: validateField('email'),
      stateCode: validateField('stateCode'),
    };
    setTouched({
      businessName: true,
      ownerName: true,
      phone: true,
      email: true,
      stateCode: true,
    });
    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      showToast('Fix highlighted fields before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    try {
      const nextInput = buildWorkspaceProfileInput(profile);
      const protectedChanges = buildAuditProtectedSettingsChanges(workspace, nextInput);
      if (protectedChanges.length && user) {
        const confirmed = await confirm({
          title: 'Save important setting changes?',
          message: 'These settings affect documents, taxes, payment terms, or business identity. Orbit Ledger will keep a change history.',
          detail: `Changed: ${summarizeAuditProtectedSettingsChanges(protectedChanges)}`,
          confirmLabel: 'Save changes',
        });
        if (!confirmed) {
          return;
        }
        await updateWorkspaceProfileAudited(workspace.workspaceId, workspace.serverRevision, nextInput, {
          actorUid: user.uid,
          actorEmail: user.email,
          reason: 'Protected settings updated',
        });
      } else {
        await updateWorkspaceProfile(workspace.workspaceId, workspace.serverRevision, nextInput);
      }
      await refresh();
      showToast('Company profile saved.', 'success');
    } catch (nextError) {
      showToast(nextError instanceof Error ? nextError.message : 'Company profile could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveWorkspaceMedia(nextProfile: ProfileFormState, successMessage: string) {
    setIsSaving(true);
    try {
      const nextInput = buildWorkspaceProfileInput(nextProfile);
      const protectedChanges = buildAuditProtectedSettingsChanges(workspace, nextInput);
      if (protectedChanges.length && user) {
        await updateWorkspaceProfileAudited(workspace.workspaceId, workspace.serverRevision, nextInput, {
          actorUid: user.uid,
          actorEmail: user.email,
          reason: successMessage,
        });
      } else {
        await updateWorkspaceProfile(workspace.workspaceId, workspace.serverRevision, nextInput);
      }
      await refresh();
      showToast(successMessage, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Business file could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAssetPicked(kind: WorkspaceIdentityAssetKind, file: File | null) {
    if (!file) {
      return;
    }

    const validationError = validateWorkspaceIdentityImage(file);
    if (validationError) {
      showToast(validationError, 'danger');
      return;
    }

    const previousUrl = getAssetUrl(profile, kind);
    setUploadingAsset(kind);

    try {
      const nextUrl = await uploadWorkspaceIdentityImage(workspace.workspaceId, kind, file);
      let nextProfile =
        kind === 'logo'
          ? { ...profile, logoUri: nextUrl }
          : kind === 'signature'
            ? { ...profile, signatureUri: nextUrl }
            : {
                ...profile,
                documentWatermarkType: 'image' as const,
                documentWatermarkImageUri: nextUrl,
              };
      if (kind === 'watermark') {
        const message = profile.logoUri
          ? 'Use this uploaded watermark image as the company logo too?'
          : 'No company logo is saved yet. Use this uploaded watermark image as the company logo too?';
        if (
          await confirm({
            title: 'Use this as company logo?',
            message,
            confirmLabel: 'Use as logo',
          })
        ) {
          nextProfile = { ...nextProfile, logoUri: nextUrl };
        }
      }
      setProfile(nextProfile);
      await saveWorkspaceMedia(
        nextProfile,
        kind === 'logo'
          ? 'Business logo saved.'
          : kind === 'signature'
            ? 'Authorized signature saved.'
            : 'Document watermark saved.'
      );
      if (previousUrl && !(kind === 'watermark' && profile.logoUri === previousUrl)) {
        void deleteWorkspaceStorageFile(previousUrl);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Business file could not be uploaded.', 'danger');
    } finally {
      setUploadingAsset(null);
    }
  }

  async function removeAsset(kind: WorkspaceIdentityAssetKind) {
    const previousUrl = getAssetUrl(profile, kind);
    if (!previousUrl) {
      return;
    }

    const nextProfile =
      kind === 'logo'
        ? { ...profile, logoUri: null }
        : kind === 'signature'
          ? { ...profile, signatureUri: null }
          : { ...profile, documentWatermarkType: 'none' as const, documentWatermarkImageUri: null };
    setProfile(nextProfile);
    await saveWorkspaceMedia(
      nextProfile,
      kind === 'logo'
        ? 'Business logo removed.'
        : kind === 'signature'
          ? 'Authorized signature removed.'
          : 'Document watermark removed.'
    );
    if (!(kind === 'watermark' && profile.logoUri === previousUrl)) {
      void deleteWorkspaceStorageFile(previousUrl);
    }
  }

  async function enableBrowserLock() {
    if (pinInput.length !== 4) {
      setPinError('Use a 4-digit PIN.');
      showToast('Use a 4-digit PIN to turn on browser lock.', 'danger');
      return;
    }

    setPinError(null);
    await enableLock(pinInput, timeoutMs);
    setPinInput('');
    showToast('Browser lock is now on for this device.', 'success');
  }

  async function disableBrowserLock() {
    if (pinInput.length !== 4) {
      setPinError('Enter your current 4-digit PIN.');
      showToast('Enter your current 4-digit PIN to turn lock off.', 'danger');
      return;
    }

    try {
      setPinError(null);
      await disableLock(pinInput);
      setPinInput('');
      showToast('Browser lock is now off for this device.', 'success');
    } catch (error) {
      setPinError('Current PIN is incorrect.');
      showToast(error instanceof Error ? error.message : 'Browser lock could not be changed.', 'danger');
    }
  }

  function updatePaymentInstruction(field: PaymentFieldKey, value: string) {
    setPaymentInstructions((current) => ({ ...current, [field]: value }));
  }

  async function savePaymentSettings() {
    if (!activeWorkspace || !user) {
      return;
    }

    const validationErrors = validateManualPaymentSettings(paymentInstructions, activeWorkspace.countryCode);
    if (validationErrors.length) {
      showToast(validationErrors[0], 'danger');
      return;
    }

    const changes = buildPaymentInstructionAuditChanges(activeWorkspace.paymentInstructions, paymentInstructions);
    if (!changes.length) {
      showToast('No payment detail changes to save.', 'info');
      return;
    }

    const confirmed = await confirm({
      title: 'Save payment detail changes?',
      message: 'These details appear on invoices and payment messages. Orbit Ledger will keep a settings history record.',
      detail: `Changed: ${summarizePaymentInstructionChanges(changes)}`,
      confirmLabel: 'Save payment details',
    });
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkspacePaymentInstructionsAudited(
        activeWorkspace.workspaceId,
        activeWorkspace.serverRevision,
        {
          ...buildWorkspaceProfileInput(profile),
          paymentInstructions,
        },
        {
          actorUid: user.uid,
          actorEmail: user.email,
          reason: paymentAuditReason,
        }
      );
      await refresh();
      setPaymentAuditReason('');
      showToast('Payment details saved with history.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment details could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function updateUserSetting<K extends keyof WebUserSettings>(field: K, value: WebUserSettings[K]) {
    setUserSettings((current) => ({ ...current, [field]: value }));
  }

  return (
    <AppShell title="Settings" subtitle="Personal choices, company details, documents, payments, security, and backups.">
      <div className="ol-settings-hub">
        <section className="ol-settings-hero">
          <div>
            <p className="ol-eyebrow">Settings</p>
            <h2>Make Orbit Ledger remember how this business works.</h2>
            <p>
              Keep daily preferences, company details, document style, payment details, and safety controls in clear sections.
            </p>
          </div>
          <span className="ol-chip ol-chip--success">Ready</span>
        </section>

        <nav className="ol-settings-jump-nav" aria-label="Settings sections">
          {settingsHubLinks.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <section className="ol-panel-glass ol-settings-section" id="my-settings">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">My Settings</div>
              <p className="ol-panel-copy">
                Personal preferences are saved for this user and this business. They do not change company-wide settings.
              </p>
            </div>
            <span aria-live="polite" className={`ol-chip ${getUserSettingsSaveChipClass(userSettingsSaveState)}`}>
              {getUserSettingsSaveLabel(userSettingsSaveState)}
            </span>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Daily work preferences</div>
                <p className="ol-form-band-copy">These choices help lists, reports, and daily review open the way this user prefers.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label">Start page view</span>
                <select
                  className="ol-select"
                  value={userSettings.dashboardView}
                  onChange={(event) => updateUserSetting('dashboardView', event.target.value as WebUserSettings['dashboardView'])}
                >
                  <option value="daily_command">Daily command center</option>
                  <option value="classic_summary">Classic summary</option>
                  <option value="reports_first">Reports first</option>
                </select>
                <span className="ol-field-help">Used when this user opens this business.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Default report range</span>
                <select
                  className="ol-select"
                  value={userSettings.defaultDateRange}
                  onChange={(event) => updateUserSetting('defaultDateRange', event.target.value as WebUserSettings['defaultDateRange'])}
                >
                  <option value="this_month">This month</option>
                  <option value="last_30_days">Last 30 days</option>
                  <option value="this_quarter">This quarter</option>
                  <option value="this_year">This year</option>
                </select>
                <span className="ol-field-help">Reports open with this range first.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Customer list opens with</span>
                <select
                  className="ol-select"
                  value={userSettings.defaultCustomerFilter}
                  onChange={(event) => updateUserSetting('defaultCustomerFilter', event.target.value as WebUserSettings['defaultCustomerFilter'])}
                >
                  <option value="all">All customers</option>
                  <option value="due">Customers with dues</option>
                  <option value="follow_up">Needs follow-up</option>
                  <option value="inactive">Inactive customers</option>
                </select>
                <span className="ol-field-help">Only changes this user's default customer view.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Invoice list opens with</span>
                <select
                  className="ol-select"
                  value={userSettings.defaultInvoiceFilter}
                  onChange={(event) => updateUserSetting('defaultInvoiceFilter', event.target.value as WebUserSettings['defaultInvoiceFilter'])}
                >
                  <option value="all">All invoices</option>
                  <option value="created">Created</option>
                  <option value="revised">Revised</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="overdue">Overdue</option>
                  <option value="paid">Paid</option>
                </select>
                <span className="ol-field-help">Only changes this user's default invoice view.</span>
              </label>
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Screen comfort and exports</div>
                <p className="ol-form-band-copy">These are personal display and download preferences. They do not change company records.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label">Table spacing</span>
                <select
                  className="ol-select"
                  value={userSettings.tableDensity}
                  onChange={(event) => updateUserSetting('tableDensity', event.target.value as WebUserSettings['tableDensity'])}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
                <span className="ol-field-help">Changes list spacing for this user.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Rows per page</span>
                <select
                  className="ol-select"
                  value={String(userSettings.rowsPerPage)}
                  onChange={(event) => updateUserSetting('rowsPerPage', Number(event.target.value))}
                >
                  <option value="10">10 rows</option>
                  <option value="25">25 rows</option>
                  <option value="50">50 rows</option>
                  <option value="100">100 rows</option>
                </select>
                <span className="ol-field-help">Used by larger web lists.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Default export</span>
                <select
                  className="ol-select"
                  value={userSettings.defaultExportFormat}
                  onChange={(event) => updateUserSetting('defaultExportFormat', event.target.value as WebUserSettings['defaultExportFormat'])}
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="both">PDF and CSV</option>
                </select>
                <span className="ol-field-help">Export screens can still be changed each time.</span>
              </label>
            </div>
          </div>
          <div aria-live="polite" className="ol-settings-save-row" data-state={userSettingsSaveState}>
            <span>{userSettingsSaveMessage}</span>
            <small>
              {userSettings.updatedAt ? `Last saved ${formatSettingsSavedAt(userSettings.updatedAt)}` : 'Safe changes save automatically.'}
            </small>
          </div>
        </section>

      <form className="ol-panel-glass ol-settings-section" id="company-settings" onSubmit={saveWorkspaceProfile}>
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Company Settings</div>
            <p className="ol-panel-copy">
              Keep the business identity consistent across invoices, reports, settings, and backup names.
            </p>
          </div>
        </div>

        <div className="ol-form-grid">
          <div className="ol-form-row ol-form-row--auto">
            <ProfileField
              error={fieldErrors.businessName}
              label="Business name"
              value={profile.businessName}
              onBlur={() => handleFieldBlur('businessName')}
              onChange={(value) => handleFieldChange('businessName', value)}
            />
            <ProfileField
              error={fieldErrors.ownerName}
              label="Owner name"
              value={profile.ownerName}
              onBlur={() => handleFieldBlur('ownerName')}
              onChange={(value) => handleFieldChange('ownerName', value)}
            />
            <ProfileField
              error={fieldErrors.phone}
              inputMode="tel"
              label="Phone"
              value={profile.phone}
              onBlur={() => handleFieldBlur('phone')}
              onChange={(value) => handleFieldChange('phone', value)}
            />
          </div>
          <div className="ol-form-row ol-form-row--auto">
            <ProfileField
              error={fieldErrors.email}
              inputMode="email"
              label="Email"
              type="email"
              value={profile.email}
              onBlur={() => handleFieldBlur('email')}
              onChange={(value) => handleFieldChange('email', value)}
            />
            <ProfileField
              label="Address"
              value={profile.address}
              onChange={(value) => handleFieldChange('address', value)}
            />
            <label className="ol-field">
              <span className="ol-field-label">Country</span>
              <select className="ol-select" disabled value={INDIA_COUNTRY.code}>
                <option value={INDIA_COUNTRY.code}>{INDIA_COUNTRY.name}</option>
              </select>
            </label>
          </div>
          <div className="ol-form-row ol-form-row--3">
            <label className="ol-field">
              <span className="ol-field-label">Currency</span>
              <select className="ol-select" disabled value={INDIA_COUNTRY.currency}>
                <option value={INDIA_COUNTRY.currency}>{INDIA_COUNTRY.currency}</option>
              </select>
            </label>
            <label className={`ol-field${fieldErrors.stateCode ? ' is-invalid' : ''}`}>
              <span className="ol-field-label">State</span>
              <select
                className="ol-select"
                value={profile.stateCode}
                onBlur={() => handleFieldBlur('stateCode')}
                onChange={(event) => handleFieldChange('stateCode', event.target.value)}
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
              {fieldErrors.stateCode ? (
                <span className="ol-field-error">{fieldErrors.stateCode}</span>
              ) : null}
            </label>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Legal and contact details</div>
                <p className="ol-form-band-copy">Optional details used on exports, invoices, statements, and payment pages.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <ProfileField label="Legal business name" value={profile.legalName} onChange={(value) => handleFieldChange('legalName', value)} />
              <ProfileField label="Business type" value={profile.businessType} onChange={(value) => handleFieldChange('businessType', value)} />
              <ProfileField label="Contact person" value={profile.contactPerson} onChange={(value) => handleFieldChange('contactPerson', value)} />
              <ProfileField inputMode="tel" label="WhatsApp" value={profile.whatsapp} onChange={(value) => handleFieldChange('whatsapp', value)} />
              <ProfileField label="Website" value={profile.website} onChange={(value) => handleFieldChange('website', value)} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Registered address</div>
                <p className="ol-form-band-copy">Structured address fields keep documents and exports cleaner than one long address line.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <ProfileField label="Address line 1" value={profile.addressLine1} onChange={(value) => handleFieldChange('addressLine1', value)} />
              <ProfileField label="Address line 2" value={profile.addressLine2} onChange={(value) => handleFieldChange('addressLine2', value)} />
              <label className="ol-field">
                <span className="ol-field-label">City</span>
                <select
                  className="ol-select"
                  value={profile.city || getDefaultIndianCity(profile.stateCode)}
                  onChange={(event) => handleFieldChange('city', event.target.value)}
                >
                  {getIndianCityOptions(profile.stateCode).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <ProfileField label="Town / village" value={profile.town} onChange={(value) => handleFieldChange('town', value)} />
              <ProfileField label="PIN / postcode" value={profile.postalCode} onChange={(value) => handleFieldChange('postalCode', value)} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Tax identity</div>
                <p className="ol-form-band-copy">Optional tax and registration details used on customer-facing documents.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <ProfileField label="GSTIN" value={profile.gstin} onChange={(value) => handleFieldChange('gstin', value.toUpperCase())} />
              <ProfileField label="PAN" value={profile.pan} onChange={(value) => handleFieldChange('pan', value.toUpperCase())} />
              <ProfileField label="VAT / tax number" value={profile.taxNumber} onChange={(value) => handleFieldChange('taxNumber', value)} />
              <ProfileField label="Registration number" value={profile.registrationNumber} onChange={(value) => handleFieldChange('registrationNumber', value)} />
              <ProfileField label="Place of supply" value={profile.placeOfSupply} onChange={(value) => handleFieldChange('placeOfSupply', value)} />
            </div>
          </div>
        </div>

        <div className="ol-actions ol-form-actions">
          <button className="ol-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save company profile'}
          </button>
        </div>
      </form>

      <section className="ol-panel-glass ol-settings-section" id="invoice-document-settings">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Invoice & Document Settings</div>
            <p className="ol-panel-copy">
              Choose document defaults, tax treatment, and saved branding for invoices, statements, and exports.
            </p>
          </div>
        </div>
        <div className="ol-form-band">
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Document defaults</div>
              <p className="ol-form-band-copy">These choices shape new documents without changing already saved invoice versions.</p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <ProfileField label="Tax treatment" value={profile.defaultTaxTreatment} onChange={(value) => handleFieldChange('defaultTaxTreatment', value)} />
            <ProfileField inputMode="decimal" label="Default tax %" value={profile.defaultTaxRate} onChange={(value) => handleFieldChange('defaultTaxRate', value)} />
            <ProfileField label="Default payment terms" value={profile.defaultPaymentTerms} onChange={(value) => handleFieldChange('defaultPaymentTerms', value)} />
            <ProfileField inputMode="numeric" label="Default due days" value={profile.defaultDueDays} onChange={(value) => handleFieldChange('defaultDueDays', value)} />
            <TemplateSelect
              isPro={subscription.isPro}
              label="Default invoice template"
              templates={invoiceTemplates}
              value={profile.defaultInvoiceTemplate}
              onChange={(value) => handleFieldChange('defaultInvoiceTemplate', value)}
            />
            <TemplateSelect
              isPro={subscription.isPro}
              label="Default statement template"
              templates={statementTemplates}
              value={profile.defaultStatementTemplate}
              onChange={(value) => handleFieldChange('defaultStatementTemplate', value)}
            />
            <ProfileField label="Default language" value={profile.defaultLanguage} onChange={(value) => handleFieldChange('defaultLanguage', value)} />
          </div>
          <label className="ol-field" style={{ marginTop: 16 }}>
            <span className="ol-field-label">Default invoice notes</span>
            <textarea
              className="ol-textarea"
              placeholder="Thank you for your business. Please mention the invoice number while paying."
              value={profile.defaultInvoiceNotes}
              onChange={(event) => handleFieldChange('defaultInvoiceNotes', event.target.value)}
            />
            <span className="ol-field-help">New invoices start with this note. Existing saved invoice versions stay unchanged.</span>
          </label>
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Monthly invoice email defaults</div>
              <p className="ol-form-band-copy">
                New customer auto-email rules start with these defaults. Each customer rule can still use its own recipient,
                send day, payment-link choice, subject, and message.
              </p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <label className="ol-checkbox-row">
              <input
                className="ol-checkbox"
                checked={profile.defaultRecurringEmailAttachPdf}
                type="checkbox"
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    defaultRecurringEmailAttachPdf: event.target.checked,
                  }))
                }
              />
              <span>Attach invoice PDF by default</span>
            </label>
            <label className="ol-checkbox-row">
              <input
                className="ol-checkbox"
                checked={profile.defaultRecurringEmailIncludePaymentLink}
                type="checkbox"
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    defaultRecurringEmailIncludePaymentLink: event.target.checked,
                  }))
                }
              />
              <span>Include payment link by default</span>
            </label>
            <label className="ol-checkbox-row ol-field--wide">
              <input
                className="ol-checkbox"
                checked={profile.defaultRecurringEmailCurrentMonthOnly}
                type="checkbox"
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    defaultRecurringEmailCurrentMonthOnly: event.target.checked,
                  }))
                }
              />
              <span>Do not email past-month catch-up invoices automatically</span>
            </label>
            <div className="ol-field-help ol-field--wide" style={{ maxWidth: 'none' }}>
              Past catch-up invoices stay in review unless you send them yourself.
            </div>
            <label className="ol-field">
              <span className="ol-field-label">Default send day</span>
              <select
                className="ol-select"
                value={profile.defaultRecurringEmailSendDayBehavior}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    defaultRecurringEmailSendDayBehavior: event.target.value as ProfileFormState['defaultRecurringEmailSendDayBehavior'],
                  }))
                }
              >
                <option value="same_day">Same day as invoice</option>
                <option value="custom_day">Choose a monthly day</option>
              </select>
              <span className="ol-field-help">Day 31 becomes the last valid day for shorter months.</span>
            </label>
            {profile.defaultRecurringEmailSendDayBehavior === 'custom_day' ? (
              <label className="ol-field">
                <span className="ol-field-label">Monthly email day</span>
                <select
                  className="ol-select"
                  value={profile.defaultRecurringEmailDay || '1'}
                  onChange={(event) => handleFieldChange('defaultRecurringEmailDay', event.target.value)}
                >
                  {monthlyDayOptions().map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <ProfileField
              label="Default email subject"
              value={profile.defaultRecurringEmailSubject}
              onChange={(value) => handleFieldChange('defaultRecurringEmailSubject', value)}
            />
          </div>
          <label className="ol-field" style={{ marginTop: 16 }}>
            <span className="ol-field-label">Default email body</span>
            <textarea
              className="ol-textarea"
              rows={8}
              value={profile.defaultRecurringEmailBody}
              onChange={(event) => handleFieldChange('defaultRecurringEmailBody', event.target.value)}
            />
            <span className="ol-field-help">
              Tokens: {'{{customerName}}'}, {'{{invoiceNumber}}'}, {'{{paymentLink}}'}, {'{{amountDue}}'}, {'{{businessName}}'}.
            </span>
          </label>
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Download naming and footer</div>
              <p className="ol-form-band-copy">Keep PDF and CSV downloads easy to find without changing invoice data.</p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <label className="ol-field">
              <span className="ol-field-label">PDF / CSV file name</span>
              <select
                className="ol-select"
                value={profile.documentFilenameFormat}
                onChange={(event) => handleFieldChange('documentFilenameFormat', event.target.value)}
              >
                <option value="customer_invoice_date_revision_country">Customer, invoice, date, version, country</option>
                <option value="invoice_customer_date">Invoice, customer, date</option>
                <option value="date_customer_invoice">Date, customer, invoice</option>
              </select>
              <span className="ol-field-help">The safest default keeps version and country in the file name.</span>
            </label>
            <label className="ol-field">
              <span className="ol-field-label">Footer preference</span>
              <select
                className="ol-select"
                value={profile.documentFooterPreference}
                onChange={(event) => handleFieldChange('documentFooterPreference', event.target.value)}
              >
                <option value="auto">Auto by plan</option>
                <option value="always_show">Always show Orbit Ledger footer</option>
                <option value="hide_when_pro">Hide on Pro documents</option>
              </select>
              <span className="ol-field-help">Free documents still include the Orbit Ledger footer.</span>
            </label>
          </div>
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Premium brand colors</div>
              <p className="ol-form-band-copy">These colors apply to Pro document templates after Pro access is active.</p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <ColorField label="Header color" value={profile.documentBrandHeaderColor} onChange={(value) => handleFieldChange('documentBrandHeaderColor', value)} />
            <ColorField label="Background color" value={profile.documentBrandBackgroundColor} onChange={(value) => handleFieldChange('documentBrandBackgroundColor', value)} />
            <ColorField label="Font color" value={profile.documentBrandFontColor} onChange={(value) => handleFieldChange('documentBrandFontColor', value)} />
          </div>
        </div>
        <div className="ol-asset-grid">
          <IdentityAssetCard
            accept="image/png,image/jpeg,image/webp"
            fileInputRef={logoInputRef}
            imageAlt="Business logo"
            imageUrl={profile.logoUri}
            isBusy={uploadingAsset === 'logo' || isSaving}
            title="Logo"
            onPick={(file) => void handleAssetPicked('logo', file)}
            onRemove={() => void removeAsset('logo')}
          />
          <IdentityAssetCard
            accept="image/png,image/jpeg,image/webp"
            fileInputRef={signatureInputRef}
            imageAlt="Authorized signature"
            imageUrl={profile.signatureUri}
            isBusy={uploadingAsset === 'signature' || isSaving}
            title="Signature"
            onPick={(file) => void handleAssetPicked('signature', file)}
            onRemove={() => void removeAsset('signature')}
          />
          <IdentityAssetCard
            accept="image/png,image/jpeg,image/webp"
            fileInputRef={watermarkInputRef}
            imageAlt="Document watermark"
            imageUrl={profile.documentWatermarkImageUri}
            isBusy={uploadingAsset === 'watermark' || isSaving}
            title="Watermark image"
            onPick={(file) => void handleAssetPicked('watermark', file)}
            onRemove={() => void removeAsset('watermark')}
          />
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Premium watermark</div>
              <p className="ol-form-band-copy">
                Pro invoices can use text, the saved company logo, or a separate uploaded image as a watermark.
              </p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <label className="ol-field">
              <span className="ol-field-label">Watermark type</span>
              <select
                className="ol-select"
                value={profile.documentWatermarkType}
                onChange={(event) =>
                  handleFieldChange('documentWatermarkType', event.target.value as ProfileFormState['documentWatermarkType'])
                }
              >
                <option value="none">No watermark</option>
                <option value="text">Text watermark</option>
                <option value="logo">Use company logo</option>
                <option value="image">Use uploaded watermark image</option>
              </select>
            </label>
            <ProfileField
              label="Watermark text"
              value={profile.documentWatermarkText}
              onChange={(value) => handleFieldChange('documentWatermarkText', value)}
            />
            <label className="ol-field">
              <span className="ol-field-label">Watermark opacity</span>
              <input
                className="ol-range"
                max="0.3"
                min="0.02"
                step="0.01"
                type="range"
                value={profile.documentWatermarkOpacity}
                onChange={(event) => handleFieldChange('documentWatermarkOpacity', event.target.value)}
              />
              <span className="ol-field-helper">{Math.round(Number(profile.documentWatermarkOpacity || 0.08) * 100)}%</span>
            </label>
          </div>
        </div>
        <div className="ol-actions ol-form-actions">
          <button className="ol-button" disabled={isSaving} type="button" onClick={() => void saveWorkspaceProfile()}>
            {isSaving ? 'Saving...' : 'Save document settings'}
          </button>
        </div>
      </section>

      <section className="ol-panel-glass ol-settings-section" id="payment-settings">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Payment Settings</div>
            <p className="ol-panel-copy">
              Keep customer-facing payment instructions separate from profile edits. Bank and UPI changes require confirmation.
            </p>
          </div>
          <span className={`ol-chip ${paymentInstructionChanges.length ? 'ol-chip--warning' : 'ol-chip--success'}`}>
            {paymentInstructionChanges.length ? 'Review needed' : 'Safe'}
          </span>
        </div>
        <div className="ol-form-band">
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Important payment details</div>
              <p className="ol-form-band-copy">These details can affect where customers send money, so Orbit Ledger asks for confirmation before saving.</p>
            </div>
          </div>
          <div className="ol-settings-payment-guard">
            <div>
              <strong>{paymentInstructionChanges.length ? 'Unsaved payment detail changes' : 'Payment details are unchanged'}</strong>
              <span>{paymentInstructionSummary}</span>
            </div>
            <div>
              Invoice terms and due days stay in Invoice & Document Settings. This section is only for payment instructions.
            </div>
          </div>
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">{paymentTemplate.title}</div>
              <p className="ol-form-band-copy">{paymentTemplate.helper} These details appear on invoices and payment messages.</p>
            </div>
          </div>
          <div className="ol-form-grid">
            <div className="ol-form-row ol-form-row--payment-settings">
              {paymentTemplate.fields.map((field) => (
                <label className="ol-field" key={field.key}>
                  <span className="ol-field-label">{field.label}</span>
                  <input
                    className="ol-input"
                    placeholder={field.placeholder}
                    value={String(paymentInstructions[field.key] ?? '')}
                    onChange={(event) => updatePaymentInstruction(field.key, event.target.value)}
                  />
                  <span className="ol-field-help">{field.helper}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <label className="ol-field" style={{ marginTop: 18 }}>
          <span className="ol-field-label">Change note</span>
          <input
            className="ol-input"
            placeholder="Example: Updated bank account after branch change"
            value={paymentAuditReason}
            onChange={(event) => setPaymentAuditReason(event.target.value)}
          />
          <span className="ol-field-help">Saved in payment settings history. Keep it short and clear.</span>
        </label>
        <div className="ol-actions ol-form-actions">
          <button
            className="ol-button"
            disabled={isSaving || !paymentInstructionChanges.length}
            type="button"
            onClick={() => void savePaymentSettings()}
          >
            {isSaving ? 'Saving...' : 'Save payment details'}
          </button>
        </div>
      </section>

      <section className="ol-panel ol-settings-section" id="security-settings">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Security + Device Settings</div>
            <p className="ol-panel-copy">
              These controls stay on this browser. They are separate from your sign-in password, company details, and business backups.
            </p>
          </div>
          <span className={`ol-chip ${isEnabled ? 'ol-chip--premium' : 'ol-chip--warning'}`}>
            {isEnabled ? 'On here' : 'Off'}
          </span>
        </div>

        <div className="ol-form-row ol-form-row--lock">
          <label className={`ol-field${pinError ? ' is-invalid' : ''}`}>
            <span className="ol-field-label">PIN</span>
            <input
              className="ol-input ol-input--pin ol-input--pin-left"
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={pinInput}
              onBlur={() => {
                if (pinInput.length > 0 && pinInput.length < 4) {
                  setPinError('Use a 4-digit PIN.');
                }
              }}
              onChange={(event) => {
                setPinInput(event.target.value.replace(/\D/g, '').slice(0, 4));
                if (pinError) {
                  setPinError(null);
                }
              }}
            />
            {pinError ? <span className="ol-field-error">{pinError}</span> : null}
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Lock timeout</span>
            <select
              className="ol-select"
              value={String(timeoutMs)}
              onChange={(event) => void setTimeoutMs(Number(event.target.value))}
            >
              <option value={String(60_000)}>1 minute</option>
              <option value={String(5 * 60_000)}>5 minutes</option>
              <option value={String(15 * 60_000)}>15 minutes</option>
            </select>
          </label>
          <div className="ol-field ol-field--action">
            <span className="ol-field-label">Action</span>
            {!isEnabled ? (
              <button className="ol-button" type="button" onClick={() => void enableBrowserLock()}>
                Turn On Lock
              </button>
            ) : (
              <button className="ol-button-secondary" type="button" onClick={() => void disableBrowserLock()}>
                Turn Off Lock
              </button>
            )}
          </div>
        </div>

        <div className="ol-settings-device-grid">
          <ToggleSetting
            checked={deviceSettings.maskBalances}
            label="Hide balances on this browser"
            note="Masks visible money amounts on screen. Invoices, exports, and saved records still keep exact values."
            statusTone={deviceSettings.maskBalances ? 'on' : 'off'}
            status={deviceSettings.maskBalances ? 'On now' : 'Off now'}
            onChange={(checked) => updateDeviceSetting('maskBalances', checked)}
          />
          <ToggleSetting
            checked={deviceSettings.largerText}
            label="Larger text on this browser"
            note="Makes app text more readable on this device without changing anyone else's view."
            statusTone={deviceSettings.largerText ? 'on' : 'off'}
            status={deviceSettings.largerText ? 'On now' : 'Off now'}
            onChange={(checked) => updateDeviceSetting('largerText', checked)}
          />
          <ToggleSetting
            checked={deviceSettings.reducedMotion}
            label="Reduce motion on this browser"
            note="Calms animations and transitions on this device only."
            statusTone={deviceSettings.reducedMotion ? 'on' : 'off'}
            status={deviceSettings.reducedMotion ? 'On now' : 'Off now'}
            onChange={(checked) => updateDeviceSetting('reducedMotion', checked)}
          />
        </div>

        <div aria-live="polite" className="ol-settings-save-row" data-state="saved">
          <span>These settings stay on this browser.</span>
          <small>
            {deviceSettings.updatedAt ? `Last changed ${formatSettingsSavedAt(deviceSettings.updatedAt)}` : 'No device preference changes yet.'}
          </small>
          {isEnabled ? (
            <button className="ol-button-secondary" type="button" onClick={lockNow}>
              Lock now
            </button>
          ) : null}
        </div>

        <div className="ol-review-grid ol-review-grid--security">
          <div className="ol-review-item">
            <span className="ol-review-label">Secure sign-in session</span>
            <strong className="ol-review-value">30 minutes idle</strong>
          </div>
          <div className="ol-review-item">
            <span className="ol-review-label">Maximum session</span>
            <strong className="ol-review-value">8 hours</strong>
          </div>
          <div className="ol-review-item">
            <span className="ol-review-label">Backup behavior</span>
            <strong className="ol-review-value">This browser only</strong>
          </div>
        </div>
      </section>

      <section className="ol-panel-glass ol-settings-section" id="backup-data-settings">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Backup & Data</div>
            <p className="ol-panel-copy">
              Keep profile details, backup, reports, and launch readiness easy to review.
            </p>
          </div>
        </div>
        <div className="ol-review-grid">
          <div className="ol-review-item">
            <span className="ol-review-label">Profile</span>
            <strong className="ol-review-value">{profile.businessName ? 'Ready' : 'Needs business name'}</strong>
          </div>
          <div className="ol-review-item">
            <span className="ol-review-label">Browser lock</span>
            <strong className="ol-review-value">{isEnabled ? 'On' : 'Off'}</strong>
          </div>
          <div className="ol-review-item">
            <span className="ol-review-label">Backup</span>
            <Link className="ol-inline-link" href="/backup">
              Open backup
            </Link>
          </div>
          <div className="ol-review-item">
            <span className="ol-review-label">Reports</span>
            <Link className="ol-inline-link" href="/reports">
              Open reports
            </Link>
          </div>
        </div>
      </section>

      <section className="ol-panel-glass ol-settings-section" id="notifications-reminders-settings">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Notifications & Reminders</div>
            <p className="ol-panel-copy">
              Set follow-up rhythm, reminder wording, and backup nudges without changing saved invoice details.
            </p>
          </div>
          <span className="ol-chip ol-chip--success">Saved for business</span>
        </div>
        <div className="ol-form-band">
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Reminder rhythm</div>
              <p className="ol-form-band-copy">These defaults guide follow-up screens and new reminder drafts.</p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <label className="ol-field">
              <span className="ol-field-label">Reminder style</span>
              <select className="ol-select" value={profile.reminderStyle} onChange={(event) => handleFieldChange('reminderStyle', event.target.value)}>
                <option value="soft">Soft</option>
                <option value="firm">Firm</option>
                <option value="urgent">Urgent</option>
              </select>
              <span className="ol-field-help">Controls the default tone used when preparing payment reminders.</span>
            </label>
            <label className="ol-field">
              <span className="ol-field-label">Overdue alert starts</span>
              <select className="ol-select" value={profile.overdueAlertTiming} onChange={(event) => handleFieldChange('overdueAlertTiming', event.target.value)}>
                <option value="same_day">On due date</option>
                <option value="one_day_after">1 day after due date</option>
                <option value="three_days_after">3 days after due date</option>
                <option value="one_week_after">1 week after due date</option>
              </select>
            </label>
            <ProfileField
              inputMode="numeric"
              label="Follow-up every"
              value={profile.followUpCadenceDays}
              onChange={(value) => handleFieldChange('followUpCadenceDays', value)}
            />
            <label className="ol-field">
              <span className="ol-field-label">Payment notice tone</span>
              <select className="ol-select" value={profile.paymentNoticeTone} onChange={(event) => handleFieldChange('paymentNoticeTone', event.target.value)}>
                <option value="friendly">Friendly</option>
                <option value="direct">Direct</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="ol-field">
              <span className="ol-field-label">Backup reminder</span>
              <select className="ol-select" value={profile.backupReminderFrequency} onChange={(event) => handleFieldChange('backupReminderFrequency', event.target.value)}>
                <option value="off">Off</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <div className="ol-settings-toggle-grid" style={{ marginTop: 14 }}>
            <ToggleSetting
              checked={profile.urgentPaymentStampDefault}
              label="Add urgent stamp by default"
              note="New invoice documents start with the payment required urgently stamp on. Users can still turn it off per invoice."
              statusTone={profile.urgentPaymentStampDefault ? 'on' : 'off'}
              status={profile.urgentPaymentStampDefault ? 'On for new invoices' : 'Off by default'}
              onChange={(checked) => setProfile((current) => ({ ...current, urgentPaymentStampDefault: checked }))}
            />
          </div>
        </div>
        <div className="ol-form-band" style={{ marginTop: 18 }}>
          <div className="ol-form-band-header">
            <div>
              <div className="ol-form-band-title">Message templates</div>
              <p className="ol-form-band-copy">Use placeholders: {'{{customerName}}'}, {'{{businessName}}'}, {'{{balance}}'}, {'{{amount}}'}, {'{{reference}}'}.</p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <TemplateTextarea
              label="WhatsApp reminder"
              value={profile.whatsappReminderTemplate}
              onChange={(value) => handleFieldChange('whatsappReminderTemplate', value)}
            />
            <TemplateTextarea
              label="Email reminder"
              value={profile.emailReminderTemplate}
              onChange={(value) => handleFieldChange('emailReminderTemplate', value)}
            />
            <TemplateTextarea
              label="Payment thank-you"
              value={profile.paymentThankYouTemplate}
              onChange={(value) => handleFieldChange('paymentThankYouTemplate', value)}
            />
            <TemplateTextarea
              label="Bounced payment"
              value={profile.bouncedPaymentTemplate}
              onChange={(value) => handleFieldChange('bouncedPaymentTemplate', value)}
            />
          </div>
        </div>
        <div className="ol-actions ol-form-actions">
          <button className="ol-button" disabled={isSaving} type="button" onClick={() => void saveWorkspaceProfile()}>
            {isSaving ? 'Saving...' : 'Save reminder settings'}
          </button>
        </div>
      </section>
      </div>
    </AppShell>
  );
}

function getAssetUrl(profile: ProfileFormState, kind: WorkspaceIdentityAssetKind) {
  if (kind === 'logo') {
    return profile.logoUri;
  }
  if (kind === 'signature') {
    return profile.signatureUri;
  }
  return profile.documentWatermarkImageUri;
}

function buildUserSettingsSignature(settings: WebUserSettings) {
  return JSON.stringify({
    dashboardView: settings.dashboardView,
    tableDensity: settings.tableDensity,
    rowsPerPage: settings.rowsPerPage,
    defaultDateRange: settings.defaultDateRange,
    defaultCustomerFilter: settings.defaultCustomerFilter,
    defaultInvoiceFilter: settings.defaultInvoiceFilter,
    balancePrivacyMode: settings.balancePrivacyMode,
    largerText: settings.largerText,
    reducedMotion: settings.reducedMotion,
    defaultExportFormat: settings.defaultExportFormat,
  });
}

function getUserSettingsSaveLabel(state: UserSettingsSaveState) {
  if (state === 'loading') {
    return 'Loading';
  }
  if (state === 'saving') {
    return 'Saving...';
  }
  if (state === 'error') {
    return 'Could not save';
  }
  if (state === 'saved') {
    return 'Saved';
  }
  return 'Ready';
}

function getUserSettingsSaveChipClass(state: UserSettingsSaveState) {
  if (state === 'error') {
    return 'ol-chip--danger';
  }
  if (state === 'loading' || state === 'saving') {
    return 'ol-chip--warning';
  }
  if (state === 'saved') {
    return 'ol-chip--success';
  }
  return '';
}

function SettingsPreviewCard({ copy, title }: { title: string; copy: string }) {
  return (
    <article className="ol-settings-preview-card">
      <strong>{title}</strong>
      <span>{copy}</span>
    </article>
  );
}

function ToggleSetting({
  checked,
  label,
  note,
  status,
  statusTone = 'neutral',
  onChange,
}: {
  checked: boolean;
  label: string;
  note: string;
  status?: string;
  statusTone?: 'neutral' | 'on' | 'off';
  onChange(checked: boolean): void;
}) {
  return (
    <label className="ol-settings-toggle">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span className="ol-settings-toggle-control" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{note}</small>
        {status ? <em data-tone={statusTone}>{status}</em> : null}
      </span>
    </label>
  );
}

function formatSettingsSavedAt(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function monthlyDayOptions(): number[] {
  return Array.from({ length: 31 }, (_, index) => index + 1);
}

function defaultRecurringEmailSubject(): string {
  return 'Invoice {{invoiceNumber}} from {{businessName}}';
}

function defaultRecurringEmailBody(): string {
  return 'Hello {{customerName}},\n\nYour invoice {{invoiceNumber}} is attached.\n\nYou can pay here:\n{{paymentLink}}\n\nThank you,\n{{businessName}}';
}

function ProfileField({
  error,
  inputMode,
  label,
  onBlur,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  value: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  error?: string | null;
  onBlur?(): void;
  onChange(value: string): void;
}) {
  return (
    <label className={`ol-field${error ? ' is-invalid' : ''}`}>
      <span className="ol-field-label">{label}</span>
      <input
        className="ol-input"
        inputMode={inputMode}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="ol-field-error">{error}</span> : null}
    </label>
  );
}

function TemplateSelect({
  isPro,
  label,
  onChange,
  templates,
  value,
}: {
  label: string;
  isPro: boolean;
  templates: WebDocumentTemplate[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <select className="ol-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Use Orbit Ledger default</option>
        {templates.map((template) => (
          <option disabled={template.tier === 'pro' && !isPro} key={template.key} value={template.key}>
            {template.tier === 'pro' ? `${template.label} · Pro Plus` : `${template.label} · Free`}
          </option>
        ))}
      </select>
      <span className="ol-field-help">Pro Plus templates can be previewed from Templates and stay locked until your plan includes them.</span>
    </label>
  );
}

function ColorField({
  label,
  onChange,
  value,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <div className="ol-color-field">
        <input aria-label={label} type="color" value={value || '#145C52'} onChange={(event) => onChange(event.target.value)} />
        <input
          className="ol-input"
          maxLength={7}
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
      <span className="ol-field-help">Use a six-digit color code.</span>
    </label>
  );
}

function TemplateTextarea({
  label,
  onChange,
  value,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <textarea className="ol-textarea" value={value} onChange={(event) => onChange(event.target.value)} />
      <span className="ol-field-help">Keep it clear and customer-friendly.</span>
    </label>
  );
}

function IdentityAssetCard({
  accept,
  fileInputRef,
  imageAlt,
  imageUrl,
  isBusy,
  onPick,
  onRemove,
  title,
}: {
  accept: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageAlt: string;
  imageUrl: string | null;
  isBusy: boolean;
  title: string;
  onPick(file: File | null): void;
  onRemove(): void;
}) {
  return (
    <article className="ol-asset-card">
      <div className="ol-asset-preview">
        {imageUrl ? (
          <img alt={imageAlt} src={imageUrl} />
        ) : (
          <span>{title}</span>
        )}
      </div>
      <div className="ol-asset-body">
        <div>
          <div className="ol-asset-title">{title}</div>
          <div className="ol-asset-copy">PNG, JPG, or WebP up to 2 MB.</div>
        </div>
        <div className="ol-actions ol-actions--compact">
          <button
            className="ol-button-secondary"
            disabled={isBusy}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            {imageUrl ? 'Replace' : 'Upload'}
          </button>
          {imageUrl ? (
            <button className="ol-button-ghost" disabled={isBusy} type="button" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        hidden
        accept={accept}
        ref={fileInputRef}
        type="file"
        onChange={(event) => {
          onPick(event.target.files?.[0] ?? null);
          event.currentTarget.value = '';
        }}
      />
    </article>
  );
}
