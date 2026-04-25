'use client';

import type { CSSProperties } from 'react';
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
      <section style={styles.panel}>
        <div style={styles.header}>Fast entry</div>
        <div style={styles.formRow}>
          <select style={styles.input} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select style={styles.input} value={type} onChange={(event) => setType(event.target.value as 'credit' | 'payment')}>
            <option value="payment">Payment</option>
            <option value="credit">Credit</option>
          </select>
          <input style={styles.input} inputMode="decimal" placeholder="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <input style={styles.input} placeholder="Note" value={note} onChange={(event) => setNote(event.target.value)} />
          <button style={styles.button} type="button" onClick={() => void addTransaction()}>
            Save
          </button>
        </div>
      </section>
      <section style={styles.list}>
        {transactions.map((transaction) => (
          <div key={transaction.id} style={styles.row}>
            <span style={{ color: transaction.type === 'payment' ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>
              {transaction.type === 'payment' ? 'Payment' : 'Credit'}
            </span>
            <span>
              {transaction.customerName}
              <br />
              <span style={styles.noteText}>{transaction.note || 'No note'}</span>
            </span>
            <span style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(transaction.amount, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!transactions.length ? <div style={styles.empty}>No transactions yet. Add the first payment or credit entry.</div> : null}
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
    display: 'grid',
    gap: 12,
  },
  header: {
    fontSize: 18,
    fontWeight: 900,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.8fr 0.8fr 1.4fr auto',
    gap: 12,
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    border: '1px solid var(--border)',
    padding: '0 14px',
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
    gridTemplateColumns: '0.7fr 1.4fr 0.7fr',
    gap: 16,
    alignItems: 'center',
    padding: '16px 18px',
    borderBottom: '1px solid var(--border)',
  },
  empty: {
    padding: 24,
    color: 'var(--text-muted)',
  },
  noteText: {
    color: 'var(--text-muted)',
    fontSize: 13,
  },
};
