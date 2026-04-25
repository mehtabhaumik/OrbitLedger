'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
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
  const [errors, setErrors] = useState<{
    name: string | null;
    phone: string | null;
    openingBalance: string | null;
  }>({
    name: null,
    phone: null,
    openingBalance: null,
  });
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    openingBalance: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void listWorkspaceCustomers(activeWorkspace.workspaceId).then(setCustomers);
  }, [activeWorkspace]);

  async function addCustomer() {
    if (!activeWorkspace) {
      return;
    }

    const countryCode = activeWorkspace.countryCode || 'IN';
    const nextErrors = {
      name: validateName(newName, 'Customer name', true),
      phone: validatePhone(newPhone, countryCode, false),
      openingBalance:
        openingBalance.trim() && parseAmount(openingBalance) === null
          ? 'Opening balance must be a valid number.'
          : null,
    };
    setTouched({ name: true, phone: true, openingBalance: true });
    setErrors(nextErrors);

    if (nextErrors.name || nextErrors.phone || nextErrors.openingBalance) {
      setMessageTone('danger');
      setMessage('Fix highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const customer = await createWorkspaceCustomer(activeWorkspace.workspaceId, {
        name: newName.trim(),
        phone: newPhone.trim(),
        openingBalance: parseAmount(openingBalance) ?? 0,
      });
      setCustomers((current) => [customer, ...current]);
      setNewName('');
      setNewPhone('');
      setOpeningBalance('');
      setTouched({ name: false, phone: false, openingBalance: false });
      setErrors({ name: null, phone: null, openingBalance: null });
      setMessageTone('success');
      setMessage('Customer saved.');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Customer could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleNameChange(value: string) {
    setNewName(value);
    setMessage(null);
    if (!touched.name) {
      return;
    }
    setErrors((current) => ({ ...current, name: validateName(value, 'Customer name', true) }));
  }

  function handlePhoneChange(value: string) {
    setNewPhone(value);
    setMessage(null);
    if (!touched.phone) {
      return;
    }
    const countryCode = activeWorkspace?.countryCode || 'IN';
    setErrors((current) => ({ ...current, phone: validatePhone(value, countryCode, false) }));
  }

  function handlePhoneBlur() {
    const countryCode = activeWorkspace?.countryCode || 'IN';
    const normalized = normalizePhoneForCountry(countryCode, newPhone);
    const nextValue = normalized ?? newPhone;
    if (normalized) {
      setNewPhone(normalized);
    }
    setTouched((current) => ({ ...current, phone: true }));
    setErrors((current) => ({ ...current, phone: validatePhone(nextValue, countryCode, false) }));
  }

  function handleOpeningBalanceChange(value: string) {
    setOpeningBalance(value);
    setMessage(null);
    if (!touched.openingBalance) {
      return;
    }
    setErrors((current) => ({
      ...current,
      openingBalance:
        value.trim() && parseAmount(value) === null ? 'Opening balance must be a valid number.' : null,
    }));
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
              <label className={`ol-field${errors.name ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Customer name</span>
                <input
                  autoComplete="name"
                  className="ol-input"
                  value={newName}
                  onBlur={() => {
                    setTouched((current) => ({ ...current, name: true }));
                    setErrors((current) => ({
                      ...current,
                      name: validateName(newName, 'Customer name', true),
                    }));
                  }}
                  onChange={(event) => handleNameChange(event.target.value)}
                />
                {errors.name ? <span className="ol-field-error">{errors.name}</span> : null}
              </label>
              <label className={`ol-field${errors.phone ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Phone</span>
                <input
                  className="ol-input"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={newPhone}
                  onBlur={handlePhoneBlur}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                />
                {errors.phone ? <span className="ol-field-error">{errors.phone}</span> : null}
              </label>
              <label className={`ol-field${errors.openingBalance ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Opening balance</span>
                <input
                  className="ol-input ol-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={openingBalance}
                  onBlur={() => {
                    setTouched((current) => ({ ...current, openingBalance: true }));
                    setErrors((current) => ({
                      ...current,
                      openingBalance:
                        openingBalance.trim() && parseAmount(openingBalance) === null
                          ? 'Opening balance must be a valid number.'
                          : null,
                    }));
                  }}
                  onChange={(event) => handleOpeningBalanceChange(event.target.value)}
                />
                {errors.openingBalance ? (
                  <span className="ol-field-error">{errors.openingBalance}</span>
                ) : null}
              </label>
            </div>
            {message ? (
              <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
                {message}
              </div>
            ) : null}
            <div className="ol-actions">
              <button className="ol-button" disabled={isSaving} type="button" onClick={() => void addCustomer()}>
                {isSaving ? 'Saving...' : 'Save customer'}
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
