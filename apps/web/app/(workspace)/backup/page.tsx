'use client';

import { useRef, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  exportWorkspaceBackup,
  parseWorkspaceBackup,
  restoreWorkspaceBackup,
  type WebWorkspaceBackup,
} from '@/lib/workspace-backup';
import { useWorkspace } from '@/providers/workspace-provider';

export default function BackupPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [preview, setPreview] = useState<WebWorkspaceBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    if (!activeWorkspace) {
      return;
    }

    setIsExporting(true);
    setMessage(null);
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
      setMessage('Workspace backup exported.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Workspace backup could not be exported.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleFilePicked(file: File | null) {
    if (!file) {
      return;
    }

    setMessage(null);
    try {
      const parsed = parseWorkspaceBackup(await file.text());
      setPreview(parsed);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : 'Backup preview could not be loaded.');
    }
  }

  async function handleRestore() {
    if (!activeWorkspace || !preview) {
      return;
    }

    setIsRestoring(true);
    setMessage(null);
    try {
      await restoreWorkspaceBackup(activeWorkspace.workspaceId, preview);
      await refresh();
      setPreview(null);
      setMessage('Workspace backup restored. Current workspace data was fully replaced.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Backup restore could not be completed.');
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <AppShell title="Backup" subtitle="Export a cloud workspace copy or restore a reviewed backup into the current workspace.">
      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel-dark">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Export workspace backup
          </div>
          <p className="ol-panel-copy">
            Export a JSON copy of the current cloud workspace. Browser-local PIN settings are not
            included, and that limitation should stay explicit.
          </p>
          <div className="ol-actions">
            <button className="ol-button" disabled={isExporting} type="button" onClick={() => void handleExport()}>
              {isExporting ? 'Exporting...' : 'Export Backup'}
            </button>
          </div>
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Restore reviewed backup
          </div>
          <p className="ol-panel-copy">
            Restoring replaces the current workspace records in cloud storage. Review the backup
            first before confirming.
          </p>
          <div className="ol-actions">
            <button className="ol-button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
              Choose backup file
            </button>
            <input
              hidden
              accept="application/json"
              ref={fileInputRef}
              type="file"
              onChange={(event) => void handleFilePicked(event.target.files?.[0] ?? null)}
            />
            <button
              className="ol-button"
              disabled={!preview || isRestoring}
              type="button"
              onClick={() => void handleRestore()}
            >
              {isRestoring ? 'Restoring...' : 'Restore Backup'}
            </button>
          </div>
        </article>
      </section>

      {preview ? (
        <section className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Backup preview
          </div>
          <div className="ol-metric-grid">
            <MetricCard label="Customers" value={preview.entities.customers.length} />
            <MetricCard label="Transactions" value={preview.entities.transactions.length} />
            <MetricCard label="Products" value={preview.entities.products.length} />
            <MetricCard label="Invoices" value={preview.entities.invoices.length} />
            <MetricCard label="Invoice items" value={preview.entities.invoice_items.length} />
          </div>
          <p className="ol-panel-copy">
            Exported at {new Date(preview.exported_at).toLocaleString()}.
          </p>
        </section>
      ) : null}

      {message ? <div className={`ol-message${message.includes('could not') ? ' ol-message--danger' : ''}`}>{message}</div> : null}
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="ol-metric-card" data-tone="primary" style={{ minHeight: 128 }}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">Included in this backup preview.</div>
    </article>
  );
}
