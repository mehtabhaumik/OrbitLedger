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
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');

  useEffect(() => {
    if (!activeWorkspace || !invoiceId) {
      setMessageTone('danger');
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
          setMessageTone('danger');
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
        setItems(
          nextInvoice.items.length
            ? nextInvoice.items.map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description ?? '',
                quantity: String(item.quantity),
                price: String(item.price),
                taxRate: String(item.taxRate),
              }))
            : [emptyItem()]
        );
      })
      .catch((error) => {
        setMessageTone('danger');
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

  async function saveInvoice() {
    if (!activeWorkspace || !invoice) {
      return;
    }

    if (!invoiceNumber.trim() || !issueDate.trim()) {
      setMessageTone('danger');
      setMessage('Add an invoice number and issue date before saving.');
      return;
    }

    const hasInvalidItem = items.some(
      (item) =>
        item.name.trim() &&
        (parseMoney(item.quantity) <= 0 || parseMoney(item.price) < 0 || parseMoney(item.taxRate) < 0)
    );
    if (hasInvalidItem) {
      setMessageTone('danger');
      setMessage('Check item quantity, price, and tax before saving.');
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
      setMessageTone('success');
      setMessage('Invoice saved.');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Invoice could not be saved.');
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

  function exportInvoice() {
    if (!invoice) {
      return;
    }
    const selectedCustomer = customers.find((customer) => customer.id === customerId);
    const html = buildInvoiceHtml({
      businessName: activeWorkspace?.businessName ?? 'Orbit Ledger',
      customerName: selectedCustomer?.name ?? 'Customer',
      currency,
      invoiceNumber,
      issueDate,
      dueDate,
      status,
      notes,
      items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total,
    });
    const blob = new Blob([html], { type: 'text/html' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${invoiceNumber || invoice.id}.html`;
    link.click();
    URL.revokeObjectURL(href);
  }

  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-actions">
        <Link className="ol-button-secondary" href="/invoices">
          Back to invoices
        </Link>
        <button className="ol-button-secondary" type="button" onClick={exportInvoice} disabled={!invoice}>
          Export document
        </button>
        <button className="ol-button" type="button" onClick={() => void saveInvoice()} disabled={isSaving || !invoice}>
          {isSaving ? 'Saving...' : 'Save invoice'}
        </button>
      </div>

      {message ? (
        <div className={`ol-message${messageTone === 'danger' ? ' ol-message--danger' : ' ol-message--success'}`}>
          {message}
        </div>
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
              <span className="ol-field-label">Notes</span>
              <textarea className="ol-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div className="ol-panel-title">Line items</div>
              <button className="ol-button-secondary" type="button" onClick={() => setItems((current) => [...current, emptyItem()])}>
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
                      <button className="ol-button-secondary" type="button" onClick={() => duplicateItem(index)}>
                        Copy
                      </button>
                      <button className="ol-button-secondary" type="button" onClick={() => removeItem(index)}>
                        Remove
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

function emptyItem(): EditableItem {
  return { name: '', description: '', quantity: '1', price: '0', taxRate: '0' };
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[, ]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
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

function buildInvoiceHtml(input: {
  businessName: string;
  customerName: string;
  currency: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  notes: string;
  items: EditableItem[];
  subtotal: number;
  tax: number;
  total: number;
}) {
  const rows = input.items
    .filter((item) => item.name.trim())
    .map((item) => {
      const lineTotal = parseMoney(item.quantity) * parseMoney(item.price);
      return `<tr><td>${escapeHtml(item.name)}${item.description ? `<br><small>${escapeHtml(item.description)}</small>` : ''}</td><td>${escapeHtml(item.quantity)}</td><td>${formatCurrency(parseMoney(item.price), input.currency)}</td><td>${formatCurrency(lineTotal, input.currency)}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(input.invoiceNumber)}</title><style>body{font-family:Inter,Arial,sans-serif;margin:40px;color:#142033}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #d8e1ef;padding:12px;text-align:left}.total{text-align:right;font-weight:800}</style></head><body><h1>${escapeHtml(input.businessName)}</h1><p>Invoice ${escapeHtml(input.invoiceNumber)} - ${escapeHtml(input.status)}</p><p>Customer: ${escapeHtml(input.customerName)}</p><p>Issue: ${escapeHtml(input.issueDate)} ${input.dueDate ? `- Due: ${escapeHtml(input.dueDate)}` : ''}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Subtotal ${formatCurrency(input.subtotal, input.currency)}</p><p class="total">Tax ${formatCurrency(input.tax, input.currency)}</p><h2 class="total">Total ${formatCurrency(input.total, input.currency)}</h2><p>${escapeHtml(input.notes)}</p></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[char] ?? char;
  });
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
