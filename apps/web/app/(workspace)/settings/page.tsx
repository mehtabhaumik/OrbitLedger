'use client';

import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  normalizePhoneForCountry,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES } from '@/lib/india';
import { updateWorkspaceProfile } from '@/lib/workspaces';
import { useWebLock } from '@/providers/web-lock-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type ProfileFormState = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  stateCode: string;
};

type ProfileFieldKey = keyof Omit<ProfileFormState, 'address'>;

export default function SettingsPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { isEnabled, timeoutMs, enableLock, disableLock, setTimeoutMs } = useWebLock();
  const [profile, setProfile] = useState<ProfileFormState>({
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    stateCode: 'GJ',
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
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [lockMessageTone, setLockMessageTone] = useState<'success' | 'danger'>('success');
  const [pinError, setPinError] = useState<string | null>(null);

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
    setMessage(null);
  }, [activeWorkspace]);

  if (!activeWorkspace) {
    return null;
  }

  const workspace = activeWorkspace;

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
    setMessage(null);

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

  async function saveWorkspaceProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setMessageTone('danger');
      setMessage('Fix highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setMessage(null);
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
      });
      await refresh();
      setMessageTone('success');
      setMessage('Workspace profile saved.');
    } catch (nextError) {
      setMessageTone('danger');
      setMessage(nextError instanceof Error ? nextError.message : 'Workspace profile could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  async function enableBrowserLock() {
    if (pinInput.length !== 4) {
      setPinError('Use a 4-digit PIN.');
      setLockMessageTone('danger');
      setLockMessage('Use a 4-digit PIN to turn on browser lock.');
      return;
    }

    setPinError(null);
    await enableLock(pinInput, timeoutMs);
    setPinInput('');
    setLockMessageTone('success');
    setLockMessage('Browser lock is now on for this device.');
  }

  async function disableBrowserLock() {
    if (pinInput.length !== 4) {
      setPinError('Enter your current 4-digit PIN.');
      setLockMessageTone('danger');
      setLockMessage('Enter your current 4-digit PIN to turn lock off.');
      return;
    }

    try {
      setPinError(null);
      await disableLock(pinInput);
      setPinInput('');
      setLockMessageTone('success');
      setLockMessage('Browser lock is now off for this device.');
    } catch (error) {
      setPinError('Current PIN is incorrect.');
      setLockMessageTone('danger');
      setLockMessage(error instanceof Error ? error.message : 'Browser lock could not be changed.');
    }
  }

  return (
    <AppShell title="Settings" subtitle="Workspace profile, sync truth, and business identity.">
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
              placeholder="+91 98765 43210"
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
              placeholder="owner@example.com"
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

        {message ? (
          <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
            {message}
          </div>
        ) : null}

        <div className="ol-actions">
          <button className="ol-button" disabled={isSaving} type="submit">
            {isSaving ? 'Saving...' : 'Save workspace profile'}
          </button>
        </div>
      </form>

      <section className="ol-note">
        <strong>Trust note</strong>
        <span>
          Web uses a signed-in workspace. Local mobile-only businesses must be linked from the
          mobile app before they can appear here.
        </span>
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
              placeholder="0000"
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
                if (lockMessage) {
                  setLockMessage(null);
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

        {lockMessage ? (
          <div className={`ol-message${lockMessageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
            {lockMessage}
          </div>
        ) : null}
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
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  value: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
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
        placeholder={placeholder}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="ol-field-error">{error}</span> : null}
    </label>
  );
}
