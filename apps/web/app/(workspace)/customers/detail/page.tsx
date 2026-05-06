'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  buildCustomerTrustMemory,
  filterCustomerTrustMemory,
  summarizePaymentClearance,
  summarizePaymentMode,
  type CustomerTrustMemoryCategory,
  type CustomerTrustMemoryFilter,
  type CustomerTrustMemorySummaryCard,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  buildReminderMessage,
  getPromiseStatusLabel,
} from '@/lib/customer-timeline';
import { downloadCustomerProfilePdf } from '@/lib/customer-export';
import { getWebDocumentTemplates, type WebDocumentTemplate } from '@/lib/web-documents';
import { resolveWebFeatureAccess } from '@/lib/web-monetization';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateBusinessName,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES, getDefaultIndianCity, getIndianCityOptions } from '@/lib/india';
import {
  getNotificationReminderPreferences,
  reminderStyleToTimelineTone,
  renderReminderTemplate,
} from '@/lib/notification-preferences';
import {
  addWorkspaceCustomerTimelineNote,
  addWorkspacePaymentPromise,
  addWorkspacePaymentReminder,
  getWorkspaceCustomer,
  listWorkspaceCustomerTimelineNotes,
  listWorkspaceCustomerTransactions,
  listWorkspaceInvoicesForCustomer,
  listWorkspacePaymentPromisesForCustomer,
  listWorkspacePaymentRemindersForCustomer,
  listWorkspaceRecurringInvoiceRules,
  updateWorkspacePaymentPromiseStatus,
  updateWorkspaceCustomer,
  type WorkspaceCustomerTimelineNote,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspacePaymentPromise,
  type WorkspacePaymentPromiseStatus,
  type WorkspacePaymentReminder,
  type WorkspacePaymentReminderTone,
  type WorkspaceRecurringInvoiceRule,
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
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
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
  town: string;
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
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const officeAccess = useOfficeAccess();
  const [customer, setCustomer] = useState<WorkspaceCustomer | null>(null);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [timelineNotes, setTimelineNotes] = useState<WorkspaceCustomerTimelineNote[]>([]);
  const [paymentPromises, setPaymentPromises] = useState<WorkspacePaymentPromise[]>([]);
  const [paymentReminders, setPaymentReminders] = useState<WorkspacePaymentReminder[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<WorkspaceInvoice[]>([]);
  const [recurringRules, setRecurringRules] = useState<WorkspaceRecurringInvoiceRule[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>('all');
  const [timelineFilter, setTimelineFilter] = useState<CustomerTrustMemoryFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [profileDraft, setProfileDraft] = useState<CustomerProfileFormState | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [noteKind, setNoteKind] = useState<'note' | 'dispute'>('note');
  const [noteBody, setNoteBody] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promiseDate, setPromiseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [promiseNote, setPromiseNote] = useState('');
  const [reminderTone, setReminderTone] = useState<WorkspacePaymentReminderTone>('polite');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const reminderPreferences = getNotificationReminderPreferences(activeWorkspace);

  useEffect(() => {
    if (!activeWorkspace || !customerId) {
      setStatus(customerId ? null : 'Choose a customer from the customer list.');
      return;
    }
    setStatus(null);
    void Promise.all([
      getWorkspaceCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspaceCustomerTransactions(activeWorkspace.workspaceId, customerId),
      listWorkspaceCustomerTimelineNotes(activeWorkspace.workspaceId, customerId),
      listWorkspacePaymentPromisesForCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspacePaymentRemindersForCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspaceInvoicesForCustomer(activeWorkspace.workspaceId, customerId),
      listWorkspaceRecurringInvoiceRules(activeWorkspace.workspaceId),
    ])
      .then(([nextCustomer, nextTransactions, nextTimelineNotes, nextPaymentPromises, nextPaymentReminders, nextInvoices, nextRules]) => {
        setCustomer(nextCustomer);
        setProfileDraft(nextCustomer ? customerToProfileDraft(nextCustomer, activeWorkspace.countryCode) : null);
        setTransactions(nextTransactions);
        setTimelineNotes(nextTimelineNotes);
        setPaymentPromises(nextPaymentPromises);
        setPaymentReminders(nextPaymentReminders);
        setCustomerInvoices(nextInvoices);
        setRecurringRules(nextRules.filter((rule) => rule.customerId === customerId));
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
  const currency = activeWorkspace?.currency ?? 'INR';
  const lastPayment = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.type === 'payment')
        .sort((left, right) => (right.createdAt || right.effectiveDate).localeCompare(left.createdAt || left.effectiveDate))[0],
    [transactions]
  );
  const trustMemory = useMemo(
    () =>
      customer
        ? buildCustomerTrustMemory({
            customerName: customer.name,
            currency,
            currentBalance: customer.balance,
            healthRank: customer.health.rank,
            healthLabel: customer.health.label,
            totalCredit: totals.credits,
            totalPayment: totals.payments,
            lastPaymentAt: lastPayment?.effectiveDate ?? lastPayment?.createdAt ?? null,
            moneyEvents: transactions.map((transaction) => ({
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              occurredAt: transaction.createdAt || transaction.effectiveDate,
              note: transaction.note,
              paymentModeLabel:
                transaction.type === 'payment' && transaction.paymentMode
                  ? `${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} · ${summarizePaymentClearance(
                      transaction.paymentClearanceStatus,
                      transaction.paymentDetails
                    )}`
                  : null,
            })),
            invoiceEvents: customerInvoices.map((invoice) => ({
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.totalAmount,
              occurredAt: invoice.issueDate,
              documentState: invoice.documentState,
              paymentState: invoice.paymentStatus,
              notes:
                invoice.latestAutoEmailStatus === 'sent'
                  ? 'This invoice has automatic email history.'
                  : invoice.paymentStatusReason ?? null,
            })),
            reminderEvents: paymentReminders.map((reminder) => ({
              id: reminder.id,
              tone: reminder.tone,
              message: reminder.message,
              balanceAtSend: reminder.balanceAtSend,
              occurredAt: reminder.createdAt,
              sharedVia: reminder.sharedVia,
            })),
            promiseEvents: paymentPromises.map((promise) => ({
              id: promise.id,
              amount: promise.promisedAmount,
              promisedDate: promise.promisedDate,
              status: promise.status,
              occurredAt: promise.createdAt,
              note: promise.note,
            })),
            noteEvents: timelineNotes.map((note) => ({
              id: note.id,
              kind: note.kind,
              body: note.body,
              occurredAt: note.createdAt,
            })),
          })
        : null,
    [currency, customer, customerInvoices, lastPayment, paymentPromises, paymentReminders, timelineNotes, totals.credits, totals.payments, transactions]
  );
  const visibleTimelineEvents = useMemo(
    () => (trustMemory ? filterCustomerTrustMemory(trustMemory.timeline, timelineFilter) : []),
    [timelineFilter, trustMemory]
  );
  const allVisibleSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((transaction) => selectedTransactionIds.has(transaction.id));
  const invoiceTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'invoice') : [];
  const customerExportAccess = resolveWebFeatureAccess(subscription, 'customer_profile_exports');
  const autoEmailWarnings = useMemo(
    () => buildCustomerAutoEmailWarnings(recurringRules, customerInvoices),
    [customerInvoices, recurringRules]
  );
  useEffect(() => {
    setReminderTone(reminderStyleToTimelineTone(reminderPreferences.reminderStyle));
  }, [reminderPreferences.reminderStyle]);

  const reminderMessage =
    activeWorkspace && customer
      ? renderReminderTemplate(reminderPreferences.whatsappReminderTemplate, {
          businessName: activeWorkspace.businessName,
          customerName: customer.name,
          balance: formatCurrency(customer.balance, currency),
        }) ||
        buildReminderMessage({
          businessName: activeWorkspace.businessName,
          customerName: customer.name,
          balanceLabel: formatCurrency(customer.balance, currency),
          tone: reminderTone,
        })
      : '';

  function updateProfileField(field: keyof CustomerProfileFormState, value: string) {
    setProfileDraft((current) =>
      current
        ? field === 'stateCode'
          ? {
              ...current,
              stateCode: value,
              city: getIndianCityOptions(value).includes(current.city)
                ? current.city
                : getDefaultIndianCity(value),
            }
          : { ...current, [field]: value }
        : current
    );
  }

  async function saveCustomerProfile() {
    if (!activeWorkspace || !customer || !profileDraft) {
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }

    const nameError = validateName(profileDraft.name, 'Customer name', true);
    const legalNameError = validateBusinessName(profileDraft.legalName, 'Legal / business name', false);
    const phoneError = validatePhone(profileDraft.phone, activeWorkspace.countryCode || 'IN', false);
    const emailError = validateEmail(profileDraft.email, false);
    const openingBalanceValue = parseAmount(profileDraft.openingBalance);
    const creditLimitValue = parseAmount(profileDraft.creditLimit);
    if (
      nameError ||
      legalNameError ||
      phoneError ||
      emailError ||
      (profileDraft.openingBalance.trim() && openingBalanceValue === null) ||
      (profileDraft.creditLimit.trim() && creditLimitValue === null)
    ) {
      showToast(nameError || legalNameError || phoneError || emailError || 'Fix the highlighted profile amounts before saving.', 'danger');
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
        town: profileDraft.town,
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

  async function saveTimelineNote() {
    if (!activeWorkspace || !customer || !noteBody.trim()) {
      showToast('Add a note before saving.', 'danger');
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }
    setIsSavingFollowUp(true);
    try {
      const note = await addWorkspaceCustomerTimelineNote(activeWorkspace.workspaceId, {
        customerId: customer.id,
        kind: noteKind,
        body: noteBody,
      });
      setTimelineNotes((current) => [note, ...current]);
      setNoteBody('');
      setNoteKind('note');
      showToast('Customer note saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Note could not be saved.', 'danger');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function savePaymentPromise() {
    if (!activeWorkspace || !customer) {
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }
    const promisedAmount = parseAmount(promiseAmount);
    if (!promisedAmount || !promiseDate) {
      showToast('Add promise amount and date before saving.', 'danger');
      return;
    }
    setIsSavingFollowUp(true);
    try {
      const promise = await addWorkspacePaymentPromise(activeWorkspace.workspaceId, {
        customerId: customer.id,
        promisedAmount,
        promisedDate: promiseDate,
        note: promiseNote,
      });
      setPaymentPromises((current) => [promise, ...current].sort(sortPromisesForView));
      setPromiseAmount('');
      setPromiseDate(new Date().toISOString().slice(0, 10));
      setPromiseNote('');
      showToast('Payment promise saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment promise could not be saved.', 'danger');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function savePaymentReminder() {
    if (!activeWorkspace || !customer) {
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }
    setIsSavingFollowUp(true);
    try {
      const reminder = await addWorkspacePaymentReminder(activeWorkspace.workspaceId, {
        customerId: customer.id,
        tone: reminderTone,
        message: reminderMessage,
        balanceAtSend: customer.balance,
        sharedVia: 'web_review',
      });
      setPaymentReminders((current) => [reminder, ...current]);
      showToast('Reminder saved to timeline.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Reminder could not be saved.', 'danger');
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  async function changePromiseStatus(promiseId: string, nextStatus: WorkspacePaymentPromiseStatus) {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }
    setIsSavingFollowUp(true);
    try {
      const updated = await updateWorkspacePaymentPromiseStatus(activeWorkspace.workspaceId, promiseId, nextStatus);
      setPaymentPromises((current) =>
        current.map((promise) => (promise.id === promiseId ? updated : promise)).sort(sortPromisesForView)
      );
      showToast('Payment promise updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Promise could not be updated.', 'danger');
    } finally {
      setIsSavingFollowUp(false);
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
    if (!officeAccess.can('export_reports')) {
      showToast(officeAccess.getLockedMessage('export_reports'), 'info');
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
    if (!customerExportAccess.allowed) {
      showToast(customerExportAccess.message ?? 'Customer profile exports are not included in your plan.', 'info');
      return;
    }
    if (!officeAccess.can('export_documents')) {
      showToast(officeAccess.getLockedMessage('export_documents'), 'info');
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
    if (!customerExportAccess.allowed) {
      showToast(customerExportAccess.message ?? 'Customer profile exports are not included in your plan.', 'info');
      return;
    }
    if (!officeAccess.can('export_documents')) {
      showToast(officeAccess.getLockedMessage('export_documents'), 'info');
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
        <button className="ol-button-secondary" type="button" disabled={!customer || !customerExportAccess.allowed || !officeAccess.can('export_documents')} onClick={() => void exportCustomerPdf()}>
          Export customer PDF
        </button>
        <button className="ol-button-secondary" type="button" disabled={!customer || !customerExportAccess.allowed || !officeAccess.can('export_documents')} onClick={exportCustomerProfileCsv}>
          Export customer CSV
        </button>
      </div>

      {!customerExportAccess.allowed ? (
        <div className="ol-message" style={{ marginTop: 12 }}>
          {customerExportAccess.message}
        </div>
      ) : null}

      {status ? <div className="ol-message ol-message--danger">{status}</div> : null}

      {customer ? (
        <>
          <section className="ol-metric-grid">
            <Metric label="Balance" value={formatCurrency(customer.balance, currency)} tone="warning" />
            <Metric label="Credits" value={formatCurrency(totals.credits, currency)} tone="primary" />
            <Metric label="Payments" value={formatCurrency(totals.payments, currency)} tone="success" />
            <Metric label="Health" value={`${customer.health.label} ${customer.health.score}/100`} tone={customer.health.tone === 'danger' ? 'warning' : customer.health.tone} />
          </section>

          {autoEmailWarnings.length ? (
            <section className="ol-panel-glass">
              <div className="ol-panel-title" style={{ marginBottom: 12 }}>
                Auto email review
              </div>
              <div className="ol-list">
                {autoEmailWarnings.map((warning) => (
                  <Link className="ol-list-item ol-list-action" href={`/invoices/automation?ruleId=${encodeURIComponent(warning.ruleId)}` as Route} key={warning.id}>
                    <div className="ol-list-icon">E</div>
                    <div className="ol-list-copy">
                      <div className="ol-list-title">{warning.title}</div>
                      <div className="ol-list-text">{warning.message}</div>
                      <span className="ol-action-link">View auto email settings</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

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

          {trustMemory ? (
            <section className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Customer trust memory</div>
                  <p className="ol-panel-copy">{trustMemory.summary}</p>
                </div>
                <span className="ol-chip ol-chip--primary">{trustMemory.timeline.length} memories</span>
              </div>
              <div className="ol-trust-memory-grid">
                {trustMemory.summaryCards.map((card) => (
                  <TrustMemoryCard card={card} key={card.id} />
                ))}
              </div>
            </section>
          ) : null}

          {profileDraft ? (
            <section className="ol-panel-glass">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Customer profile</div>
                  <p className="ol-panel-copy">Optional details used for exports, invoices, statements, and follow-up context.</p>
                </div>
                <button className="ol-button" type="button" disabled={isSavingProfile || !officeAccess.can('manage_customers')} onClick={() => void saveCustomerProfile()}>
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
                    <label className="ol-field">
                      <span className="ol-field-label">Country</span>
                      <select className="ol-select" disabled value={INDIA_COUNTRY.code}>
                        <option value={INDIA_COUNTRY.code}>{INDIA_COUNTRY.name}</option>
                      </select>
                    </label>
                    <label className="ol-field">
                      <span className="ol-field-label">State</span>
                      <select className="ol-select" value={profileDraft.stateCode || 'GJ'} onChange={(event) => updateProfileField('stateCode', event.target.value)}>
                        {INDIAN_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ol-field">
                      <span className="ol-field-label">City</span>
                      <select className="ol-select" value={profileDraft.city || getDefaultIndianCity(profileDraft.stateCode || 'GJ')} onChange={(event) => updateProfileField('city', event.target.value)}>
                        {getIndianCityOptions(profileDraft.stateCode || 'GJ').map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                    </label>
                    <CustomerField label="Town / village" value={profileDraft.town} onChange={(value) => updateProfileField('town', value)} />
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
                    <CustomerTemplateSelect
                      isPro={subscription.isPro}
                      label="Preferred invoice template"
                      templates={invoiceTemplates}
                      value={profileDraft.preferredInvoiceTemplate}
                      onChange={(value) => updateProfileField('preferredInvoiceTemplate', value)}
                    />
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

          <section className="ol-page-grid ol-page-grid--2">
            <article className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Trust timeline</div>
                  <p className="ol-panel-copy">Money, reminders, promises, disputes, and notes in one readable history.</p>
                </div>
                <label className="ol-field" style={{ minWidth: 180 }}>
                  <span className="ol-field-label">View</span>
                  <select
                    className="ol-select"
                    value={timelineFilter}
                    onChange={(event) => setTimelineFilter(event.target.value as CustomerTrustMemoryFilter)}
                  >
                    {trustMemory?.filters.map((filter) => (
                      <option key={filter.id} value={filter.id}>
                        {filter.label} ({filter.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ol-form-band" style={{ marginBottom: 16 }}>
                <div className="ol-form-band-grid">
                  <label className="ol-field">
                    <span className="ol-field-label">Note type</span>
                    <select className="ol-select" value={noteKind} onChange={(event) => setNoteKind(event.target.value as 'note' | 'dispute')}>
                      <option value="note">Note</option>
                      <option value="dispute">Dispute</option>
                    </select>
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Important note</span>
                    <input className="ol-input" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="What should the business remember?" />
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Action</span>
                    <button className="ol-button-secondary" type="button" disabled={isSavingFollowUp || !officeAccess.can('manage_customers')} onClick={() => void saveTimelineNote()}>
                      Save note
                    </button>
                  </div>
                </div>
              </div>
              <div className="ol-list">
                {visibleTimelineEvents.map((event) => (
                  <div className="ol-list-item" key={event.id}>
                    <div className="ol-list-icon" data-tone={event.tone}>{trustMemoryIcon(event.category)}</div>
                    <div className="ol-list-copy">
                      <div className="ol-list-title">
                        {event.title} · <span className="ol-status-text" data-tone={event.tone}>{event.meta}</span>
                      </div>
                      <div className="ol-list-text">{formatDateTime(event.occurredAt)} · {event.detail}</div>
                    </div>
                  </div>
                ))}
                {!visibleTimelineEvents.length ? <div className="ol-empty">No timeline items for this view yet.</div> : null}
              </div>
            </article>

            <article className="ol-panel">
              <div className="ol-panel-header">
                <div>
                  <div className="ol-panel-title">Promises and follow-up</div>
                  <p className="ol-panel-copy">Record what the customer promised and keep reminder history visible.</p>
                </div>
                <span className="ol-chip ol-chip--warning">{paymentPromises.filter((promise) => promise.status === 'open').length} open</span>
              </div>
              <div className="ol-form-stack">
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <CustomerField label="Promised amount" value={promiseAmount} onChange={setPromiseAmount} />
                    <label className="ol-field">
                      <span className="ol-field-label">Promised date</span>
                      <input className="ol-input" type="date" value={promiseDate} onChange={(event) => setPromiseDate(event.target.value)} />
                    </label>
                    <CustomerField label="Promise note" value={promiseNote} onChange={setPromiseNote} />
                    <div className="ol-field ol-field--action">
                      <span className="ol-field-label">Action</span>
                      <button className="ol-button" type="button" disabled={isSavingFollowUp || !officeAccess.can('manage_customers')} onClick={() => void savePaymentPromise()}>
                        Save promise
                      </button>
                    </div>
                  </div>
                </div>
                <div className="ol-form-band">
                  <div className="ol-form-band-grid">
                    <label className="ol-field">
                      <span className="ol-field-label">Reminder tone</span>
                      <select className="ol-select" value={reminderTone} onChange={(event) => setReminderTone(event.target.value as WorkspacePaymentReminderTone)}>
                        <option value="polite">Polite</option>
                        <option value="firm">Firm</option>
                        <option value="final">Final</option>
                      </select>
                    </label>
                    <label className="ol-field">
                      <span className="ol-field-label">Reminder message</span>
                      <textarea className="ol-textarea" readOnly value={reminderMessage} />
                    </label>
                    <div className="ol-field ol-field--action">
                      <span className="ol-field-label">Action</span>
                      <button className="ol-button-secondary" type="button" disabled={isSavingFollowUp || !customer.balance || !officeAccess.can('manage_customers')} onClick={() => void savePaymentReminder()}>
                        Save reminder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ol-list" style={{ marginTop: 16 }}>
                {paymentPromises.map((promise) => (
                  <div className="ol-list-item" key={promise.id}>
                    <div className="ol-list-icon">P</div>
                    <div className="ol-list-copy">
                      <div className="ol-list-title">
                        {formatCurrency(promise.promisedAmount, currency)} · {getPromiseStatusLabel(promise.status, promise.promisedDate, new Date().toISOString().slice(0, 10))}
                      </div>
                      <div className="ol-list-text">
                        Due {promise.promisedDate}{promise.note ? ` · ${promise.note}` : ''}
                      </div>
                      {promise.status === 'open' || promise.status === 'missed' ? (
                        <div className="ol-inline-actions">
                          <button className="ol-button-secondary" type="button" disabled={isSavingFollowUp || !officeAccess.can('manage_customers')} onClick={() => void changePromiseStatus(promise.id, 'fulfilled')}>
                            Mark fulfilled
                          </button>
                          <button className="ol-button-ghost" type="button" disabled={isSavingFollowUp || !officeAccess.can('manage_customers')} onClick={() => void changePromiseStatus(promise.id, 'missed')}>
                            Mark missed
                          </button>
                          <button className="ol-button-ghost" type="button" disabled={isSavingFollowUp || !officeAccess.can('manage_customers')} onClick={() => void changePromiseStatus(promise.id, 'cancelled')}>
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!paymentPromises.length ? <div className="ol-empty">No payment promises saved yet.</div> : null}
              </div>
            </article>
          </section>

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
                <button className="ol-button" type="button" disabled={!filteredTransactions.length || !officeAccess.can('export_reports')} onClick={exportCustomerTransactions}>
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

function TrustMemoryCard({ card }: { card: CustomerTrustMemorySummaryCard }) {
  return (
    <article className="ol-trust-memory-card" data-tone={card.tone}>
      <span className="ol-trust-memory-label">{card.label}</span>
      <strong>{card.value}</strong>
      <p>{card.helper}</p>
    </article>
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

function CustomerTemplateSelect({
  isPro,
  label,
  onChange,
  templates,
  value,
}: {
  label: string;
  isPro: boolean;
  templates: WebDocumentTemplate[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <select className="ol-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Use business default</option>
        {templates.map((template) => (
          <option disabled={template.tier === 'pro' && !isPro} key={template.key} value={template.key}>
            {template.tier === 'pro' ? `${template.label} · Pro Plus` : `${template.label} · Free`}
          </option>
        ))}
      </select>
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
    city: customer.city ?? getDefaultIndianCity(customer.stateCode ?? 'GJ'),
    town: customer.town ?? '',
    stateCode: customer.stateCode ?? 'GJ',
    countryCode: INDIA_COUNTRY.code,
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

function sortPromisesForView(left: WorkspacePaymentPromise, right: WorkspacePaymentPromise): number {
  const weight: Record<WorkspacePaymentPromiseStatus, number> = {
    open: 0,
    missed: 1,
    fulfilled: 2,
    cancelled: 3,
  };
  return (
    weight[left.status] - weight[right.status] ||
    left.promisedDate.localeCompare(right.promisedDate) ||
    right.createdAt.localeCompare(left.createdAt)
  );
}

function trustMemoryIcon(category: CustomerTrustMemoryCategory): string {
  switch (category) {
    case 'money':
      return 'M';
    case 'documents':
      return 'D';
    case 'promises':
      return 'P';
    case 'reminders':
      return 'R';
    case 'disputes':
      return '!';
    case 'notes':
      return 'N';
  }
}

function buildCustomerAutoEmailWarnings(
  rules: WorkspaceRecurringInvoiceRule[],
  invoices: WorkspaceInvoice[],
  today = new Date().toISOString().slice(0, 10)
) {
  return rules
    .filter((rule) => rule.status === 'active' && rule.emailEnabled && rule.nextEmailDate && daysBetween(today, rule.nextEmailDate) <= 3)
    .map((rule) => {
      const billingMonth = rule.nextEmailDate?.slice(0, 7) ?? today.slice(0, 7);
      const monthInvoices = invoices.filter(
        (invoice) =>
          (invoice.billingMonth ?? invoice.issueDate.slice(0, 7)) === billingMonth &&
          invoice.documentState !== 'cancelled' &&
          !invoice.isArchived
      );
      const selectedInvoice = monthInvoices.find((invoice) => invoice.useForMonthlyAutoEmail);
      return {
        id: rule.id,
        ruleId: rule.id,
        title:
          rule.emailApprovalRequired || !rule.emailAutomationApproved
            ? 'Automatic email needs approval'
            : selectedInvoice
              ? 'Automatic email is scheduled'
              : monthInvoices.length
                ? 'Invoice exists but is not selected'
                : 'Monthly invoice will be prepared',
        message:
          rule.emailApprovalRequired || !rule.emailAutomationApproved
            ? 'Review and approve this customer email before automatic sending resumes.'
            : selectedInvoice
              ? `The latest selected invoice version will be sent on ${rule.nextEmailDate}.`
              : monthInvoices.length
                ? 'Choose whether the existing invoice should be used for this month’s automatic email.'
                : `No invoice is selected yet for the ${rule.nextEmailDate} email.`,
      };
    });
}

function daysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return 0;
  }
  return Math.ceil((toTime - fromTime) / 86_400_000);
}

function formatDateTime(value: string): string {
  if (!value) {
    return 'No date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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
