'use client';

import type { CollectionCoachRecommendation } from '@orbit-ledger/core';
import { buildCollectionCoach } from '@orbit-ledger/core';
import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { downloadCustomerProfilePdf } from '@/lib/customer-export';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateEmail,
  validateBusinessName,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES, getDefaultIndianCity, getIndianCityOptions } from '@/lib/india';
import {
  createWorkspaceCustomer,
  listWorkspaceCustomers,
  listWorkspaceInvoices,
  listWorkspacePaymentPromises,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspacePaymentPromise,
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
import { resolveWebFeatureAccess } from '@/lib/web-monetization';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function CustomersPage() {
  const { activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const officeAccess = useOfficeAccess();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [paymentPromises, setPaymentPromises] = useState<WorkspacePaymentPromise[]>([]);
  const [newName, setNewName] = useState('');
  const [newLegalName, setNewLegalName] = useState('');
  const [newCustomerType, setNewCustomerType] = useState<'individual' | 'business'>('business');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newWhatsapp, setNewWhatsapp] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newBillingAddress, setNewBillingAddress] = useState('');
  const [newShippingAddress, setNewShippingAddress] = useState('');
  const [newCity, setNewCity] = useState(getDefaultIndianCity(activeWorkspace?.stateCode ?? 'GJ'));
  const [newTown, setNewTown] = useState('');
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
    legalName: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    creditLimit: string | null;
    openingBalance: string | null;
  }>({
    name: null,
    legalName: null,
    contactPerson: null,
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
  const customerExportAccess = resolveWebFeatureAccess(subscription, 'customer_profile_exports');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void Promise.all([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceInvoices(activeWorkspace.workspaceId),
      listWorkspacePaymentPromises(activeWorkspace.workspaceId),
    ])
      .then(([nextCustomers, nextInvoices, nextPaymentPromises]) => {
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setPaymentPromises(nextPaymentPromises);
      })
      .catch(() => {
        setCustomers([]);
        setInvoices([]);
        setPaymentPromises([]);
      });
    setNewStateCode(activeWorkspace.stateCode || 'GJ');
    setNewCity(getDefaultIndianCity(activeWorkspace.stateCode || 'GJ'));
    setSelectedCustomerIds(new Set());
  }, [activeWorkspace]);

  async function addCustomer() {
    if (!activeWorkspace) {
      return;
    }

    const countryCode = activeWorkspace.countryCode || 'IN';
    const nextErrors = {
      name: validateName(newName, 'Customer name', true),
      legalName: validateBusinessName(newLegalName, 'Legal / business name', false),
      contactPerson: validateName(newContactPerson, 'Contact person', false),
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

    if (
      nextErrors.name ||
      nextErrors.legalName ||
      nextErrors.contactPerson ||
      nextErrors.phone ||
      nextErrors.email ||
      nextErrors.creditLimit ||
      nextErrors.openingBalance
    ) {
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
        town: newTown,
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
      setNewCity(getDefaultIndianCity(activeWorkspace.stateCode || 'GJ'));
      setNewTown('');
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
      setErrors({ name: null, legalName: null, contactPerson: null, phone: null, email: null, creditLimit: null, openingBalance: null });
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

  function handleStateChange(value: string) {
    setNewStateCode(value);
    setNewCity((current) => (getIndianCityOptions(value).includes(current) ? current : getDefaultIndianCity(value)));
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
  const collectionCoach = useMemo(
    () =>
      buildCollectionCoach({
        businessName: activeWorkspace?.businessName,
        currency: activeWorkspace?.currency ?? 'INR',
        today: new Date().toISOString().slice(0, 10),
        customers: customers.map((customer) => {
          const latestPromise = getLatestPromiseForCustomer(paymentPromises, customer.id);
          const overdueInvoiceCount = invoices.filter(
            (invoice) =>
              invoice.customerId === customer.id &&
              !invoice.isArchived &&
              invoice.documentState !== 'cancelled' &&
              invoice.paymentStatus === 'overdue'
          ).length;
          return {
            id: customer.id,
            name: customer.name,
            balance: customer.balance,
            brokenPromiseCount: paymentPromises.filter(
              (promise) => promise.customerId === customer.id && promise.status === 'missed'
            ).length,
            healthRank: customer.health.rank,
            lastPromise: latestPromise
              ? {
                  amount: latestPromise.promisedAmount,
                  promisedDate: latestPromise.promisedDate,
                  status: latestPromise.status,
                }
              : null,
            overdueInvoiceCount,
          };
        }),
      }),
    [activeWorkspace?.businessName, activeWorkspace?.currency, customers, invoices, paymentPromises]
  );
  const coachRecommendations = collectionCoach.recommendations.slice(0, 4);
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

  async function copyCoachReminder(recommendation: CollectionCoachRecommendation) {
    try {
      await navigator.clipboard.writeText(recommendation.suggestedMessage);
      showToast('Reminder copied.', 'success');
    } catch {
      showToast('Reminder could not be copied.', 'danger');
    }
  }

  function exportCustomers() {
    if (!activeWorkspace) {
      return;
    }
    if (!customerExportAccess.allowed) {
      showToast(customerExportAccess.message ?? 'Customer exports are not included in your plan.', 'info');
      return;
    }
    if (!officeAccess.can('export_documents')) {
      showToast(officeAccess.getLockedMessage('export_documents'), 'info');
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
      customer.town ?? '',
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
        'Town / village',
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
    if (!customerExportAccess.allowed) {
      showToast(customerExportAccess.message ?? 'Customer exports are not included in your plan.', 'info');
      return;
    }
    if (!officeAccess.can('export_documents')) {
      showToast(officeAccess.getLockedMessage('export_documents'), 'info');
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
      <section className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Customer review
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
                  Use the wider view for review, import, export, and record updates.
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
            <Link className="ol-button" href={'/customers/new' as Route}>
              Add customer
            </Link>
            <input
              hidden
              accept=".csv,text/csv"
              ref={importInputRef}
              type="file"
              onChange={(event) => void importCustomers(event.target.files?.[0] ?? null)}
            />
          </div>
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

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Collection coach</div>
            <p className="ol-panel-copy">
              {collectionCoach.summary}
            </p>
          </div>
          {collectionCoach.topRecommendation ? (
            <span className={`ol-chip ol-chip--${collectionCoach.topRecommendation.tone === 'danger' ? 'warning' : collectionCoach.topRecommendation.tone}`}>
              {collectionCoach.topRecommendation.priority === 'critical' ? 'Contact first' : 'Guided follow-up'}
            </span>
          ) : (
            <span className="ol-chip ol-chip--success">Clear</span>
          )}
        </div>
        {coachRecommendations.length ? (
          <div className="ol-coach-grid">
            {coachRecommendations.map((recommendation) => (
              <CollectionCoachCard
                key={recommendation.id}
                recommendation={recommendation}
                onCopy={() => void copyCoachReminder(recommendation)}
              />
            ))}
          </div>
        ) : (
          <div className="ol-empty">No collection follow-up is needed right now.</div>
        )}
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
            <button className="ol-button" type="button" disabled={!filteredCustomers.length || !customerExportAccess.allowed || !officeAccess.can('export_documents')} onClick={exportCustomers}>
              Export CSV
            </button>
            <button className="ol-button-secondary" type="button" disabled={!filteredCustomers.length || !customerExportAccess.allowed || !officeAccess.can('export_documents')} onClick={() => void exportCustomersPdf()}>
              Export PDF
            </button>
          </div>
        </div>
        {!customerExportAccess.allowed ? (
          <div className="ol-message" style={{ margin: '0 24px 16px' }}>
            {customerExportAccess.message}
          </div>
        ) : null}
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

function CollectionCoachCard({
  onCopy,
  recommendation,
}: {
  onCopy(): void;
  recommendation: CollectionCoachRecommendation;
}) {
  return (
    <article className="ol-coach-card" data-tone={recommendation.tone}>
      <div className="ol-coach-card-head">
        <div>
          <div className="ol-coach-title">{recommendation.title}</div>
          <p>{recommendation.reason}</p>
        </div>
        <span className="ol-coach-score">{recommendation.score}</span>
      </div>
      <div className="ol-coach-meta">
        <span>{recommendation.balanceLabel}</span>
        <span>{recommendation.helper}</span>
        <span>Next follow-up: {recommendation.followUpDate}</span>
      </div>
      <div className="ol-coach-message">
        {recommendation.suggestedMessage.split('\n').slice(0, 3).join(' ')}
      </div>
      <div className="ol-inline-actions">
        <Link
          className="ol-button-secondary"
          href={`/customers/detail?customerId=${encodeURIComponent(recommendation.customerId)}` as Route}
        >
          Open customer
        </Link>
        <button className="ol-button-ghost" type="button" onClick={onCopy}>
          Copy reminder
        </button>
      </div>
    </article>
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

function getLatestPromiseForCustomer(promises: WorkspacePaymentPromise[], customerId: string) {
  const activePromises = promises.filter(
    (promise) =>
      promise.customerId === customerId &&
      (promise.status === 'open' || promise.status === 'missed') &&
      promise.promisedDate
  );
  if (!activePromises.length) {
    return null;
  }
  const today = new Date().toISOString().slice(0, 10);
  return activePromises.sort((left, right) => {
    const leftWeight = getPromiseWeight(left, today);
    const rightWeight = getPromiseWeight(right, today);
    return leftWeight - rightWeight || left.promisedDate.localeCompare(right.promisedDate);
  })[0];
}

function getPromiseWeight(promise: WorkspacePaymentPromise, today: string) {
  if (promise.status === 'missed' || promise.promisedDate < today) {
    return 0;
  }
  if (promise.promisedDate === today) {
    return 1;
  }
  return 2;
}
