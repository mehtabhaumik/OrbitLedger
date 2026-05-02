'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getManualPaymentVerificationPlan,
  getPaymentClearanceStatusLabel,
  getPaymentModeConfig,
  PAYMENT_MODE_CONFIGS,
  reconcileProviderPayment,
  summarizePaymentClearance,
  summarizePaymentMode,
  type PaymentClearanceStatus,
  type PaymentProviderSource,
  type PaymentMode,
  type PaymentModeDetails,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import { parseAmount, validatePositiveAmount } from '@/lib/form-validation';
import {
  createWorkspaceTransaction,
  listWorkspaceInvoices,
  listWorkspaceInvoicesForCustomer,
  listWorkspaceCustomers,
  listWorkspaceTransactions,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
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
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function TransactionsPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'payment'>('payment');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentDetails, setPaymentDetails] = useState<PaymentModeDetails>({});
  const [paymentClearanceStatus, setPaymentClearanceStatus] = useState<PaymentClearanceStatus>('cleared');
  const [allocationStrategy, setAllocationStrategy] = useState<'ledger_only' | 'oldest_invoice' | 'selected_invoice'>('ledger_only');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [customerInvoices, setCustomerInvoices] = useState<WorkspaceInvoice[]>([]);
  const [workspaceInvoices, setWorkspaceInvoices] = useState<WorkspaceInvoice[]>([]);
  const [providerSource, setProviderSource] = useState<PaymentProviderSource>('upi');
  const [providerReference, setProviderReference] = useState('');
  const [payerName, setPayerName] = useState('');
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
      listWorkspaceInvoices(activeWorkspace.workspaceId),
    ]).then(([nextCustomers, nextTransactions, nextInvoices]) => {
      setCustomers(nextCustomers);
      setTransactions(nextTransactions);
      setWorkspaceInvoices(nextInvoices);
      setCustomerId((current) => current || nextCustomers[0]?.id || '');
    });
    setSelectedTransactionIds(new Set());
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || !customerId || type !== 'payment') {
      setCustomerInvoices([]);
      setSelectedInvoiceId('');
      return;
    }

    void listWorkspaceInvoicesForCustomer(activeWorkspace.workspaceId, customerId)
      .then((invoices) => {
        const unpaidInvoices = invoices.filter(
          (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
        );
        setCustomerInvoices(unpaidInvoices);
        setSelectedInvoiceId((current) => current || unpaidInvoices[0]?.id || '');
      })
      .catch(() => {
        setCustomerInvoices([]);
        setSelectedInvoiceId('');
      });
  }, [activeWorkspace, customerId, type]);

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
      showToast('Fix highlighted fields before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    try {
      const reconciledPaymentDetails =
        type === 'payment' && providerReference.trim()
          ? {
              ...paymentDetails,
              referenceNumber: paymentDetails.referenceNumber ?? providerReference.trim(),
              provider: paymentDetails.provider ?? paymentProviderLabel(providerSource),
            }
          : paymentDetails;
      const transaction = await createWorkspaceTransaction(activeWorkspace.workspaceId, {
        customerId,
        type,
        amount: parseAmount(amount) ?? 0,
        note,
        effectiveDate,
        paymentMode: type === 'payment' ? paymentMode : null,
        paymentDetails: type === 'payment' ? reconciledPaymentDetails : null,
        paymentClearanceStatus: type === 'payment' ? paymentClearanceStatus : null,
        allocationStrategy: type === 'payment' ? allocationStrategy : 'ledger_only',
        invoiceId: allocationStrategy === 'selected_invoice' ? selectedInvoiceId : null,
      });
      setTransactions((current) => [transaction, ...current]);
      setAmount('');
      setNote('');
      setPaymentMode('cash');
      setPaymentDetails({});
      setPaymentClearanceStatus('cleared');
      setProviderReference('');
      setPayerName('');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setAllocationStrategy('ledger_only');
      setSelectedInvoiceId('');
      setTouched({ customerId: false, amount: false });
      setErrors({ customerId: null, amount: null });
      showToast(
        type === 'payment'
          ? allocationStrategy === 'ledger_only'
            ? 'Payment saved as ledger entry.'
            : paymentVerificationPlan.successMessage
          : 'Credit saved. Balance updated.',
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Transaction could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function handleAmountChange(value: string) {
    setAmount(value);
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
  const openWorkspaceInvoices = useMemo(
    () =>
      workspaceInvoices.filter(
        (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
      ),
    [workspaceInvoices]
  );
  const reconciliationDecision = useMemo(
    () =>
      type === 'payment'
        ? reconcileProviderPayment({
            source: providerSource,
            reference: providerReference,
            amount: parseAmount(amount) ?? 0,
            currency: activeWorkspace?.currency ?? 'INR',
            payerName,
            invoices: openWorkspaceInvoices,
          })
        : null,
    [activeWorkspace?.currency, amount, openWorkspaceInvoices, payerName, providerReference, providerSource, type]
  );
  const transactionSummary = useMemo(
    () => sumTransactionAmounts(filteredTransactions),
    [filteredTransactions]
  );
  const paymentVerificationPlan = useMemo(
    () =>
      getManualPaymentVerificationPlan({
        allocationStrategy,
        clearanceStatus: paymentClearanceStatus,
      }),
    [allocationStrategy, paymentClearanceStatus]
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

  function applyReconciliationMatch() {
    if (!reconciliationDecision?.invoice || reconciliationDecision.allocationStrategy !== 'selected_invoice') {
      showToast('No invoice match is ready to apply.', 'danger');
      return;
    }

    setCustomerId(reconciliationDecision.invoice.customerId ?? '');
    setAllocationStrategy('selected_invoice');
    setSelectedInvoiceId(reconciliationDecision.invoice.id);
    setPaymentMode(reconciliationDecision.paymentMode);
    setPaymentDetails(reconciliationDecision.paymentDetails);
    setNote(reconciliationDecision.note);
    if ((parseAmount(amount) ?? 0) <= 0 && reconciliationDecision.allocationAmount > 0) {
      setAmount(formatAmountInput(reconciliationDecision.allocationAmount));
    }
    showToast('Matched invoice applied to this payment.', 'success');
  }

  function exportTransactions() {
    if (!activeWorkspace) {
      return;
    }

    const exportRows = selectedTransactions.length ? selectedTransactions : filteredTransactions;
    const rows = exportRows.map((transaction) => [
      transaction.effectiveDate,
      transaction.type === 'payment' ? 'Payment' : 'Credit',
      transaction.customerName,
      transaction.type === 'payment'
        ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} - ${summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}`
        : '',
      transaction.note ?? '',
      transaction.amount,
    ]);
    const csv = buildCsv(['Date', 'Type', 'Customer', 'Payment mode', 'Note', 'Amount'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        'transactions',
        selectedTransactionIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    showToast(
      `${exportRows.length} transaction${exportRows.length === 1 ? '' : 's'} exported.`,
      'success'
    );
  }

  return (
    <AppShell title="Transactions" subtitle="Record payments and credit entries with the same ledger behavior everywhere.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Fast entry</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Credit adds to receivable. Payment reduces receivable.
            </p>
          </div>
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--warning">Credit adds due</span>
            <span className="ol-chip ol-chip--success">Payment reduces due</span>
          </div>
        </div>

        <div className="ol-form-stack">
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Entry details</div>
                <p className="ol-form-band-copy">Choose who this entry belongs to and the amount to record.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
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
                <span className="ol-field-label">Entry type</span>
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
            </div>
          </div>

          {type === 'payment' ? (
            <>
              <div className="ol-form-band">
                <div className="ol-form-band-header">
                  <div>
                    <div className="ol-form-band-title">Payment method</div>
                    <p className="ol-form-band-copy">Add how the customer paid and the reference you may need later.</p>
                  </div>
                </div>
                <div className="ol-form-band-grid ol-form-band-grid--compact">
                  <label className="ol-field">
                    <span className="ol-field-label">Payment mode</span>
                    <select
                      className="ol-select"
                      value={paymentMode}
                      onChange={(event) => {
                        setPaymentMode(event.target.value as PaymentMode);
                        setPaymentDetails({});
                      }}
                    >
                      {PAYMENT_MODE_CONFIGS.map((config) => (
                        <option key={config.mode} value={config.mode}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <PaymentModeFields details={paymentDetails} mode={paymentMode} onChange={setPaymentDetails} />
                  <label className="ol-field">
                    <span className="ol-field-label">Match from</span>
                    <select
                      className="ol-select"
                      value={providerSource}
                      onChange={(event) => setProviderSource(event.target.value as PaymentProviderSource)}
                    >
                      <option value="upi">UPI</option>
                      <option value="payment_page">Payment page</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                      <option value="wallet">Wallet</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Payment reference</span>
                    <input
                      className="ol-input"
                      placeholder="Reference from app or bank"
                      value={providerReference}
                      onChange={(event) => setProviderReference(event.target.value)}
                    />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Paid by</span>
                    <input
                      className="ol-input"
                      placeholder="Optional payer name"
                      value={payerName}
                      onChange={(event) => setPayerName(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="ol-form-band">
                <div className="ol-form-band-header">
                  <div>
                    <div className="ol-form-band-title">Apply and verify</div>
                    <p className="ol-form-band-copy">Choose whether this payment reduces the customer balance or pays an invoice.</p>
                  </div>
                </div>
                <div className="ol-form-band-grid ol-form-band-grid--wide">
                  {reconciliationDecision && providerReference.trim() ? (
                    <div className={`ol-message ${reconciliationDecision.invoice ? 'ol-message--success' : ''}`} style={{ margin: 0 }}>
                      <strong>{reconciliationDecision.message}</strong>
                      {reconciliationDecision.invoice ? (
                        <>
                          {' '}
                          {reconciliationDecision.invoice.customerName ?? 'Customer'} ·{' '}
                          {formatCurrency(reconciliationDecision.dueAmount, activeWorkspace?.currency ?? 'INR')} due
                        </>
                      ) : null}
                      {reconciliationDecision.allocationStrategy === 'selected_invoice' ? (
                        <div style={{ marginTop: 10 }}>
                          <button className="ol-button-secondary" type="button" onClick={applyReconciliationMatch}>
                            Use this match
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="ol-field">
                    <span className="ol-field-label">Apply payment</span>
                    <select
                      className="ol-select"
                      value={allocationStrategy}
                      onChange={(event) =>
                        setAllocationStrategy(event.target.value as typeof allocationStrategy)
                      }
                    >
                      <option value="ledger_only">Customer ledger only</option>
                      <option value="oldest_invoice">Oldest unpaid invoices</option>
                      <option value="selected_invoice">Selected invoice</option>
                    </select>
                  </label>
                  {allocationStrategy === 'selected_invoice' ? (
                    <label className="ol-field">
                      <span className="ol-field-label">Invoice</span>
                      <select
                        className="ol-select"
                        value={selectedInvoiceId}
                        onChange={(event) => setSelectedInvoiceId(event.target.value)}
                      >
                        <option value="">Choose invoice</option>
                        {customerInvoices.map((invoice) => (
                          <option key={invoice.id} value={invoice.id}>
                            {invoice.invoiceNumber} · {formatCurrency(Math.max(invoice.totalAmount - invoice.paidAmount, 0), activeWorkspace?.currency ?? 'INR')} due
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="ol-field">
                    <span className="ol-field-label">Verification</span>
                    <select
                      className="ol-select"
                      value={paymentClearanceStatus}
                      onChange={(event) => setPaymentClearanceStatus(event.target.value as PaymentClearanceStatus)}
                    >
                      {(['received', 'post_dated', 'deposited', 'cleared', 'bounced', 'cancelled'] as PaymentClearanceStatus[]).map((status) => (
                        <option key={status} value={status}>
                          {getPaymentClearanceStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="ol-message" style={{ margin: 0 }}>
                    <strong>{paymentVerificationPlan.statusLabel}</strong> · {paymentVerificationPlan.invoiceEffect}{' '}
                    {paymentVerificationPlan.customerBalanceEffect}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="ol-form-band">
            <div className="ol-form-band-grid ol-form-band-grid--wide">
              <label className="ol-field">
                <span className="ol-field-label">Note</span>
                <input className="ol-input" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <div className="ol-form-band-actions">
                <button className="ol-button" disabled={isSaving} type="button" onClick={() => void addTransaction()}>
                  {isSaving ? 'Saving...' : type === 'payment' ? paymentVerificationPlan.actionLabel : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
          helper="Credit given in this view."
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
            <button className="ol-button" type="button" disabled={!filteredTransactions.length} onClick={exportTransactions}>
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
                {transaction.type === 'payment'
                  ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} · ${summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}${transaction.note ? ` · ${transaction.note}` : ''}`
                  : transaction.note || 'No note'}
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

function PaymentModeFields({
  details,
  mode,
  onChange,
}: {
  details: PaymentModeDetails;
  mode: PaymentMode;
  onChange: (details: PaymentModeDetails) => void;
}) {
  const config = getPaymentModeConfig(mode);
  const update = (field: keyof PaymentModeDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  if (mode === 'cash') {
    return null;
  }

  return (
    <>
      {['cheque', 'demand_draft', 'bank_transfer', 'upi', 'wallet'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Reference</span>
          <input className="ol-input" value={details.referenceNumber ?? ''} onChange={(event) => update('referenceNumber', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft', 'bank_transfer'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Bank</span>
          <input className="ol-input" value={details.bankName ?? ''} onChange={(event) => update('bankName', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft'].includes(mode) ? (
        <>
          <label className="ol-field">
            <span className="ol-field-label">Branch</span>
            <input className="ol-input" value={details.branchName ?? ''} onChange={(event) => update('branchName', event.target.value)} />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Instrument date</span>
            <input className="ol-input" type="date" value={details.instrumentDate ?? ''} onChange={(event) => update('instrumentDate', event.target.value)} />
          </label>
        </>
      ) : null}
      {mode === 'upi' ? (
        <label className="ol-field">
          <span className="ol-field-label">UPI ID</span>
          <input className="ol-input" value={details.upiId ?? ''} onChange={(event) => update('upiId', event.target.value)} />
        </label>
      ) : null}
      {mode === 'card' ? (
        <label className="ol-field">
          <span className="ol-field-label">Card last 4</span>
          <input className="ol-input" inputMode="numeric" maxLength={4} value={details.cardLastFour ?? ''} onChange={(event) => update('cardLastFour', event.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
      ) : null}
      {mode === 'wallet' ? (
        <label className="ol-field">
          <span className="ol-field-label">Provider</span>
          <input className="ol-input" value={details.provider ?? ''} onChange={(event) => update('provider', event.target.value)} />
        </label>
      ) : null}
      {mode === 'other' ? (
        <label className="ol-field">
          <span className="ol-field-label">Payment detail</span>
          <input className="ol-input" value={details.note ?? ''} onChange={(event) => update('note', event.target.value)} />
        </label>
      ) : null}
      <div className="ol-field">
        <span className="ol-field-label">Mode note</span>
        <div className="ol-message ol-message--success" style={{ margin: 0 }}>{config.helper}</div>
      </div>
    </>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmountInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function paymentProviderLabel(source: PaymentProviderSource) {
  switch (source) {
    case 'upi':
      return 'UPI';
    case 'payment_page':
      return 'Payment page';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    case 'wallet':
      return 'Wallet';
    case 'other':
    default:
      return 'Other';
  }
}
