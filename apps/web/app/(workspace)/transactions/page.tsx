'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { parseAmount, validatePositiveAmount } from '@/lib/form-validation';
import {
  createWorkspaceTransaction,
  listWorkspaceCustomers,
  listWorkspaceTransactions,
  type WorkspaceCustomer,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { useWorkspace } from '@/providers/workspace-provider';

export default function TransactionsPage() {
  const { activeWorkspace } = useWorkspace();
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'credit' | 'payment'>('payment');
  const [note, setNote] = useState('');
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
      });
      setTransactions((current) => [transaction, ...current]);
      setAmount('');
      setNote('');
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

  return (
    <AppShell title="Transactions" subtitle="Quick payment and credit entry with a clean audit trail.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Fast entry</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Use the wider web layout to log payments and credits without losing context. This is
              where the product should feel faster and more deliberate than a flat form sheet.
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

      <section className="ol-table">
        <div className="ol-table-head" style={{ gridTemplateColumns: '0.7fr 1.4fr 0.7fr' }}>
          <span>Type</span>
          <span>Customer and note</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
        </div>
        {transactions.map((transaction) => (
          <div className="ol-table-row" key={transaction.id} style={{ gridTemplateColumns: '0.7fr 1.4fr 0.7fr' }}>
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
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(transaction.amount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!transactions.length ? (
          <div className="ol-empty">
            No transactions yet. Add the first payment or credit entry.
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
