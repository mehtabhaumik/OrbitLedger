'use client';

import type { CSSProperties } from 'react';
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
      <section style={styles.grid}>
        <article style={styles.panel}>
          <div style={styles.title}>Export workspace backup</div>
          <p style={styles.copy}>
            Export a JSON copy of the current cloud workspace. Browser-local PIN settings are not
            included.
          </p>
          <button style={styles.button} disabled={isExporting} type="button" onClick={() => void handleExport()}>
            {isExporting ? 'Exporting...' : 'Export Backup'}
          </button>
        </article>

        <article style={styles.panel}>
          <div style={styles.title}>Restore reviewed backup</div>
          <p style={styles.copy}>
            Restoring replaces the current workspace records in cloud storage. Review the backup
            first before confirming.
          </p>
          <div style={styles.row}>
            <button style={styles.secondaryButton} type="button" onClick={() => fileInputRef.current?.click()}>
              Choose Backup File
            </button>
            <input
              hidden
              accept="application/json"
              ref={fileInputRef}
              type="file"
              onChange={(event) => void handleFilePicked(event.target.files?.[0] ?? null)}
            />
            <button
              style={styles.button}
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
        <section style={styles.preview}>
          <div style={styles.title}>Backup preview</div>
          <div style={styles.previewGrid}>
            <PreviewMetric label="Customers" value={preview.entities.customers.length} />
            <PreviewMetric label="Transactions" value={preview.entities.transactions.length} />
            <PreviewMetric label="Products" value={preview.entities.products.length} />
            <PreviewMetric label="Invoices" value={preview.entities.invoices.length} />
            <PreviewMetric label="Invoice items" value={preview.entities.invoice_items.length} />
          </div>
          <p style={styles.copy}>
            Exported at {new Date(preview.exported_at).toLocaleString()}.
          </p>
        </section>
      ) : null}

      {message ? <div style={styles.message}>{message}</div> : null}
    </AppShell>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.metric}>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
  },
  panel: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
    display: 'grid',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
  },
  copy: {
    margin: 0,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    minHeight: 44,
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 800,
    padding: '0 18px',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontWeight: 800,
    padding: '0 18px',
  },
  preview: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
    display: 'grid',
    gap: 14,
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
  },
  metric: {
    borderRadius: 8,
    border: '1px solid var(--border)',
    padding: 16,
    display: 'grid',
    gap: 6,
    background: '#f9fbfe',
  },
  metricValue: {
    fontSize: 22,
    color: 'var(--text)',
  },
  metricLabel: {
    color: 'var(--text-muted)',
    fontSize: 13,
    fontWeight: 700,
  },
  message: {
    padding: 16,
    borderRadius: 8,
    background: 'var(--primary-surface)',
    color: 'var(--text)',
    fontWeight: 700,
  },
};
