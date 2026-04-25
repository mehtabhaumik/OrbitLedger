'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
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
    if (!activeWorkspace || !amount.trim() || !customerId) {
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    const transaction = await createWorkspaceTransaction(activeWorkspace.workspaceId, {
      customerId,
      type,
      amount: numericAmount,
      note,
    });
    setTransactions((current) => [transaction, ...current]);
    setAmount('');
    setNote('');
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

        <div className="ol-form-row" style={{ gridTemplateColumns: '1.1fr 0.8fr 0.8fr 1.4fr auto' }}>
          <select className="ol-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select className="ol-select" value={type} onChange={(event) => setType(event.target.value as 'credit' | 'payment')}>
            <option value="payment">Payment</option>
            <option value="credit">Credit</option>
          </select>
          <input className="ol-input ol-amount" inputMode="decimal" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <input className="ol-input" placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <button className="ol-button" type="button" onClick={() => void addTransaction()}>
            Save
          </button>
        </div>
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
