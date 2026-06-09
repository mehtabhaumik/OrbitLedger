'use client';

import Link from 'next/link';
import type {
  OrbitEntityComplianceFlags,
  OrbitEntitySubtype,
  OrbitEntityType,
  OrbitEntityVerificationStatus,
} from '@orbit-ledger/contracts';
import {
  ORBIT_VERIFICATION_DOCUMENT_ACCEPT,
  ORBIT_ENTITY_TYPE_OPTIONS,
  buildSmartInvoiceNumber,
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
import { buildWorkspaceProfileView } from '@/lib/workspace-profile-view';
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
  WEB_ENTITY_SUBTYPE_LABELS,
  buildWebEntityProfileUiModel,
  getEntityBusinessNameLabel,
  getEntityOwnerNameLabel,
  getEntityPanLabel,
  isEntityProfileFieldRequiredForVerification,
  shouldShowEntityProfileField,
} from '@/lib/entity-profile-ui';
import {
  buildWebEntityVerificationDocumentChecklist,
  type WebEntityVerificationDocumentRow,
} from '@/lib/entity-verification-documents-ui';
import {
  DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM,
  WEB_DOCUMENT_VAULT_ATTESTATION_TEXT,
  WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS,
  buildWebDocumentVaultTypeOptions,
  getWebDocumentVaultTypeOption,
  listWorkspaceDocumentVault,
  uploadWorkspaceDocumentVaultRecord,
  validateWebDocumentVaultUpload,
  type WebDocumentVaultRecord,
  type WebDocumentVaultUploadForm,
} from '@/lib/document-vault';
import {
  WEB_ADDRESS_CHANGE_REASON_OPTIONS,
  buildAddressChangeRequestKey,
  buildWorkspaceAddressChanges,
  formatAddressChangeAuditReason,
  isAddressChangeReasonComplete,
  summarizeAddressChanges,
  type WebAddressChange,
  type WebAddressChangeReasonId,
} from '@/lib/address-change-reason';
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
import { buildWebLiveCollectionsSetupStatus } from '@/lib/live-collections-setup-status';
import { getWebPaymentProviderPlan } from '@/lib/payment-provider-mode';
import { DEFAULT_NOTIFICATION_REMINDER_PREFERENCES } from '@/lib/notification-preferences';
import {
  deleteWorkspaceStorageFile,
  uploadWorkspaceIdentityImage,
  validateWorkspaceIdentityImage,
  type WorkspaceIdentityAssetKind,
} from '@/lib/workspace-storage';
import {
  backfillWorkspaceInvoiceNumberKeys,
  listWorkspaceInvoiceNumberAuditTrail,
  scanWorkspaceInvoiceNumberHealth,
  type WorkspaceInvoiceNumberAuditItem,
  type WorkspaceInvoiceNumberHealth,
} from '@/lib/workspace-data';
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
  entityType: OrbitEntityType;
  entitySubtype: OrbitEntitySubtype | null;
  entityVerificationStatus: OrbitEntityVerificationStatus;
  entityComplianceFlags: OrbitEntityComplianceFlags;
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
  cin: string;
  llpin: string;
  taxNumber: string;
  registrationNumber: string;
  registeredOfficeAddress: string;
  principalPlaceOfBusiness: string;
  additionalPlacesOfBusiness: string;
  nonprofitRegistrationNumber: string;
  nonprofitRegistrationAuthority: string;
  ngoDarpanId: string;
  taxExemption12A12ABNumber: string;
  taxDeduction80GNumber: string;
  fcraRegistrationNumber: string;
  csrRegistrationNumber: string;
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
  invoiceNumberPrefix: string;
  invoiceNumberSeparator: '/' | '-';
  invoiceNumberPadding: string;
  invoiceNumberNextSequence: string;
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

type AddressReasonRequest = {
  changes: WebAddressChange[];
  requestKey: string;
};

