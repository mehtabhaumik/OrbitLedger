'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getInvoiceDocumentStateLabel,
  getInvoicePaymentStatusLabel,
  INVOICE_DOCUMENT_STATES,
  INVOICE_PAYMENT_STATUSES,
} from '@orbit-ledger/core';

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
  type InvoiceFilterSet,
} from '@/lib/workspace-power';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function InvoicesPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const router = useRouter();
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<InvoiceFilterSet>({
    customerIds: [],
    documentStates: [],
    paymentStatuses: [],
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    setSelectedInvoiceIds(new Set());
    void listWorkspaceInvoices(activeWorkspace.workspaceId)
      .then(setInvoices)
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Invoices could not be loaded.', 'danger');
      });
  }, [activeWorkspace, showToast]);

  async function addDraftInvoice() {
    if (!activeWorkspace) {
      return;
    }

    setIsCreating(true);
    try {
      const invoice = await createDraftWorkspaceInvoice(activeWorkspace.workspaceId);
      setInvoices((current) => [invoice, ...current]);
      showToast(`Invoice ${invoice.invoiceNumber} created.`, 'success');
      router.push(`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice could not be created.', 'danger');
    } finally {
      setIsCreating(false);
    }
  }

  const visibleInvoices = useMemo(
    () => (showArchived ? invoices : invoices.filter((invoice) => !invoice.isArchived)),
    [invoices, showArchived]
  );
  const archivedInvoiceCount = invoices.filter((invoice) => invoice.isArchived).length;
  const filteredInvoices = useMemo(
    () =>
      filterWorkspaceInvoices(visibleInvoices, {
        query: search,
        filters,
        range: { from: dateFrom, to: dateTo },
      }),
    [dateFrom, dateTo, filters, search, visibleInvoices]
  );
  const selectedInvoices = useMemo(
    () => pickSelectedRows(filteredInvoices, selectedInvoiceIds),
    [filteredInvoices, selectedInvoiceIds]
  );
  const invoiceSummary = useMemo(() => sumInvoiceTotals(filteredInvoices), [filteredInvoices]);
  const allVisibleSelected =
    filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedInvoiceIds.has(invoice.id));
  const customerOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const invoice of visibleInvoices) {
      if (invoice.customerId) {
        options.set(invoice.customerId, invoice.customerName ?? 'Customer');
      }
    }
    return Array.from(options.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  }, [visibleInvoices]);

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

    const exportRows = selectedInvoices.length ? selectedInvoices : filteredInvoices;
    const rows = exportRows.map((invoice) => [
      invoice.invoiceNumber,
      getInvoiceDocumentStateLabel(invoice.documentState),
      getInvoicePaymentStatusLabel(invoice.paymentStatus),
      invoice.issueDate,
      invoice.customerName ?? '',
      invoice.totalAmount,
    ]);
    const csv = buildCsv(['Invoice number', 'Document state', 'Payment state', 'Issue date', 'Customer', 'Amount'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        'invoices',
        selectedInvoiceIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    showToast(`${exportRows.length} invoice${exportRows.length === 1 ? '' : 's'} exported.`, 'success');
  }

  function toggleFilter(key: keyof InvoiceFilterSet, value: string) {
    setFilters((current) => {
      const values = new Set(current[key]);
      if (values.has(value)) {
        values.delete(value);
      } else {
        values.add(value);
      }
      return { ...current, [key]: Array.from(values) };
    });
  }

  function toggleInvoiceExpanded(invoiceId: string) {
    setExpandedInvoiceIds((current) => {
      const next = new Set(current);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  }

  return (
    <AppShell title="Invoices" subtitle="Create, edit, review, and export invoices from the web workspace.">
      <section className="ol-split-grid">
        <article className="ol-panel-dark">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Invoice workspace</div>
              <p className="ol-panel-copy" style={{ maxWidth: 560 }}>
                Start a new invoice and continue directly in the editor for line items, totals, saved versions, and export.
              </p>
            </div>
            <button className="ol-button" disabled={isCreating} type="button" onClick={() => void addDraftInvoice()}>
              {isCreating ? 'Creating...' : 'Create invoice'}
            </button>
          </div>
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
                  Filter by customer, document state, payment state, and date before sending or reviewing documents.
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
          helper="Working invoices still need first save."
          tone="warning"
        />
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">Search invoices</span>
            <input
              className="ol-input"
              placeholder="Invoice or customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <FilterGroup
            label="Customer"
            options={customerOptions.map(([value, label]) => ({ value, label }))}
            selected={filters.customerIds}
            onToggle={(value) => toggleFilter('customerIds', value)}
          />
          <FilterGroup
            label="Invoice"
            options={INVOICE_DOCUMENT_STATES.map((value) => ({ value, label: getInvoiceDocumentStateLabel(value) }))}
            selected={filters.documentStates}
            onToggle={(value) => toggleFilter('documentStates', value)}
          />
          <FilterGroup
            label="Payment"
            options={INVOICE_PAYMENT_STATUSES.map((value) => ({ value, label: getInvoicePaymentStatusLabel(value) }))}
            selected={filters.paymentStatuses}
            onToggle={(value) => toggleFilter('paymentStatuses', value)}
          />
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
              setFilters({ customerIds: [], documentStates: [], paymentStatuses: [] });
              setDateFrom('');
              setDateTo('');
              setSelectedInvoiceIds(new Set());
            }}>
              Clear view
            </button>
            <button className="ol-button-secondary" type="button" onClick={() => setShowArchived((current) => !current)}>
              {showArchived ? 'Hide archived' : `Show archived${archivedInvoiceCount ? ` (${archivedInvoiceCount})` : ''}`}
            </button>
            <button className="ol-button" type="button" disabled={!filteredInvoices.length} onClick={exportInvoices}>
              Export {selectedInvoiceIds.size ? 'selected' : 'view'}
            </button>
          </div>
        </div>
        <div className="ol-table-summary">
          {selectedInvoiceIds.size
            ? `${selectedInvoices.length} selected from this view.`
            : 'Select rows for a focused export, or export the current view.'}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '44px 1.15fr 0.8fr 0.7fr 0.65fr 0.65fr 0.8fr' }}>
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
          <span>Customer</span>
          <span>Invoice state</span>
          <span>Payment</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
        </div>
        {filteredInvoices.map((invoice) => (
          <div key={invoice.id}>
            <div
              className="ol-table-row"
              style={{ gridTemplateColumns: '44px 1.15fr 0.8fr 0.7fr 0.65fr 0.65fr 0.8fr' }}
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
              <span>
                <Link
                  href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route}
                  style={{ fontWeight: 800 }}
                >
                  {invoice.invoiceNumber}
                </Link>
                {invoice.isArchived ? <span className="ol-chip ol-chip--tax" style={{ marginLeft: 8 }}>Archived</span> : null}
                <button
                  className="ol-link-button"
                  type="button"
                  onClick={() => toggleInvoiceExpanded(invoice.id)}
                >
                  {invoice.versions?.length ? `${invoice.versions.length} version${invoice.versions.length === 1 ? '' : 's'}` : 'No saved version'}
                </button>
              </span>
              <span>{invoice.customerName ?? 'Unlinked customer'}</span>
              <span>{getInvoiceDocumentStateLabel(invoice.documentState)}</span>
              <span>{getInvoicePaymentStatusLabel(invoice.paymentStatus)}</span>
              <span>{invoice.issueDate || '—'}</span>
              <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
                {formatCurrency(invoice.totalAmount, activeWorkspace?.currency ?? 'INR')}
              </span>
            </div>
            {expandedInvoiceIds.has(invoice.id) && invoice.versions?.length ? (
              <div className="ol-version-rows">
                {invoice.versions.map((version) => (
                  <div className="ol-version-row" key={version.id}>
                    <span>v{version.versionNumber}</span>
                    <span>{version.invoiceNumber}</span>
                    <span>{formatDateTime(version.createdAt)}</span>
                    <span>{version.reason}</span>
                    <span>{getInvoicePaymentStatusLabel(version.paymentStatus)}</span>
                    <span className="ol-amount">{formatCurrency(version.totalAmount, activeWorkspace?.currency ?? 'INR')}</span>
                    <Link className="ol-button-secondary" href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route}>
                      View / update
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
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

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const controlRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 220, maxHeight: 238 });
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  const summary = selectedLabels.length
    ? selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} selected`
    : 'All';

  function updateMenuPosition() {
    const control = controlRef.current;
    if (!control) {
      return;
    }

    const rect = control.getBoundingClientRect();
    const viewportGap = 12;
    const triggerGap = 8;
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24);
    const left = Math.min(Math.max(rect.left, viewportGap), window.innerWidth - width - viewportGap);
    const measuredMenuHeight = menuRef.current?.scrollHeight ?? menuRef.current?.getBoundingClientRect().height ?? 238;
    const desiredMenuHeight = Math.min(measuredMenuHeight, 320);
    const spaceBelow = window.innerHeight - rect.bottom - triggerGap - viewportGap;
    const spaceAbove = rect.top - triggerGap - viewportGap;
    const openAbove = spaceBelow < desiredMenuHeight && spaceAbove > spaceBelow;
    const availableSpace = Math.max(openAbove ? spaceAbove : spaceBelow, 120);
    const maxHeight = Math.min(desiredMenuHeight, availableSpace);
    const menuHeight = Math.min(measuredMenuHeight, maxHeight);
    setMenuPosition({
      left,
      top: openAbove
        ? Math.max(viewportGap, rect.top - triggerGap - menuHeight)
        : Math.min(rect.bottom + triggerGap, window.innerHeight - viewportGap - menuHeight),
      width,
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (isOpen) {
      updateMenuPosition();
    }
  }, [isOpen, options.length, selected.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    const closeIfOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (controlRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const reposition = () => updateMenuPosition();

    window.addEventListener('pointerdown', closeIfOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      window.removeEventListener('pointerdown', closeIfOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen]);

  return (
    <div className="ol-field">
      <span className="ol-field-label">{label}</span>
      <div className={`ol-multi-select${isOpen ? ' is-open' : ''}`}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="ol-multi-select-trigger"
          ref={controlRef}
          type="button"
          onClick={() => {
            if (!isOpen) {
              updateMenuPosition();
            }
            setIsOpen((current) => !current);
          }}
        >
          <span>{summary}</span>
          <span className="ol-multi-select-count">{selected.length || 'All'}</span>
        </button>
        {isOpen ? (
          <div
            className="ol-multi-select-menu"
            ref={menuRef}
            role="menu"
            style={{
              left: menuPosition.left,
              maxHeight: menuPosition.maxHeight,
              top: menuPosition.top,
              width: menuPosition.width,
            }}
          >
            {options.length ? (
              options.map((option) => (
                <label className="ol-multi-select-option" key={option.value}>
                  <input
                    checked={selected.includes(option.value)}
                    type="checkbox"
                    onChange={() => onToggle(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))
            ) : (
              <span className="ol-filter-empty">No options yet</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
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

function formatDateTime(value: string) {
  if (!value) {
    return 'Time not saved';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
