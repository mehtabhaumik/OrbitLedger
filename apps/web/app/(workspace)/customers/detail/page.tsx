'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { summarizePaymentMode } from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import { downloadCustomerProfilePdf } from '@/lib/customer-export';
import {
  getWorkspaceCustomer,
  listWorkspaceCustomerTransactions,
  type WorkspaceCustomer,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import {
  buildCsv,
  downloadTextFile,
  filterWorkspaceTransactions,
  makeExportFileName,
  pickSelectedRows,
  type TransactionTypeFilter,
} from '@/lib/workspace-power';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<CustomerDetailShell message="Loading customer..." />}>
      <CustomerDetailContent />
    </Suspense>
  );
}

function CustomerDetailContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') ?? '';
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<WorkspaceCustomer | null>(null);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeWorkspace || !customerId) {
      setStatus(customerId ? null : 'Choose a customer from the customer list.');
      return;
    }
    setStatus(null);
    void Promise.all([
      getWorkspaceCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspaceCustomerTransactions(activeWorkspace.workspaceId, customerId),
    ])
      .then(([nextCustomer, nextTransactions]) => {
        setCustomer(nextCustomer);
        setTransactions(nextTransactions);
        setSelectedTransactionIds(new Set());
        if (!nextCustomer) {
          setStatus('Customer could not be found.');
        }
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Customer could not be loaded.'));
  }, [activeWorkspace, customerId]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (summary, transaction) => {
        if (transaction.type === 'credit') {
          summary.credits += transaction.amount;
        } else {
          summary.payments += transaction.amount;
        }
        return summary;
      },
      { credits: 0, payments: 0 }
    );
  }, [transactions]);
  const filteredTransactions = useMemo(
    () =>
      filterWorkspaceTransactions(transactions, {
        query: search,
        typeFilter,
        range: { from: dateFrom, to: dateTo },
      }),
    [dateFrom, dateTo, search, transactions, typeFilter]
  );
  const selectedTransactions = useMemo(
    () => pickSelectedRows(filteredTransactions, selectedTransactionIds),
    [filteredTransactions, selectedTransactionIds]
  );
  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const currency = activeWorkspace?.currency ?? 'INR';

  function toggleTransactionSelection(transactionId: string) {
    setSelectedTransactionIds((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  }

  function toggleAllVisibleTransactions() {
    setSelectedTransactionIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredTransactions.forEach((transaction) => next.delete(transaction.id));
      } else {
        filteredTransactions.forEach((transaction) => next.add(transaction.id));
      }
      return next;
    });
  }

  function exportCustomerTransactions() {
    if (!activeWorkspace || !customer) {
      return;
    }

    const exportRows = selectedTransactions.length ? selectedTransactions : filteredTransactions;
    const rows = exportRows.map((transaction) => [
      transaction.effectiveDate,
      transaction.type === 'payment' ? 'Payment' : 'Credit',
      transaction.type === 'payment' ? summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails) : '',
      transaction.note ?? '',
      transaction.amount,
    ]);
    const csv = buildCsv(['Date', 'Type', 'Payment mode', 'Note', 'Amount'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        customer.name,
        'transactions',
        selectedTransactionIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    showToast(`${exportRows.length} entr${exportRows.length === 1 ? 'y' : 'ies'} exported.`, 'success');
  }

  function exportCustomerProfileCsv() {
    if (!activeWorkspace || !customer) {
      return;
    }

    const csv = buildCsv(
      [
        'Name',
        'Phone',
        'Address',
        'Status',
        'Health rank',
        'Health score',
        'Balance',
        'Opening balance',
        'Important information',
        'Notes',
        'Last updated',
      ],
      [[
        customer.name,
        customer.phone ?? '',
        customer.address ?? '',
        customer.isArchived ? 'Archived' : 'Active',
        customer.health.label,
        customer.health.score,
        customer.balance,
        customer.openingBalance,
        customer.health.helper,
        customer.notes ?? '',
        customer.updatedAt,
      ]]
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, customer.name, 'customer-profile']), csv);
    showToast('Customer CSV downloaded.', 'success');
  }

  async function exportCustomerPdf() {
    if (!activeWorkspace || !customer) {
      return;
    }

    try {
      await downloadCustomerProfilePdf({ workspace: activeWorkspace, customers: [customer] });
      showToast('Customer PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer PDF could not be downloaded.', 'danger');
    }
  }

  return (
    <AppShell title="Customer Detail" subtitle="Activity, balance, and follow-up context.">
      <div className="ol-actions ol-actions--sticky">
        <Link className="ol-button-secondary" href="/customers">
          Back to customers
        </Link>
        <Link className="ol-button" href="/transactions">
          Record transaction
        </Link>
        <Link className="ol-button-secondary" href={'/documents' as Route}>
          Create statement
        </Link>
        <button className="ol-button-secondary" type="button" disabled={!customer} onClick={() => void exportCustomerPdf()}>
          Export customer PDF
        </button>
        <button className="ol-button-secondary" type="button" disabled={!customer} onClick={exportCustomerProfileCsv}>
          Export customer CSV
        </button>
      </div>

      {status ? <div className="ol-message ol-message--danger">{status}</div> : null}

      {customer ? (
        <>
          <section className="ol-metric-grid">
            <Metric label="Balance" value={formatCurrency(customer.balance, currency)} tone="warning" />
            <Metric label="Credits" value={formatCurrency(totals.credits, currency)} tone="primary" />
            <Metric label="Payments" value={formatCurrency(totals.payments, currency)} tone="success" />
            <Metric label="Health" value={`${customer.health.label} ${customer.health.score}/100`} tone={customer.health.tone === 'danger' ? 'warning' : customer.health.tone} />
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">{customer.name}</div>
                <p className="ol-panel-copy">{customer.phone || 'No phone saved'}</p>
              </div>
              <span className="ol-chip ol-chip--primary">{customer.isArchived ? 'Archived' : 'Active'}</span>
            </div>
            <p className="ol-panel-copy">{customer.address || 'No address saved yet.'}</p>
          </section>

          <section className="ol-table">
            <div className="ol-table-tools">
              <label className="ol-field">
                <span className="ol-field-label">Search entries</span>
                <input
                  className="ol-input"
                  placeholder="Note or customer"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Type</span>
                <select
                  className="ol-select"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TransactionTypeFilter)}
                >
                  <option value="all">All entries</option>
                  <option value="payment">Payments</option>
                  <option value="credit">Credits</option>
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
                  setTypeFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setSelectedTransactionIds(new Set());
                }}>
                  Clear view
                </button>
                <button className="ol-button" type="button" disabled={!filteredTransactions.length} onClick={exportCustomerTransactions}>
                  Export {selectedTransactionIds.size ? 'selected' : 'view'}
                </button>
              </div>
            </div>
            <div className="ol-table-summary">
              {selectedTransactionIds.size
                ? `${selectedTransactions.length} selected from this customer view.`
                : 'Select entries for a focused customer export, or export the current view.'}
            </div>
            <div className="ol-table-head" style={{ gridTemplateColumns: '44px 0.7fr 1.2fr 0.7fr 0.8fr' }}>
              <span>
                <input
                  aria-label="Select all visible customer entries"
                  checked={allVisibleSelected}
                  className="ol-checkbox"
                  type="checkbox"
                  onChange={toggleAllVisibleTransactions}
                />
              </span>
              <span>Type</span>
              <span>Note</span>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
            </div>
            {filteredTransactions.map((transaction) => (
              <div
                className="ol-table-row"
                key={transaction.id}
                style={{ gridTemplateColumns: '44px 0.7fr 1.2fr 0.7fr 0.8fr' }}
              >
                <span>
                  <input
                    aria-label={`Select ${transaction.effectiveDate || 'entry'}`}
                    checked={selectedTransactionIds.has(transaction.id)}
                    className="ol-checkbox"
                    type="checkbox"
                    onChange={() => toggleTransactionSelection(transaction.id)}
                  />
                </span>
                <span
                  className="ol-status-text"
                  data-tone={transaction.type === 'payment' ? 'success' : 'warning'}
                  style={{ fontWeight: 800 }}
                >
                  {transaction.type === 'payment' ? 'Payment' : 'Credit'}
                </span>
                <span>
                  {transaction.type === 'payment'
                    ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)}${transaction.note ? ` · ${transaction.note}` : ''}`
                    : transaction.note || transaction.effectiveDate}
                </span>
                <span>{transaction.effectiveDate || '—'}</span>
                <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
                  {formatCurrency(transaction.amount, currency)}
                </span>
              </div>
            ))}
            {!filteredTransactions.length ? <div className="ol-empty">No ledger entries match this view.</div> : null}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function CustomerDetailShell({ message }: { message: string }) {
  return (
    <AppShell title="Customer Detail" subtitle="Activity, balance, and follow-up context.">
      <div className="ol-message ol-message--success">{message}</div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'warning' | 'success';
}) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">Current customer ledger.</div>
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
