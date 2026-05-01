'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { getWebFirebaseProjectId } from '@/lib/firebase';
import {
  applyWorkspaceProviderEventToInvoice,
  listWorkspaceCustomers,
  listWorkspaceInvoices,
  listWorkspacePaymentProviderEvents,
  markWorkspaceProviderEventReviewed,
  reverseWorkspaceProviderEventPayment,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspacePaymentProviderEvent,
} from '@/lib/workspace-data';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type EventFilter = 'needs_review' | 'applied' | 'reversed' | 'all';

export default function PaymentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [events, setEvents] = useState<WorkspacePaymentProviderEvent[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [filter, setFilter] = useState<EventFilter>('needs_review');
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const projectId = getWebFirebaseProjectId();
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/providerWebhook`;

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void loadPaymentAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId]);

  async function loadPaymentAdminData() {
    if (!activeWorkspace) {
      return;
    }
    setIsLoading(true);
    try {
      const [nextEvents, nextInvoices, nextCustomers] = await Promise.all([
        listWorkspacePaymentProviderEvents(activeWorkspace.workspaceId),
        listWorkspaceInvoices(activeWorkspace.workspaceId),
        listWorkspaceCustomers(activeWorkspace.workspaceId),
      ]);
      setEvents(nextEvents);
      setInvoices(nextInvoices);
      setCustomers(nextCustomers);
      setSelectedInvoices((current) => {
        const next = { ...current };
        for (const event of nextEvents) {
          if (!next[event.id] && event.invoiceId) {
            next[event.id] = event.invoiceId;
          }
        }
        return next;
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment events could not be loaded.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }

  const reviewEvents = useMemo(
    () =>
      events.filter((event) => {
        if (filter === 'all') {
          return true;
        }
        if (filter === 'applied') {
          return event.applied && !event.reversed;
        }
        if (filter === 'reversed') {
          return event.reversed;
        }
        return !event.applied || event.applyStatus === 'needs_review' || event.error;
      }),
    [events, filter]
  );
  const stats = useMemo(
    () => ({
      total: events.length,
      applied: events.filter((event) => event.applied && !event.reversed).length,
      reversed: events.filter((event) => event.reversed).length,
      review: events.filter((event) => !event.applied || event.applyStatus === 'needs_review' || event.error).length,
    }),
    [events]
  );
  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
      ),
    [invoices]
  );

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl);
    showToast('Provider URL copied.', 'success');
  }

  async function copyExamplePayload() {
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          workspaceId: activeWorkspace?.workspaceId ?? 'workspace_id',
          invoiceNumber: 'WEB-641090',
          source: 'payment_page',
          status: 'succeeded',
          amount: 1770,
          currency: activeWorkspace?.currency ?? 'INR',
          reference: 'INV-WEB-641090',
          providerPaymentId: 'provider_payment_id',
          payerName: 'Customer name',
        },
        null,
        2
      )
    );
    showToast('Example payload copied.', 'success');
  }

  async function applyEvent(event: WorkspacePaymentProviderEvent) {
    if (!activeWorkspace) {
      return;
    }
    const invoiceId = selectedInvoices[event.id] || event.invoiceId || '';
    if (!invoiceId) {
      showToast('Choose an invoice before applying this event.', 'danger');
      return;
    }

    setBusyEventId(event.id);
    try {
      await applyWorkspaceProviderEventToInvoice(activeWorkspace.workspaceId, event.id, {
        invoiceId,
        customerId: event.customerId,
        note: reviewNotes[event.id],
      });
      await loadPaymentAdminData();
      showToast('Payment event applied to invoice.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment event could not be applied.', 'danger');
    } finally {
      setBusyEventId(null);
    }
  }

  async function markReviewed(event: WorkspacePaymentProviderEvent) {
    if (!activeWorkspace) {
      return;
    }
    setBusyEventId(event.id);
    try {
      await markWorkspaceProviderEventReviewed(activeWorkspace.workspaceId, event.id, reviewNotes[event.id]);
      await loadPaymentAdminData();
      showToast('Payment event marked reviewed.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment event could not be updated.', 'danger');
    } finally {
      setBusyEventId(null);
    }
  }

  async function reverseEvent(event: WorkspacePaymentProviderEvent) {
    if (!activeWorkspace) {
      return;
    }
    const invoiceId = selectedInvoices[event.id] || event.invoiceId || '';
    if (!event.applied && !invoiceId) {
      showToast('Choose an invoice before reversing this refund.', 'danger');
      return;
    }
    if (!window.confirm('Reverse this payment? This adds a ledger correction and reduces the invoice paid amount.')) {
      return;
    }

    setBusyEventId(event.id);
    try {
      await reverseWorkspaceProviderEventPayment(activeWorkspace.workspaceId, event.id, {
        invoiceId,
        customerId: event.customerId,
        note: reviewNotes[event.id],
      });
      await loadPaymentAdminData();
      showToast('Payment reversed and ledger corrected.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment could not be reversed.', 'danger');
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <AppShell title="Payments" subtitle="Review automatic payment updates and match provider events.">
      <section className="ol-metric-grid">
        <Metric label="Events" value={String(stats.total)} helper="Received from payment providers." tone="primary" />
        <Metric label="Applied" value={String(stats.applied)} helper="Updated invoices automatically." tone="success" />
        <Metric label="Needs Review" value={String(stats.review)} helper="Waiting for owner decision." tone="warning" />
        <Metric label="Reversed" value={String(stats.reversed)} helper="Refunds and payment rollbacks." tone="warning" />
      </section>

      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Automatic Payment Updates</div>
            <p className="ol-panel-copy" style={{ maxWidth: 680 }}>
              Add this URL in your payment provider so paid invoices can update Orbit Ledger automatically.
            </p>
          </div>
          <span className="ol-chip ol-chip--success">Ready</span>
        </div>
        <div className="ol-review-grid">
          <Review label="Provider URL" value={webhookUrl} />
          <Review label="Secret header" value="x-orbit-ledger-webhook-secret" />
          <Review label="Region" value="Asia South" />
          <Review label="Hosted page" value="/pay" />
        </div>
        <div className="ol-actions ol-actions--compact" style={{ marginTop: 16 }}>
          <button className="ol-button" type="button" onClick={() => void copyWebhookUrl()}>
            Copy provider URL
          </button>
          <button className="ol-button-secondary" type="button" onClick={() => void copyExamplePayload()}>
            Copy sample data
          </button>
          <Link className="ol-button-secondary" href="/transactions">
            Record payment manually
          </Link>
        </div>
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">View</span>
            <select className="ol-select" value={filter} onChange={(event) => setFilter(event.target.value as EventFilter)}>
              <option value="needs_review">Needs review</option>
              <option value="applied">Applied</option>
              <option value="reversed">Reversed</option>
              <option value="all">All events</option>
            </select>
          </label>
          <div className="ol-table-actions">
            <button className="ol-button-secondary" disabled={isLoading} type="button" onClick={() => void loadPaymentAdminData()}>
              Refresh
            </button>
          </div>
        </div>
        <div className="ol-table-summary">
          {isLoading ? 'Loading payment events...' : `${reviewEvents.length} payment event${reviewEvents.length === 1 ? '' : 's'} in this view.`}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '0.72fr 0.9fr 0.7fr 1fr 1.2fr' }}>
          <span>Status</span>
          <span>Payment</span>
          <span>Invoice</span>
          <span>Review</span>
          <span>Action</span>
        </div>
        {reviewEvents.map((event) => (
          <div className="ol-table-row" key={event.id} style={{ gridTemplateColumns: '0.72fr 0.9fr 0.7fr 1fr 1.2fr' }}>
            <span>
              <strong>{event.reversed ? 'Reversed' : event.applied ? 'Applied' : formatEventStatus(event)}</strong>
              <br />
              <span className="ol-muted" style={{ fontSize: 13 }}>
                {event.reversedAt ? formatDateTime(event.reversedAt) : formatDateTime(event.createdAt)}
              </span>
            </span>
            <span>
              <strong>{formatCurrency(event.amount, event.currency)}</strong>
              <br />
              <span className="ol-muted" style={{ fontSize: 13 }}>
                {providerLabel(event.source)} · {event.reference ?? event.providerPaymentId ?? 'No reference'}
              </span>
            </span>
            <span>
              {event.invoiceId ? (
                <Link className="ol-link-button" href={`/invoices/detail?invoiceId=${encodeURIComponent(event.invoiceId)}`}>
                  Open invoice
                </Link>
              ) : (
                <span className="ol-muted">Not matched</span>
              )}
            </span>
            <span>
              <select
                className="ol-select"
                disabled={(event.applied && event.status !== 'refunded') || event.reversed}
                value={selectedInvoices[event.id] ?? ''}
                onChange={(input) =>
                  setSelectedInvoices((current) => ({ ...current, [event.id]: input.target.value }))
                }
              >
                <option value="">Choose invoice</option>
                {openInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} · {customerName(invoice.customerId, customers)}
                  </option>
                ))}
              </select>
              <input
                className="ol-input"
                disabled={event.reversed}
                placeholder="Review note"
                style={{ marginTop: 8 }}
                value={reviewNotes[event.id] ?? ''}
                onChange={(input) =>
                  setReviewNotes((current) => ({ ...current, [event.id]: input.target.value }))
                }
              />
            </span>
            <span className="ol-inline-actions">
              <button
                className="ol-button"
                disabled={event.applied || busyEventId === event.id || event.status !== 'succeeded'}
                type="button"
                onClick={() => void applyEvent(event)}
              >
                Apply
              </button>
              <button
                className="ol-button-ghost"
                disabled={event.reversed || busyEventId === event.id || (!event.applied && event.status !== 'refunded')}
                type="button"
                onClick={() => void reverseEvent(event)}
              >
                Reverse
              </button>
              <button
                className="ol-button-secondary"
                disabled={busyEventId === event.id}
                type="button"
                onClick={() => void markReviewed(event)}
              >
                Mark reviewed
              </button>
            </span>
          </div>
        ))}
        {!isLoading && !reviewEvents.length ? (
          <div className="ol-empty">No payment events need attention right now.</div>
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

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-review-card">
      <div className="ol-review-label">{label}</div>
      <div className="ol-review-value">{value}</div>
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

function formatDateTime(value: string) {
  if (!value) {
    return 'Not saved';
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatEventStatus(event: WorkspacePaymentProviderEvent) {
  if (event.error) {
    return 'Failed';
  }
  if (event.applyStatus === 'needs_review') {
    return 'Needs review';
  }
  if (event.status === 'pending') {
    return 'Pending';
  }
  if (event.status === 'refunded') {
    return 'Refunded';
  }
  return event.applyStatus.replace(/_/g, ' ');
}

function providerLabel(source: string) {
  switch (source) {
    case 'upi':
      return 'UPI';
    case 'payment_page':
      return 'Payment page';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    case 'wallet':
      return 'Wallet';
    default:
      return 'Provider';
  }
}

function customerName(customerId: string | null, customers: WorkspaceCustomer[]) {
  return customers.find((customer) => customer.id === customerId)?.name ?? 'Customer';
}
