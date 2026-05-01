'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getInvoiceDocumentStateLabel,
  getInvoicePaymentStatusLabel,
  getPaymentModeConfig,
  PAYMENT_MODE_CONFIGS,
  summarizePaymentMode,
  type InvoiceDocumentState,
  type InvoicePaymentStatus,
  type PaymentMode,
  type PaymentModeDetails,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  createWorkspaceInvoicePayment,
  getWorkspaceInvoiceDetail,
  listWorkspaceInvoicePaymentAllocations,
  listWorkspaceCustomers,
  saveWorkspaceInvoiceDetail,
  type WorkspaceCustomer,
  type WorkspaceInvoiceDetail,
  type WorkspaceInvoicePaymentAllocation,
} from '@/lib/workspace-data';
import {
  buildInvoiceWebDocument,
  buildPaymentRequestMessage,
  downloadInvoiceCsv,
  downloadInvoicePdf,
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
  const [paymentStatus, setPaymentStatus] = useState<InvoicePaymentStatus>('unpaid');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentDetails, setPaymentDetails] = useState<PaymentModeDetails>({});
  const [allocations, setAllocations] = useState<WorkspaceInvoicePaymentAllocation[]>([]);
  const [revisionReason, setRevisionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([emptyItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
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
      listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoiceId),
    ])
      .then(([nextInvoice, nextCustomers, nextAllocations]) => {
        setCustomers(nextCustomers);
        setAllocations(nextAllocations);
        if (!nextInvoice) {
          setMessage('Invoice could not be found.');
          return;
        }
        setInvoice(nextInvoice);
        const nextDueAmount = Math.max(nextInvoice.totalAmount - nextInvoice.paidAmount, 0);
        setPaymentAmount(nextDueAmount > 0 ? formatAmountInput(nextDueAmount) : '');
        setPaymentDate(new Date().toISOString().slice(0, 10));
        setPaymentNote(`Payment for invoice ${nextInvoice.invoiceNumber}`);
        setCustomerId(nextInvoice.customerId ?? '');
        setInvoiceNumber(nextInvoice.invoiceNumber);
        setIssueDate(nextInvoice.issueDate);
        setDueDate(nextInvoice.dueDate ?? '');
        setPaymentStatus(nextInvoice.paymentStatus);
        setRevisionReason('');
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
  const dueAmount = invoice ? Math.max(total - invoice.paidAmount, 0) : 0;
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
      status: invoice.documentState,
      documentState: invoice.documentState,
      paymentStatus,
      notes,
      totalAmount: total,
      paidAmount: invoice.paidAmount,
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
  }, [activeWorkspace, customerId, dueDate, invoice, invoiceNumber, issueDate, items, notes, paymentStatus, selectedCustomer, selectedTemplate?.key, total]);

  async function saveInvoice(
    nextPaymentStatus = paymentStatus,
    reason = revisionReason,
    documentState?: InvoiceDocumentState
  ) {
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
        documentState,
        paymentStatus: nextPaymentStatus,
        revisionReason: reason,
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
      setPaymentStatus(updated.paymentStatus);
      setRevisionReason('');
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

  async function downloadInvoiceDocument() {
    if (!currentInvoiceDocument) {
      return;
    }
    try {
      await downloadInvoicePdf(currentInvoiceDocument);
      showToast('Invoice PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice PDF could not be downloaded.', 'danger');
    }
  }

  function downloadInvoiceCsvFile() {
    if (!currentInvoiceDocument) {
      return;
    }
    downloadInvoiceCsv(currentInvoiceDocument);
    showToast('Invoice CSV downloaded.', 'success');
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

  async function markPaymentStatus(nextPaymentStatus: InvoicePaymentStatus) {
    setPaymentStatus(nextPaymentStatus);
    await saveInvoice(
      nextPaymentStatus,
      nextPaymentStatus === 'paid' ? 'Payment marked received' : 'Payment status updated'
    );
  }

  async function recordInvoicePayment(amountOverride?: number) {
    if (!activeWorkspace || !invoice) {
      return;
    }
    const amountToSave = amountOverride ?? parseMoney(paymentAmount);
    if (!invoice.customerId && !customerId) {
      showToast('Choose a customer before recording payment.', 'danger');
      return;
    }
    if (amountToSave <= 0) {
      showToast('Enter a payment amount before saving.', 'danger');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const updated = await createWorkspaceInvoicePayment(activeWorkspace.workspaceId, invoice.id, {
        amount: amountToSave,
        effectiveDate: paymentDate,
        note: paymentNote,
        paymentMode,
        paymentDetails,
      });
      const nextAllocations = await listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoice.id);
      setInvoice(updated);
      setPaymentStatus(updated.paymentStatus);
      setAllocations(nextAllocations);
      const nextDueAmount = Math.max(updated.totalAmount - updated.paidAmount, 0);
      setPaymentAmount(nextDueAmount > 0 ? formatAmountInput(nextDueAmount) : '');
      setPaymentNote(`Payment for invoice ${updated.invoiceNumber}`);
      setPaymentMode('cash');
      setPaymentDetails({});
      showToast('Payment recorded and applied to this invoice.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment could not be recorded.', 'danger');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function cancelInvoice() {
    if (!window.confirm('Cancel this invoice? This keeps the history but marks the document as cancelled.')) {
      return;
    }

    await saveInvoice(paymentStatus, 'Invoice cancelled', 'cancelled');
  }

  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-actions ol-actions--sticky">
        <Link className="ol-button-secondary" href="/invoices">
          Back to invoices
        </Link>
        <button className="ol-button-secondary" type="button" onClick={viewPdf} disabled={!currentInvoiceDocument}>
          View / print PDF
        </button>
        <button className="ol-button-secondary" type="button" onClick={() => void downloadInvoiceDocument()} disabled={!currentInvoiceDocument}>
          Download PDF
        </button>
        <button className="ol-button-secondary" type="button" onClick={downloadInvoiceCsvFile} disabled={!currentInvoiceDocument}>
          Download CSV
        </button>
        <button className="ol-button-secondary" type="button" onClick={() => void copyPaymentMessage()} disabled={!currentInvoiceDocument || total <= 0}>
          Copy payment message
        </button>
        <button className="ol-button-secondary" type="button" onClick={() => void recordInvoicePayment(dueAmount)} disabled={isRecordingPayment || !invoice || dueAmount <= 0}>
          Record full payment
        </button>
        <button className="ol-button-secondary" type="button" onClick={() => void cancelInvoice()} disabled={isSaving || !invoice || invoice.documentState === 'cancelled'}>
          Cancel invoice
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
            <div className="ol-review-grid" style={{ marginTop: 16 }}>
              <Review label="Document state" value={getInvoiceDocumentStateLabel(invoice.documentState)} />
              <Review label="Payment state" value={getInvoicePaymentStatusLabel(paymentStatus)} />
              <Review label="Latest version" value={invoice.versionNumber ? `v${invoice.versionNumber}` : 'Not saved yet'} />
              <Review label="Saved history" value={`${invoice.versions?.length ?? 0} version${(invoice.versions?.length ?? 0) === 1 ? '' : 's'}`} />
            </div>
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">Revision note</span>
              <input
                className="ol-input"
                placeholder={invoice.documentState === 'draft' ? 'First saved invoice' : 'What changed?'}
                value={revisionReason}
                onChange={(event) => setRevisionReason(event.target.value)}
              />
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
            <Metric label="Paid" value={formatCurrency(invoice.paidAmount, currency)} tone="success" />
            <Metric label="Amount due" value={formatCurrency(Math.max(total - invoice.paidAmount, 0), currency)} tone="warning" />
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Payment allocation</div>
                <p className="ol-panel-copy">
                  Record a confirmed payment here so invoice status follows real allocated money.
                </p>
              </div>
              <span className={`ol-chip ol-chip--${paymentStatus === 'paid' ? 'success' : paymentStatus === 'overdue' ? 'warning' : 'primary'}`}>
                {getInvoicePaymentStatusLabel(paymentStatus)}
              </span>
            </div>
            <div className="ol-form-row ol-form-row--4">
              <label className="ol-field">
                <span className="ol-field-label">Payment amount</span>
                <input
                  className="ol-input ol-amount"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment date</span>
                <input className="ol-input" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment mode</span>
                <select
                  className="ol-select"
                  value={paymentMode}
                  onChange={(event) => {
                    setPaymentMode(event.target.value as PaymentMode);
                    setPaymentDetails({});
                  }}
                >
                  {PAYMENT_MODE_CONFIGS.map((config) => (
                    <option key={config.mode} value={config.mode}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment note</span>
                <input className="ol-input" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
              </label>
              <PaymentModeFields details={paymentDetails} mode={paymentMode} onChange={setPaymentDetails} />
              <div className="ol-field ol-field--action">
                <span className="ol-field-label">Action</span>
                <button className="ol-button" type="button" disabled={isRecordingPayment || dueAmount <= 0} onClick={() => void recordInvoicePayment()}>
                  {isRecordingPayment ? 'Recording...' : 'Record payment'}
                </button>
              </div>
            </div>
            <div className="ol-review-grid" style={{ marginTop: 16 }}>
              <Review label="Allocated" value={formatCurrency(invoice.paidAmount, currency)} />
              <Review label="Still due" value={formatCurrency(Math.max(invoice.totalAmount - invoice.paidAmount, 0), currency)} />
              <Review label="Payment records" value={`${allocations.length}`} />
            </div>
            <div className="ol-list" style={{ marginTop: 16 }}>
              {allocations.map((allocation) => (
                <div className="ol-list-item" key={allocation.id}>
                  <div className="ol-list-icon">Pay</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{formatCurrency(allocation.amount, currency)}</div>
                    <div className="ol-list-text">
                      {summarizePaymentMode(allocation.paymentMode, allocation.paymentDetails)} · {allocation.transactionEffectiveDate || allocation.createdAt.slice(0, 10)}
                      {allocation.transactionNote ? ` · ${allocation.transactionNote}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {!allocations.length ? (
                <div className="ol-empty">No payments are allocated to this invoice yet.</div>
              ) : null}
            </div>
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

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Invoice history</div>
                <p className="ol-panel-copy">
                  Saved versions stay available for review, export, and correction.
                </p>
              </div>
            </div>
            <div className="ol-list">
              {(invoice.versions ?? []).map((version) => (
                <div className="ol-list-item" key={version.id}>
                  <div className="ol-list-icon">v{version.versionNumber}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">
                      {version.invoiceNumber} · {formatCurrency(version.totalAmount, currency)}
                    </div>
                    <div className="ol-list-text">
                      {formatDateTime(version.createdAt)} · {version.reason} · {getInvoiceDocumentStateLabel(version.documentState)} · {getInvoicePaymentStatusLabel(version.paymentStatus)}
                    </div>
                  </div>
                  <Link className="ol-button-secondary" href={`/invoices/detail?invoiceId=${encodeURIComponent(version.invoiceId)}`}>
                    Update
                  </Link>
                </div>
              ))}
              {!(invoice.versions ?? []).length ? (
                <div className="ol-empty">Save this invoice to create version v1.</div>
              ) : null}
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

function formatAmountInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function PaymentModeFields({
  details,
  mode,
  onChange,
}: {
  details: PaymentModeDetails;
  mode: PaymentMode;
  onChange: (details: PaymentModeDetails) => void;
}) {
  const config = getPaymentModeConfig(mode);
  const update = (field: keyof PaymentModeDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  if (mode === 'cash') {
    return null;
  }

  return (
    <>
      {['cheque', 'demand_draft', 'bank_transfer', 'upi', 'wallet'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Reference</span>
          <input className="ol-input" value={details.referenceNumber ?? ''} onChange={(event) => update('referenceNumber', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft', 'bank_transfer'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Bank</span>
          <input className="ol-input" value={details.bankName ?? ''} onChange={(event) => update('bankName', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft'].includes(mode) ? (
        <>
          <label className="ol-field">
            <span className="ol-field-label">Branch</span>
            <input className="ol-input" value={details.branchName ?? ''} onChange={(event) => update('branchName', event.target.value)} />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Instrument date</span>
            <input className="ol-input" type="date" value={details.instrumentDate ?? ''} onChange={(event) => update('instrumentDate', event.target.value)} />
          </label>
        </>
      ) : null}
      {mode === 'upi' ? (
        <label className="ol-field">
          <span className="ol-field-label">UPI ID</span>
          <input className="ol-input" value={details.upiId ?? ''} onChange={(event) => update('upiId', event.target.value)} />
        </label>
      ) : null}
      {mode === 'card' ? (
        <label className="ol-field">
          <span className="ol-field-label">Card last 4</span>
          <input className="ol-input" inputMode="numeric" maxLength={4} value={details.cardLastFour ?? ''} onChange={(event) => update('cardLastFour', event.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
      ) : null}
      {mode === 'wallet' ? (
        <label className="ol-field">
          <span className="ol-field-label">Provider</span>
          <input className="ol-input" value={details.provider ?? ''} onChange={(event) => update('provider', event.target.value)} />
        </label>
      ) : null}
      {mode === 'other' ? (
        <label className="ol-field">
          <span className="ol-field-label">Payment detail</span>
          <input className="ol-input" value={details.note ?? ''} onChange={(event) => update('note', event.target.value)} />
        </label>
      ) : null}
      <div className="ol-field">
        <span className="ol-field-label">Mode note</span>
        <div className="ol-message ol-message--success" style={{ margin: 0 }}>{config.helper}</div>
      </div>
    </>
  );
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

function formatDateTime(value: string) {
  if (!value) {
    return 'Time not saved';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
