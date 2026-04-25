'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  createWorkspaceCustomer,
  listWorkspaceCustomers,
  type WorkspaceCustomer,
} from '@/lib/workspace-data';
import { useWorkspace } from '@/providers/workspace-provider';

export default function CustomersPage() {
  const { activeWorkspace } = useWorkspace();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void listWorkspaceCustomers(activeWorkspace.workspaceId).then(setCustomers);
  }, [activeWorkspace]);

  async function addCustomer() {
    if (!activeWorkspace || !newName.trim()) {
      return;
    }

    const customer = await createWorkspaceCustomer(activeWorkspace.workspaceId, {
      name: newName,
      phone: newPhone,
      openingBalance: openingBalance ? Number(openingBalance) : 0,
    });
    setCustomers((current) => [customer, ...current]);
    setNewName('');
    setNewPhone('');
    setOpeningBalance('');
  }

  return (
    <AppShell title="Customers" subtitle="Searchable customer records and outstanding balance review.">
      <section style={styles.panel}>
        <div style={styles.panelTitle}>Add customer</div>
        <div style={styles.formRow}>
          <input placeholder="Customer name" style={styles.input} value={newName} onChange={(event) => setNewName(event.target.value)} />
          <input placeholder="Phone" style={styles.input} value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
          <input
            inputMode="decimal"
            placeholder="Opening balance"
            style={styles.input}
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
          />
          <button style={styles.button} type="button" onClick={() => void addCustomer()}>
            Save
          </button>
        </div>
      </section>
      <section style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Name</span>
          <span>Phone</span>
          <span style={{ textAlign: 'right' }}>Balance</span>
        </div>
        {customers.map((customer) => (
          <div key={customer.id} style={styles.row}>
            <span>{customer.name}</span>
            <span>{customer.phone || '—'}</span>
            <span style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(customer.balance, activeWorkspace?.currency ?? 'INR')}</span>
          </div>
        ))}
        {!customers.length ? <div style={styles.empty}>No customers yet. Add the first customer to start tracking dues.</div> : null}
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
  panelTitle: {
    fontSize: 18,
    fontWeight: 900,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.9fr) minmax(0, 0.8fr) auto',
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
  table: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 0.7fr',
    padding: '14px 18px',
    color: 'var(--text-muted)',
    fontWeight: 800,
    fontSize: 12,
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    background: '#f9fbfe',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 0.7fr',
    padding: '16px 18px',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
  },
  empty: {
    padding: 24,
    color: 'var(--text-muted)',
  },
};
