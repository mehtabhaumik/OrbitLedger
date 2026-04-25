'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  createDraftWorkspaceInvoice,
  listWorkspaceInvoices,
  type WorkspaceInvoice,
} from '@/lib/workspace-data';
import { useWorkspace } from '@/providers/workspace-provider';

export default function InvoicesPage() {
  const { activeWorkspace } = useWorkspace();
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void listWorkspaceInvoices(activeWorkspace.workspaceId).then(setInvoices);
  }, [activeWorkspace]);

  async function addDraftInvoice() {
    if (!activeWorkspace) {
      return;
    }

    const invoice = await createDraftWorkspaceInvoice(activeWorkspace.workspaceId);
    setInvoices((current) => [invoice, ...current]);
  }

  return (
    <AppShell title="Invoices" subtitle="Document-focused invoice workspace with clean draft control.">
      <section style={styles.panel}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.header}>Invoice workspace</div>
            <div style={styles.copy}>Drafts created here can later be completed with itemized details and shared as PDFs.</div>
          </div>
          <button style={styles.button} type="button" onClick={() => void addDraftInvoice()}>
            Create draft
          </button>
        </div>
      </section>
      <section style={styles.list}>
        {invoices.map((invoice) => (
          <div key={invoice.id} style={styles.row}>
            <span style={{ fontWeight: 800 }}>{invoice.invoiceNumber}</span>
            <span>{invoice.status}</span>
            <span style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(invoice.totalAmount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!invoices.length ? <div style={styles.empty}>No invoices yet. Create the first draft to start the document flow.</div> : null}
      </section>
    </AppShell>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

const styles: Record<string, CSSProperties> = {
  panel: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: 900,
  },
  copy: {
    color: 'var(--text-muted)',
    lineHeight: 1.6,
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
  list: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 0.6fr 0.8fr',
    gap: 16,
    alignItems: 'center',
    padding: '16px 18px',
    borderBottom: '1px solid var(--border)',
  },
  empty: {
    padding: 24,
    color: 'var(--text-muted)',
  },
};
