'use client';

import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { INDIA_COUNTRY, INDIAN_STATES } from '@/lib/india';
import { updateWorkspaceProfile } from '@/lib/workspaces';
import { useWebLock } from '@/providers/web-lock-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function SettingsPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { isEnabled, timeoutMs, enableLock, disableLock, setTimeoutMs } = useWebLock();
  const [isSaving, setIsSaving] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  if (!activeWorkspace) {
    return null;
  }

  const workspace = activeWorkspace;

  async function saveWorkspaceProfile(formData: FormData) {
    setIsSaving(true);
    try {
      await updateWorkspaceProfile(workspace.workspaceId, workspace.serverRevision, {
        businessName: String(formData.get('businessName') ?? ''),
        ownerName: String(formData.get('ownerName') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        email: String(formData.get('email') ?? ''),
        address: String(formData.get('address') ?? ''),
        currency: INDIA_COUNTRY.currency,
        countryCode: INDIA_COUNTRY.code,
        stateCode: String(formData.get('stateCode') ?? ''),
      });
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function enableBrowserLock() {
    if (pinInput.length !== 4) {
      setLockMessage('Use a 4-digit PIN to turn on browser lock.');
      return;
    }

    await enableLock(pinInput, timeoutMs);
    setPinInput('');
    setLockMessage('Browser lock is now on for this device.');
  }

  async function disableBrowserLock() {
    try {
      await disableLock(pinInput);
      setPinInput('');
      setLockMessage('Browser lock is now off for this device.');
    } catch (error) {
      setLockMessage(error instanceof Error ? error.message : 'Browser lock could not be changed.');
    }
  }

  return (
    <AppShell title="Settings" subtitle="Workspace profile, sync truth, and business identity.">
      <form action={saveWorkspaceProfile} className="ol-panel-glass">
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
            <Field name="businessName" label="Business name" defaultValue={workspace.businessName} />
            <Field name="ownerName" label="Owner name" defaultValue={workspace.ownerName} />
            <Field name="phone" label="Phone" defaultValue={workspace.phone} />
          </div>
          <div className="ol-form-row ol-form-row--3">
            <Field name="email" label="Email" defaultValue={workspace.email} />
            <Field name="address" label="Address" defaultValue={workspace.address} />
            <label className="ol-field">
              <span className="ol-field-label">Country</span>
              <select className="ol-select" defaultValue={INDIA_COUNTRY.code} disabled name="countryCode">
                <option value={INDIA_COUNTRY.code}>{INDIA_COUNTRY.name}</option>
              </select>
            </label>
          </div>
          <div className="ol-form-row ol-form-row--3">
            <label className="ol-field">
              <span className="ol-field-label">Currency</span>
              <select className="ol-select" defaultValue={INDIA_COUNTRY.currency} disabled name="currency">
                <option value={INDIA_COUNTRY.currency}>{INDIA_COUNTRY.currency}</option>
              </select>
            </label>
            <label className="ol-field">
              <span className="ol-field-label">State</span>
              <select className="ol-select" defaultValue={workspace.stateCode} name="stateCode">
                {INDIAN_STATES.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

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
          <label className="ol-field">
            <span className="ol-field-label">PIN</span>
            <input
              className="ol-input ol-input--pin ol-input--pin-left"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              type="password"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 4))}
            />
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

        {lockMessage ? <div className="ol-message">{lockMessage}</div> : null}
      </section>
    </AppShell>
  );
}

function Field({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <input className="ol-input" defaultValue={defaultValue} name={name} />
    </label>
  );
}
