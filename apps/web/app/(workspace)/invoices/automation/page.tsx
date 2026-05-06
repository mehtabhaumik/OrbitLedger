'use client';

import Link from 'next/link';
import type { Route } from 'next';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import {
  cancelWorkspaceRecurringInvoiceRule,
  listWorkspaceCustomers,
  listWorkspaceProducts,
  listWorkspaceRecurringEmailQueue,
  listWorkspaceRecurringInvoiceRules,
  saveWorkspaceRecurringInvoiceRule,
  type SaveWorkspaceRecurringInvoiceRuleInput,
  type WorkspaceCustomer,
  type WorkspaceProduct,
  type WorkspaceRecurringEmailQueueItem,
  type WorkspaceRecurringInvoiceRule,
} from '@/lib/workspace-data';
import { resolveWebFeatureAccess } from '@/lib/web-monetization';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type RecurringInvoiceFormItem = {
  id?: string;
  productId?: string | null;
  name: string;
  description: string;
  quantity: string;
  price: string;
  taxRate: string;
};

type RecurringInvoiceFormState = {
  name: string;
  customerId: string;
  startDate: string;
  endDate: string;
  invoiceDay: string;
  dueDays: string;
  invoiceNumberPrefix: string;
  notes: string;
  emailEnabled: boolean;
  emailRecipient: string;
  emailDay: string;
  emailSubject: string;
  emailBody: string;
  emailIncludePaymentLink: boolean;
  emailAttachPdf: boolean;
  emailCurrentMonthOnly: boolean;
  approveEmailAutomation: boolean;
  items: RecurringInvoiceFormItem[];
};

