'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

import { AppShell } from '@/components/app-shell';
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
        currency: String(formData.get('currency') ?? 'INR'),
        countryCode: String(formData.get('countryCode') ?? 'IN'),
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
      <form action={saveWorkspaceProfile} style={styles.form}>
        <div style={styles.grid}>
          <Field name="businessName" label="Business name" defaultValue={workspace.businessName} />
          <Field name="ownerName" label="Owner name" defaultValue={workspace.ownerName} />
          <Field name="phone" label="Phone" defaultValue={workspace.phone} />
          <Field name="email" label="Email" defaultValue={workspace.email} />
          <Field name="address" label="Address" defaultValue={workspace.address} />
          <div style={styles.row}>
            <Field name="currency" label="Currency" defaultValue={workspace.currency} />
            <Field name="countryCode" label="Country" defaultValue={workspace.countryCode} />
            <Field name="stateCode" label="State" defaultValue={workspace.stateCode} />
          </div>
        </div>
        <button style={styles.button} disabled={isSaving} type="submit">
          {isSaving ? 'Saving...' : 'Save workspace profile'}
        </button>
      </form>
      <section style={styles.note}>
        <strong>Trust note</strong>
        <span>
          Web uses a signed-in workspace. Local mobile-only businesses must be linked from the
          mobile app before they can appear here.
        </span>
      </section>
      <section style={styles.form}>
        <div style={styles.titleRow}>
          <strong>Browser lock</strong>
          <span style={styles.pill}>{isEnabled ? 'On for this browser' : 'Off'}</span>
        </div>
        <p style={styles.noteCopy}>
          This is a browser-local PIN lock. It is not your cloud password and it is not included in
          workspace backups.
        </p>
        <div style={styles.lockRow}>
          <input
            inputMode="numeric"
            maxLength={4}
            placeholder="4-digit PIN"
            style={styles.input}
            type="password"
            value={pinInput}
            onChange={(event) => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <select
            style={styles.input}
            value={String(timeoutMs)}
            onChange={(event) => void setTimeoutMs(Number(event.target.value))}
          >
            <option value={String(60_000)}>1 minute</option>
            <option value={String(5 * 60_000)}>5 minutes</option>
            <option value={String(15 * 60_000)}>15 minutes</option>
          </select>
          {!isEnabled ? (
            <button style={styles.button} type="button" onClick={() => void enableBrowserLock()}>
              Turn On Lock
            </button>
          ) : (
            <button style={styles.secondaryButton} type="button" onClick={() => void disableBrowserLock()}>
              Turn Off Lock
            </button>
          )}
        </div>
        {lockMessage ? <span style={styles.helpText}>{lockMessage}</span> : null}
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
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input defaultValue={defaultValue} name={name} style={styles.input} />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
    display: 'grid',
    gap: 16,
  },
  grid: {
    display: 'grid',
    gap: 14,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    border: '1px solid var(--border)',
    padding: '0 14px',
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 800,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontWeight: 800,
    padding: '0 18px',
  },
  note: {
    display: 'grid',
    gap: 6,
    background: 'var(--warning-surface)',
    border: '1px solid #f0d7a7',
    borderRadius: 8,
    padding: 18,
    color: 'var(--text)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pill: {
    padding: '8px 10px',
    borderRadius: 999,
    background: 'var(--premium-surface)',
    color: 'var(--premium)',
    fontSize: 12,
    fontWeight: 800,
  },
  noteCopy: {
    margin: 0,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  lockRow: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 0.9fr auto',
    gap: 12,
  },
  helpText: {
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 700,
  },
};
