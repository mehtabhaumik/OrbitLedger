'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { downloadCustomerProfilePdf } from '@/lib/customer-export';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import {
  createWorkspaceCustomer,
  listWorkspaceCustomers,
  type WorkspaceCustomer,
} from '@/lib/workspace-data';
import {
  buildCsv,
  downloadTextFile,
  filterWorkspaceCustomers,
  makeExportFileName,
  parseCustomerImportCsv,
  pickSelectedRows,
  sumCustomerBalances,
  type CustomerBalanceFilter,
} from '@/lib/workspace-power';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function CustomersPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [newName, setNewName] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<'individual' | 'business'>('business');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBillingAddress, setNewBillingAddress] = useState('');
  const [newShippingAddress, setNewShippingAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newStateCode, setNewStateCode] = useState(activeWorkspace?.stateCode ?? 'GJ');
  const [newPostalCode, setNewPostalCode] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newPan, setNewPan] = useState('');
  const [newPaymentTerms, setNewPaymentTerms] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [errors, setErrors] = useState<{
    name: string | null;
    phone: string | null;
    email: string | null;
    creditLimit: string | null;
    openingBalance: string | null;
  }>({
    name: null,
    phone: null,
    email: null,
    creditLimit: null,
    openingBalance: null,
  });
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    creditLimit: false,
    openingBalance: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<CustomerBalanceFilter>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void listWorkspaceCustomers(activeWorkspace.workspaceId).then(setCustomers);
    setNewStateCode(activeWorkspace.stateCode || 'GJ');
    setSelectedCustomerIds(new Set());
  }, [activeWorkspace]);

  async function addCustomer() {
    if (!activeWorkspace) {
      return;
    }

    const countryCode = activeWorkspace.countryCode || 'IN';
    const nextErrors = {
      name: validateName(newName, 'Customer name', true),
      phone: validatePhone(newPhone, countryCode, false),
      email: validateEmail(newEmail, false),
      creditLimit:
        newCreditLimit.trim() && parseAmount(newCreditLimit) === null
          ? 'Credit limit must be a valid number.'
          : null,
      openingBalance:
        openingBalance.trim() && parseAmount(openingBalance) === null
          ? 'Opening balance must be a valid number.'
          : null,
    };
    setTouched({ name: true, phone: true, email: true, creditLimit: true, openingBalance: true });
    setErrors(nextErrors);

    if (nextErrors.name || nextErrors.phone || nextErrors.openingBalance) {
      showToast('Fix highlighted fields before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    try {
      const normalizedPhone = normalizePhoneForCountry(countryCode, newPhone) ?? newPhone.trim();
      const normalizedWhatsapp = normalizePhoneForCountry(countryCode, newWhatsapp) ?? newWhatsapp.trim();
      const customer = await createWorkspaceCustomer(activeWorkspace.workspaceId, {
        name: newName.trim(),
        legalName: newLegalName,
        customerType: newCustomerType,
        contactPerson: newContactPerson,
        phone: normalizedPhone,
        whatsapp: normalizedWhatsapp,
        email: newEmail,
        billingAddress: newBillingAddress,
        address: newBillingAddress,
        shippingAddress: newShippingAddress,
        city: newCity,
        stateCode: newStateCode,
        countryCode,
        postalCode: newPostalCode,
        gstin: newGstin,
        pan: newPan,
        paymentTerms: newPaymentTerms,
        creditLimit: parseAmount(newCreditLimit),
        tags: splitTags(newTags),
        notes: newNotes,
        openingBalance: parseAmount(openingBalance) ?? 0,
      });
      setCustomers((current) => [customer, ...current]);
      setNewName('');
      setNewLegalName('');
      setNewCustomerType('business');
      setNewContactPerson('');
      setNewPhone('');
      setNewWhatsapp('');
      setNewEmail('');
      setNewBillingAddress('');
      setNewShippingAddress('');
      setNewCity('');
      setNewStateCode(activeWorkspace.stateCode || 'GJ');
      setNewPostalCode('');
      setNewGstin('');
      setNewPan('');
      setNewPaymentTerms('');
      setNewCreditLimit('');
      setNewTags('');
      setNewNotes('');
      setOpeningBalance('');
      setTouched({ name: false, phone: false, email: false, creditLimit: false, openingBalance: false });
      setErrors({ name: null, phone: null, email: null, creditLimit: null, openingBalance: null });
      showToast('Customer saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function handleNameChange(value: string) {
    setNewName(value);
    if (!touched.name) {
      return;
    }
    setErrors((current) => ({ ...current, name: validateName(value, 'Customer name', true) }));
  }

  function handlePhoneChange(value: string) {
    setNewPhone(value);
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
    if (!touched.openingBalance) {
      return;
    }
    setErrors((current) => ({
      ...current,
      openingBalance:
        value.trim() && parseAmount(value) === null ? 'Opening balance must be a valid number.' : null,
    }));
  }

  const filteredCustomers = useMemo(
    () => filterWorkspaceCustomers(customers, { query: search, balanceFilter }),
    [balanceFilter, customers, search]
  );
  const selectedCustomers = useMemo(
    () => pickSelectedRows(filteredCustomers, selectedCustomerIds),
    [filteredCustomers, selectedCustomerIds]
  );
  const customerSummary = useMemo(() => sumCustomerBalances(filteredCustomers), [filteredCustomers]);
  const allVisibleSelected =
    filteredCustomers.length > 0 && filteredCustomers.every((customer) => selectedCustomerIds.has(customer.id));

  function toggleCustomerSelection(customerId: string) {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }

  function toggleAllVisibleCustomers() {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filteredCustomers.forEach((customer) => next.delete(customer.id));
      } else {
        filteredCustomers.forEach((customer) => next.add(customer.id));
      }
      return next;
    });
  }

  function exportCustomers() {
    if (!activeWorkspace) {
      return;
    }

    const exportRows = selectedCustomers.length ? selectedCustomers : filteredCustomers;
    const rows = exportRows.map((customer) => [
      customer.name,
      customer.legalName ?? '',
      customer.customerType ?? '',
      customer.contactPerson ?? '',
      customer.phone ?? '',
      customer.whatsapp ?? '',
      customer.email ?? '',
      customer.address ?? '',
      customer.shippingAddress ?? '',
      customer.city ?? '',
      customer.stateCode ?? '',
      customer.countryCode ?? '',
      customer.postalCode ?? '',
      customer.gstin ?? '',
      customer.pan ?? '',
      customer.paymentTerms ?? '',
      customer.creditLimit ?? '',
      customer.tags.join(', '),
      customer.isArchived ? 'Archived' : 'Active',
      customer.health.label,
      customer.health.score,
      customer.balance,
      customer.openingBalance,
      customer.updatedAt,
    ]);
    const csv = buildCsv(
      [
        'Name',
        'Legal name',
        'Customer type',
        'Contact person',
        'Phone',
        'WhatsApp',
        'Email',
        'Billing address',
        'Shipping address',
        'City',
        'State',
        'Country',
        'PIN/postcode',
        'GSTIN',
        'PAN',
        'Payment terms',
        'Credit limit',
        'Tags',
        'Status',
        'Health rank',
        'Health score',
        'Balance',
        'Opening balance',
        'Last updated',
      ],
      rows
    );
    downloadTextFile(
      makeExportFileName([activeWorkspace.businessName, 'customers', selectedCustomerIds.size ? 'selected' : 'current-view']),
      csv
    );
    showToast(`${exportRows.length} customer${exportRows.length === 1 ? '' : 's'} exported.`, 'success');
  }

  async function exportCustomersPdf() {
    if (!activeWorkspace) {
      return;
    }

    const exportRows = selectedCustomers.length ? selectedCustomers : filteredCustomers;
    try {
      await downloadCustomerProfilePdf({ workspace: activeWorkspace, customers: exportRows });
      showToast(`${exportRows.length} customer PDF page${exportRows.length === 1 ? '' : 's'} downloaded.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer PDF could not be downloaded.', 'danger');
    }
  }

  async function importCustomers(file: File | null) {
    if (!activeWorkspace || !file) {
      return;
    }

    setIsImporting(true);
    try {
      const rows = parseCustomerImportCsv(await file.text());
      const importedCustomers: WorkspaceCustomer[] = [];
      for (const row of rows) {
        const phone = normalizePhoneForCountry(activeWorkspace.countryCode || 'IN', row.phone ?? '') ?? row.phone;
        const customer = await createWorkspaceCustomer(activeWorkspace.workspaceId, {
          name: row.name,
          phone,
          address: row.address,
          openingBalance: row.openingBalance,
        });
        importedCustomers.push(customer);
      }

      setCustomers((current) => [...importedCustomers.reverse(), ...current]);
      showToast(`${rows.length} customer${rows.length === 1 ? '' : 's'} imported.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customers could not be imported.', 'danger');
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  return (
    <AppShell title="Customers" subtitle="Searchable customer records and outstanding balance review.">
      <section className="ol-split-grid">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Add customer
          </div>
          <div className="ol-form-grid">
            <div className="ol-form-band">
              <div className="ol-form-band-header">
                <div>
                  <div className="ol-form-band-title">Core details</div>
                  <p className="ol-form-band-copy">Only display name is required. Optional fields improve invoices and customer exports.</p>
                </div>
              </div>
              <div className="ol-form-band-grid">
              <label className={`ol-field${errors.name ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Display name</span>
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
              <label className="ol-field">
                <span className="ol-field-label">Legal / business name</span>
                <input className="ol-input" value={newLegalName} onChange={(event) => setNewLegalName(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Customer type</span>
                <select className="ol-select" value={newCustomerType} onChange={(event) => setNewCustomerType(event.target.value as 'individual' | 'business')}>
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Contact person</span>
                <input className="ol-input" value={newContactPerson} onChange={(event) => setNewContactPerson(event.target.value)} />
              </label>
              </div>
            </div>
            <div className="ol-form-band">
              <div className="ol-form-band-grid">
              <label className={`ol-field${errors.phone ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Phone</span>
                <input
                  className="ol-input"
                  inputMode="tel"
                  value={newPhone}
                  onBlur={handlePhoneBlur}
                  onChange={(event) => handlePhoneChange(event.target.value)}
                />
                {errors.phone ? <span className="ol-field-error">{errors.phone}</span> : null}
              </label>
              <label className="ol-field">
                <span className="ol-field-label">WhatsApp</span>
                <input className="ol-input" inputMode="tel" value={newWhatsapp} onChange={(event) => setNewWhatsapp(event.target.value)} />
              </label>
              <label className={`ol-field${errors.email ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Email</span>
                <input className="ol-input" inputMode="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
                {errors.email ? <span className="ol-field-error">{errors.email}</span> : null}
              </label>
              </div>
            </div>
            <div className="ol-form-band">
              <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label">Billing address</span>
                <input className="ol-input" value={newBillingAddress} onChange={(event) => setNewBillingAddress(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Shipping address</span>
                <input className="ol-input" value={newShippingAddress} onChange={(event) => setNewShippingAddress(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">City</span>
                <input className="ol-input" value={newCity} onChange={(event) => setNewCity(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">State</span>
                <input className="ol-input" value={newStateCode} onChange={(event) => setNewStateCode(event.target.value.toUpperCase())} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">PIN / postcode</span>
                <input className="ol-input" value={newPostalCode} onChange={(event) => setNewPostalCode(event.target.value)} />
              </label>
              </div>
            </div>
            <div className="ol-form-band">
              <div className="ol-form-band-grid">
              <label className="ol-field">
                <span className="ol-field-label">GSTIN</span>
                <input className="ol-input" value={newGstin} onChange={(event) => setNewGstin(event.target.value.toUpperCase())} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">PAN</span>
                <input className="ol-input" value={newPan} onChange={(event) => setNewPan(event.target.value.toUpperCase())} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment terms</span>
                <input className="ol-input" placeholder="Example: Net 15" value={newPaymentTerms} onChange={(event) => setNewPaymentTerms(event.target.value)} />
              </label>
              <label className={`ol-field${errors.creditLimit ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Credit limit</span>
                <input className="ol-input ol-amount" inputMode="decimal" value={newCreditLimit} onChange={(event) => setNewCreditLimit(event.target.value)} />
                {errors.creditLimit ? <span className="ol-field-error">{errors.creditLimit}</span> : null}
              </label>
              <label className={`ol-field${errors.openingBalance ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Opening balance</span>
                <input
                  className="ol-input ol-amount"
                  inputMode="decimal"
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
              <label className="ol-field">
                <span className="ol-field-label">Tags</span>
                <input className="ol-input" placeholder="VIP, wholesale, follow-up" value={newTags} onChange={(event) => setNewTags(event.target.value)} />
              </label>
              </div>
            </div>
            <label className="ol-field">
              <span className="ol-field-label">Notes</span>
              <textarea className="ol-textarea" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} />
            </label>
            <div className="ol-actions">
              <button className="ol-button" disabled={isSaving} type="button" onClick={() => void addCustomer()}>
                {isSaving ? 'Saving...' : 'Save customer'}
              </button>
            </div>
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Customer cleanup
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">₹</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Outstanding balances stay visible</div>
                <div className="ol-list-text">
                  Filter customers, select the right rows, and export only the list you are reviewing.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">A</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Cleaner office work</div>
                <div className="ol-list-text">
                  Use the wider view for review, cleanup, import, and export.
                </div>
              </div>
            </div>
          </div>
          <div className="ol-actions" style={{ marginTop: 16 }}>
            <button
              className="ol-button-secondary"
              disabled={isImporting}
              type="button"
              onClick={() => importInputRef.current?.click()}
            >
              {isImporting ? 'Importing...' : 'Import customers'}
            </button>
            <button className="ol-button-secondary" type="button" onClick={() => {
              const csv = buildCsv(
                ['Name', 'Phone', 'Opening balance', 'Address'],
                [['Asha Traders', '+91 98765 43210', 0, 'Market Road']]
              );
              downloadTextFile('orbit-ledger-customer-import-template.csv', csv);
            }}>
              Download template
            </button>
            <input
              hidden
              accept=".csv,text/csv"
              ref={importInputRef}
              type="file"
              onChange={(event) => void importCustomers(event.target.files?.[0] ?? null)}
            />
          </div>
        </article>
      </section>

      <section className="ol-metric-grid">
        <Metric label="Showing" value={String(filteredCustomers.length)} helper="Customers in this view." tone="primary" />
        <Metric
          label="Outstanding"
          value={formatCurrency(customerSummary.outstanding, activeWorkspace?.currency ?? 'INR')}
          helper={`${customerSummary.outstandingCount} customer${customerSummary.outstandingCount === 1 ? '' : 's'} to collect from.`}
          tone="warning"
        />
        <Metric
          label="Advance"
          value={formatCurrency(customerSummary.advance, activeWorkspace?.currency ?? 'INR')}
          helper={`${customerSummary.advanceCount} customer${customerSummary.advanceCount === 1 ? '' : 's'} paid ahead.`}
          tone="success"
        />
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">Search customers</span>
            <input
              className="ol-input"
              placeholder="Name or phone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Balance view</span>
            <select
              className="ol-select"
              value={balanceFilter}
              onChange={(event) => setBalanceFilter(event.target.value as typeof balanceFilter)}
            >
              <option value="all">All customers</option>
              <option value="outstanding">Outstanding only</option>
              <option value="advance">Advance balances</option>
              <option value="settled">Settled only</option>
            </select>
          </label>
          <div className="ol-table-actions">
            <button className="ol-button-secondary" type="button" onClick={() => {
              setSearch('');
              setBalanceFilter('all');
              setSelectedCustomerIds(new Set());
            }}>
              Clear view
            </button>
            <button className="ol-button" type="button" disabled={!filteredCustomers.length} onClick={exportCustomers}>
              Export CSV
            </button>
            <button className="ol-button-secondary" type="button" disabled={!filteredCustomers.length} onClick={() => void exportCustomersPdf()}>
              Export PDF
            </button>
          </div>
        </div>
        <div className="ol-table-summary">
          {selectedCustomerIds.size
            ? `${selectedCustomers.length} selected from this view.`
            : 'Select rows for a focused export, or export the current view.'}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '44px 1.2fr 1fr 0.7fr 0.7fr' }}>
          <span>
            <input
              aria-label="Select all visible customers"
              checked={allVisibleSelected}
              className="ol-checkbox"
              type="checkbox"
              onChange={toggleAllVisibleCustomers}
            />
          </span>
          <span>Name</span>
          <span>Phone</span>
          <span>Health</span>
          <span style={{ textAlign: 'right' }}>Balance</span>
        </div>
        {filteredCustomers.map((customer) => (
          <div
            className="ol-table-row"
            key={customer.id}
            style={{ gridTemplateColumns: '44px 1.2fr 1fr 0.7fr 0.7fr' }}
          >
            <span>
              <input
                aria-label={`Select ${customer.name}`}
                checked={selectedCustomerIds.has(customer.id)}
                className="ol-checkbox"
                type="checkbox"
                onChange={() => toggleCustomerSelection(customer.id)}
              />
            </span>
            <Link
              href={`/customers/detail?customerId=${encodeURIComponent(customer.id)}` as Route}
              style={{ fontWeight: 800 }}
            >
              {customer.name}
            </Link>
            <span>{customer.phone || '—'}</span>
            <span>
              <span className={`ol-chip ol-chip--${customer.health.tone === 'danger' ? 'warning' : customer.health.tone}`}>
                {customer.health.label}
              </span>
            </span>
            <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
              {formatCurrency(customer.balance, activeWorkspace?.currency ?? 'INR')}
            </span>
          </div>
        ))}
        {!filteredCustomers.length ? (
          <div className="ol-empty">
            No customers match this view.
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

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}