export default function InvoiceAutomationPage() {
  const { activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ruleId = searchParams.get('ruleId');
  const customerIdFromQuery = searchParams.get('customerId');
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [rules, setRules] = useState<WorkspaceRecurringInvoiceRule[]>([]);
  const [emailQueue, setEmailQueue] = useState<WorkspaceRecurringEmailQueueItem[]>([]);
  const [form, setForm] = useState<RecurringInvoiceFormState>(() => defaultRecurringForm());
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const recurringAutoEmailAccess = resolveWebFeatureAccess(subscription, 'recurring_auto_email');
  const editingRule = useMemo(() => rules.find((rule) => rule.id === ruleId) ?? null, [ruleId, rules]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId) ?? null,
    [customers, form.customerId]
  );

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    async function loadAutomation() {
      if (!activeWorkspace) {
        return;
      }
      const [nextCustomers, nextProducts, nextRules, nextEmailQueue] = await Promise.all([
        listWorkspaceCustomers(activeWorkspace.workspaceId),
        listWorkspaceProducts(activeWorkspace.workspaceId),
        listWorkspaceRecurringInvoiceRules(activeWorkspace.workspaceId),
        listWorkspaceRecurringEmailQueue(activeWorkspace.workspaceId, ruleId),
      ]);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setRules(nextRules);
      setEmailQueue(nextEmailQueue);
      const rule = ruleId ? nextRules.find((entry) => entry.id === ruleId) : null;
      if (rule) {
        setForm(formFromRule(rule));
      } else {
        const draft = defaultRecurringForm(activeWorkspace);
        const presetCustomer = customerIdFromQuery
          ? nextCustomers.find((customer) => customer.id === customerIdFromQuery)
          : null;
        setForm({
          ...draft,
          customerId: presetCustomer?.id ?? '',
          emailRecipient: presetCustomer?.email ?? '',
        });
      }
    }

    void loadAutomation().catch((error) => {
      showToast(error instanceof Error ? error.message : 'Monthly automation could not be loaded.', 'danger');
    });
  }, [activeWorkspace, customerIdFromQuery, ruleId, showToast]);

  function updateItem(index: number, field: keyof RecurringInvoiceFormItem, value: string) {
    setForm((current) => ({
      ...current,
      approveEmailAutomation: false,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((entry) => entry.id === productId);
    setForm((current) => ({
      ...current,
      approveEmailAutomation: false,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? product
            ? {
                ...item,
                productId: product.id,
                name: product.name,
                price: String(product.price),
              }
            : { ...item, productId: null }
          : item
      ),
    }));
  }

  async function saveAutomation() {
    if (!activeWorkspace) {
      return;
    }
    if (!recurringAutoEmailAccess.allowed) {
      showToast(recurringAutoEmailAccess.message ?? 'Monthly auto email is not included in your plan.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveWorkspaceRecurringInvoiceRule(
        activeWorkspace.workspaceId,
        recurringFormToInput(form),
        editingRule?.id
      );
      showToast(saved.emailAutomationApproved ? 'Monthly auto email approved and saved.' : 'Monthly auto email saved for review.', 'success');
      router.push('/invoices' as Route);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Monthly auto email could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function pauseAutomation() {
    if (!activeWorkspace || !editingRule) {
      return;
    }
    setIsCancelling(true);
    try {
      await cancelWorkspaceRecurringInvoiceRule(activeWorkspace.workspaceId, editingRule.id);
      showToast('Automatic email paused.', 'success');
      router.push('/invoices' as Route);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Automatic email could not be paused.', 'danger');
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <AppShell title="Monthly auto email" subtitle="Create customer-specific monthly invoice and email rules.">
      <div className="ol-inline-actions" style={{ marginBottom: 18 }}>
        <Link className="ol-button-secondary" href={'/invoices' as Route}>
          Back to invoices
        </Link>
      </div>

      <section className="ol-panel-glass">
        <div className="ol-section-heading">
          <div>
            <div className="ol-panel-title">{editingRule ? 'View / edit auto email' : 'New auto email'}</div>
            <p className="ol-panel-copy">
              Orbit Ledger prepares the invoice before the email date, then sends only after this rule is approved.
            </p>
          </div>
          <ApprovalSummary rule={editingRule} />
        </div>

        {!recurringAutoEmailAccess.allowed ? (
          <div className="ol-message" style={{ marginBottom: 18 }}>
            {recurringAutoEmailAccess.message}
          </div>
        ) : null}

        <div className="ol-form-grid ol-form-grid--comfortable">
          <label className="ol-field">
            <span className="ol-field-label">Rule name</span>
            <input
              className="ol-input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Customer</span>
            <select
              className="ol-select"
              value={form.customerId}
              onChange={(event) => {
                const customer = customers.find((entry) => entry.id === event.target.value);
                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                  emailRecipient: customer?.email || current.emailRecipient,
                  approveEmailAutomation: false,
                }));
              }}
            >
              <option value="">Choose customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Start date</span>
            <input
              className="ol-input"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">End date</span>
            <input
              className="ol-input"
              type="date"
              value={form.endDate}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value, approveEmailAutomation: false }))}
            />
            <span className="ol-helper">Leave empty to continue until you pause it.</span>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Prepare invoice on</span>
            <select
              className="ol-select"
              value={form.invoiceDay}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  invoiceDay: event.target.value,
                  emailDay: current.emailDay === current.invoiceDay ? event.target.value : current.emailDay,
                  approveEmailAutomation: false,
                }))
              }
            >
              {monthlyDayOptions().map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
            <span className="ol-helper">Day 31 automatically becomes the last day for shorter months.</span>
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Due days</span>
            <input
              className="ol-input"
              inputMode="numeric"
              value={form.dueDays}
              onChange={(event) => setForm((current) => ({ ...current, dueDays: event.target.value.replace(/\D/g, ''), approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Invoice prefix</span>
            <input
              className="ol-input"
              value={form.invoiceNumberPrefix}
              onChange={(event) => setForm((current) => ({ ...current, invoiceNumberPrefix: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field ol-field--wide">
            <span className="ol-field-label">Notes</span>
            <textarea
              className="ol-textarea"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
        </div>
      </section>

      <section className="ol-panel-glass">
        <div className="ol-panel-title" style={{ marginBottom: 12 }}>
          Invoice lines
        </div>
        <div className="ol-stack">
          {form.items.map((item, index) => (
            <div className="ol-form-grid ol-form-grid--comfortable" key={item.id ?? index}>
              <label className="ol-field">
                <span className="ol-field-label">Product</span>
                <select className="ol-select" value={item.productId ?? ''} onChange={(event) => selectProduct(index, event.target.value)}>
                  <option value="">Custom item</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
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
                <input className="ol-input" inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Price</span>
                <input className="ol-input" inputMode="decimal" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Tax %</span>
                <input className="ol-input" inputMode="decimal" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} />
              </label>
            </div>
          ))}
          <div className="ol-inline-actions">
            <button
              className="ol-button-secondary"
              type="button"
              onClick={() => setForm((current) => ({ ...current, approveEmailAutomation: false, items: [...current.items, emptyRecurringItem()] }))}
            >
              Add line
            </button>
            {form.items.length > 1 ? (
              <button
                className="ol-button-secondary"
                type="button"
                onClick={() => setForm((current) => ({ ...current, approveEmailAutomation: false, items: current.items.slice(0, -1) }))}
              >
                Remove last line
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="ol-panel-glass">
        <div className="ol-section-heading">
          <div>
            <div className="ol-panel-title">Email settings</div>
            <p className="ol-panel-copy">
              These settings apply only to {selectedCustomer?.name ?? 'this customer'}. They start from the saved business defaults and can be adjusted here.
            </p>
          </div>
        </div>
        <div className="ol-form-grid ol-form-grid--comfortable">
          <label className="ol-checkbox-row ol-field--wide">
            <input
              className="ol-checkbox"
              checked={form.emailEnabled}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, emailEnabled: event.target.checked, approveEmailAutomation: false }))}
            />
            <span>Send invoice email automatically</span>
          </label>
          <label className="ol-checkbox-row ol-field--wide">
            <input
              className="ol-checkbox"
              checked={form.emailCurrentMonthOnly}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, emailCurrentMonthOnly: event.target.checked, approveEmailAutomation: false }))}
            />
            <span>Do not email past-month catch-up invoices automatically</span>
          </label>
          <div className="ol-field-help ol-field--wide" style={{ maxWidth: 'none' }}>
            Past catch-up invoices stay in review unless you send them yourself.
          </div>
          <label className="ol-field">
            <span className="ol-field-label">Recipient email</span>
            <input
              className="ol-input"
              value={form.emailRecipient}
              onChange={(event) => setForm((current) => ({ ...current, emailRecipient: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Send email on</span>
            <select
              className="ol-select"
              value={form.emailDay}
              onChange={(event) => setForm((current) => ({ ...current, emailDay: event.target.value, approveEmailAutomation: false }))}
            >
              {monthlyDayOptions().map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
            <span className="ol-helper">Shorter months use the last valid day.</span>
          </label>
          <label className="ol-checkbox-row">
            <input
              className="ol-checkbox"
              checked={form.emailAttachPdf}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, emailAttachPdf: event.target.checked, approveEmailAutomation: false }))}
            />
            <span>Attach invoice PDF</span>
          </label>
          <label className="ol-checkbox-row">
            <input
              className="ol-checkbox"
              checked={form.emailIncludePaymentLink}
              type="checkbox"
              onChange={(event) => setForm((current) => ({ ...current, emailIncludePaymentLink: event.target.checked, approveEmailAutomation: false }))}
            />
            <span>Include payment link</span>
          </label>
          <label className="ol-field ol-field--wide">
            <span className="ol-field-label">Email subject</span>
            <input
              className="ol-input"
              value={form.emailSubject}
              onChange={(event) => setForm((current) => ({ ...current, emailSubject: event.target.value, approveEmailAutomation: false }))}
            />
          </label>
          <label className="ol-field ol-field--wide">
            <span className="ol-field-label">Email body</span>
            <textarea
              className="ol-textarea"
              rows={8}
              value={form.emailBody}
              onChange={(event) => setForm((current) => ({ ...current, emailBody: event.target.value, approveEmailAutomation: false }))}
            />
            <span className="ol-helper">
              Available tokens: {'{{customerName}}'}, {'{{invoiceNumber}}'}, {'{{invoiceDate}}'}, {'{{dueDate}}'}, {'{{amountDue}}'}, {'{{paymentLink}}'}, {'{{businessName}}'}, {'{{businessPhone}}'}, {'{{businessEmail}}'}.
            </span>
          </label>
        </div>
      </section>

      <section className="ol-panel-glass">
        <label className="ol-checkbox-row">
          <input
            className="ol-checkbox"
            checked={form.approveEmailAutomation}
            type="checkbox"
            onChange={(event) => setForm((current) => ({ ...current, approveEmailAutomation: event.target.checked }))}
          />
          <span>I approve this customer&apos;s automatic monthly invoice email.</span>
        </label>
        <p className="ol-helper" style={{ marginTop: 8 }}>
          Automatic emails pause after meaningful changes until this approval is renewed.
        </p>
        <div className="ol-inline-actions" style={{ marginTop: 18 }}>
          <button className="ol-button" disabled={isSaving || !recurringAutoEmailAccess.allowed} type="button" onClick={() => void saveAutomation()}>
            {isSaving ? 'Saving...' : 'Save auto email'}
          </button>
          {editingRule && editingRule.status === 'active' ? (
            <button className="ol-button-secondary" disabled={isCancelling} type="button" onClick={() => void pauseAutomation()}>
              {isCancelling ? 'Pausing...' : 'Pause this email'}
            </button>
          ) : null}
        </div>
      </section>

      {editingRule ? (
        <section className="ol-panel-glass">
          <div className="ol-section-heading">
            <div>
              <div className="ol-panel-title">Queue preview and send history</div>
              <p className="ol-panel-copy">
                Review what is waiting to go out and what has already happened for this customer rule.
              </p>
            </div>
          </div>
          {emailQueue.length ? (
            <div className="ol-list" style={{ marginTop: 18 }}>
              {emailQueue.map((item) => (
                <article className="ol-list-item" key={item.id}>
                  <div className="ol-list-icon">{item.status === 'sent' ? 'S' : 'Q'}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">
                      {item.invoiceNumber ?? 'Invoice email'}
                      <EmailQueueStatusBadge status={item.status} />
                    </div>
                    <div className="ol-list-text">
                      {formatEmailQueueStatus(item.status)} · {formatQueueDate(item.sentAt ?? item.scheduledFor)}
                      {item.recipientEmail ? ` · ${item.recipientEmail}` : ''}
                    </div>
                    {item.subject ? <div className="ol-list-text">Subject: {item.subject}</div> : null}
                    {item.body ? <div className="ol-list-text">{trimQueuePreview(item.body)}</div> : null}
                    <div className="ol-list-text">
                      {item.attachPdf ? 'PDF attached' : 'No PDF attachment'} · {item.includePaymentLink ? 'Payment link included' : 'No payment link'}
                    </div>
                    {item.lastError ? <div className="ol-list-text">Needs attention: {item.lastError}</div> : null}
                  </div>
                  {item.invoiceId ? (
                    <Link className="ol-button-secondary" href={`/invoices/detail?invoiceId=${encodeURIComponent(item.invoiceId)}` as Route}>
                      View invoice
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="ol-empty" style={{ marginTop: 18 }}>
              No queued or sent automatic emails for this customer rule yet.
            </div>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}

function ApprovalSummary({ rule }: { rule: WorkspaceRecurringInvoiceRule | null }) {
  if (!rule) {
    return <span className="ol-chip ol-chip--tax">Approval required</span>;
  }
  if (rule.emailApprovalRequired || !rule.emailAutomationApproved) {
    return <span className="ol-chip ol-chip--tax">Review and approve changes</span>;
  }
  return (
    <span className="ol-chip ol-chip--success">
      Approved {rule.emailAutomationApprovedAt ? `on ${rule.emailAutomationApprovedAt.slice(0, 10)}` : ''}
    </span>
  );
}

function defaultRecurringForm(workspace?: OrbitWorkspaceSummary | null): RecurringInvoiceFormState {
  const today = new Date().toISOString().slice(0, 10);
  const day = String(Number(today.slice(8, 10)));
  const configuredEmailDay =
    workspace?.defaultRecurringEmailSendDayBehavior === 'custom_day' && workspace.defaultRecurringEmailDay
      ? String(workspace.defaultRecurringEmailDay)
      : day;
  return {
    name: 'Monthly service invoice',
    customerId: '',
    startDate: today,
    endDate: '',
    invoiceDay: day,
    dueDays: String(workspace?.defaultDueDays ?? 7),
    invoiceNumberPrefix: 'AUTO',
    notes: '',
    emailEnabled: false,
    emailRecipient: '',
    emailDay: configuredEmailDay,
    emailSubject: workspace?.defaultRecurringEmailSubject ?? defaultRecurringEmailSubject(),
    emailBody: workspace?.defaultRecurringEmailBody ?? defaultRecurringEmailBody(),
    emailIncludePaymentLink: workspace?.defaultRecurringEmailIncludePaymentLink !== false,
    emailAttachPdf: workspace?.defaultRecurringEmailAttachPdf !== false,
    emailCurrentMonthOnly: workspace?.defaultRecurringEmailCurrentMonthOnly !== false,
    approveEmailAutomation: false,
    items: [emptyRecurringItem()],
  };
}

function formFromRule(rule: WorkspaceRecurringInvoiceRule): RecurringInvoiceFormState {
  return {
    name: rule.name,
    customerId: rule.customerId,
    startDate: rule.startDate,
    endDate: rule.endDate ?? '',
    invoiceDay: String(rule.invoiceDay),
    dueDays: String(rule.dueDays),
    invoiceNumberPrefix: rule.invoiceNumberPrefix,
    notes: rule.notes ?? '',
    emailEnabled: rule.emailEnabled,
    emailRecipient: rule.emailRecipient ?? '',
    emailDay: String(rule.emailDay ?? rule.invoiceDay),
    emailSubject: rule.emailSubject ?? defaultRecurringEmailSubject(),
    emailBody: rule.emailBody ?? defaultRecurringEmailBody(),
    emailIncludePaymentLink: rule.emailIncludePaymentLink,
    emailAttachPdf: rule.emailAttachPdf,
    emailCurrentMonthOnly: rule.emailCurrentMonthOnly,
    approveEmailAutomation: rule.emailAutomationApproved && !rule.emailApprovalRequired,
    items: rule.items.length
      ? rule.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          description: item.description ?? '',
          quantity: String(item.quantity),
          price: String(item.price),
          taxRate: String(item.taxRate),
        }))
      : [emptyRecurringItem()],
  };
}

function emptyRecurringItem(): RecurringInvoiceFormItem {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: null,
    name: '',
    description: '',
    quantity: '1',
    price: '0',
    taxRate: '0',
  };
}

function recurringFormToInput(form: RecurringInvoiceFormState): SaveWorkspaceRecurringInvoiceRuleInput {
  return {
    name: form.name,
    customerId: form.customerId,
    startDate: form.startDate,
    endDate: form.endDate || null,
    invoiceDay: Number(form.invoiceDay),
    dueDays: Number(form.dueDays || 0),
    invoiceNumberPrefix: form.invoiceNumberPrefix,
    notes: form.notes,
    emailEnabled: form.emailEnabled,
    emailRecipient: form.emailRecipient,
    emailDay: Number(form.emailDay || form.invoiceDay),
    emailSubject: form.emailSubject,
    emailBody: form.emailBody,
    emailIncludePaymentLink: form.emailIncludePaymentLink,
    emailAttachPdf: form.emailAttachPdf,
    emailCurrentMonthOnly: form.emailCurrentMonthOnly,
    approveEmailAutomation: form.approveEmailAutomation,
    items: form.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? null,
      name: item.name,
      description: item.description,
      quantity: parseNumber(item.quantity),
      price: parseNumber(item.price),
      taxRate: parseNumber(item.taxRate),
    })),
  };
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthlyDayOptions(): number[] {
  return Array.from({ length: 31 }, (_, index) => index + 1);
}

function defaultRecurringEmailSubject(): string {
  return 'Invoice {{invoiceNumber}} from {{businessName}}';
}

function defaultRecurringEmailBody(): string {
  return 'Hello {{customerName}},\n\nYour invoice {{invoiceNumber}} is attached.\n\nYou can pay here:\n{{paymentLink}}\n\nThank you,\n{{businessName}}';
}

function EmailQueueStatusBadge({ status }: { status: string }) {
  const className =
    status === 'sent'
      ? 'ol-chip ol-chip--success'
      : status === 'failed' || status === 'cancelled'
        ? 'ol-chip ol-chip--danger'
        : 'ol-chip ol-chip--tax';
  return (
    <span className={className} style={{ marginLeft: 8 }}>
      {formatEmailQueueStatus(status)}
    </span>
  );
}

function formatEmailQueueStatus(status: string) {
  if (status === 'ready') {
    return 'Ready to send';
  }
  if (status === 'sending') {
    return 'Sending';
  }
  if (status === 'sent') {
    return 'Sent';
  }
  if (status === 'failed') {
    return 'Needs review';
  }
  if (status === 'cancelled') {
    return 'Stopped';
  }
  return 'Scheduled';
}

function formatQueueDate(value: string | null | undefined) {
  if (!value) {
    return 'not scheduled';
  }
  const timestamp = Date.parse(value.includes('T') ? value : `${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    ...(value.includes('T') ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(timestamp));
}

function trimQueuePreview(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}
