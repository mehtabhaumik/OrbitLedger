'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import {
  getWorkspaceInvoiceDetail,
  listWorkspaceCustomers,
  saveWorkspaceInvoiceDetail,
  type WorkspaceCustomer,
  type WorkspaceInvoiceDetail,
} from '@/lib/workspace-data';
import {
  buildInvoiceWebDocument,
  buildPaymentRequestMessage,
  downloadDocumentHtml,
  getWebDocumentTemplates,
  openPrintableDocument,
} from '@/lib/web-documents';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type EditableItem = {
  id?: string;
  name: string;
  description: string;
  quantity: string;
  price: string;
  taxRate: string;
};

export default function InvoiceEditorPage() {
  return (
    <Suspense fallback={<InvoiceEditorShell message="Loading invoice..." />}>
      <InvoiceEditorContent />
    </Suspense>
  );
}

function InvoiceEditorContent() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get('invoiceId') ?? '';
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [invoice, setInvoice] = useState<WorkspaceInvoiceDetail | null>(null);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([emptyItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState('');
  const invoiceTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'invoice') : [];
  const selectedTemplate = invoiceTemplates.find((template) => template.key === templateKey) ?? invoiceTemplates[0];

  const defaultTaxRate = useMemo(
    () => getDefaultInvoiceTaxRate(activeWorkspace?.countryCode, selectedTemplate?.countryFormat),
    [activeWorkspace?.countryCode, selectedTemplate?.countryFormat]
  );

  useEffect(() => {
    if (!activeWorkspace || !invoiceId) {
      setMessage(invoiceId ? null : 'Choose an invoice from the invoice list.');
      return;
    }
    setMessage(null);
    void Promise.all([
      getWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoiceId),
      listWorkspaceCustomers(activeWorkspace.workspaceId),
    ])
      .then(([nextInvoice, nextCustomers]) => {
        setCustomers(nextCustomers);
        if (!nextInvoice) {
          setMessage('Invoice could not be found.');
          return;
        }
        setInvoice(nextInvoice);
        setCustomerId(nextInvoice.customerId ?? '');
        setInvoiceNumber(nextInvoice.invoiceNumber);
        setIssueDate(nextInvoice.issueDate);
        setDueDate(nextInvoice.dueDate ?? '');
        setStatus(nextInvoice.status);
        setNotes(nextInvoice.notes ?? '');
        const nextDefaultTaxRate = getDefaultInvoiceTaxRate(activeWorkspace.countryCode);
        setItems(
          nextInvoice.items.length
            ? nextInvoice.items.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description ?? '',
                quantity: String(item.quantity),
                price: String(item.price),
                taxRate: String(item.taxRate || nextDefaultTaxRate),
              }))
            : [emptyItem(nextDefaultTaxRate)]
        );
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Invoice could not be loaded.');
      });
  }, [activeWorkspace, invoiceId]);

  const totals = useMemo(() => {
    return items.reduce(
      (summary, item) => {
        const quantity = parseMoney(item.quantity);
        const price = parseMoney(item.price);
        const taxRate = parseMoney(item.taxRate);
        const subtotal = quantity * price;
        summary.subtotal += subtotal;
        summary.tax += subtotal * (taxRate / 100);
        return summary;
      },
      { subtotal: 0, tax: 0 }
    );
  }, [items]);
  const total = totals.subtotal + totals.tax;
  const currency = activeWorkspace?.currency ?? 'INR';
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const currentInvoiceDocument = useMemo(() => {
    if (!activeWorkspace || !invoice) {
      return null;
    }
    const documentInvoice: WorkspaceInvoiceDetail = {
      ...invoice,
      customerId: customerId || null,
      invoiceNumber,
      issueDate,
      dueDate: dueDate || null,
      status,
      notes,
      totalAmount: total,
      items: items
        .filter((item) => item.name.trim())
        .map((item, index) => {
          const quantity = parseMoney(item.quantity);
          const price = parseMoney(item.price);
          const taxRate = parseMoney(item.taxRate);
          const subtotal = quantity * price;
          return {
            id: item.id ?? `draft-${index}`,
            invoiceId: invoice.id,
            productId: null,
            name: item.name.trim(),
            description: item.description.trim() || null,
            quantity,
            price,
            taxRate,
            total: subtotal + subtotal * (taxRate / 100),
          };
        }),
    };
    return buildInvoiceWebDocument({
      workspace: activeWorkspace,
      invoice: documentInvoice,
      customer: selectedCustomer,
      templateKey: selectedTemplate?.key,
    });
  }, [activeWorkspace, customerId, dueDate, invoice, invoiceNumber, issueDate, items, notes, selectedCustomer, selectedTemplate?.key, status, total]);

  async function saveInvoice() {
    if (!activeWorkspace || !invoice) {
      return;
    }

    if (!invoiceNumber.trim() || !issueDate.trim()) {
      showToast('Add an invoice number and issue date before saving.', 'danger');
      return;
    }

    const hasInvalidItem = items.some(
      (item) =>
        item.name.trim() &&
        (parseMoney(item.quantity) <= 0 || parseMoney(item.price) < 0 || parseMoney(item.taxRate) < 0)
    );
    if (hasInvalidItem) {
      showToast('Check item quantity, price, and tax before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await saveWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoice.id, {
        customerId: customerId || null,
        invoiceNumber,
        issueDate,
        dueDate: dueDate || null,
        status,
        notes,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          quantity: parseMoney(item.quantity),
          price: parseMoney(item.price),
          taxRate: parseMoney(item.taxRate),
        })),
      });
      setInvoice(updated);
      showToast('Invoice saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function updateItem(index: number, field: keyof EditableItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  }

  function duplicateItem(index: number) {
    setItems((current) => {
      const item = current[index];
      return item ? [...current.slice(0, index + 1), { ...item, id: undefined }, ...current.slice(index + 1)] : current;
    });
  }

  function removeItem(index: number) {
    setItems((current) => {
      if (current.length === 1) {
        return [emptyItem()];
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function viewPdf() {
    if (!currentInvoiceDocument) {
      return;
    }
    try {
      openPrintableDocument(currentInvoiceDocument.html);
      showToast('Invoice opened. Choose Save as PDF in the print window.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice PDF could not be opened.', 'danger');
    }
  }

  function downloadInvoiceDocument() {
    if (!currentInvoiceDocument) {
      return;
    }
    downloadDocumentHtml(currentInvoiceDocument.fileName, currentInvoiceDocument.html);
    showToast('Invoice document downloaded.', 'success');
  }

  async function copyPaymentMessage() {
    if (!activeWorkspace || !currentInvoiceDocument) {
      return;
    }
    const messageText = buildPaymentRequestMessage({
      businessName: activeWorkspace.businessName,
      customerName: selectedCustomer?.name ?? 'Customer',
      amount: total,
      currency,
      documentLabel: 'invoice',
      documentNumber: invoiceNumber,
    });
    await navigator.clipboard.writeText(messageText);
    showToast('Payment message copied.', 'success');
  }

  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-actions">
        <Link className="ol-button-secondary" href="/invoices">
          Back to invoices
        </Link>
        <button className="ol-button-secondary" type="button" onClick={viewPdf} disabled={!currentInvoiceDocument}>
          View / save PDF
        </button>
        <button className="ol-button-secondary" type="button" onClick={downloadInvoiceDocument} disabled={!currentInvoiceDocument}>
          Download document
        </button>
        <button className="ol-button-secondary" type="button" onClick={() => void copyPaymentMessage()} disabled={!currentInvoiceDocument || total <= 0}>
          Copy payment message
        </button>
        <button className="ol-button" type="button" onClick={() => void saveInvoice()} disabled={isSaving || !invoice}>
          {isSaving ? 'Saving...' : 'Save invoice'}
        </button>
      </div>

      {message ? (
        <div className="ol-message ol-message--danger">{message}</div>
      ) : null}

      {invoice ? (
        <>
          <section className="ol-panel">
            <div className="ol-form-row ol-form-row--4">
              <label className="ol-field">
                <span className="ol-field-label">Customer</span>
                <select className="ol-select" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">No customer selected</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Invoice number</span>
                <input className="ol-input" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Issue date</span>
                <input className="ol-input" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Due date</span>
                <input className="ol-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">Status</span>
              <select className="ol-select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">PDF template</span>
              <select
                className="ol-select"
                value={templateKey || selectedTemplate?.key || ''}
                onChange={(event) => setTemplateKey(event.target.value)}
              >
                {invoiceTemplates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.tier === 'pro' ? `${template.label} · Pro` : template.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">Notes</span>
              <textarea className="ol-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div className="ol-panel-title">Line items</div>
              <button className="ol-button-secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem(defaultTaxRate)])}>
                Add item
              </button>
            </div>
            <div className="ol-form-grid">
              {items.map((item, index) => (
                <div className="ol-form-row ol-form-row--invoice-item" key={`${item.id ?? 'new'}-${index}`}>
                  <label className="ol-field">
                    <span className="ol-field-label">Item</span>
                    <input className="ol-input" value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Description</span>
                    <input className="ol-input" value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Qty</span>
                    <input className="ol-input ol-amount" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Price</span>
                    <input className="ol-input ol-amount" inputMode="decimal" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Tax %</span>
                    <input className="ol-input ol-amount" inputMode="decimal" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} />
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Line</span>
                    <div className="ol-inline-actions">
                      <button
                        aria-label="Copy line"
                        className="ol-button-secondary ol-icon-button"
                        title="Copy line"
                        type="button"
                        onClick={() => duplicateItem(index)}
                      >
                        <CopyIcon />
                      </button>
                      <button
                        aria-label="Remove line"
                        className="ol-button-secondary ol-icon-button ol-icon-button--danger"
                        title="Remove line"
                        type="button"
                        onClick={() => removeItem(index)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ol-metric-grid">
            <Metric label="Subtotal" value={formatCurrency(totals.subtotal, currency)} tone="primary" />
            <Metric label="Tax" value={formatCurrency(totals.tax, currency)} tone="warning" />
            <Metric label="Total" value={formatCurrency(total, currency)} tone="success" />
          </section>

          <section className="ol-panel-glass">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">PDF readiness</div>
                <p className="ol-panel-copy">
                  The PDF uses the same country-ready template catalog, Pro access, branding rules,
                  and payment message flow across Orbit Ledger.
                </p>
              </div>
              <span className={`ol-chip ${currentInvoiceDocument?.template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
                {currentInvoiceDocument?.template.label ?? 'Template'}
              </span>
            </div>
            <div className="ol-review-grid">
              <Review label="PDF name" value={currentInvoiceDocument?.fileName ?? 'Save invoice details first'} />
              <Review label="Tax format" value={currentInvoiceDocument?.template.countryFormat?.replace(/_/g, ' ') ?? 'Local'} />
              <Review label="PDF style" value={currentInvoiceDocument?.pdfStyle === 'advanced' ? 'Advanced' : 'Basic'} />
              <Review label="Customer" value={selectedCustomer?.name ?? 'Unlinked customer'} />
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function InvoiceEditorShell({ message }: { message: string }) {
  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-message ol-message--success">{message}</div>
    </AppShell>
  );
}

function emptyItem(taxRate = 0): EditableItem {
  return { name: '', description: '', quantity: '1', price: '0', taxRate: formatTaxRateInput(taxRate) };
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[, ]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDefaultInvoiceTaxRate(countryCode?: string | null, countryFormat?: string | null): number {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (normalizedCountryCode === 'IN' || countryFormat === 'india_gst') {
    return 18;
  }
  if (normalizedCountryCode === 'GB' || countryFormat === 'uk_vat') {
    return 20;
  }
  return 0;
}

function formatTaxRateInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'warning' | 'success' }) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">Invoice calculation.</div>
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

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path
        d="M8 8.5c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7c-1.1 0-2-.9-2-2v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5 15.5V6.75c0-1.24 1.01-2.25 2.25-2.25H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path
        d="M6.5 7l.7 12.2A2 2 0 0 0 9.2 21h5.6a2 2 0 0 0 2-1.8L17.5 7M9 7l.6-2h4.8L15 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
