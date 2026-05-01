'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  exportWorkspaceBackup,
  parseWorkspaceBackup,
  restoreWorkspaceBackup,
  summarizeWorkspaceBackup,
  type WebWorkspaceBackup,
} from '@/lib/workspace-backup';
import { useAuth } from '@/providers/auth-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function BackupPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [preview, setPreview] = useState<WebWorkspaceBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [lastProtectedAt, setLastProtectedAt] = useState<string | null>(null);
  const backupSummary = useMemo(() => (preview ? summarizeWorkspaceBackup(preview) : null), [preview]);
  const activeBackupKey = activeWorkspace
    ? `orbit-ledger:last-web-backup:${activeWorkspace.workspaceId}`
    : null;

  useEffect(() => {
    if (!activeBackupKey) {
      setLastProtectedAt(null);
      return;
    }

    setLastProtectedAt(window.localStorage.getItem(activeBackupKey));
  }, [activeBackupKey]);

  async function handleExport() {
    if (!activeWorkspace) {
      return;
    }

    setIsExporting(true);
    setMessage(null);
    setMessageTone('success');
    try {
      const backup = await exportWorkspaceBackup(activeWorkspace.workspaceId);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `orbit-ledger-${activeWorkspace.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-workspace-backup.json`;
      link.click();
      URL.revokeObjectURL(href);
      const protectedAt = backup.exported_at;
      if (activeBackupKey) {
        window.localStorage.setItem(activeBackupKey, protectedAt);
      }
      setLastProtectedAt(protectedAt);
      setMessageTone('success');
      setMessage('Workspace backup exported. Keep this file somewhere private and easy to find.');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Workspace backup could not be exported.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFilePicked(file: File | null) {
    setPreview(null);
    setSelectedFileName('');
    setFileError(null);
    setMessage(null);

    if (!file) {
      return;
    }

    const fileName = file.name || 'backup.json';
    setSelectedFileName(fileName);
    const isJsonName = /\.json$/i.test(fileName);
    const isJsonType =
      file.type === 'application/json' ||
      file.type === 'text/json' ||
      file.type === 'application/octet-stream' ||
      file.type === '';
    if (!isJsonName || !isJsonType) {
      setFileError('Choose a valid backup file.');
      return;
    }

    try {
      const parsed = parseWorkspaceBackup(await file.text());
      setPreview(parsed);
      setMessageTone('success');
      setMessage('Backup file loaded. Review counts before restoring.');
    } catch (error) {
      setPreview(null);
      setMessageTone('danger');
      setFileError(error instanceof Error ? error.message : 'Backup preview could not be loaded.');
    }
  }

  async function handleRestore() {
    if (!activeWorkspace || !preview || !user) {
      return;
    }
    if (restoreConfirmation.trim() !== activeWorkspace.businessName) {
      setMessageTone('danger');
      setMessage(`Type ${activeWorkspace.businessName} to confirm restore.`);
      return;
    }

    setIsRestoring(true);
    setMessage(null);
    setMessageTone('success');
    setRestoreProgress('Preparing rollback copy...');
    let rollbackBackup: WebWorkspaceBackup | null = null;
    try {
      rollbackBackup = await exportWorkspaceBackup(activeWorkspace.workspaceId);
      setRestoreProgress('Applying backup...');
      await restoreWorkspaceBackup(activeWorkspace.workspaceId, preview, {
        expectedOwnerId: user.uid,
        onProgress: setRestoreProgress,
      });
      await refresh();
      const protectedAt = new Date().toISOString();
      if (activeBackupKey) {
        window.localStorage.setItem(activeBackupKey, protectedAt);
      }
      setLastProtectedAt(protectedAt);
      setPreview(null);
      setSelectedFileName('');
      setFileError(null);
      setRestoreConfirmation('');
      setMessageTone('success');
      setMessage('Workspace backup restored. A rollback copy was prepared before changes were applied.');
    } catch (error) {
      if (rollbackBackup) {
        try {
          setRestoreProgress('Restore failed. Rolling back current data...');
          await restoreWorkspaceBackup(activeWorkspace.workspaceId, rollbackBackup, {
            expectedOwnerId: user.uid,
            onProgress: setRestoreProgress,
          });
        } catch {
          setMessageTone('danger');
          setMessage('Restore failed, and rollback could not complete. Review the workspace before continuing.');
          setIsRestoring(false);
          return;
        }
      }
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Backup restore could not be completed.');
    } finally {
      setRestoreProgress(null);
      setIsRestoring(false);
    }
  }

  return (
    <AppShell title="Backup" subtitle="Save a copy of this business or restore a reviewed backup.">
      <section className="ol-panel">
        <div className="ol-panel-title" style={{ marginBottom: 12 }}>
          Protection status
        </div>
        <div className="ol-metric-grid">
          <MetricCard
            label="Status"
            helper={
              lastProtectedAt
                ? 'This browser has exported a backup for this workspace.'
                : 'Create a backup to protect this workspace.'
            }
            value={lastProtectedAt ? 'Protected' : 'No backup yet'}
          />
          <MetricCard
            label="Last protected"
            helper="Based on backups exported from this browser."
            value={lastProtectedAt ? new Date(lastProtectedAt).toLocaleString() : 'Not saved yet'}
          />
          <MetricCard
            label="Included"
            helper="Customers, transactions, products, invoices, and invoice items."
            value="Core records"
          />
          <MetricCard
            label="Not included"
            helper="Browser lock settings and files outside this workspace."
            value="Local-only items"
          />
        </div>
      </section>

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel-dark">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Save backup
          </div>
          <p className="ol-panel-copy">
            Download a backup of this business. Browser lock settings and files outside this workspace are not included.
          </p>
          <div className="ol-actions">
            <button className="ol-button" disabled={isExporting} type="button" onClick={() => void handleExport()}>
              {isExporting ? 'Saving...' : 'Save Backup'}
            </button>
          </div>
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Restore backup
          </div>
          <p className="ol-panel-copy">
            Restoring replaces the current business data. Orbit Ledger prepares a rollback copy first.
          </p>
          <div className="ol-actions">
            <button className="ol-button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
              Choose Backup File
            </button>
            <input
              hidden
              accept="application/json"
              ref={fileInputRef}
              type="file"
              onChange={(event) => void handleFilePicked(event.target.files?.[0] ?? null)}
            />
            <div className={`ol-field${fileError ? ' is-invalid' : ''}`}>
              <span className="ol-field-label">Selected backup file</span>
              <input
                className="ol-input"
                readOnly
                value={selectedFileName || 'No file selected'}
              />
              {fileError ? <span className="ol-field-error">{fileError}</span> : null}
            </div>
            <button
              className="ol-button"
              disabled={!preview || isRestoring || restoreConfirmation.trim() !== activeWorkspace?.businessName}
              type="button"
              onClick={() => void handleRestore()}
            >
              {isRestoring ? 'Restoring...' : 'Restore Backup'}
            </button>
          </div>
        </article>
      </section>

      {preview && backupSummary ? (
        <section className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Backup Preview
          </div>
          <p className="ol-panel-copy">
            This backup is for {backupSummary.businessName}. It was saved on{' '}
            {new Date(backupSummary.exportedAt).toLocaleString()} and contains{' '}
            {backupSummary.totalRecords} records.
          </p>
          <div className="ol-metric-grid">
            <MetricCard label="Customers" value={backupSummary.counts.customers} />
            <MetricCard label="Transactions" value={backupSummary.counts.transactions} />
            <MetricCard label="Products" value={backupSummary.counts.products} />
            <MetricCard label="Invoices" value={backupSummary.counts.invoices} />
            <MetricCard label="Invoice items" value={backupSummary.counts.invoice_items} />
          </div>
          <p className="ol-panel-copy">
            Restoring this backup will replace the current workspace after you type the business name.
          </p>
          <label className="ol-field" style={{ marginTop: 16 }}>
            <span className="ol-field-label">Type business name to confirm</span>
            <input
              className="ol-input"
              value={restoreConfirmation}
              placeholder={activeWorkspace?.businessName ?? 'Business name'}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
            />
          </label>
        </section>
      ) : null}

      {restoreProgress ? <div className="ol-message ol-message--success">{restoreProgress}</div> : null}

      {message ? (
        <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
          {message}
        </div>
      ) : null}
    </AppShell>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: number | string; helper?: string }) {
  return (
    <article className="ol-metric-card" data-tone="primary" style={{ minHeight: 128 }}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">{helper ?? 'Included in this backup preview.'}</div>
    </article>
  );
}
