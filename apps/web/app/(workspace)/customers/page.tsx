'use client';

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
      <section className="ol-split-grid">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Add customer
          </div>
          <div className="ol-form-grid">
            <div className="ol-form-row ol-form-row--3">
              <label className="ol-field">
                <span className="ol-field-label">Customer name</span>
                <input className="ol-input" value={newName} onChange={(event) => setNewName(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Phone</span>
                <input className="ol-input" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Opening balance</span>
                <input
                  className="ol-input ol-amount"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                />
              </label>
            </div>
            <div className="ol-actions">
              <button className="ol-button" type="button" onClick={() => void addCustomer()}>
                Save customer
              </button>
            </div>
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Why this page matters
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">₹</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Outstanding balances stay visible</div>
                <div className="ol-list-text">
                  Customers are where receivables become actionable instead of staying buried in raw
                  records.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">A</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Audit-friendly inputs</div>
                <div className="ol-list-text">
                  Opening balance, phone, and identity data feed the same workspace used for
                  invoices and transaction history.
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="ol-table">
        <div className="ol-table-head" style={{ gridTemplateColumns: '1.2fr 1fr 0.7fr' }}>
          <span>Name</span>
          <span>Phone</span>
          <span style={{ textAlign: 'right' }}>Balance</span>
        </div>
        {customers.map((customer) => (
          <div
            className="ol-table-row"
            key={customer.id}
            style={{ gridTemplateColumns: '1.2fr 1fr 0.7fr' }}
          >
            <span style={{ fontWeight: 800 }}>{customer.name}</span>
            <span>{customer.phone || '—'}</span>
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(customer.balance, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!customers.length ? (
          <div className="ol-empty">
            No customers yet. Add the first customer to start tracking dues.
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
