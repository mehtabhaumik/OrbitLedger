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
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  stateCode: string;
  logoUri: string | null;
  signatureUri: string | null;
};

type PaymentFieldKey = keyof ManualPaymentInstructionDetails;

type ProfileFieldKey = keyof Omit<ProfileFormState, 'address' | 'logoUri' | 'signatureUri'>;

export default function SettingsPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { isEnabled, timeoutMs, enableLock, disableLock, setTimeoutMs } = useWebLock();
  const { showToast } = useToast();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileFormState>({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
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
      ownerName: activeWorkspace.ownerName,
      phone: activeWorkspace.phone,
      email: activeWorkspace.email,
      address: activeWorkspace.address,
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
        businessName: profile.businessName.trim(),
        ownerName: profile.ownerName.trim(),
        phone: profile.phone.trim(),
        email: profile.email.trim(),
        address: profile.address.trim(),
        currency: INDIA_COUNTRY.currency,
        countryCode: INDIA_COUNTRY.code,
        stateCode: profile.stateCode,
        logoUri: profile.logoUri,
        authorizedPersonName: workspace.authorizedPersonName,
        authorizedPersonTitle: workspace.authorizedPersonTitle,
        signatureUri: profile.signatureUri,
        paymentInstructions,
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
        businessName: nextProfile.businessName.trim(),
        ownerName: nextProfile.ownerName.trim(),
        phone: nextProfile.phone.trim(),
        email: nextProfile.email.trim(),
        address: nextProfile.address.trim(),
        currency: INDIA_COUNTRY.currency,
        countryCode: INDIA_COUNTRY.code,
        stateCode: nextProfile.stateCode,
        logoUri: nextProfile.logoUri,
        authorizedPersonName: workspace.authorizedPersonName,
        authorizedPersonTitle: workspace.authorizedPersonTitle,
        signatureUri: nextProfile.signatureUri,
        paymentInstructions,
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
