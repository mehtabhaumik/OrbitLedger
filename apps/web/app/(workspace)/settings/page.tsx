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
import {
  normalizePhoneForCountry,
  parseAmount,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES } from '@/lib/india';
import {
  deleteWorkspaceStorageFile,
  uploadWorkspaceIdentityImage,
  validateWorkspaceIdentityImage,
  type WorkspaceIdentityAssetKind,
} from '@/lib/workspace-storage';
import { updateWorkspaceProfile } from '@/lib/workspaces';
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
  defaultLanguage: string;
  stateCode: string;
  logoUri: string | null;
  signatureUri: string | null;
};

type PaymentFieldKey = keyof ManualPaymentInstructionDetails;

type ProfileFieldKey = 'businessName' | 'ownerName' | 'phone' | 'email' | 'stateCode';

export default function SettingsPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { isEnabled, timeoutMs, enableLock, disableLock, setTimeoutMs } = useWebLock();
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
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
    defaultLanguage: '',
    stateCode: 'GJ',
    logoUri: null,
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
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [paymentInstructions, setPaymentInstructions] = useState<ManualPaymentInstructionDetails>({});

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
      city: activeWorkspace.city ?? '',
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
      defaultLanguage: activeWorkspace.defaultLanguage ?? '',
      stateCode: activeWorkspace.stateCode || 'GJ',
      logoUri: activeWorkspace.logoUri,
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
  }, [activeWorkspace]);

  if (!activeWorkspace) {
    return null;
  }

  const workspace = activeWorkspace;
  const paymentTemplate = getManualPaymentInstructionTemplate(workspace.countryCode);

  function validateField(field: ProfileFieldKey, candidate = profile) {
    if (field === 'businessName') {
      return validateName(candidate.businessName, 'Business name', true);
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
    const next = { ...profile, [field]: value };
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
      defaultLanguage: nextProfile.defaultLanguage,
      currency: INDIA_COUNTRY.currency,
      countryCode: INDIA_COUNTRY.code,
      stateCode: nextProfile.stateCode,
      logoUri: nextProfile.logoUri,
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
      await updateWorkspaceProfile(workspace.workspaceId, workspace.serverRevision, {
        ...buildWorkspaceProfileInput(profile),
      });
      await refresh();
      showToast('Workspace profile saved.', 'success');
    } catch (nextError) {
      showToast(nextError instanceof Error ? nextError.message : 'Workspace profile could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveWorkspaceMedia(nextProfile: ProfileFormState, successMessage: string) {
    setIsSaving(true);
    try {
      await updateWorkspaceProfile(workspace.workspaceId, workspace.serverRevision, {
        ...buildWorkspaceProfileInput(nextProfile),
      });
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

    const previousUrl = kind === 'logo' ? profile.logoUri : profile.signatureUri;
    setUploadingAsset(kind);

    try {
      const nextUrl = await uploadWorkspaceIdentityImage(workspace.workspaceId, kind, file);
      const nextProfile =
        kind === 'logo'
          ? { ...profile, logoUri: nextUrl }
          : { ...profile, signatureUri: nextUrl };
      setProfile(nextProfile);
      await saveWorkspaceMedia(
        nextProfile,
        kind === 'logo' ? 'Business logo saved.' : 'Authorized signature saved.'
      );
      void deleteWorkspaceStorageFile(previousUrl);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Business file could not be uploaded.', 'danger');
    } finally {
      setUploadingAsset(null);
    }
  }

  async function removeAsset(kind: WorkspaceIdentityAssetKind) {
    const previousUrl = kind === 'logo' ? profile.logoUri : profile.signatureUri;
    if (!previousUrl) {
      return;
    }

    const nextProfile =
      kind === 'logo'
        ? { ...profile, logoUri: null }
        : { ...profile, signatureUri: null };
    setProfile(nextProfile);
    await saveWorkspaceMedia(
      nextProfile,
      kind === 'logo' ? 'Business logo removed.' : 'Authorized signature removed.'
    );
    void deleteWorkspaceStorageFile(previousUrl);
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

  return (
    <AppShell title="Settings" subtitle="Business identity, files, launch checks, and browser lock.">
      <form className="ol-panel-glass" onSubmit={saveWorkspaceProfile}>
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Workspace profile</div>
            <p className="ol-panel-copy">
              Keep the business identity coherent across invoices, reports, settings, and backup
              naming.
            </p>
          </div>
        </div>

        <div className="ol-form-grid">
          <div className="ol-form-row ol-form-row--3">
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
          <div className="ol-form-row ol-form-row--3">
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
              <ProfileField label="City" value={profile.city} onChange={(value) => handleFieldChange('city', value)} />
              <ProfileField label="PIN / postcode" value={profile.postalCode} onChange={(value) => handleFieldChange('postalCode', value)} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Tax and document defaults</div>
                <p className="ol-form-band-copy">These are optional now, but they make invoices and customer reports more complete.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <ProfileField label="GSTIN" value={profile.gstin} onChange={(value) => handleFieldChange('gstin', value.toUpperCase())} />
              <ProfileField label="PAN" value={profile.pan} onChange={(value) => handleFieldChange('pan', value.toUpperCase())} />
              <ProfileField label="VAT / tax number" value={profile.taxNumber} onChange={(value) => handleFieldChange('taxNumber', value)} />
              <ProfileField label="Registration number" value={profile.registrationNumber} onChange={(value) => handleFieldChange('registrationNumber', value)} />
              <ProfileField label="Place of supply" value={profile.placeOfSupply} onChange={(value) => handleFieldChange('placeOfSupply', value)} />
              <ProfileField label="Tax treatment" value={profile.defaultTaxTreatment} onChange={(value) => handleFieldChange('defaultTaxTreatment', value)} />
              <ProfileField label="Default payment terms" value={profile.defaultPaymentTerms} onChange={(value) => handleFieldChange('defaultPaymentTerms', value)} />
              <ProfileField inputMode="numeric" label="Default due days" value={profile.defaultDueDays} onChange={(value) => handleFieldChange('defaultDueDays', value)} />
              <ProfileField inputMode="decimal" label="Default tax %" value={profile.defaultTaxRate} onChange={(value) => handleFieldChange('defaultTaxRate', value)} />
              <ProfileField label="Default invoice template" value={profile.defaultInvoiceTemplate} onChange={(value) => handleFieldChange('defaultInvoiceTemplate', value)} />
              <ProfileField label="Default statement template" value={profile.defaultStatementTemplate} onChange={(value) => handleFieldChange('defaultStatementTemplate', value)} />
              <ProfileField label="Default language" value={profile.defaultLanguage} onChange={(value) => handleFieldChange('defaultLanguage', value)} />
            </div>
          </div>
        </div>

        <div className="ol-actions">
          <button className="ol-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save workspace profile'}
          </button>
        </div>
      </form>

      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Business files</div>
            <p className="ol-panel-copy">
              Keep the logo and signature ready for invoices, statements, and exported documents.
            </p>
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
        </div>
      </section>

      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">{paymentTemplate.title}</div>
            <p className="ol-panel-copy">
              {paymentTemplate.helper} These details appear on invoices and payment messages.
            </p>
          </div>
        </div>
        <div className="ol-form-grid">
          <div className="ol-form-row ol-form-row--3">
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
        <div className="ol-actions">
          <button className="ol-button" disabled={isSaving} type="button" onClick={() => void saveWorkspaceProfile()}>
            {isSaving ? 'Saving...' : 'Save payment details'}
          </button>
        </div>
      </section>

      <section className="ol-note">
        <strong>Workspace note</strong>
        <span>
          Keep this business profile ready before sharing invoices, reports, or backups.
        </span>
      </section>

      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Launch checks</div>
            <p className="ol-panel-copy">
              Keep profile details, browser lock, backup, and reports ready before public use.
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

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Browser lock</div>
            <p className="ol-panel-copy">
              This is a browser-local PIN lock. It is not your cloud password and it is not
              included in workspace backups.
            </p>
          </div>
          <span className={`ol-chip ${isEnabled ? 'ol-chip--premium' : 'ol-chip--warning'}`}>
            {isEnabled ? 'On for this browser' : 'Off'}
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
      </section>
    </AppShell>
  );
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
