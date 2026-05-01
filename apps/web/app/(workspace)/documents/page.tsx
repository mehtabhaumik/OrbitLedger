'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  buildPaymentRequestMessage,
  buildStatementWebDocument,
  downloadDocumentHtml,
  getWebDocumentTemplates,
  openPrintableDocument,
} from '@/lib/web-documents';
import {
  listWorkspaceCustomerTransactions,
  listWorkspaceCustomers,
  type WorkspaceCustomer,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function DocumentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void listWorkspaceCustomers(activeWorkspace.workspaceId).then((nextCustomers) => {
      setCustomers(nextCustomers);
      setCustomerId((current) => current || nextCustomers[0]?.id || '');
    });
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || !customerId) {
      setTransactions([]);
      return;
    }
    setIsLoading(true);
    void listWorkspaceCustomerTransactions(activeWorkspace.workspaceId, customerId)
      .then(setTransactions)
      .catch((error) => showToast(error instanceof Error ? error.message : 'Customer activity could not be loaded.', 'danger'))
      .finally(() => setIsLoading(false));
  }, [activeWorkspace, customerId, showToast]);

  const customer = customers.find((entry) => entry.id === customerId) ?? null;
  const templates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'statement') : [];
  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? templates[0];
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
      templateKey: selectedTemplate?.key,
    });
  }, [activeWorkspace, customer, dateFrom, dateTo, selectedTemplate?.key, transactions]);

  function viewPdf() {
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

  function downloadStatement() {
    if (!statement) {
      return;
    }
    downloadDocumentHtml(statement.fileName, statement.html);
    showToast('Statement document downloaded.', 'success');
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

  return (
    <AppShell title="Documents" subtitle="Create customer statements and PDF-ready business documents.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Customer statement</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Review the statement, open the print window, then save as PDF or print from the browser.
            </p>
          </div>
          <span className={`ol-chip ${selectedTemplate?.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
            {selectedTemplate?.tier === 'pro' ? 'Pro template' : 'Free template'}
          </span>
        </div>

        <div className="ol-form-row ol-form-row--4">
          <label className="ol-field">
            <span className="ol-field-label">Customer</span>
            <select className="ol-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
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
                <option key={template.key} value={template.key}>
                  {template.tier === 'pro' ? `${template.label} · Pro` : template.label}
                </option>
              ))}
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
        </div>

        <div className="ol-actions" style={{ marginTop: 16 }}>
          <button className="ol-button" type="button" disabled={!statement || isLoading} onClick={viewPdf}>
            View / save PDF
          </button>
          <button className="ol-button-secondary" type="button" disabled={!statement || isLoading} onClick={downloadStatement}>
            Download document
          </button>
          <button className="ol-button-secondary" type="button" disabled={!customer || customer.balance <= 0} onClick={() => void copyPaymentMessage()}>
            Copy payment message
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
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
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

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
