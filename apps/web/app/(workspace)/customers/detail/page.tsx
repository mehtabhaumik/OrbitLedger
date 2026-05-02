'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { summarizePaymentClearance, summarizePaymentMode } from '@orbit-ledger/core';

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
  getWorkspaceCustomer,
  listWorkspaceCustomerTransactions,
  updateWorkspaceCustomer,
  type WorkspaceCustomer,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import {
  buildCsv,
  downloadTextFile,
  filterWorkspaceTransactions,
  makeExportFileName,
  pickSelectedRows,
  type TransactionTypeFilter,
} from '@/lib/workspace-power';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type CustomerProfileFormState = {
  name: string;
  legalName: string;
  customerType: 'individual' | 'business';
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  billingAddress: string;
  shippingAddress: string;
  city: string;
  stateCode: string;
  countryCode: string;
  postalCode: string;
  gstin: string;
  pan: string;
  taxNumber: string;
  registrationNumber: string;
  placeOfSupply: string;
  defaultTaxTreatment: string;
  openingBalance: string;
  creditLimit: string;
  paymentTerms: string;
  preferredPaymentMode: string;
  preferredInvoiceTemplate: string;
  preferredLanguage: string;
  tags: string;
  notes: string;
};

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<CustomerDetailShell message="Loading customer..." />}>
      <CustomerDetailContent />
    </Suspense>
  );
}

function CustomerDetailContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') ?? '';
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [customer, setCustomer] = useState<WorkspaceCustomer | null>(null);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [profileDraft, setProfileDraft] = useState<CustomerProfileFormState | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!activeWorkspace || !customerId) {
      setStatus(customerId ? null : 'Choose a customer from the customer list.');
      return;
    }
    setStatus(null);
    void Promise.all([
      getWorkspaceCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspaceCustomerTransactions(activeWorkspace.workspaceId, customerId),
    ])
      .then(([nextCustomer, nextTransactions]) => {
        setCustomer(nextCustomer);
        setProfileDraft(nextCustomer ? customerToProfileDraft(nextCustomer, activeWorkspace.countryCode) : null);
        setTransactions(nextTransactions);
        setSelectedTransactionIds(new Set());
        if (!nextCustomer) {
          setStatus('Customer could not be found.');
        }
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Customer could not be loaded.'));
  }, [activeWorkspace, customerId]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (summary, transaction) => {
        if (transaction.type === 'credit') {
          summary.credits += transaction.amount;
        } else {
          summary.payments += transaction.amount;
        }
        return summary;
      },
      { credits: 0, payments: 0 }
    );
  }, [transactions]);
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
  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const currency = activeWorkspace?.currency ?? 'INR';

  function updateProfileField(field: keyof CustomerProfileFormState, value: string) {
    setProfileDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveCustomerProfile() {
    if (!activeWorkspace || !customer || !profileDraft) {
      return;
    }

    const nameError = validateName(profileDraft.name, 'Customer name', true);
    const phoneError = validatePhone(profileDraft.phone, activeWorkspace.countryCode || 'IN', false);
    const emailError = validateEmail(profileDraft.email, false);
    const openingBalanceValue = parseAmount(profileDraft.openingBalance);
    const creditLimitValue = parseAmount(profileDraft.creditLimit);
    if (
      nameError ||
      phoneError ||
      emailError ||
      (profileDraft.openingBalance.trim() && openingBalanceValue === null) ||
      (profileDraft.creditLimit.trim() && creditLimitValue === null)
    ) {
      showToast(nameError || phoneError || emailError || 'Fix the highlighted profile amounts before saving.', 'danger');
      return;
    }

    setIsSavingProfile(true);
    try {
      const countryCode = activeWorkspace.countryCode || 'IN';
      const updated = await updateWorkspaceCustomer(activeWorkspace.workspaceId, customer.id, {
        name: profileDraft.name,
        legalName: profileDraft.legalName,
        customerType: profileDraft.customerType,
        contactPerson: profileDraft.contactPerson,
        phone: normalizePhoneForCountry(countryCode, profileDraft.phone) ?? profileDraft.phone,
        whatsapp: normalizePhoneForCountry(countryCode, profileDraft.whatsapp) ?? profileDraft.whatsapp,
        email: profileDraft.email,
        address: profileDraft.billingAddress,
        billingAddress: profileDraft.billingAddress,
        shippingAddress: profileDraft.shippingAddress,
        city: profileDraft.city,
        stateCode: profileDraft.stateCode,
        countryCode: profileDraft.countryCode || countryCode,
        postalCode: profileDraft.postalCode,
        gstin: profileDraft.gstin,
        pan: profileDraft.pan,
        taxNumber: profileDraft.taxNumber,
        registrationNumber: profileDraft.registrationNumber,
        placeOfSupply: profileDraft.placeOfSupply,
        defaultTaxTreatment: profileDraft.defaultTaxTreatment,
        openingBalance: openingBalanceValue ?? 0,
        creditLimit: creditLimitValue,
        paymentTerms: profileDraft.paymentTerms,
        preferredPaymentMode: profileDraft.preferredPaymentMode,
        preferredInvoiceTemplate: profileDraft.preferredInvoiceTemplate,
        preferredLanguage: profileDraft.preferredLanguage,
        tags: splitTags(profileDraft.tags),
        notes: profileDraft.notes,
      });
      setCustomer(updated);
      setProfileDraft(customerToProfileDraft(updated, countryCode));
      showToast('Customer profile saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer profile could not be saved.', 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  }

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

  function exportCustomerTransactions() {
    if (!activeWorkspace || !customer) {
      return;
    }

    const exportRows = selectedTransactions.length ? selectedTransactions : filteredTransactions;
    const rows = exportRows.map((transaction) => [
      transaction.effectiveDate,
      transaction.type === 'payment' ? 'Payment' : 'Credit',
      transaction.type === 'payment'
        ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} - ${summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}`
        : '',
      transaction.note ?? '',
      transaction.amount,
    ]);
    const csv = buildCsv(['Date', 'Type', 'Payment mode', 'Note', 'Amount'], rows);
    downloadTextFile(
      makeExportFileName([
        activeWorkspace.businessName,
        customer.name,
        'transactions',
        selectedTransactionIds.size ? 'selected' : 'current-view',
      ]),
      csv
    );
    showToast(`${exportRows.length} entr${exportRows.length === 1 ? 'y' : 'ies'} exported.`, 'success');
  }

  function exportCustomerProfileCsv() {
    if (!activeWorkspace || !customer) {
      return;
    }

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
        'VAT/tax number',
        'Registration number',
        'Place of supply',
        'Tax treatment',
        'Payment terms',
        'Credit limit',
        'Preferred payment mode',
        'Preferred invoice template',
        'Preferred language',
        'Tags',
        'Status',
        'Health rank',
        'Health score',
        'Balance',
        'Opening balance',
        'Important information',
        'Notes',
        'Last updated',
      ],
      [[
        customer.name,
        customer.legalName ?? '',
        customer.customerType ?? '',
        customer.contactPerson ?? '',
        customer.phone ?? '',
        customer.whatsapp ?? '',
        customer.email ?? '',
        customer.billingAddress ?? customer.address ?? '',
        customer.shippingAddress ?? '',
        customer.city ?? '',
        customer.stateCode ?? '',
        customer.countryCode ?? '',
        customer.postalCode ?? '',
        customer.gstin ?? '',
        customer.pan ?? '',
        customer.taxNumber ?? '',
        customer.registrationNumber ?? '',
        customer.placeOfSupply ?? '',
        customer.defaultTaxTreatment ?? '',
        customer.paymentTerms ?? '',
        customer.creditLimit ?? '',
        customer.preferredPaymentMode ?? '',
        customer.preferredInvoiceTemplate ?? '',
        customer.preferredLanguage ?? '',
        customer.tags.join(', '),
        customer.isArchived ? 'Archived' : 'Active',
        customer.health.label,
        customer.health.score,
        customer.balance,
        customer.openingBalance,
        customer.health.helper,
        customer.notes ?? '',
        customer.updatedAt,
      ]]
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, customer.name, 'customer-profile']), csv);
    showToast('Customer CSV downloaded.', 'success');
  }

  async function exportCustomerPdf() {
    if (!activeWorkspace || !customer) {
      return;
    }

    try {
      await downloadCustomerProfilePdf({ workspace: activeWorkspace, customers: [customer] });
      showToast('Customer PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer PDF could not be downloaded.', 'danger');
    }
  }

  return (
    <AppShell title="Customer Detail" subtitle="Activity, balance, and follow-up context.">
      <div className="ol-actions ol-actions--sticky">
        <Link className="ol-button-secondary" href="/customers">
          Back to customers
        </Link>
        <Link className="ol-button" href="/transactions">
          Record transaction
        </Link>
        <Link className="ol-button-secondary" href={'/documents' as Route}>
          Create statement
        </Link>
        <button className="ol-button-secondary" type="button" disabled={!customer} onClick={() => void exportCustomerPdf()}>
          Export customer PDF
        </button>
        <button className="ol-button-secondary" type="button" disabled={!customer} onClick={exportCustomerProfileCsv}>
          Export customer CSV
        </button>
      </div>

      {status ? <div className="ol-message ol-message--danger">{status}</div> : null}

      {customer ? (
        <>
          <section className="ol-metric-grid">
            <Metric label="Balance" value={formatCurrency(customer.balance, currency)} tone="warning" />
            <Metric label="Credits" value={formatCurrency(totals.credits, currency)} tone="primary" />
            <Metric label="Payments" value={formatCurrency(totals.payments, currency)} tone="success" />
            <Metric label="Health" value={`${customer.health.label} ${customer.health.score}/100`} tone={customer.health.tone === 'danger' ? 'warning' : customer.health.tone} />
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">{customer.name}</div>
                <p className="ol-panel-copy">
                  {[customer.phone, customer.email, customer.contactPerson].filter(Boolean).join(' · ') || 'No contact details saved'}
                </p>
              </div>
              <span className="ol-chip ol-chip--primary">{customer.isArchived ? 'Archived' : 'Active'}</span>
            </div>
            <div className="ol-review-grid">
              <Review label="Legal name" value={customer.legalName ?? 'Not saved'} />
              <Review label="Type" value={customer.customerType === 'individual' ? 'Individual' : customer.customerType === 'business' ? 'Business' : 'Not saved'} />
              <Review label="WhatsApp" value={customer.whatsapp ?? 'Not saved'} />
              <Review label="GSTIN" value={customer.gstin ?? 'Not saved'} />
              <Review label="PAN" value={customer.pan ?? 'Not saved'} />
              <Review label="Terms" value={customer.paymentTerms ?? 'Not saved'} />
              <Review label="Credit limit" value={customer.creditLimit !== null ? formatCurrency(customer.creditLimit, currency) : 'Not saved'} />
              <Review label="Tags" value={customer.tags.length ? customer.tags.join(', ') : 'Not saved'} />
            </div>
            <p className="ol-panel-copy" style={{ marginTop: 16 }}>{customer.billingAddress || customer.address || 'No address saved yet.'}</p>
          </section>

          {profileDraft ? (
            <section className="ol-panel-glass">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Customer profile</div>
                  <p className="ol-panel-copy">Optional details used for exports, invoices, statements, and follow-up context.</p>
                </div>
                <button className="ol-button" type="button" disabled={isSavingProfile} onClick={() => void saveCustomerProfile()}>
                  {isSavingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </div>
              <div className="ol-form-stack">
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <CustomerField label="Display name" value={profileDraft.name} onChange={(value) => updateProfileField('name', value)} />
                    <CustomerField label="Legal / business name" value={profileDraft.legalName} onChange={(value) => updateProfileField('legalName', value)} />
                    <label className="ol-field">
                      <span className="ol-field-label">Customer type</span>
                      <select className="ol-select" value={profileDraft.customerType} onChange={(event) => updateProfileField('customerType', event.target.value)}>
                        <option value="business">Business</option>
                        <option value="individual">Individual</option>
                      </select>
                    </label>
                    <CustomerField label="Contact person" value={profileDraft.contactPerson} onChange={(value) => updateProfileField('contactPerson', value)} />
                    <CustomerField label="Phone" value={profileDraft.phone} onChange={(value) => updateProfileField('phone', value)} />
                    <CustomerField label="WhatsApp" value={profileDraft.whatsapp} onChange={(value) => updateProfileField('whatsapp', value)} />
                    <CustomerField label="Email" value={profileDraft.email} onChange={(value) => updateProfileField('email', value)} />
                  </div>
                </div>
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <CustomerField label="Billing address" value={profileDraft.billingAddress} onChange={(value) => updateProfileField('billingAddress', value)} />
                    <CustomerField label="Shipping address" value={profileDraft.shippingAddress} onChange={(value) => updateProfileField('shippingAddress', value)} />
                    <CustomerField label="City" value={profileDraft.city} onChange={(value) => updateProfileField('city', value)} />
                    <CustomerField label="State" value={profileDraft.stateCode} onChange={(value) => updateProfileField('stateCode', value.toUpperCase())} />
                    <CustomerField label="Country" value={profileDraft.countryCode} onChange={(value) => updateProfileField('countryCode', value.toUpperCase())} />
                    <CustomerField label="PIN / postcode" value={profileDraft.postalCode} onChange={(value) => updateProfileField('postalCode', value)} />
                  </div>
                </div>
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <CustomerField label="GSTIN" value={profileDraft.gstin} onChange={(value) => updateProfileField('gstin', value.toUpperCase())} />
                    <CustomerField label="PAN" value={profileDraft.pan} onChange={(value) => updateProfileField('pan', value.toUpperCase())} />
                    <CustomerField label="VAT / tax number" value={profileDraft.taxNumber} onChange={(value) => updateProfileField('taxNumber', value)} />
                    <CustomerField label="Registration number" value={profileDraft.registrationNumber} onChange={(value) => updateProfileField('registrationNumber', value)} />
                    <CustomerField label="Place of supply" value={profileDraft.placeOfSupply} onChange={(value) => updateProfileField('placeOfSupply', value)} />
                    <CustomerField label="Tax treatment" value={profileDraft.defaultTaxTreatment} onChange={(value) => updateProfileField('defaultTaxTreatment', value)} />
                  </div>
                </div>
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <CustomerField label="Opening balance" value={profileDraft.openingBalance} onChange={(value) => updateProfileField('openingBalance', value)} />
                    <CustomerField label="Credit limit" value={profileDraft.creditLimit} onChange={(value) => updateProfileField('creditLimit', value)} />
                    <CustomerField label="Payment terms" value={profileDraft.paymentTerms} onChange={(value) => updateProfileField('paymentTerms', value)} />
                    <CustomerField label="Preferred payment mode" value={profileDraft.preferredPaymentMode} onChange={(value) => updateProfileField('preferredPaymentMode', value)} />
                    <CustomerField label="Preferred invoice template" value={profileDraft.preferredInvoiceTemplate} onChange={(value) => updateProfileField('preferredInvoiceTemplate', value)} />
                    <CustomerField label="Preferred language" value={profileDraft.preferredLanguage} onChange={(value) => updateProfileField('preferredLanguage', value)} />
                    <CustomerField label="Tags" value={profileDraft.tags} onChange={(value) => updateProfileField('tags', value)} />
                  </div>
                </div>
                <label className="ol-field">
                  <span className="ol-field-label">Notes</span>
                  <textarea className="ol-textarea" value={profileDraft.notes} onChange={(event) => updateProfileField('notes', event.target.value)} />
                </label>
              </div>
            </section>
          ) : null}

          <section className="ol-table">
            <div className="ol-table-tools">
              <label className="ol-field">
                <span className="ol-field-label">Search entries</span>
                <input
                  className="ol-input"
                  placeholder="Note or customer"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Type</span>
                <select
                  className="ol-select"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TransactionTypeFilter)}
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
                <button className="ol-button" type="button" disabled={!filteredTransactions.length} onClick={exportCustomerTransactions}>
                  Export {selectedTransactionIds.size ? 'selected' : 'view'}
                </button>
              </div>
            </div>
            <div className="ol-table-summary">
              {selectedTransactionIds.size
                ? `${selectedTransactions.length} selected from this customer view.`
                : 'Select entries for a focused customer export, or export the current view.'}
            </div>
            <div className="ol-table-head" style={{ gridTemplateColumns: '44px 0.7fr 1.2fr 0.7fr 0.8fr' }}>
              <span>
                <input
                  aria-label="Select all visible customer entries"
                  checked={allVisibleSelected}
                  className="ol-checkbox"
                  type="checkbox"
                  onChange={toggleAllVisibleTransactions}
                />
              </span>
              <span>Type</span>
              <span>Note</span>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
            </div>
            {filteredTransactions.map((transaction) => (
              <div
                className="ol-table-row"
                key={transaction.id}
                style={{ gridTemplateColumns: '44px 0.7fr 1.2fr 0.7fr 0.8fr' }}
              >
                <span>
                  <input
                    aria-label={`Select ${transaction.effectiveDate || 'entry'}`}
                    checked={selectedTransactionIds.has(transaction.id)}
                    className="ol-checkbox"
                    type="checkbox"
                    onChange={() => toggleTransactionSelection(transaction.id)}
                  />
                </span>
                <span
                  className="ol-status-text"
                  data-tone={transaction.type === 'payment' ? 'success' : 'warning'}
                  style={{ fontWeight: 800 }}
                >
                  {transaction.type === 'payment' ? 'Payment' : 'Credit'}
                </span>
                <span>
                  {transaction.type === 'payment'
                    ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} · ${summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}${transaction.note ? ` · ${transaction.note}` : ''}`
                    : transaction.note || transaction.effectiveDate}
                </span>
                <span>{transaction.effectiveDate || '—'}</span>
                <span className="ol-amount" style={{ textAlign: 'right', fontWeight: 800 }}>
                  {formatCurrency(transaction.amount, currency)}
                </span>
              </div>
            ))}
            {!filteredTransactions.length ? <div className="ol-empty">No ledger entries match this view.</div> : null}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function CustomerDetailShell({ message }: { message: string }) {
  return (
    <AppShell title="Customer Detail" subtitle="Activity, balance, and follow-up context.">
      <div className="ol-message ol-message--success">{message}</div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'warning' | 'success';
}) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">Current customer ledger.</div>
    </article>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-review-item">
      <span className="ol-review-label">{label}</span>
      <strong className="ol-review-value">{value}</strong>
    </div>
  );
}

function CustomerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <input className="ol-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function customerToProfileDraft(customer: WorkspaceCustomer, fallbackCountryCode = 'IN'): CustomerProfileFormState {
  return {
    name: customer.name,
    legalName: customer.legalName ?? '',
    customerType: customer.customerType ?? 'business',
    contactPerson: customer.contactPerson ?? '',
    phone: customer.phone ?? '',
    whatsapp: customer.whatsapp ?? '',
    email: customer.email ?? '',
    billingAddress: customer.billingAddress ?? customer.address ?? '',
    shippingAddress: customer.shippingAddress ?? '',
    city: customer.city ?? '',
    stateCode: customer.stateCode ?? '',
    countryCode: customer.countryCode ?? fallbackCountryCode,
    postalCode: customer.postalCode ?? '',
    gstin: customer.gstin ?? '',
    pan: customer.pan ?? '',
    taxNumber: customer.taxNumber ?? '',
    registrationNumber: customer.registrationNumber ?? '',
    placeOfSupply: customer.placeOfSupply ?? '',
    defaultTaxTreatment: customer.defaultTaxTreatment ?? '',
    openingBalance: formatAmountInput(customer.openingBalance),
    creditLimit: customer.creditLimit !== null ? formatAmountInput(customer.creditLimit) : '',
    paymentTerms: customer.paymentTerms ?? '',
    preferredPaymentMode: customer.preferredPaymentMode ?? '',
    preferredInvoiceTemplate: customer.preferredInvoiceTemplate ?? '',
    preferredLanguage: customer.preferredLanguage ?? '',
    tags: customer.tags.join(', '),
    notes: customer.notes ?? '',
  };
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function formatAmountInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
