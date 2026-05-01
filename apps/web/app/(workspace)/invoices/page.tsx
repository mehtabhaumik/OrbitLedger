'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  createDraftWorkspaceInvoice,
  listWorkspaceInvoices,
  type WorkspaceInvoice,
} from '@/lib/workspace-data';
import {
  buildCsv,
  downloadTextFile,
  filterWorkspaceInvoices,
  makeExportFileName,
  pickSelectedRows,
  sumInvoiceTotals,
  type InvoiceStatusFilter,
} from '@/lib/workspace-power';
import { useWorkspace } from '@/providers/workspace-provider';

export default function InvoicesPage() {
  const { activeWorkspace } = useWorkspace();
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    setMessage(null);
    setMessageTone('success');
    setSelectedInvoiceIds(new Set());
    void listWorkspaceInvoices(activeWorkspace.workspaceId)
      .then(setInvoices)
      .catch((error) => {
        setMessageTone('danger');
        setMessage(error instanceof Error ? error.message : 'Invoices could not be loaded.');
      });
  }, [activeWorkspace]);

  async function addDraftInvoice() {
    if (!activeWorkspace) {
      return;
    }

    setIsCreating(true);
    setMessage(null);
    try {
      const invoice = await createDraftWorkspaceInvoice(activeWorkspace.workspaceId);
      setInvoices((current) => [invoice, ...current]);
      setMessageTone('success');
      setMessage(`Draft ${invoice.invoiceNumber} created.`);
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Invoice draft could not be created.');
    } finally {
      setIsCreating(false);
    }
  }

  const filteredInvoices = useMemo(
    () =>
      filterWorkspaceInvoices(invoices, {
        query: search,
        statusFilter,
        range: { from: dateFrom, to: dateTo },
      }),
    [dateFrom, dateTo, invoices, search, statusFilter]
  );
  const selectedInvoices = useMemo(
    () => pickSelectedRows(filteredInvoices, selectedInvoiceIds),
    [filteredInvoices, selectedInvoiceIds]
  );
  const invoiceSummary = useMemo(() => sumInvoiceTotals(filteredInvoices), [filteredInvoices]);
  const allVisibleSelected =
    filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedInvoiceIds.has(invoice.id));

  function toggleInvoiceSelection(invoiceId: string) {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  }

  function toggleAllVisibleInvoices() {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredInvoices.forEach((invoice) => next.delete(invoice.id));
      } else {
        filteredInvoices.forEach((invoice) => next.add(invoice.id));
      }
      return next;
    });
  }

  function exportInvoices() {
    if (!activeWorkspace) {
      return;
    }

    const rows = selectedInvoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.status,
      invoice.issueDate,
      invoice.customerId ?? '',
      invoice.totalAmount,
    ]);
    const csv = buildCsv(['Invoice number', 'Status', 'Issue date', 'Customer ID', 'Total'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        'invoices',
        selectedInvoiceIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    setMessageTone('success');
    setMessage(`${selectedInvoices.length} invoice${selectedInvoices.length === 1 ? '' : 's'} exported.`);
  }

  return (
    <AppShell title="Invoices" subtitle="Document-focused invoice workspace with clean draft control.">
      <section className="ol-split-grid">
        <article className="ol-panel-dark">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Invoice workspace</div>
              <p className="ol-panel-copy" style={{ maxWidth: 560 }}>
                Create drafts, finish item details, review totals, and export focused invoice lists.
              </p>
            </div>
            <button className="ol-button" disabled={isCreating} type="button" onClick={() => void addDraftInvoice()}>
              {isCreating ? 'Creating draft...' : 'Create draft'}
            </button>
          </div>
          {message ? (
            <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
              {message}
            </div>
          ) : null}
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Invoice review
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">P</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Preview-first flow</div>
                <div className="ol-list-text">
                  Use the wider screen for line items, totals, status checks, and downloads.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">B</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Clean document control</div>
                <div className="ol-list-text">
                  Filter by date and status before sending, saving, or reviewing documents.
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="ol-metric-grid">
        <Metric label="Showing" value={String(filteredInvoices.length)} helper="Invoices in this view." tone="primary" />
        <Metric
          label="Total"
          value={formatCurrency(invoiceSummary.total, activeWorkspace?.currency ?? 'INR')}
          helper="Invoice value in this view."
          tone="success"
        />
        <Metric
          label="Drafts"
          value={String(invoiceSummary.byStatus.draft ?? 0)}
          helper="Draft invoices still need review."
          tone="warning"
        />
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">Search invoices</span>
            <input
              className="ol-input"
              placeholder="Invoice number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Status</span>
            <select
              className="ol-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as InvoiceStatusFilter)}
            >
              <option value="all">All invoices</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">From</span>
            <input className="ol-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">To</span>
            <input className="ol-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <div className="ol-table-actions">
            <button className="ol-button-secondary" type="button" onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setDateFrom('');
              setDateTo('');
              setSelectedInvoiceIds(new Set());
            }}>
              Clear view
            </button>
            <button className="ol-button" type="button" disabled={!selectedInvoices.length} onClick={exportInvoices}>
              Export {selectedInvoiceIds.size ? 'selected' : 'view'}
            </button>
          </div>
        </div>
        <div className="ol-table-summary">
          {selectedInvoiceIds.size
            ? `${selectedInvoices.length} selected from this view.`
            : 'Select rows for a focused export, or export the current view.'}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '44px 1fr 0.55fr 0.65fr 0.8fr' }}>
          <span>
            <input
              aria-label="Select all visible invoices"
              checked={allVisibleSelected}
              className="ol-checkbox"
              type="checkbox"
              onChange={toggleAllVisibleInvoices}
            />
          </span>
          <span>Invoice</span>
          <span>Status</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>
        {filteredInvoices.map((invoice) => (
          <div
            className="ol-table-row"
            key={invoice.id}
            style={{ gridTemplateColumns: '44px 1fr 0.55fr 0.65fr 0.8fr' }}
          >
            <span>
              <input
                aria-label={`Select ${invoice.invoiceNumber}`}
                checked={selectedInvoiceIds.has(invoice.id)}
                className="ol-checkbox"
                type="checkbox"
                onChange={() => toggleInvoiceSelection(invoice.id)}
              />
            </span>
            <Link
              href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route}
              style={{ fontWeight: 800 }}
            >
              {invoice.invoiceNumber}
            </Link>
            <span>{invoice.status}</span>
            <span>{invoice.issueDate || '—'}</span>
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(invoice.totalAmount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!filteredInvoices.length ? (
          <div className="ol-empty">
            No invoices match this view.
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'primary' | 'warning' | 'success';
}) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">{helper}</div>
    </article>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
