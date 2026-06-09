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
import { openOrbitPrintDocument, printPreparedByFromUser } from '@/lib/print-system';
import { buildWorkspaceProfileView } from '@/lib/workspace-profile-view';
import { useAuth } from '@/providers/auth-provider';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function BackupPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const { user } = useAuth();
  const officeAccess = useOfficeAccess();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [preview, setPreview] = useState<WebWorkspaceBackup | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);
  const [lastProtectedAt, setLastProtectedAt] = useState<string | null>(null);
  const backupSummary = useMemo(() => (preview ? summarizeWorkspaceBackup(preview) : null), [preview]);
  const workspaceProfile = useMemo(
    () => (activeWorkspace ? buildWorkspaceProfileView(activeWorkspace) : null),
    [activeWorkspace]
  );
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
    if (!officeAccess.can('export_backup')) {
      showToast(officeAccess.getLockedMessage('export_backup'), 'info');
      return;
    }

    setIsExporting(true);
    try {
      const backup = await exportWorkspaceBackup(activeWorkspace.workspaceId);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `orbit-ledger-${workspaceProfile?.exportName ?? 'workspace'}-workspace-backup.json`;
      link.click();
      URL.revokeObjectURL(href);
      const protectedAt = backup.exported_at;
      if (activeBackupKey) {
        window.localStorage.setItem(activeBackupKey, protectedAt);
      }
      setLastProtectedAt(protectedAt);
      showToast('Workspace backup exported. Keep this file private.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Workspace backup could not be exported.', 'danger');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFilePicked(file: File | null) {
    if (!officeAccess.can('restore_backup')) {
      showToast(officeAccess.getLockedMessage('restore_backup'), 'info');
      return;
    }

    setPreview(null);
    setSelectedFileName('');
    setFileError(null);

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
      showToast('Choose a valid backup file.', 'danger');
      return;
    }

    try {
      const parsed = parseWorkspaceBackup(await file.text());
      setPreview(parsed);
      showToast('Backup file loaded. Review counts before restoring.', 'success');
    } catch (error) {
      setPreview(null);
      setFileError(error instanceof Error ? error.message : 'Backup preview could not be loaded.');
      showToast(error instanceof Error ? error.message : 'Backup preview could not be loaded.', 'danger');
    }
  }

  async function handleRestore() {
    if (!activeWorkspace || !preview || !user) {
      return;
    }
    if (!officeAccess.can('restore_backup')) {
      showToast(officeAccess.getLockedMessage('restore_backup'), 'info');
      return;
    }
    const confirmationName = workspaceProfile?.displayName ?? activeWorkspace.businessName;
    if (restoreConfirmation.trim() !== confirmationName) {
      showToast(`Type ${confirmationName} to confirm restore.`, 'danger');
      return;
    }

    setIsRestoring(true);
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
      showToast('Workspace backup restored. Rollback copy was prepared first.', 'success');
    } catch (error) {
      if (rollbackBackup) {
        try {
          setRestoreProgress('Restore failed. Rolling back current data...');
          await restoreWorkspaceBackup(activeWorkspace.workspaceId, rollbackBackup, {
            expectedOwnerId: user.uid,
            onProgress: setRestoreProgress,
          });
        } catch {
          showToast('Restore failed, and rollback could not complete. Review the workspace.', 'danger');
          setIsRestoring(false);
          return;
        }
      }
      showToast(error instanceof Error ? error.message : 'Backup restore could not be completed.', 'danger');
    } finally {
      setRestoreProgress(null);
      setIsRestoring(false);
    }
  }

  function printBackupSummary() {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('export_backup')) {
      showToast(officeAccess.getLockedMessage('export_backup'), 'info');
      return;
    }

    try {
      openOrbitPrintDocument({
        title: 'Backup and Export Summary',
        subtitle: 'Workspace backup status and restore review.',
        workspace: activeWorkspace,
        preparedBy: printPreparedByFromUser(user),
        classification: 'Data protection record',
        sections: [
          {
            type: 'summary',
            title: 'Protection status',
            metrics: [
              { label: 'Status', value: lastProtectedAt ? 'Protected' : 'No backup yet' },
              { label: 'Last protected', value: lastProtectedAt ? new Date(lastProtectedAt).toLocaleString() : 'Not saved yet' },
              { label: 'Included', value: 'Core records' },
              { label: 'Preview loaded', value: backupSummary ? 'Yes' : 'No' },
            ],
          },
          {
            type: 'table',
            title: 'Backup preview',
            columns: [
              { key: 'record', label: 'Record' },
              { key: 'count', label: 'Count', align: 'right' },
            ],
            rows: backupSummary
              ? [
                  { record: 'Customers', count: backupSummary.counts.customers },
                  { record: 'Transactions', count: backupSummary.counts.transactions },
                  { record: 'Products', count: backupSummary.counts.products },
                  { record: 'Invoices', count: backupSummary.counts.invoices },
                  { record: 'Invoice items', count: backupSummary.counts.invoice_items },
                  { record: 'Payment reversals', count: backupSummary.counts.payment_reversals },
                ]
              : [],
            emptyText: 'No backup file is loaded for preview.',
          },
          {
            type: 'notes',
            title: 'Restore safety',
            lines: [
              'Restoring replaces the current business data after review.',
              'Orbit Ledger prepares a rollback copy before applying a restore.',
              selectedFileName ? `Selected file: ${selectedFileName}` : 'No file selected.',
            ],
          },
        ],
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Print view could not open.', 'danger');
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
        <div className="ol-actions" style={{ marginTop: 16 }}>
          <button className="ol-button-secondary" type="button" disabled={!officeAccess.can('export_backup')} onClick={printBackupSummary}>
            Print backup summary
          </button>
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
            <button className="ol-button" disabled={isExporting || !officeAccess.can('export_backup')} type="button" onClick={() => void handleExport()}>
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
            <button className="ol-button-secondary" disabled={!officeAccess.can('restore_backup')} type="button" onClick={() => fileInputRef.current?.click()}>
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
              <span className="ol-field-label ol-field-label--with-meta">
                <span className="ol-field-label-text">
                  Selected backup file
                  <span className="ol-required-badge">Required</span>
                </span>
                <BackupFieldHelp text="Choose the JSON backup file you want to preview. Restore stays blocked until Orbit Ledger can read and validate this file." />
              </span>
              <input
                className="ol-input"
                aria-required="true"
                readOnly
                value={selectedFileName || 'No file selected'}
              />
              {fileError ? <span className="ol-field-error">{fileError}</span> : null}
            </div>
            <button
              className="ol-button"
              disabled={!preview || isRestoring || restoreConfirmation.trim() !== workspaceProfile?.displayName || !officeAccess.can('restore_backup')}
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
            <MetricCard label="Payment reversals" value={backupSummary.counts.payment_reversals} />
          </div>
          <p className="ol-panel-copy">
            Restoring this backup will replace the current workspace after you type the business name.
          </p>
          <label className="ol-field" style={{ marginTop: 16 }}>
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">
                Type business name to confirm
                <span className="ol-required-badge">Required</span>
              </span>
              <BackupFieldHelp text="This exact confirmation prevents accidental restore. Type the current business name before the restore button unlocks." />
            </span>
            <input
              aria-required="true"
              className="ol-input"
              required
              value={restoreConfirmation}
              placeholder={workspaceProfile?.displayName ?? 'Business name'}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
            />
          </label>
        </section>
      ) : null}

      {restoreProgress ? <div className="ol-message ol-message--success">{restoreProgress}</div> : null}
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

function BackupFieldHelp({ text }: { text: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label="Field help">?</summary>
      <span>{text}</span>
    </details>
  );
}
