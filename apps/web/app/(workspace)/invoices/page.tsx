'use client';

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
      <section className="ol-split-grid">
        <article className="ol-panel-dark">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Invoice workspace</div>
              <p className="ol-panel-copy" style={{ maxWidth: 560 }}>
                Drafts created here can later be completed with itemized details and shared as PDFs.
                The layout leans into a more desktop document workflow than the mobile app.
              </p>
            </div>
            <button className="ol-button" type="button" onClick={() => void addDraftInvoice()}>
              Create draft
            </button>
          </div>
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Why web invoices feel different
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">P</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Preview-first flow</div>
                <div className="ol-list-text">
                  The wide shell is better suited for long item tables, PDF review, and export
                  controls than a single mobile column.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">B</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Brand and trust</div>
                <div className="ol-list-text">
                  Consistent business identity matters more on document surfaces than almost any
                  other page in the product.
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="ol-table">
        <div className="ol-table-head" style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr' }}>
          <span>Invoice</span>
          <span>Status</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>
        {invoices.map((invoice) => (
          <div className="ol-table-row" key={invoice.id} style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr' }}>
            <span style={{ fontWeight: 800 }}>{invoice.invoiceNumber}</span>
            <span>{invoice.status}</span>
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(invoice.totalAmount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!invoices.length ? (
          <div className="ol-empty">
            No invoices yet. Create the first draft to start the document flow.
          </div>
        ) : null}
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
