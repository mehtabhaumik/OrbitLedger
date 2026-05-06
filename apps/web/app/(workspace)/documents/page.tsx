'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  buildSmartDocumentPack,
  type SmartDocumentPackItem,
  type SmartDocumentPackSignal,
  type SmartDocumentPackTier,
} from '@orbit-ledger/core';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  buildPaymentRequestMessage,
  buildStatementWebDocument,
  downloadStatementBatchPdf,
  downloadStatementPdf,
  getWebDocumentTemplates,
  openPrintableDocument,
} from '@/lib/web-documents';
import { buildCsv, downloadTextFile, makeExportFileName } from '@/lib/workspace-power';
import {
  createDraftWorkspaceInvoice,
  listWorkspaceInvoices,
  listWorkspaceCustomerTransactions,
  listWorkspaceCustomers,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import {
  getWebFeaturePlanChip,
  resolveWebFeatureAccess,
} from '@/lib/web-monetization';
import { useWebSubscription } from '@/providers/subscription-provider';

export default function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const router = useRouter();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [transactionsByCustomerId, setTransactionsByCustomerId] = useState<Record<string, WorkspaceTransaction[]>>({});
  const [customerId, setCustomerId] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const statementTemplateAccess = resolveWebFeatureAccess(subscription, 'advanced_statement_templates');
  const statementBatchAccess = resolveWebFeatureAccess(subscription, 'batch_statements');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void Promise.all([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceInvoices(activeWorkspace.workspaceId),
    ])
      .then(([nextCustomers, nextInvoices]) => {
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setCustomerId((current) => current || nextCustomers[0]?.id || '');
        setSelectedCustomerIds((current) => (current.size ? current : new Set(nextCustomers[0]?.id ? [nextCustomers[0].id] : [])));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Documents could not load.', 'danger'));
  }, [activeWorkspace, showToast]);

  useEffect(() => {
    if (!activeWorkspace || !selectedCustomerIds.size) {
      setTransactionsByCustomerId({});
      return;
    }
    setIsLoading(true);
    const ids = [...selectedCustomerIds];
    void Promise.all(
      ids.map(async (id) => [id, await listWorkspaceCustomerTransactions(activeWorkspace.workspaceId, id)] as const)
    )
      .then((entries) => {
        setTransactionsByCustomerId(Object.fromEntries(entries));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Customer activity could not be loaded.', 'danger'))
      .finally(() => setIsLoading(false));
  }, [activeWorkspace, selectedCustomerIds, showToast]);

  const customer = customers.find((entry) => entry.id === customerId) ?? null;
  const selectedCustomers = customers.filter((entry) => selectedCustomerIds.has(entry.id));
  const templates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'statement') : [];
  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? templates[0];
  const transactions = customer ? transactionsByCustomerId[customer.id] ?? [] : [];
  const smartDocumentPack = useMemo(() => {
    if (!activeWorkspace) {
      return null;
    }
    return buildSmartDocumentPack({
      businessName: activeWorkspace.businessName,
      currency: activeWorkspace.currency,
      currentTier: mapWebSmartDocumentTier(subscription.tier),
      signals: buildWebSmartDocumentSignals(customers, invoices, activeWorkspace.countryCode),
    });
  }, [activeWorkspace, customers, invoices, subscription.tier]);
  const smartDocumentPackItems = smartDocumentPack?.items.slice(0, 6) ?? [];
  const statement = useMemo(() => {
    if (!activeWorkspace || !customer) {
      return null;
    }
    return buildStatementWebDocument({
      workspace: activeWorkspace,
      customer,
      transactions,
      dateFrom,
      dateTo,
      subscription,
      templateKey: selectedTemplate?.key,
    });
  }, [activeWorkspace, customer, dateFrom, dateTo, selectedTemplate?.key, subscription, transactions]);
  const statementBatch = useMemo(() => {
    if (!activeWorkspace || !selectedCustomers.length) {
      return [];
    }

    return selectedCustomers.map((entry) =>
      buildStatementWebDocument({
        workspace: activeWorkspace,
        customer: entry,
        transactions: transactionsByCustomerId[entry.id] ?? [],
        dateFrom,
        dateTo,
        subscription,
        templateKey: selectedTemplate?.key,
      })
    );
  }, [activeWorkspace, dateFrom, dateTo, selectedCustomers, selectedTemplate?.key, subscription, transactionsByCustomerId]);

  function viewPdf() {
    if (selectedTemplate?.tier === 'pro' && !statementTemplateAccess.allowed) {
      showToast(statementTemplateAccess.message ?? 'This statement template is not included in your plan.', 'info');
      return;
    }
    if (!statement) {
      showToast('Choose a customer before creating a statement.', 'danger');
      return;
    }
    try {
      openPrintableDocument(statement.html);
      showToast('Statement opened. Choose Save as PDF in the print window.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Statement could not be opened.', 'danger');
    }
  }

  async function downloadStatement() {
    if (selectedTemplate?.tier === 'pro' && !statementTemplateAccess.allowed) {
      showToast(statementTemplateAccess.message ?? 'This statement template is not included in your plan.', 'info');
      return;
    }
    if (!statement) {
      return;
    }
    try {
      await downloadStatementPdf(statement);
      showToast('Statement PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Statement PDF could not be downloaded.', 'danger');
    }
  }

  function viewStatementBatch() {
    if (!statementBatchAccess.allowed) {
      showToast(statementBatchAccess.message ?? 'Statement batches are not included in your plan.', 'info');
      return;
    }
    if (!statementBatch.length) {
      showToast('Choose customers before creating a statement batch.', 'danger');
      return;
    }
    try {
      openPrintableDocument(combineStatementBatchHtml(statementBatch.map((entry) => entry.html)));
      showToast('Statement batch opened. Choose Save as PDF in the print window.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Statement batch could not be opened.', 'danger');
    }
  }

  async function downloadStatementBatch() {
    if (!statementBatchAccess.allowed) {
      showToast(statementBatchAccess.message ?? 'Statement batches are not included in your plan.', 'info');
      return;
    }
    if (!statementBatch.length) {
      showToast('Choose customers before downloading a statement batch.', 'danger');
      return;
    }
    try {
      await downloadStatementBatchPdf(statementBatch);
      showToast('Statement batch PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Statement batch PDF could not be downloaded.', 'danger');
    }
  }

  function downloadStatementBatchCsv() {
    if (!statementBatchAccess.allowed) {
      showToast(statementBatchAccess.message ?? 'Statement batches are not included in your plan.', 'info');
      return;
    }
    if (!activeWorkspace || !statementBatch.length) {
      return;
    }

    const csv = buildCsv(
      ['Customer', 'From', 'To', 'Opening balance', 'Credit / charges', 'Payments received', 'Closing balance', 'Entry count'],
      statementBatch.map((entry) => {
        const data = entry.statementData;
        return [
          data.customerName,
          data.from,
          data.to,
          data.openingBalance,
          data.totalCredit,
          data.totalPayment,
          data.closingBalance,
          data.rows.length,
        ];
      })
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, 'statement-batch']), csv);
    showToast('Statement batch CSV downloaded.', 'success');
  }

  function toggleBatchCustomer(nextCustomerId: string) {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(nextCustomerId)) {
        next.delete(nextCustomerId);
      } else {
        next.add(nextCustomerId);
      }
      return next;
    });
    setCustomerId((current) => current || nextCustomerId);
  }

  async function copyPaymentMessage() {
    if (!activeWorkspace || !customer) {
      return;
    }
    const message = buildPaymentRequestMessage({
      businessName: activeWorkspace.businessName,
      customerName: customer.name,
      amount: Math.max(customer.balance, 0),
      currency: activeWorkspace.currency,
      documentLabel: 'statement',
    });
    await navigator.clipboard.writeText(message);
    showToast('Payment message copied.', 'success');
  }

  async function runSmartDocumentAction(item: SmartDocumentPackItem) {
    if (!activeWorkspace) {
      return;
    }
    if (!item.available) {
      router.push('/market' as Route);
      return;
    }

    const targetCustomer = item.customerId ? customers.find((entry) => entry.id === item.customerId) ?? null : null;

    if (item.actionTarget === 'create_invoice') {
      try {
        const invoice = await createDraftWorkspaceInvoice(activeWorkspace.workspaceId, {
          dueDays: activeWorkspace.defaultDueDays,
          notes: activeWorkspace.defaultInvoiceNotes,
          customerId: targetCustomer?.id ?? null,
        });
        showToast(targetCustomer ? `Draft invoice started for ${targetCustomer.name}.` : 'Draft invoice started.', 'success');
        router.push(`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}` as Route);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Invoice could not be started.', 'danger');
      }
      return;
    }

    if (item.actionTarget === 'send_statement') {
      if (targetCustomer) {
        setCustomerId(targetCustomer.id);
        setSelectedCustomerIds(new Set([targetCustomer.id]));
        document.getElementById('customer-statement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`Statement tools are ready for ${targetCustomer.name}.`, 'success');
      } else {
        document.getElementById('customer-statement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (item.actionTarget === 'send_payment_notice' || item.actionTarget === 'send_overdue_notice') {
      if (!targetCustomer) {
        router.push('/customers' as Route);
        return;
      }
      const message = buildPaymentRequestMessage({
        businessName: activeWorkspace.businessName,
        customerName: targetCustomer.name,
        amount: Math.max(item.amountDue ?? targetCustomer.balance, 0),
        currency: activeWorkspace.currency,
        documentLabel: item.actionTarget === 'send_overdue_notice' ? 'overdue notice' : 'payment notice',
      });
      await navigator.clipboard.writeText(message);
      showToast(`${item.actionTarget === 'send_overdue_notice' ? 'Overdue notice' : 'Payment notice'} copied for ${targetCustomer.name}.`, 'success');
      return;
    }

    if (item.actionTarget === 'export_customer_profile') {
      if (targetCustomer) {
        router.push(`/customers/detail?customerId=${encodeURIComponent(targetCustomer.id)}` as Route);
      } else {
        router.push('/customers' as Route);
      }
      return;
    }

    router.push('/reports' as Route);
  }

  return (
    <AppShell title="Documents" subtitle="Create customer statements and PDF-ready business documents.">
      {smartDocumentPack ? (
        <section className="ol-panel ol-smart-document-pack">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Smart Document Pack</div>
              <p className="ol-panel-copy" style={{ maxWidth: 720 }}>
                {smartDocumentPack.summary}
              </p>
            </div>
            <span className="ol-chip ol-chip--primary">
              {smartDocumentPack.recommendedPack ? 'Recommended first' : 'Nothing waiting'}
            </span>
          </div>

          {smartDocumentPack.emptyState ? (
            <div className="ol-message">
              Add customers, invoices, or payments and Orbit Ledger will recommend the right document pack here.
            </div>
          ) : (
            <div className="ol-smart-document-grid">
              {smartDocumentPackItems.map((item) => (
                <SmartDocumentPackCard key={item.id} item={item} onAction={() => void runSmartDocumentAction(item)} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="ol-panel-dark" id="customer-statement">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Customer statement</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Review the statement, open the print window, then save as PDF or print from the browser.
            </p>
          </div>
          <span className={`ol-chip ${selectedTemplate?.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
            {selectedTemplate?.tier === 'pro' ? getWebFeaturePlanChip(subscription, 'advanced_statement_templates') : 'Included in Free'}
          </span>
        </div>

        <div className="ol-form-row ol-form-row--4">
          <label className="ol-field">
            <span className="ol-field-label">Customer</span>
            <select
              className="ol-select"
              value={customerId}
              onChange={(event) => {
                setCustomerId(event.target.value);
                setSelectedCustomerIds((current) => (current.size ? current : new Set(event.target.value ? [event.target.value] : [])));
              }}
            >
              <option value="">Select customer</option>
              {customers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Template</span>
            <select className="ol-select" value={templateKey || selectedTemplate?.key || ''} onChange={(event) => setTemplateKey(event.target.value)}>
              {templates.map((template) => (
                <option disabled={template.tier === 'pro' && !statementTemplateAccess.allowed} key={template.key} value={template.key}>
                  {template.tier === 'pro' ? `${template.label} · Pro Plus` : template.label}
                </option>
              ))}
            </select>
            {!statementTemplateAccess.allowed ? (
              <span className="ol-field-help">Premium statement templates are available with Pro Plus and Office.</span>
            ) : null}
          </label>
          <label className="ol-field">
            <span className="ol-field-label">From</span>
            <input className="ol-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">To</span>
            <input className="ol-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </div>

        <div className="ol-actions ol-actions--sticky" style={{ marginTop: 16 }}>
          <button className="ol-button" type="button" disabled={!statement || isLoading} onClick={viewPdf}>
            View / print PDF
          </button>
          <button className="ol-button-secondary" type="button" disabled={!statement || isLoading} onClick={() => void downloadStatement()}>
            Download PDF
          </button>
          <button className="ol-button-secondary" type="button" disabled={!customer || customer.balance <= 0} onClick={() => void copyPaymentMessage()}>
            Copy payment message
          </button>
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Statement batch</div>
            <p className="ol-panel-copy">
              Select customers and create one PDF with a dedicated statement page for each customer.
            </p>
          </div>
          <span className="ol-chip ol-chip--primary">{selectedCustomers.length} selected</span>
        </div>
        {!statementBatchAccess.allowed ? (
          <div className="ol-message" style={{ marginBottom: 16 }}>
            {statementBatchAccess.message}{' '}
            <Link href={'/market' as Route}>View plans</Link>
          </div>
        ) : null}
        <div className="ol-list" style={{ maxHeight: 360, overflow: 'auto' }}>
          {customers.map((entry) => (
            <label className="ol-list-item ol-list-action" key={entry.id}>
              <input
                className="ol-checkbox"
                checked={selectedCustomerIds.has(entry.id)}
                type="checkbox"
                onChange={() => toggleBatchCustomer(entry.id)}
              />
              <div className="ol-list-copy">
                <div className="ol-list-title">{entry.name}</div>
                <div className="ol-list-text">
                  {formatCurrency(entry.balance, activeWorkspace?.currency ?? 'INR')} balance · {transactionsByCustomerId[entry.id]?.length ?? 0} entries loaded
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className="ol-actions ol-actions--sticky" style={{ marginTop: 16 }}>
          <button className="ol-button" type="button" disabled={!statementBatch.length || isLoading || !statementBatchAccess.allowed} onClick={viewStatementBatch}>
            View / print batch
          </button>
          <button className="ol-button-secondary" type="button" disabled={!statementBatch.length || isLoading || !statementBatchAccess.allowed} onClick={() => void downloadStatementBatch()}>
            Download batch PDF
          </button>
          <button className="ol-button-secondary" type="button" disabled={!statementBatch.length || isLoading || !statementBatchAccess.allowed} onClick={downloadStatementBatchCsv}>
            Download batch CSV
          </button>
        </div>
      </section>

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Statement review
          </div>
          <div className="ol-review-grid">
            <Review label="Customer" value={customer?.name ?? 'Not selected'} />
            <Review label="Balance" value={formatCurrency(customer?.balance ?? 0, activeWorkspace?.currency ?? 'INR')} />
            <Review label="Entries" value={String(transactions.length)} />
            <Review label="PDF name" value={statement?.fileName ?? 'Select a customer'} />
          </div>
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Templates
          </div>
          <div className="ol-list">
            {templates.map((template) => (
              <div className="ol-list-item" key={template.key}>
                <div className="ol-list-icon">{template.tier === 'pro' ? 'P' : 'F'}</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{template.label}</div>
                <div className="ol-list-text">{template.description}</div>
                {template.tier === 'pro' ? (
                  <div className="ol-template-lock-note">{getWebFeaturePlanChip(subscription, 'advanced_statement_templates')}</div>
                ) : null}
              </div>
            </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function combineStatementBatchHtml(htmlDocuments: string[]) {
  const pages = htmlDocuments.map((html) => {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch?.[1] ?? html;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement Batch</title><style>@page{size:A4;margin:0}.statement-batch-page{break-after:page;page-break-after:always}.statement-batch-page:last-child{break-after:auto;page-break-after:auto}</style></head><body>${pages
    .map((page) => `<div class="statement-batch-page">${page}</div>`)
    .join('')}</body></html>`;
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-review-item">
      <span className="ol-review-label">{label}</span>
      <strong className="ol-review-value">{value}</strong>
    </div>
  );
}

function SmartDocumentPackCard({ item, onAction }: { item: SmartDocumentPackItem; onAction: () => void }) {
  return (
    <article className="ol-smart-document-card" data-tone={item.tone}>
      <div className="ol-smart-document-card-top">
        <span className="ol-smart-document-icon">{smartDocumentPackIcon(item.kind)}</span>
        <span className={`ol-chip ${item.available ? 'ol-chip--success' : 'ol-chip--premium'}`}>
          {item.available ? 'Ready' : `${smartDocumentPackTierLabel(item.requiredTier)} plan`}
        </span>
      </div>
      <div>
        <h3>{item.title}</h3>
        <p>{item.message}</p>
      </div>
      <div className="ol-smart-document-meta">
        <span>{item.helper}</span>
        <span>{item.includedDocuments.map(smartDocumentPackKindLabel).join(' + ')}</span>
      </div>
      <button className={item.available ? 'ol-button-secondary' : 'ol-button'} type="button" onClick={onAction}>
        {item.available ? item.actionLabel : 'View plans'}
      </button>
    </article>
  );
}

function buildWebSmartDocumentSignals(
  customers: WorkspaceCustomer[],
  invoices: WorkspaceInvoice[],
  countryCode: string | null | undefined
): SmartDocumentPackSignal[] {
  const activeInvoices = invoices.filter((invoice) => !invoice.isArchived && invoice.documentState !== 'cancelled');
  const signals: SmartDocumentPackSignal[] = [];
  const dueCustomer = customers
    .filter((customer) => customer.balance > 0 && !customer.isArchived)
    .sort((left, right) => right.balance - left.balance)[0];

  if (dueCustomer) {
    const dueInvoiceCount = activeInvoices.filter((invoice) => invoice.customerId === dueCustomer.id && invoice.paymentStatus !== 'paid').length;
    signals.push({
      id: dueCustomer.id,
      kind: 'customer_has_balance',
      customerId: dueCustomer.id,
      customerName: dueCustomer.name,
      amountDue: dueCustomer.balance,
      invoiceCount: dueInvoiceCount,
      hasCustomerEmail: Boolean(dueCustomer.email),
    });
    signals.push({
      id: `${dueCustomer.id}:notice`,
      kind: 'payment_due',
      customerId: dueCustomer.id,
      customerName: dueCustomer.name,
      amountDue: dueCustomer.balance,
      invoiceCount: dueInvoiceCount,
      hasCustomerEmail: Boolean(dueCustomer.email),
    });
    signals.push({
      id: `${dueCustomer.id}:profile`,
      kind: 'customer_review',
      customerId: dueCustomer.id,
      customerName: dueCustomer.name,
      amountDue: dueCustomer.balance,
      invoiceCount: dueInvoiceCount,
    });
  }

  const overdueInvoices = activeInvoices.filter((invoice) => invoice.paymentStatus === 'overdue');
  if (overdueInvoices.length) {
    const overdueInvoice = overdueInvoices[0]!;
    signals.push({
      id: overdueInvoice.id,
      kind: 'invoice_overdue',
      customerId: overdueInvoice.customerId,
      customerName: overdueInvoice.customerName,
      amountDue: Math.max(overdueInvoice.totalAmount - overdueInvoice.paidAmount, 0),
      overdueInvoiceCount: overdueInvoices.length,
      daysOverdue: 1,
      hasCustomerEmail: Boolean(customers.find((customer) => customer.id === overdueInvoice.customerId)?.email),
    });
  }

  const readyInvoice = activeInvoices.find((invoice) => invoice.totalAmount > 0);
  if (readyInvoice) {
    signals.push({
      id: `${readyInvoice.id}:invoice`,
      kind: 'invoice_ready',
      customerId: readyInvoice.customerId,
      customerName: readyInvoice.customerName,
      amountDue: Math.max(readyInvoice.totalAmount - readyInvoice.paidAmount, 0),
      hasPaymentLink: true,
    });
  }

  if (activeInvoices.some((invoice) => invoice.totalAmount > 0)) {
    signals.push({
      id: 'tax-period',
      kind: 'tax_period_review',
      countryCode,
      hasTaxData: true,
      invoiceCount: activeInvoices.length,
    });
  }

  if (activeInvoices.some((invoice) => invoice.versionNumber > 1 || (invoice.versions?.length ?? 0) > 1 || invoice.hasAutoEmailHistory)) {
    signals.push({
      id: 'audit-review',
      kind: 'audit_review',
      needsAuditTrail: true,
      invoiceCount: activeInvoices.length,
      countryCode,
    });
  }

  return signals;
}

function mapWebSmartDocumentTier(tier: 'free' | 'plus' | 'pro' | 'office'): SmartDocumentPackTier {
  return tier === 'pro' ? 'pro_plus' : tier;
}

function smartDocumentPackIcon(kind: SmartDocumentPackItem['kind']) {
  const icons: Record<SmartDocumentPackItem['kind'], string> = {
    invoice: 'INV',
    statement: 'ST',
    payment_notice: 'PAY',
    overdue_notice: 'DUE',
    customer_profile: 'CP',
    tax_summary: 'TAX',
    audit_packet: 'AUD',
  };
  return icons[kind];
}

function smartDocumentPackKindLabel(kind: SmartDocumentPackItem['kind']) {
  const labels: Record<SmartDocumentPackItem['kind'], string> = {
    invoice: 'invoice',
    statement: 'statement',
    payment_notice: 'payment notice',
    overdue_notice: 'overdue notice',
    customer_profile: 'customer profile',
    tax_summary: 'tax summary',
    audit_packet: 'audit packet',
  };
  return labels[kind];
}

function smartDocumentPackTierLabel(tier: SmartDocumentPackTier) {
  const labels: Record<SmartDocumentPackTier, string> = {
    free: 'Free',
    plus: 'Plus',
    pro_plus: 'Pro Plus',
    office: 'Office',
  };
  return labels[tier];
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