const settingsHubLinks = [
  { href: '#my-settings', label: 'My Settings' },
  { href: '#company-settings', label: 'Entity Settings' },
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
  const vaultFileInputRef = useRef<HTMLInputElement | null>(null);
  const userSettingsReadyRef = useRef(false);
  const userSettingsSignatureRef = useRef('');
  const [invoiceNumberHealth, setInvoiceNumberHealth] = useState<WorkspaceInvoiceNumberHealth | null>(null);
  const [invoiceNumberAuditItems, setInvoiceNumberAuditItems] = useState<WorkspaceInvoiceNumberAuditItem[]>([]);
  const [isInvoiceNumberMaintenanceBusy, setIsInvoiceNumberMaintenanceBusy] = useState(false);
  const [isInvoiceNumberAuditBusy, setIsInvoiceNumberAuditBusy] = useState(false);
  const [profile, setProfile] = useState<ProfileFormState>({
    businessName: '',
    legalName: '',
    ownerName: '',
    contactPerson: '',
    businessType: '',
    entityType: 'sole_proprietorship',
    entitySubtype: null,
    entityVerificationStatus: 'draft',
    entityComplianceFlags: {
      gstRegistered: false,
      donationReceiptsEnabled: false,
      has12A12AB: false,
      has80G: false,
      receivesForeignContribution: false,
      hasFcra: false,
      acceptsCsrFunding: false,
      hasUdyam: false,
    },
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
    cin: '',
    llpin: '',
    taxNumber: '',
    registrationNumber: '',
    registeredOfficeAddress: '',
    principalPlaceOfBusiness: '',
    additionalPlacesOfBusiness: '',
    nonprofitRegistrationNumber: '',
    nonprofitRegistrationAuthority: '',
    ngoDarpanId: '',
    taxExemption12A12ABNumber: '',
    taxDeduction80GNumber: '',
    fcraRegistrationNumber: '',
    csrRegistrationNumber: '',
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
    invoiceNumberPrefix: '',
    invoiceNumberSeparator: '/',
    invoiceNumberPadding: '4',
    invoiceNumberNextSequence: '1',
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
  const [useCompanyAddressForRegistered, setUseCompanyAddressForRegistered] = useState(false);
  const [addressReasonRequest, setAddressReasonRequest] = useState<AddressReasonRequest | null>(null);
  const [addressChangeReason, setAddressChangeReason] = useState<WebAddressChangeReasonId>('office_relocation');
  const [addressChangeOtherReason, setAddressChangeOtherReason] = useState('');
  const [vaultDocuments, setVaultDocuments] = useState<WebDocumentVaultRecord[]>([]);
  const [vaultUploadForm, setVaultUploadForm] = useState<WebDocumentVaultUploadForm>(DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM);
  const [vaultFile, setVaultFile] = useState<File | null>(null);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [isVaultUploading, setIsVaultUploading] = useState(false);
  const [vaultUploadError, setVaultUploadError] = useState<string | null>(null);

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
      entityType: activeWorkspace.entityType ?? 'sole_proprietorship',
      entitySubtype: activeWorkspace.entitySubtype ?? null,
      entityVerificationStatus: activeWorkspace.entityVerificationStatus ?? 'draft',
      entityComplianceFlags: activeWorkspace.entityComplianceFlags ?? {
        gstRegistered: false,
        donationReceiptsEnabled: false,
        has12A12AB: false,
        has80G: false,
        receivesForeignContribution: false,
        hasFcra: false,
        acceptsCsrFunding: false,
        hasUdyam: false,
      },
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
      cin: activeWorkspace.cin ?? '',
      llpin: activeWorkspace.llpin ?? '',
      taxNumber: activeWorkspace.taxNumber ?? '',
      registrationNumber: activeWorkspace.registrationNumber ?? '',
      registeredOfficeAddress: activeWorkspace.registeredOfficeAddress ?? '',
      principalPlaceOfBusiness: activeWorkspace.principalPlaceOfBusiness ?? '',
      additionalPlacesOfBusiness: activeWorkspace.additionalPlacesOfBusiness?.join('\n') ?? '',
      nonprofitRegistrationNumber: activeWorkspace.nonprofitRegistrationNumber ?? '',
      nonprofitRegistrationAuthority: activeWorkspace.nonprofitRegistrationAuthority ?? '',
      ngoDarpanId: activeWorkspace.ngoDarpanId ?? '',
      taxExemption12A12ABNumber: activeWorkspace.taxExemption12A12ABNumber ?? '',
      taxDeduction80GNumber: activeWorkspace.taxDeduction80GNumber ?? '',
      fcraRegistrationNumber: activeWorkspace.fcraRegistrationNumber ?? '',
      csrRegistrationNumber: activeWorkspace.csrRegistrationNumber ?? '',
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
      invoiceNumberPrefix: activeWorkspace.invoiceNumberPrefix ?? '',
      invoiceNumberSeparator: activeWorkspace.invoiceNumberSeparator ?? '/',
      invoiceNumberPadding:
        activeWorkspace.invoiceNumberPadding !== null && activeWorkspace.invoiceNumberPadding !== undefined
          ? String(activeWorkspace.invoiceNumberPadding)
          : '4',
      invoiceNumberNextSequence:
        activeWorkspace.invoiceNumberNextSequence !== null && activeWorkspace.invoiceNumberNextSequence !== undefined
          ? String(activeWorkspace.invoiceNumberNextSequence)
          : '1',
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
    setUseCompanyAddressForRegistered(false);
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

  useEffect(() => {
    if (!activeWorkspace || !user) {
      setVaultDocuments([]);
      setVaultUploadForm(DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM);
      setVaultFile(null);
      setVaultUploadError(null);
      return;
    }

    let isMounted = true;
    setIsVaultLoading(true);
    setVaultUploadError(null);
    void listWorkspaceDocumentVault(activeWorkspace.workspaceId)
      .then((documents) => {
        if (isMounted) {
          setVaultDocuments(documents);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setVaultUploadError(error instanceof Error ? error.message : 'Document vault could not be loaded.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsVaultLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.workspaceId, user?.uid]);

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
  const workspaceProfile = buildWorkspaceProfileView(workspace);
  const paymentProviderPlan = getWebPaymentProviderPlan();
  const liveCollectionsSetupStatus = buildWebLiveCollectionsSetupStatus(paymentProviderPlan);
  const paymentTemplate = getManualPaymentInstructionTemplate(workspace.countryCode);
  const invoiceTemplates = getWebDocumentTemplates(workspace, 'invoice');
  const statementTemplates = getWebDocumentTemplates(workspace, 'statement');
  const invoiceNumberPreview = buildSmartInvoiceNumber({
    businessName: profile.businessName || workspaceProfile.displayName,
    workspaceId: workspace.workspaceId,
    issueDate: new Date().toISOString().slice(0, 10),
    sequenceNumber: normalizePositiveInteger(profile.invoiceNumberNextSequence, workspace.invoiceNumberNextSequence ?? 1),
    countryCode: workspace.countryCode,
    settings: {
      customPrefix: profile.invoiceNumberPrefix || workspace.invoiceNumberPrefix,
      separator: profile.invoiceNumberSeparator,
      sequencePadding: normalizePositiveInteger(profile.invoiceNumberPadding, workspace.invoiceNumberPadding ?? 4),
    },
  }).invoiceNumber;
  const paymentInstructionChanges = buildPaymentInstructionAuditChanges(workspace.paymentInstructions, paymentInstructions);
  const paymentInstructionSummary = summarizePaymentInstructionChanges(paymentInstructionChanges);
  const entityProfileUi = buildWebEntityProfileUiModel({
    entityType: profile.entityType,
    entitySubtype: profile.entitySubtype,
    entityVerificationStatus: profile.entityVerificationStatus,
    entityComplianceFlags: profile.entityComplianceFlags,
  });
  const verificationDocuments = buildWebEntityVerificationDocumentChecklist({
    entityType: profile.entityType,
    entitySubtype: profile.entitySubtype,
    entityComplianceFlags: profile.entityComplianceFlags,
  });
  const documentVaultTypeOptions = buildWebDocumentVaultTypeOptions({
    entityType: profile.entityType,
    entitySubtype: profile.entitySubtype,
    entityComplianceFlags: profile.entityComplianceFlags,
  });
  const showEntityField = (field: Parameters<typeof shouldShowEntityProfileField>[1]) =>
    shouldShowEntityProfileField(entityProfileUi, field);
  const isEntityFieldRequired = (field: Parameters<typeof isEntityProfileFieldRequiredForVerification>[1]) =>
    isEntityProfileFieldRequiredForVerification(entityProfileUi, field);

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
    let next =
      field === 'stateCode'
        ? {
            ...profile,
            stateCode: value,
            city: getIndianCityOptions(value).includes(profile.city)
              ? profile.city
              : getDefaultIndianCity(value),
          }
        : { ...profile, [field]: value };

    if (useCompanyAddressForRegistered && (field === 'address' || field === 'stateCode')) {
      next = withCompanyAddressAsRegistered(next);
    }
    if (['addressLine1', 'addressLine2', 'city', 'town'].includes(field)) {
      setUseCompanyAddressForRegistered(false);
    }
    if (isAddressReasonField(field)) {
      setAddressReasonRequest(null);
    }
    setProfile(next);

    if (field in touched && touched[field as ProfileFieldKey]) {
      const nextError = validateField(field as ProfileFieldKey, next);
      setFieldErrors((current) => ({ ...current, [field as ProfileFieldKey]: nextError }));
    }
  }

  function handleEntityTypeChange(value: string) {
    const entityType = value as OrbitEntityType;
    const option = ORBIT_ENTITY_TYPE_OPTIONS.find((entry) => entry.type === entityType);
    setProfile((current) => ({
      ...current,
      entityType,
      entitySubtype: option?.allowedSubtypes[0] ?? null,
      entityComplianceFlags:
        entityType === 'nonprofit_charity'
          ? current.entityComplianceFlags
          : {
              ...current.entityComplianceFlags,
              donationReceiptsEnabled: false,
              has12A12AB: false,
              has80G: false,
              receivesForeignContribution: false,
              hasFcra: false,
              acceptsCsrFunding: false,
            },
    }));
  }

  function handleEntitySubtypeChange(value: string) {
    setProfile((current) => ({
      ...current,
      entitySubtype: value ? (value as OrbitEntitySubtype) : null,
    }));
  }

  function handleComplianceFlagChange(field: keyof OrbitEntityComplianceFlags, checked: boolean) {
    setProfile((current) => ({
      ...current,
      entityComplianceFlags: {
        ...current.entityComplianceFlags,
        [field]: checked,
      },
    }));
  }

  function handleUseCompanyAddressForRegistered(checked: boolean) {
    setUseCompanyAddressForRegistered(checked);
    if (!checked) {
      return;
    }
    setProfile((current) => withCompanyAddressAsRegistered(current));
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
      entityType: nextProfile.entityType,
      entitySubtype: nextProfile.entitySubtype,
      entityVerificationStatus: nextProfile.entityVerificationStatus,
      entityComplianceFlags: nextProfile.entityComplianceFlags,
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
      cin: nextProfile.cin,
      llpin: nextProfile.llpin,
      taxNumber: nextProfile.taxNumber,
      registrationNumber: nextProfile.registrationNumber,
      registeredOfficeAddress: nextProfile.registeredOfficeAddress,
      principalPlaceOfBusiness: nextProfile.principalPlaceOfBusiness,
      additionalPlacesOfBusiness: splitProfileLines(nextProfile.additionalPlacesOfBusiness),
      nonprofitRegistrationNumber: nextProfile.nonprofitRegistrationNumber,
      nonprofitRegistrationAuthority: nextProfile.nonprofitRegistrationAuthority,
      ngoDarpanId: nextProfile.ngoDarpanId,
      taxExemption12A12ABNumber: nextProfile.taxExemption12A12ABNumber,
      taxDeduction80GNumber: nextProfile.taxDeduction80GNumber,
      fcraRegistrationNumber: nextProfile.fcraRegistrationNumber,
      csrRegistrationNumber: nextProfile.csrRegistrationNumber,
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
      invoiceNumberPrefix: nextProfile.invoiceNumberPrefix,
      invoiceNumberSeparator: nextProfile.invoiceNumberSeparator,
      invoiceNumberPadding: parseAmount(nextProfile.invoiceNumberPadding),
      invoiceNumberNextSequence: parseAmount(nextProfile.invoiceNumberNextSequence),
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

    const nextInput = buildWorkspaceProfileInput(profile);
    const addressChanges = buildWorkspaceAddressChanges(workspace, nextInput);
    const addressRequestKey = buildAddressChangeRequestKey(addressChanges);
    if (addressChanges.length) {
      if (!addressReasonRequest || addressReasonRequest.requestKey !== addressRequestKey) {
        setAddressReasonRequest({
          changes: addressChanges,
          requestKey: addressRequestKey,
        });
        showToast('Choose a reason before saving address changes.', 'info');
        return;
      }
      if (!isAddressChangeReasonComplete(addressChangeReason, addressChangeOtherReason)) {
        showToast('Add a clear reason for Other before saving address changes.', 'danger');
        return;
      }
      if (!user) {
        showToast('Sign in again before saving address changes.', 'danger');
        return;
      }
    } else if (addressReasonRequest) {
      setAddressReasonRequest(null);
    }

    setIsSaving(true);
    try {
      const protectedChanges = buildAuditProtectedSettingsChanges(workspace, nextInput);
      const addressAuditReason = addressChanges.length
        ? formatAddressChangeAuditReason(addressChangeReason, addressChangeOtherReason, addressChanges)
        : null;
      if (protectedChanges.length && user) {
        const confirmed = await confirm({
          title: 'Save important setting changes?',
          message: 'These settings affect documents, taxes, payment terms, or business identity. Orbit Ledger will keep a change history.',
          detail: addressAuditReason
            ? `${addressAuditReason} Changed settings: ${summarizeAuditProtectedSettingsChanges(protectedChanges)}`
            : `Changed: ${summarizeAuditProtectedSettingsChanges(protectedChanges)}`,
          confirmLabel: 'Save changes',
        });
        if (!confirmed) {
          return;
        }
        await updateWorkspaceProfileAudited(workspace.workspaceId, workspace.serverRevision, nextInput, {
          actorUid: user.uid,
          actorEmail: user.email,
          reason: addressAuditReason ?? 'Protected settings updated',
        });
      } else {
        await updateWorkspaceProfile(
          workspace.workspaceId,
          workspace.serverRevision,
          nextInput,
          user
            ? {
                actorUid: user.uid,
                actorEmail: user.email,
                reason: 'Entity profile updated',
              }
            : null
        );
      }
      await refresh();
      setAddressReasonRequest(null);
      setAddressChangeOtherReason('');
      showToast('Entity profile saved.', 'success');
    } catch (nextError) {
      showToast(nextError instanceof Error ? nextError.message : 'Entity profile could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshInvoiceNumberHealth() {
    setIsInvoiceNumberMaintenanceBusy(true);
    try {
      const [nextHealth, nextAuditItems] = await Promise.all([
        scanWorkspaceInvoiceNumberHealth(workspace.workspaceId),
        listWorkspaceInvoiceNumberAuditTrail(workspace.workspaceId),
      ]);
      setInvoiceNumberHealth(nextHealth);
      setInvoiceNumberAuditItems(nextAuditItems);
      showToast('Invoice number check completed.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice number check could not run.', 'danger');
    } finally {
      setIsInvoiceNumberMaintenanceBusy(false);
    }
  }

  async function backfillInvoiceNumberKeys() {
    const confirmed = await confirm({
      title: 'Repair invoice number search keys?',
      message: 'Orbit Ledger will add missing invoice number keys to older invoices. Existing invoice numbers will not be changed.',
      confirmLabel: 'Repair keys',
    });
    if (!confirmed) {
      return;
    }

    setIsInvoiceNumberMaintenanceBusy(true);
    try {
      const [nextHealth, nextAuditItems] = await Promise.all([
        backfillWorkspaceInvoiceNumberKeys(workspace.workspaceId),
        listWorkspaceInvoiceNumberAuditTrail(workspace.workspaceId),
      ]);
      setInvoiceNumberHealth(nextHealth);
      setInvoiceNumberAuditItems(nextAuditItems);
      showToast('Invoice number keys repaired.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice number keys could not be repaired.', 'danger');
    } finally {
      setIsInvoiceNumberMaintenanceBusy(false);
    }
  }

  async function refreshInvoiceNumberAuditTrail() {
    setIsInvoiceNumberAuditBusy(true);
    try {
      setInvoiceNumberAuditItems(await listWorkspaceInvoiceNumberAuditTrail(workspace.workspaceId));
      showToast('Invoice number audit loaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice number audit could not be loaded.', 'danger');
    } finally {
      setIsInvoiceNumberAuditBusy(false);
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
        await updateWorkspaceProfile(
          workspace.workspaceId,
          workspace.serverRevision,
          nextInput,
          user
            ? {
                actorUid: user.uid,
                actorEmail: user.email,
                reason: successMessage,
              }
            : null
        );
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

  function updateVaultUploadForm<K extends keyof WebDocumentVaultUploadForm>(
    field: K,
    value: WebDocumentVaultUploadForm[K]
  ) {
    setVaultUploadForm((current) => ({ ...current, [field]: value }));
    setVaultUploadError(null);
  }

  function handleVaultDocumentTypeChange(value: string) {
    const option = getWebDocumentVaultTypeOption(documentVaultTypeOptions, value);
    setVaultUploadForm((current) => ({
      ...current,
      documentType: option?.id ?? '',
      documentCategory: option?.category ?? current.documentCategory,
      documentName: current.documentName.trim() ? current.documentName : option?.label ?? '',
    }));
    setVaultUploadError(null);
  }

  async function uploadVaultDocument() {
    if (!activeWorkspace || !user) {
      showToast('Sign in and choose a workspace before uploading documents.', 'danger');
      return;
    }

    const errors = validateWebDocumentVaultUpload({ ...vaultUploadForm, file: vaultFile });
    if (errors.length) {
      setVaultUploadError(errors[0]);
      showToast(errors[0], 'danger');
      return;
    }

    setIsVaultUploading(true);
    setVaultUploadError(null);
    try {
      const uploaded = await uploadWorkspaceDocumentVaultRecord({
        workspace: activeWorkspace,
        actor: {
          uid: user.uid,
          email: user.email,
        },
        form: vaultUploadForm,
        file: vaultFile as File,
      });
      setVaultDocuments((current) => [uploaded, ...current.filter((document) => document.id !== uploaded.id)]);
      setVaultUploadForm(DEFAULT_DOCUMENT_VAULT_UPLOAD_FORM);
      setVaultFile(null);
      if (vaultFileInputRef.current) {
        vaultFileInputRef.current.value = '';
      }
      showToast('Document uploaded to the vault.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Document could not be uploaded.';
      setVaultUploadError(message);
      showToast(message, 'danger');
    } finally {
      setIsVaultUploading(false);
    }
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
    <AppShell title="Settings" subtitle="Personal choices, entity details, documents, payments, security, and backups.">
      <div className="ol-settings-hub">
        <section className="ol-settings-hero">
          <div>
            <p className="ol-eyebrow">Settings</p>
            <h2>Make Orbit Ledger remember how this business works.</h2>
            <p>
              Keep daily preferences, entity details, document style, payment details, and safety controls in clear sections.
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
                Personal preferences are saved for this user and this workspace. They do not change entity-wide settings.
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
                <p className="ol-form-band-copy">These are personal display and download preferences. They do not change workspace records.</p>
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
            <div className="ol-panel-title">Entity Settings</div>
            <p className="ol-panel-copy">
              Keep the right identity fields visible for this workspace type across invoices, reports, settings, and backup names.
            </p>
          </div>
        </div>

        <div className="ol-form-grid">
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Entity type</div>
                <p className="ol-form-band-copy">{entityProfileUi.entityDescription}</p>
              </div>
              <span className="ol-chip ol-chip--primary">{entityProfileUi.entityLabel}</span>
            </div>
            <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label ol-field-label--with-meta">
                  <span className="ol-field-label-text">
                    Profile type
                    <span className="ol-required-badge">Required</span>
                  </span>
                  <SettingsFieldHelp help="Choose the legal or business structure for this workspace. Orbit Ledger shows only the fields that apply to that type." label="Profile type" />
                </span>
                <select
                  className="ol-select"
                  required
                  value={profile.entityType}
                  onChange={(event) => handleEntityTypeChange(event.target.value)}
                >
                  {ORBIT_ENTITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {entityProfileUi.subtypeOptions.length ? (
                <label className="ol-field">
                  <span className="ol-field-label ol-field-label--with-meta">
                    <span className="ol-field-label-text">
                      Subtype
                      <span className="ol-required-badge">Required</span>
                    </span>
                    <SettingsFieldHelp help="Subtype controls which registration fields appear. For example, Section 8 nonprofits use CIN while trusts and societies do not." label="Subtype" />
                  </span>
                  <select
                    className="ol-select"
                    value={profile.entitySubtype ?? entityProfileUi.subtypeOptions[0] ?? ''}
                    onChange={(event) => handleEntitySubtypeChange(event.target.value)}
                  >
                    {entityProfileUi.subtypeOptions.map((subtype) => (
                      <option key={subtype} value={subtype}>
                        {WEB_ENTITY_SUBTYPE_LABELS[subtype]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="ol-form-band-grid ol-form-band-grid--compact">
              <label className="ol-inline-check ol-inline-check--panel">
                <input
                  checked={profile.entityComplianceFlags.gstRegistered}
                  type="checkbox"
                  onChange={(event) => handleComplianceFlagChange('gstRegistered', event.target.checked)}
                />
                <span>
                  <strong>GST registered</strong>
                  <small>Shows GSTIN and principal-place fields for GST-ready records.</small>
                </span>
              </label>
              {profile.entityType !== 'freelancer_individual' ? (
                <label className="ol-inline-check ol-inline-check--panel">
                  <input
                    checked={profile.entityComplianceFlags.hasUdyam}
                    type="checkbox"
                    onChange={(event) => handleComplianceFlagChange('hasUdyam', event.target.checked)}
                  />
                  <span>
                    <strong>Udyam registered</strong>
                    <small>Keeps MSME/Udyam proof available for later verification.</small>
                  </span>
                </label>
              ) : null}
              {profile.entityType === 'nonprofit_charity' ? (
                <>
                  <label className="ol-inline-check ol-inline-check--panel">
                    <input
                      checked={profile.entityComplianceFlags.donationReceiptsEnabled}
                      type="checkbox"
                      onChange={(event) => handleComplianceFlagChange('donationReceiptsEnabled', event.target.checked)}
                    />
                    <span>
                      <strong>Donation receipts</strong>
                      <small>Shows 80G fields when donation receipts are enabled.</small>
                    </span>
                  </label>
                  <label className="ol-inline-check ol-inline-check--panel">
                    <input
                      checked={profile.entityComplianceFlags.has12A12AB}
                      type="checkbox"
                      onChange={(event) => handleComplianceFlagChange('has12A12AB', event.target.checked)}
                    />
                    <span>
                      <strong>12A / 12AB</strong>
                      <small>Shows income-tax exemption registration fields.</small>
                    </span>
                  </label>
                  <label className="ol-inline-check ol-inline-check--panel">
                    <input
                      checked={profile.entityComplianceFlags.has80G}
                      type="checkbox"
                      onChange={(event) => handleComplianceFlagChange('has80G', event.target.checked)}
                    />
                    <span>
                      <strong>80G approved</strong>
                      <small>Shows donor deduction registration details.</small>
                    </span>
                  </label>
                  <label className="ol-inline-check ol-inline-check--panel">
                    <input
                      checked={profile.entityComplianceFlags.receivesForeignContribution || profile.entityComplianceFlags.hasFcra}
                      type="checkbox"
                      onChange={(event) => {
                        handleComplianceFlagChange('receivesForeignContribution', event.target.checked);
                        handleComplianceFlagChange('hasFcra', event.target.checked);
                      }}
                    />
                    <span>
                      <strong>FCRA / foreign contribution</strong>
                      <small>Shows FCRA registration or prior-permission fields.</small>
                    </span>
                  </label>
                  <label className="ol-inline-check ol-inline-check--panel">
                    <input
                      checked={profile.entityComplianceFlags.acceptsCsrFunding}
                      type="checkbox"
                      onChange={(event) => handleComplianceFlagChange('acceptsCsrFunding', event.target.checked)}
                    />
                    <span>
                      <strong>CSR funding</strong>
                      <small>Shows CSR registration fields for charity funding records.</small>
                    </span>
                  </label>
                </>
              ) : null}
            </div>
          </div>
          <div className="ol-form-row ol-form-row--auto">
            <ProfileField
              error={fieldErrors.businessName}
              help="Required. This appears on invoices, statements, reports, settings, and backup names."
              label={getEntityBusinessNameLabel(profile.entityType)}
              required
              value={profile.businessName}
              onBlur={() => handleFieldBlur('businessName')}
              onChange={(value) => handleFieldChange('businessName', value)}
            />
            <ProfileField
              error={fieldErrors.ownerName}
              help="Required. Used as the primary owner contact on internal workspace records."
              label={getEntityOwnerNameLabel(profile.entityType)}
              required
              value={profile.ownerName}
              onBlur={() => handleFieldBlur('ownerName')}
              onChange={(value) => handleFieldChange('ownerName', value)}
            />
            <ProfileField
              error={fieldErrors.phone}
              help="Required. Add the best reachable phone for workspace and support records."
              inputMode="tel"
              label="Phone"
              required
              value={profile.phone}
              onBlur={() => handleFieldBlur('phone')}
              onChange={(value) => handleFieldChange('phone', value)}
            />
          </div>
          <div className="ol-form-row ol-form-row--auto">
            <ProfileField
              error={fieldErrors.email}
              help="Required. Used for workspace alerts, document contact details, and important account notices."
              inputMode="email"
              label="Email"
              required
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
              <span className="ol-field-label ol-field-label--with-meta">
                <span className="ol-field-label-text">
                  State
                  <span className="ol-required-badge">Required</span>
                </span>
                <SettingsFieldHelp help="Required for India-first workspace records, reporting context, and default city choices." label="State" />
              </span>
              <select
                aria-required="true"
                className="ol-select"
                required
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
              {showEntityField('legalName') ? (
                <ProfileField
                  help="The legal name used for verification and formal documents for this entity type."
                  label={profile.entityType === 'nonprofit_charity' ? 'Legal organization name' : 'Legal name'}
                  requiredBadge={isEntityFieldRequired('legalName')}
                  value={profile.legalName}
                  onChange={(value) => handleFieldChange('legalName', value)}
                />
              ) : null}
              <ProfileField
                help="Day-to-day contact name for follow-up, workspace records, and support context."
                label={profile.entityType === 'nonprofit_charity' ? 'Operations contact' : 'Contact person'}
                value={profile.contactPerson}
                onChange={(value) => handleFieldChange('contactPerson', value)}
              />
              {showEntityField('registeredOfficeAddress') ? (
                <ProfileField
                  help="Registered office or principal registered address for this entity type."
                  label={profile.entityType === 'nonprofit_charity' ? 'Registered / principal office' : 'Registered office address'}
                  requiredBadge={isEntityFieldRequired('registeredOfficeAddress')}
                  value={profile.registeredOfficeAddress}
                  onChange={(value) => handleFieldChange('registeredOfficeAddress', value)}
                />
              ) : null}
              {showEntityField('principalPlaceOfBusiness') ? (
                <ProfileField
                  help="The primary place where the business or organization operates."
                  label="Principal place of business"
                  requiredBadge={isEntityFieldRequired('principalPlaceOfBusiness')}
                  value={profile.principalPlaceOfBusiness}
                  onChange={(value) => handleFieldChange('principalPlaceOfBusiness', value)}
                />
              ) : null}
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
            <label className="ol-inline-check ol-inline-check--panel">
              <input
                checked={useCompanyAddressForRegistered}
                type="checkbox"
                onChange={(event) => handleUseCompanyAddressForRegistered(event.target.checked)}
              />
              <span>
                <strong>Use workspace address</strong>
                <small>Copy the workspace address into the registered-address fields used on invoices and statements.</small>
              </span>
            </label>
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
              <ProfileField
                label="PIN / postcode"
                requiredBadge={isEntityFieldRequired('postalCode')}
                value={profile.postalCode}
                onChange={(value) => handleFieldChange('postalCode', value)}
              />
              {showEntityField('additionalPlacesOfBusiness') ? (
                <ProfileTextArea
                  help="Add one additional place per line. These become structured records in later verification phases."
                  label="Additional places of business"
                  value={profile.additionalPlacesOfBusiness}
                  onChange={(value) => handleFieldChange('additionalPlacesOfBusiness', value)}
                />
              ) : null}
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Tax and registration identity</div>
                <p className="ol-form-band-copy">Only fields that apply to {entityProfileUi.entityLabel.toLowerCase()} profiles are shown here.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              {showEntityField('cin') ? (
                <ProfileField
                  help="Corporate Identification Number. Required for company and Section 8 company profiles."
                  label="CIN"
                  requiredBadge={isEntityFieldRequired('cin')}
                  value={profile.cin}
                  onChange={(value) => handleFieldChange('cin', value.toUpperCase())}
                />
              ) : null}
              {showEntityField('llpin') ? (
                <ProfileField
                  help="LLP Identification Number for Limited Liability Partnership profiles."
                  label="LLPIN"
                  requiredBadge={isEntityFieldRequired('llpin')}
                  value={profile.llpin}
                  onChange={(value) => handleFieldChange('llpin', value.toUpperCase())}
                />
              ) : null}
              {showEntityField('pan') || showEntityField('companyPan') ? (
                <ProfileField
                  help="Permanent Account Number for the selected entity type."
                  label={getEntityPanLabel(profile.entityType)}
                  requiredBadge={isEntityFieldRequired('pan') || isEntityFieldRequired('companyPan')}
                  value={profile.pan}
                  onChange={(value) => handleFieldChange('pan', value.toUpperCase())}
                />
              ) : null}
              {showEntityField('gstin') ? (
                <ProfileField
                  help="Shown only when GST registered is selected."
                  label="GSTIN"
                  requiredBadge={isEntityFieldRequired('gstin')}
                  value={profile.gstin}
                  onChange={(value) => handleFieldChange('gstin', value.toUpperCase())}
                />
              ) : null}
              <ProfileField label="VAT / tax number" value={profile.taxNumber} onChange={(value) => handleFieldChange('taxNumber', value)} />
              {profile.entityType === 'nonprofit_charity' ? (
                <>
                  <ProfileField
                    help="Trust deed, society, NGO, or charity registration number."
                    label="Nonprofit registration number"
                    requiredBadge={isEntityFieldRequired('nonprofitRegistrationNumber')}
                    value={profile.nonprofitRegistrationNumber}
                    onChange={(value) => handleFieldChange('nonprofitRegistrationNumber', value)}
                  />
                  <ProfileField
                    label="Registration authority"
                    value={profile.nonprofitRegistrationAuthority}
                    onChange={(value) => handleFieldChange('nonprofitRegistrationAuthority', value)}
                  />
                  <ProfileField label="NGO Darpan ID" value={profile.ngoDarpanId} onChange={(value) => handleFieldChange('ngoDarpanId', value)} />
                  {showEntityField('taxExemption12A12ABNumber') ? (
                    <ProfileField
                      label="12A / 12AB number"
                      requiredBadge={isEntityFieldRequired('taxExemption12A12ABNumber')}
                      value={profile.taxExemption12A12ABNumber}
                      onChange={(value) => handleFieldChange('taxExemption12A12ABNumber', value)}
                    />
                  ) : null}
                  {showEntityField('taxDeduction80GNumber') ? (
                    <ProfileField
                      label="80G number"
                      requiredBadge={isEntityFieldRequired('taxDeduction80GNumber')}
                      value={profile.taxDeduction80GNumber}
                      onChange={(value) => handleFieldChange('taxDeduction80GNumber', value)}
                    />
                  ) : null}
                  {showEntityField('fcraRegistrationNumber') ? (
                    <ProfileField
                      label="FCRA registration / permission"
                      requiredBadge={isEntityFieldRequired('fcraRegistrationNumber')}
                      value={profile.fcraRegistrationNumber}
                      onChange={(value) => handleFieldChange('fcraRegistrationNumber', value)}
                    />
                  ) : null}
                  {showEntityField('csrRegistrationNumber') ? (
                    <ProfileField
                      label="CSR registration"
                      requiredBadge={isEntityFieldRequired('csrRegistrationNumber')}
                      value={profile.csrRegistrationNumber}
                      onChange={(value) => handleFieldChange('csrRegistrationNumber', value)}
                    />
                  ) : null}
                </>
              ) : (
                <ProfileField label="Registration number" value={profile.registrationNumber} onChange={(value) => handleFieldChange('registrationNumber', value)} />
              )}
              <ProfileField label="Place of supply" value={profile.placeOfSupply} onChange={(value) => handleFieldChange('placeOfSupply', value)} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Verification documents</div>
                <p className="ol-form-band-copy">
                  Proof checklist for {entityProfileUi.entityLabel.toLowerCase()} profiles.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{verificationDocuments.required.length} required</span>
            </div>
            <div className="ol-form-band-grid ol-form-band-grid--wide">
              <VerificationDocumentList
                documents={verificationDocuments.required}
                emptyText="No required proof for the selected profile."
                title="Required proof"
              />
              <VerificationDocumentList
                documents={verificationDocuments.optional}
                emptyText="No optional proof for the selected profile."
                title="Optional proof"
              />
            </div>
          </div>
          <div className="ol-form-band ol-document-vault-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Document vault</div>
                <p className="ol-form-band-copy">
                  Upload legal proof for this {entityProfileUi.entityLabel.toLowerCase()} profile. Vault records keep the reason, attestation, uploader, and file metadata ready for admin review.
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{vaultDocuments.length} uploaded</span>
            </div>

            <div className="ol-document-vault-upload-grid">
              <ProfileField
                help="Use a clear name like PAN card, GST certificate, or registered office proof."
                label="Document name"
                required
                value={vaultUploadForm.documentName}
                onChange={(value) => updateVaultUploadForm('documentName', value)}
              />
              <label className="ol-field">
                <span className="ol-field-label">
                  Document type
                  <span className="ol-required-badge">Required</span>
                </span>
                <select
                  className="ol-select"
                  required
                  value={vaultUploadForm.documentType}
                  onChange={(event) => handleVaultDocumentTypeChange(event.target.value)}
                >
                  <option value="">Choose document type</option>
                  {documentVaultTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} · {option.requirement === 'required' ? 'Required' : 'Optional'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">
                  Document category
                  <span className="ol-required-badge">Required</span>
                </span>
                <select
                  className="ol-select"
                  required
                  value={vaultUploadForm.documentCategory}
                  onChange={(event) =>
                    updateVaultUploadForm(
                      'documentCategory',
                      event.target.value as WebDocumentVaultUploadForm['documentCategory']
                    )
                  }
                >
                  <option value="">Choose category</option>
                  {WEB_DOCUMENT_VAULT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <ProfileTextArea
                help="This reason is saved with the vault record for future audit and admin verification."
                label="Reason to upload"
                value={vaultUploadForm.reasonToUpload}
                onChange={(value) => updateVaultUploadForm('reasonToUpload', value)}
              />
              <label className="ol-field">
                <span className="ol-field-label">
                  File
                  <span className="ol-required-badge">Required</span>
                </span>
                <input
                  ref={vaultFileInputRef}
                  accept={ORBIT_VERIFICATION_DOCUMENT_ACCEPT}
                  className="ol-input ol-file-input"
                  type="file"
                  onChange={(event) => {
                    setVaultFile(event.target.files?.[0] ?? null);
                    setVaultUploadError(null);
                  }}
                />
                <span className="ol-field-help">
                  PDF, PNG, or JPEG only. Maximum file size is 10 MB.
                </span>
              </label>
              <label className="ol-inline-check ol-inline-check--panel ol-document-vault-attestation">
                <input
                  checked={vaultUploadForm.selfAttestation}
                  type="checkbox"
                  onChange={(event) => updateVaultUploadForm('selfAttestation', event.target.checked)}
                />
                <span>
                  <strong>Self-attestation</strong>
                  <small>{WEB_DOCUMENT_VAULT_ATTESTATION_TEXT}</small>
                </span>
              </label>
            </div>

            {vaultUploadError ? <div className="ol-inline-error">{vaultUploadError}</div> : null}

            <div className="ol-form-band-actions">
              <span className="ol-form-band-copy">
                {vaultFile ? `${vaultFile.name} · ${formatFileSize(vaultFile.size)}` : 'No file selected.'}
              </span>
              <button
                className="ol-button"
                disabled={isVaultUploading}
                type="button"
                onClick={uploadVaultDocument}
              >
                {isVaultUploading ? 'Uploading...' : 'Upload document'}
              </button>
            </div>

            <DocumentVaultList documents={vaultDocuments} isLoading={isVaultLoading} />
          </div>
        </div>

        {addressReasonRequest ? (
          <div className="ol-form-band ol-address-reason-band" role="status">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Address change reason</div>
                <p className="ol-form-band-copy">
                  Changed: {summarizeAddressChanges(addressReasonRequest.changes)}.
                </p>
              </div>
              <span className="ol-chip ol-chip--warning">Reason required</span>
            </div>
            <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label">
                  Reason
                  <span className="ol-required-badge">Required</span>
                </span>
                <select
                  className="ol-select"
                  value={addressChangeReason}
                  onChange={(event) => setAddressChangeReason(event.target.value as WebAddressChangeReasonId)}
                >
                  {WEB_ADDRESS_CHANGE_REASON_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {addressChangeReason === 'other' ? (
                <ProfileField
                  help="Add the reason that should appear in the address-change audit record."
                  label="Other reason"
                  required
                  value={addressChangeOtherReason}
                  onChange={setAddressChangeOtherReason}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="ol-actions ol-form-actions">
          <button className="ol-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save entity profile'}
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
            <ProfileField
              help="The default wording for when customers should pay new invoices, such as Due on receipt, Net 7, or Net 15."
              label="Default payment terms"
              value={profile.defaultPaymentTerms}
              onChange={(value) => handleFieldChange('defaultPaymentTerms', value)}
            />
            <ProfileField
              help="The number of days after the invoice date when payment becomes due. For example, 15 means invoices are due after 15 days."
              inputMode="numeric"
              label="Default due days"
              value={profile.defaultDueDays}
              onChange={(value) => handleFieldChange('defaultDueDays', value)}
            />
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
              <div className="ol-form-band-title">Invoice numbering</div>
              <p className="ol-form-band-copy">
                New invoices use this pattern. Changes are saved with history because invoice numbers appear on customer documents and payments.
              </p>
            </div>
          </div>
          <div className="ol-form-band-grid">
            <ProfileField
              label="Company code override"
              maxLength={12}
              placeholder="Auto from business name"
              value={profile.invoiceNumberPrefix}
              onChange={(value) => handleFieldChange('invoiceNumberPrefix', value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))}
            />
            <label className="ol-field">
              <span className="ol-field-label">Separator</span>
              <select
                className="ol-select"
                value={profile.invoiceNumberSeparator}
                onChange={(event) =>
                  handleFieldChange('invoiceNumberSeparator', event.target.value === '-' ? '-' : '/')
                }
              >
                <option value="/">Slash</option>
                <option value="-">Dash</option>
              </select>
              <span className="ol-field-help">Used between company code, year, and sequence.</span>
            </label>
            <label className="ol-field">
              <span className="ol-field-label">Sequence digits</span>
              <select
                className="ol-select"
                value={profile.invoiceNumberPadding}
                onChange={(event) => handleFieldChange('invoiceNumberPadding', event.target.value)}
              >
                <option value="3">3 digits</option>
                <option value="4">4 digits</option>
                <option value="5">5 digits</option>
                <option value="6">6 digits</option>
                <option value="7">7 digits</option>
                <option value="8">8 digits</option>
              </select>
              <span className="ol-field-help">Controls the length of the running number.</span>
            </label>
            <ProfileField
              inputMode="numeric"
              label="Next sequence"
              value={profile.invoiceNumberNextSequence}
              onChange={(value) => handleFieldChange('invoiceNumberNextSequence', value.replace(/[^0-9]/g, '').slice(0, 8))}
            />
          </div>
          <div className="ol-form-band-grid" style={{ marginTop: 16 }}>
            <div className="ol-field ol-field--wide">
              <span className="ol-field-label">Next invoice preview</span>
              <div className="ol-summary-card" style={{ minHeight: 'auto', padding: '18px 20px' }}>
                <strong style={{ color: 'var(--ol-ink)', fontSize: 22 }}>{invoiceNumberPreview}</strong>
                <span className="ol-field-help" style={{ display: 'block', marginTop: 8 }}>
                  Leave the company code blank to let Orbit Ledger create a safe code from the business name.
                </span>
              </div>
            </div>
          </div>
          <div className="ol-settings-toggle-grid" style={{ marginTop: 16 }}>
            <article className="ol-settings-toggle-card">
              <div>
                <div className="ol-settings-toggle-title">Legacy invoice number check</div>
                <p className="ol-settings-toggle-note">
                  Check older invoices for missing search keys or reused invoice numbers. Repairing keys does not change customer-facing invoice numbers.
                </p>
                {invoiceNumberHealth ? (
                  <div className="ol-settings-status-row" style={{ marginTop: 12 }}>
                    <span className="ol-chip">{invoiceNumberHealth.totalInvoices} invoices scanned</span>
                    <span className={invoiceNumberHealth.missingKeyCount ? 'ol-chip ol-chip--warning' : 'ol-chip ol-chip--success'}>
                      {invoiceNumberHealth.missingKeyCount} need key repair
                    </span>
                    <span className={invoiceNumberHealth.duplicateGroups.length ? 'ol-chip ol-chip--warning' : 'ol-chip ol-chip--success'}>
                      {invoiceNumberHealth.duplicateGroups.length} duplicate groups
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="ol-actions ol-actions--compact">
                <button
                  className="ol-button-secondary"
                  disabled={isInvoiceNumberMaintenanceBusy}
                  type="button"
                  onClick={refreshInvoiceNumberHealth}
                >
                  Check numbers
                </button>
                <button
                  className="ol-button"
                  disabled={isInvoiceNumberMaintenanceBusy || !invoiceNumberHealth?.missingKeyCount}
                  type="button"
                  onClick={backfillInvoiceNumberKeys}
                >
                  Repair keys
                </button>
              </div>
            </article>
          </div>
          {invoiceNumberHealth?.duplicateGroups.length ? (
            <div className="ol-table-card" style={{ marginTop: 16 }}>
              <div className="ol-table-card-header">
                <strong>Duplicate invoice numbers need review</strong>
                <span>Keep one invoice as-is. Open the others and assign unique numbers before saving new versions.</span>
              </div>
              <div className="ol-stacked-list">
                {invoiceNumberHealth.duplicateGroups.map((group) => (
                  <article className="ol-stacked-list-item" key={group.invoiceNumberKey}>
                    <div>
                      <strong>{group.invoiceNumber}</strong>
                      <span>{group.invoiceIds.length} active invoices share this number.</span>
                      {group.recommendedKeepInvoiceId ? (
                        <span>Suggested keeper: {shortId(group.recommendedKeepInvoiceId)}. Give every other invoice a unique number.</span>
                      ) : null}
                    </div>
                    <div className="ol-conflict-invoice-list">
                      {group.invoices.map((invoice) => (
                        <div className="ol-conflict-invoice-row" key={invoice.id}>
                          <div>
                            <strong>{shortId(invoice.id)}</strong>
                            <span>
                              {invoice.issueDate ?? 'No date'} · v{invoice.versionNumber ?? 0} · {formatMoney(invoice.totalAmount, workspace.currency)}
                            </span>
                          </div>
                          <div className="ol-actions ol-actions--compact">
                            {group.recommendedKeepInvoiceId === invoice.id ? (
                              <span className="ol-chip ol-chip--success">Keep number</span>
                            ) : (
                              <span className="ol-chip ol-chip--warning">Needs new number</span>
                            )}
                            <Link
                              className="ol-button-secondary"
                              href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}`}
                            >
                              Open invoice
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          <div className="ol-table-card" style={{ marginTop: 16 }}>
            <div className="ol-table-card-header">
              <div>
                <strong>Invoice number audit trail</strong>
                <span>Shows protected changes to numbering rules and sequence settings.</span>
              </div>
              <button
                className="ol-button-secondary"
                disabled={isInvoiceNumberAuditBusy}
                type="button"
                onClick={refreshInvoiceNumberAuditTrail}
              >
                {isInvoiceNumberAuditBusy ? 'Loading...' : 'Load audit'}
              </button>
            </div>
            {invoiceNumberAuditItems.length ? (
              <div className="ol-stacked-list">
                {invoiceNumberAuditItems.map((item) => (
                  <article className="ol-stacked-list-item" key={item.id}>
                    <div>
                      <strong>{item.reason ?? 'Invoice numbering updated'}</strong>
                      <span>
                        {formatAuditDate(item.createdAt)} · {item.actorEmail ?? 'Workspace user'} · revision {item.serverRevisionBefore ?? '-'} to {item.serverRevisionAfter ?? '-'}
                      </span>
                    </div>
                    <div className="ol-conflict-change-list">
                      {item.changes.map((change) => (
                        <span className="ol-chip" key={`${item.id}-${change.field}`}>
                          {change.label}: {change.previousValue ?? 'Blank'} → {change.nextValue ?? 'Blank'}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ol-empty-state" style={{ margin: 16 }}>
                <strong>No invoice-number audit loaded yet.</strong>
                <span>Load the audit trail to review protected numbering changes.</span>
              </div>
            )}
          </div>
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
              <div className="ol-form-band-title">Online collections</div>
              <p className="ol-form-band-copy">
                Online payment links are separate from manual UPI and bank instructions.
              </p>
            </div>
            <span className={`ol-chip ${getLiveCollectionsStatusChipClass(liveCollectionsSetupStatus.tone)}`}>
              {liveCollectionsSetupStatus.badge}
            </span>
          </div>
          <div className="ol-live-collections-setup-card" data-tone={liveCollectionsSetupStatus.tone}>
            <div>
              <strong>{liveCollectionsSetupStatus.title}</strong>
              <span>{liveCollectionsSetupStatus.message}</span>
            </div>
            <ul>
              {liveCollectionsSetupStatus.detailItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="ol-actions ol-actions--compact">
            <Link className="ol-button-secondary" href="/payments">
              {liveCollectionsSetupStatus.primaryActionLabel}
            </Link>
            {liveCollectionsSetupStatus.secondaryActionLabel ? (
              <Link className="ol-button-ghost" href="/transactions">
                {liveCollectionsSetupStatus.secondaryActionLabel}
              </Link>
            ) : null}
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
                  <span className="ol-field-label ol-field-label--with-meta">
                    <span className="ol-field-label-text">{field.label}</span>
                    <SettingsFieldHelp
                      help={`${field.helper} Optional for saving settings, but add it if it helps customers pay from invoices and reminders without confusion.`}
                      label={field.label}
                    />
                  </span>
                  <input
                    className="ol-input"
                    placeholder={field.placeholder}
                    value={String(paymentInstructions[field.key] ?? '')}
                    onChange={(event) => updatePaymentInstruction(field.key, event.target.value)}
                  />
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
              These controls stay on this browser. They are separate from your sign-in password, entity details, and business backups.
            </p>
          </div>
          <span className={`ol-chip ${isEnabled ? 'ol-chip--premium' : 'ol-chip--warning'}`}>
            {isEnabled ? 'On here' : 'Off'}
          </span>
        </div>

	        <div className="ol-form-row ol-form-row--lock">
	          <label className={`ol-field${pinError ? ' is-invalid' : ''}`}>
	            <span className="ol-field-label ol-field-label--with-meta">
	              <span className="ol-field-label-text">
	                PIN
	                <span className="ol-required-badge">Required</span>
	              </span>
	              <SettingsFieldHelp help="Required to turn browser lock on or off. Use exactly 4 digits; this stays on this device only." label="PIN" />
	            </span>
	            <input
	              aria-required="true"
	              className="ol-input ol-input--pin ol-input--pin-left"
	              inputMode="numeric"
	              maxLength={4}
	              required
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

function getLiveCollectionsStatusChipClass(tone: 'blocked' | 'warning' | 'ready' | 'success') {
  if (tone === 'success') {
    return 'ol-chip--success';
  }
  if (tone === 'blocked' || tone === 'warning') {
    return 'ol-chip--warning';
  }
  return 'ol-chip--tax';
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

function withCompanyAddressAsRegistered(profile: ProfileFormState): ProfileFormState {
  return {
    ...profile,
    addressLine1: profile.address.trim(),
    addressLine2: '',
    city: profile.city || getDefaultIndianCity(profile.stateCode || 'GJ'),
    town: '',
  };
}

function splitProfileLines(value: string) {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.length ? entries : null;
}

function isAddressReasonField(field: keyof ProfileFormState) {
  return [
    'address',
    'addressLine1',
    'addressLine2',
    'city',
    'town',
    'postalCode',
    'stateCode',
    'registeredOfficeAddress',
    'principalPlaceOfBusiness',
    'additionalPlacesOfBusiness',
  ].includes(field);
}

function VerificationDocumentList({
  documents,
  emptyText,
  title,
}: {
  documents: readonly WebEntityVerificationDocumentRow[];
  emptyText: string;
  title: string;
}) {
  return (
    <section className="ol-verification-doc-list" aria-label={title}>
      <div className="ol-verification-doc-list-head">
        <strong>{title}</strong>
        <span>{documents.length}</span>
      </div>
      {documents.length ? (
        <div className="ol-list">
          {documents.map((document) => (
            <article className="ol-list-item ol-verification-doc-item" key={document.id}>
              <div className="ol-list-icon" data-tone={document.requirement === 'required' ? 'warning' : 'neutral'}>
                {document.categoryLabel.slice(0, 1)}
              </div>
              <div className="ol-list-copy">
                <div className="ol-verification-doc-title-row">
                  <div className="ol-list-title">{document.label}</div>
                  <span className={`ol-chip ${document.requirement === 'required' ? 'ol-chip--warning' : 'ol-chip--muted'}`}>
                    {document.requirementLabel}
                  </span>
                </div>
                <div className="ol-list-text">{document.description}</div>
                <div className="ol-verification-doc-meta">
                  <span>{document.categoryLabel}</span>
                  <span>{document.acceptedFileSummary}</span>
                  <span>{document.maxSizeLabel}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="ol-empty-state ol-verification-doc-empty">
          <span>{emptyText}</span>
        </div>
      )}
    </section>
  );
}

function DocumentVaultList({
  documents,
  isLoading,
}: {
  documents: readonly WebDocumentVaultRecord[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="ol-empty-state ol-document-vault-empty">
        <span>Loading document vault...</span>
      </div>
    );
  }

  if (!documents.length) {
    return (
      <div className="ol-empty-state ol-document-vault-empty">
        <span>No uploaded documents yet.</span>
      </div>
    );
  }

  return (
    <div className="ol-document-vault-list" aria-label="Uploaded documents">
      {documents.map((document) => (
        <article className="ol-list-item ol-document-vault-item" key={document.id}>
          <div className="ol-list-icon" data-tone={document.selfAttested ? 'success' : 'warning'}>
            {document.documentCategoryLabel.slice(0, 1)}
          </div>
          <div className="ol-list-copy">
            <div className="ol-verification-doc-title-row">
              <div>
                <div className="ol-list-title">{document.documentName}</div>
                <div className="ol-list-text">
                  {document.documentTypeLabel} · Uploaded {document.uploadedAt ? formatAuditDate(document.uploadedAt) : 'recently'}
                </div>
              </div>
              <span className="ol-chip ol-chip--success">{document.verificationStatus.replace(/_/g, ' ')}</span>
            </div>
            <div className="ol-list-text ol-document-vault-reason">{document.reasonToUpload}</div>
            <div className="ol-verification-doc-meta">
              <span>{document.documentCategoryLabel}</span>
              <span>{document.contentType}</span>
              <span>{formatFileSize(document.size)}</span>
              <span>{document.selfAttested ? 'Self-attested' : 'Attestation missing'}</span>
            </div>
          </div>
          {document.downloadUrl ? (
            <a className="ol-button-secondary ol-document-vault-open" href={document.downloadUrl} rel="noreferrer" target="_blank">
              Open
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ProfileField({
  error,
  help,
  inputMode,
  label,
  maxLength,
  onBlur,
  onChange,
  placeholder,
  required = false,
  requiredBadge = false,
  type = 'text',
  value,
}: {
  label: string;
  value: string;
  help?: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  requiredBadge?: boolean;
  error?: string | null;
  onBlur?(): void;
  onChange(value: string): void;
}) {
  return (
    <label className={`ol-field${error ? ' is-invalid' : ''}`}>
      <span className="ol-field-label ol-field-label--with-meta">
        <span className="ol-field-label-text">
          {label}
          {required || requiredBadge ? <span className="ol-required-badge">Required</span> : null}
        </span>
        {help ? <SettingsFieldHelp help={help} label={label} /> : null}
      </span>
      <input
        aria-required={required || undefined}
        className="ol-input"
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="ol-field-error">{error}</span> : null}
    </label>
  );
}

function ProfileTextArea({
  help,
  label,
  onChange,
  value,
}: {
  help?: string;
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label ol-field-label--with-meta">
        <span className="ol-field-label-text">{label}</span>
        {help ? <SettingsFieldHelp help={help} label={label} /> : null}
      </span>
      <textarea
        className="ol-textarea"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SettingsFieldHelp({ help, label }: { help: string; label: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label={`What is ${label}?`}>?</summary>
      <span>{help}</span>
    </details>
  );
}

function normalizePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function shortId(value: string) {
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
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
