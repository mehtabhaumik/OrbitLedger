'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { parseAmount, validatePositiveAmount } from '@/lib/form-validation';
import {
  createWorkspaceTransaction,
  listWorkspaceCustomers,
  listWorkspaceTransactions,
  type WorkspaceCustomer,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import {
  buildCsv,
  downloadTextFile,
  filterWorkspaceTransactions,
  makeExportFileName,
  pickSelectedRows,
  sumTransactionAmounts,
  type TransactionTypeFilter,
} from '@/lib/workspace-power';
import { useWorkspace } from '@/providers/workspace-provider';

export default function TransactionsPage() {
  const { activeWorkspace } = useWorkspace();
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'payment'>('payment');
  const [note, setNote] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<{
    customerId: string | null;
    amount: string | null;
  }>({
    customerId: null,
    amount: null,
  });
  const [touched, setTouched] = useState({
    customerId: false,
    amount: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void Promise.all([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceTransactions(activeWorkspace.workspaceId),
    ]).then(([nextCustomers, nextTransactions]) => {
      setCustomers(nextCustomers);
      setTransactions(nextTransactions);
      setCustomerId((current) => current || nextCustomers[0]?.id || '');
    });
    setSelectedTransactionIds(new Set());
  }, [activeWorkspace]);

  async function addTransaction() {
    if (!activeWorkspace) {
      return;
    }

    const nextErrors = {
      customerId: customerId ? null : 'Choose a customer.',
      amount: validatePositiveAmount(amount, 'Amount'),
    };
    setTouched({ customerId: true, amount: true });
    setErrors(nextErrors);

    if (nextErrors.customerId || nextErrors.amount) {
      setMessageTone('danger');
      setMessage('Fix highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const transaction = await createWorkspaceTransaction(activeWorkspace.workspaceId, {
        customerId,
        type,
        amount: parseAmount(amount) ?? 0,
        note,
        effectiveDate,
      });
      setTransactions((current) => [transaction, ...current]);
      setAmount('');
      setNote('');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setTouched({ customerId: false, amount: false });
      setErrors({ customerId: null, amount: null });
      setMessageTone('success');
      setMessage('Transaction saved.');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Transaction could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    setMessage(null);
    if (!touched.amount) {
      return;
    }
    setErrors((current) => ({ ...current, amount: validatePositiveAmount(value, 'Amount') }));
  }

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
  const transactionSummary = useMemo(
    () => sumTransactionAmounts(filteredTransactions),
    [filteredTransactions]
  );
  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) => selectedTransactionIds.has(transaction.id));

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

  function exportTransactions() {
    if (!activeWorkspace) {
      return;
    }

    const rows = selectedTransactions.map((transaction) => [
      transaction.effectiveDate,
      transaction.type === 'payment' ? 'Payment' : 'Credit',
      transaction.customerName,
      transaction.note ?? '',
      transaction.amount,
    ]);
    const csv = buildCsv(['Date', 'Type', 'Customer', 'Note', 'Amount'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        'transactions',
        selectedTransactionIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    setMessageTone('success');
    setMessage(
      `${selectedTransactions.length} transaction${selectedTransactions.length === 1 ? '' : 's'} exported.`
    );
  }

  return (
    <AppShell title="Transactions" subtitle="Quick payment and credit entry with a clean audit trail.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Fast entry</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Use the wider web layout to log payments and credits without losing context. This is
              Review, filter, and export the entries that need attention.
            </p>
          </div>
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--success">Payments</span>
            <span className="ol-chip ol-chip--warning">Credits</span>
          </div>
        </div>

        <div className="ol-form-row ol-form-row--transaction-entry">
          <label className={`ol-field${errors.customerId ? ' is-invalid' : ''}`}>
            <span className="ol-field-label">Customer</span>
            <select
              className="ol-select"
              value={customerId}
              onBlur={() => {
                setTouched((current) => ({ ...current, customerId: true }));
                setErrors((current) => ({
                  ...current,
                  customerId: customerId ? null : 'Choose a customer.',
                }));
              }}
              onChange={(event) => {
                const next = event.target.value;
                setCustomerId(next);
                setMessage(null);
                if (touched.customerId) {
                  setErrors((current) => ({ ...current, customerId: next ? null : 'Choose a customer.' }));
                }
              }}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            {errors.customerId ? <span className="ol-field-error">{errors.customerId}</span> : null}
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Type</span>
            <select className="ol-select" value={type} onChange={(event) => setType(event.target.value as 'credit' | 'payment')}>
              <option value="payment">Payment</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label className={`ol-field${errors.amount ? ' is-invalid' : ''}`}>
            <span className="ol-field-label">Amount</span>
            <input
              className="ol-input ol-amount"
              inputMode="decimal"
              value={amount}
              onBlur={() => {
                setTouched((current) => ({ ...current, amount: true }));
                setErrors((current) => ({
                  ...current,
                  amount: validatePositiveAmount(amount, 'Amount'),
                }));
              }}
              onChange={(event) => handleAmountChange(event.target.value)}
            />
            {errors.amount ? <span className="ol-field-error">{errors.amount}</span> : null}
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Date</span>
            <input
              className="ol-input"
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Note</span>
            <input className="ol-input" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="ol-field ol-field--action">
            <span className="ol-field-label">Action</span>
            <button className="ol-button" disabled={isSaving} type="button" onClick={() => void addTransaction()}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {message ? (
          <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
            {message}
          </div>
        ) : null}
      </section>

      <section className="ol-metric-grid">
        <Metric label="Showing" value={String(filteredTransactions.length)} helper="Entries in this view." tone="primary" />
        <Metric
          label="Payments"
          value={formatCurrency(transactionSummary.payments, activeWorkspace?.currency ?? 'INR')}
          helper="Money received in this view."
          tone="success"
        />
        <Metric
          label="Credits"
          value={formatCurrency(transactionSummary.credits, activeWorkspace?.currency ?? 'INR')}
          helper="New credit in this view."
          tone="warning"
        />
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">Search transactions</span>
            <input
              className="ol-input"
              placeholder="Customer or note"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Type</span>
            <select
              className="ol-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
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
            <button className="ol-button" type="button" disabled={!selectedTransactions.length} onClick={exportTransactions}>
              Export {selectedTransactionIds.size ? 'selected' : 'view'}
            </button>
          </div>
        </div>
        <div className="ol-table-summary">
          {selectedTransactionIds.size
            ? `${selectedTransactions.length} selected from this view.`
            : 'Select rows for a focused export, or export the current view.'}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '44px 0.65fr 1.35fr 0.65fr 0.7fr' }}>
          <span>
            <input
              aria-label="Select all visible transactions"
              checked={allVisibleSelected}
              className="ol-checkbox"
              type="checkbox"
              onChange={toggleAllVisibleTransactions}
            />
          </span>
          <span>Type</span>
          <span>Customer and note</span>
          <span>Date</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
        </div>
        {filteredTransactions.map((transaction) => (
          <div className="ol-table-row" key={transaction.id} style={{ gridTemplateColumns: '44px 0.65fr 1.35fr 0.65fr 0.7fr' }}>
            <span>
              <input
                aria-label={`Select ${transaction.customerName} transaction`}
                checked={selectedTransactionIds.has(transaction.id)}
                className="ol-checkbox"
                type="checkbox"
                onChange={() => toggleTransactionSelection(transaction.id)}
              />
            </span>
            <span className="ol-status-text" data-tone={transaction.type === 'payment' ? 'success' : 'warning'} style={{ fontWeight: 800 }}>
              {transaction.type === 'payment' ? 'Payment' : 'Credit'}
            </span>
            <span>
              <strong>{transaction.customerName}</strong>
              <br />
              <span className="ol-muted" style={{ fontSize: 13 }}>
                {transaction.note || 'No note'}
              </span>
            </span>
            <span>{transaction.effectiveDate || '—'}</span>
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(transaction.amount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!filteredTransactions.length ? (
          <div className="ol-empty">
            No transactions match this view.
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
