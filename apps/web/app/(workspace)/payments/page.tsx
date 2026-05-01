'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  buildInvoicePaymentReference,
  buildManualPaymentFollowUpMessage,
  buildRazorpayPaymentLinkDraft,
  getManualPaymentVerificationPlan,
  getPaymentClearanceStatusLabel,
  summarizePaymentClearance,
  summarizePaymentMode,
  type PaymentClearanceStatus,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import { getWebFirebaseProjectId } from '@/lib/firebase';
import { getWebPaymentProviderPlan } from '@/lib/payment-provider-mode';
import {
  applyWorkspaceProviderEventToInvoice,
  listWorkspaceCustomers,
  listWorkspaceInvoices,
  listWorkspaceManualPaymentReviewItems,
  listWorkspacePaymentProviderEvents,
  listWorkspaceTransactions,
  markWorkspaceProviderEventReviewed,
  reverseWorkspaceProviderEventPayment,
  updateWorkspaceManualPaymentClearance,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspaceManualPaymentReviewItem,
  type WorkspacePaymentProviderEvent,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type EventFilter = 'needs_review' | 'applied' | 'reversed' | 'all';
type ManualPaymentFilter = 'needs_action' | 'pending' | 'bounced' | 'all';

export default function PaymentsPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [events, setEvents] = useState<WorkspacePaymentProviderEvent[]>([]);
  const [manualPayments, setManualPayments] = useState<WorkspaceManualPaymentReviewItem[]>([]);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [filter, setFilter] = useState<EventFilter>('needs_review');
  const [manualFilter, setManualFilter] = useState<ManualPaymentFilter>('needs_action');
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [busyManualPaymentId, setBusyManualPaymentId] = useState<string | null>(null);
  const projectId = getWebFirebaseProjectId();
  const providerPlan = getWebPaymentProviderPlan();
  const webhookUrl = `https://asia-south1-${projectId}.cloudfunctions.net/providerWebhook`;
  const [paymentPageUrl, setPaymentPageUrl] = useState(`https://${projectId}.web.app/pay`);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    void loadPaymentAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.workspaceId]);

  useEffect(() => {
    setPaymentPageUrl(`${window.location.origin}/pay`);
  }, []);

  async function loadPaymentAdminData() {
    if (!activeWorkspace) {
      return;
    }
    setIsLoading(true);
    try {
      const [nextEvents, nextManualPayments, nextTransactions, nextInvoices, nextCustomers] = await Promise.all([
        listWorkspacePaymentProviderEvents(activeWorkspace.workspaceId),
        listWorkspaceManualPaymentReviewItems(activeWorkspace.workspaceId),
        listWorkspaceTransactions(activeWorkspace.workspaceId),
        listWorkspaceInvoices(activeWorkspace.workspaceId),
        listWorkspaceCustomers(activeWorkspace.workspaceId),
      ]);
      setEvents(nextEvents);
      setManualPayments(nextManualPayments);
      setTransactions(nextTransactions);
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
      manualReview: manualPayments.length,
      pendingManual: manualPayments.filter((payment) =>
        payment.paymentClearanceStatus === 'received' ||
        payment.paymentClearanceStatus === 'post_dated' ||
        payment.paymentClearanceStatus === 'deposited'
      ).length,
      bouncedManual: manualPayments.filter((payment) => payment.paymentClearanceStatus === 'bounced').length,
    }),
    [events, manualPayments]
  );
  const manualReviewItems = useMemo(
    () =>
      manualPayments.filter((payment) => {
        if (manualFilter === 'all') {
          return true;
        }
        if (manualFilter === 'pending') {
          return (
            payment.paymentClearanceStatus === 'received' ||
            payment.paymentClearanceStatus === 'post_dated' ||
            payment.paymentClearanceStatus === 'deposited'
          );
        }
        if (manualFilter === 'bounced') {
          return payment.paymentClearanceStatus === 'bounced';
        }
        return payment.paymentClearanceStatus !== 'cleared';
      }),
    [manualFilter, manualPayments]
  );
  const openInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) => invoice.documentState !== 'cancelled' && invoice.totalAmount - invoice.paidAmount > 0
      ),
    [invoices]
  );
  const paymentActivity = useMemo(() => {
    const providerItems = events.map((event) => ({
      id: `provider-${event.id}`,
      at: event.lastModified || event.createdAt,
      title: event.reversed ? 'Provider payment reversed' : event.applied ? 'Provider payment applied' : 'Provider event received',
      detail: `${providerLabel(event.source)} · ${event.reference ?? event.providerPaymentId ?? 'No reference'}`,
      amount: event.amount,
      currency: event.currency,
      tone: event.reversed ? 'warning' : event.applied ? 'success' : 'primary',
      invoiceId: event.invoiceId,
    }));
    const manualItems = transactions
      .filter((transaction) => transaction.type === 'payment')
      .map((transaction) => ({
        id: `manual-${transaction.id}`,
        at: transaction.createdAt,
        title: 'Manual payment recorded',
        detail: `${transaction.customerName} · ${summarizePaymentMode(transaction.paymentMode, transaction.paymentDetails)} · ${summarizePaymentClearance(transaction.paymentClearanceStatus, transaction.paymentDetails)}`,
        amount: transaction.amount,
        currency: activeWorkspace?.currency ?? 'INR',
        tone: transaction.paymentClearanceStatus === 'cleared' ? 'success' : 'warning',
        invoiceId: null,
      }));

    return [...providerItems, ...manualItems]
      .sort((left, right) => right.at.localeCompare(left.at))
      .slice(0, 12);
  }, [activeWorkspace?.currency, events, transactions]);
  const razorpayPaymentLinkDraft = useMemo(() => {
    if (!activeWorkspace) {
      return null;
    }
    const sampleInvoice = openInvoices[0] ?? invoices[0] ?? null;
    const sampleCustomer = sampleInvoice
      ? customers.find((customer) => customer.id === sampleInvoice.customerId) ?? null
      : null;
    const invoiceNumber = sampleInvoice?.invoiceNumber ?? 'WEB-641090';
    const amount = sampleInvoice
      ? Math.max(sampleInvoice.totalAmount - sampleInvoice.paidAmount, sampleInvoice.totalAmount, 1)
      : 1770;

    return buildRazorpayPaymentLinkDraft({
      workspaceId: activeWorkspace.workspaceId,
      businessName: activeWorkspace.businessName,
      invoiceId: sampleInvoice?.id ?? 'invoice_id',
      invoiceNumber,
      customerId: sampleInvoice?.customerId ?? 'customer_id',
      customerName: sampleCustomer?.name ?? 'Customer name',
      amount,
      currency: activeWorkspace.currency,
      reference: buildInvoicePaymentReference(invoiceNumber),
      callbackUrl: paymentPageUrl,
    });
  }, [activeWorkspace, customers, invoices, openInvoices, paymentPageUrl]);

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

  async function copyRazorpayPaymentLinkDraft() {
    if (!razorpayPaymentLinkDraft) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(razorpayPaymentLinkDraft, null, 2));
    showToast('Razorpay test link details copied.', 'success');
  }

  async function copyPaymentPageUrl() {
    await navigator.clipboard.writeText(paymentPageUrl);
    showToast('Payment page copied.', 'success');
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

  async function updateManualPayment(payment: WorkspaceManualPaymentReviewItem, clearanceStatus: PaymentClearanceStatus) {
    if (!activeWorkspace) {
      return;
    }

    setBusyManualPaymentId(payment.transactionId);
    try {
      await updateWorkspaceManualPaymentClearance(activeWorkspace.workspaceId, payment.transactionId, {
        clearanceStatus,
      });
      await loadPaymentAdminData();
      showToast(
        clearanceStatus === 'cleared'
          ? 'Manual payment verified and balances updated.'
          : `Manual payment marked ${getPaymentClearanceStatusLabel(clearanceStatus).toLowerCase()}.`,
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Manual payment could not be updated.', 'danger');
    } finally {
      setBusyManualPaymentId(null);
    }
  }

  async function copyManualPaymentFollowUp(payment: WorkspaceManualPaymentReviewItem) {
    if (!activeWorkspace) {
      return;
    }
    const message = buildManualPaymentFollowUpMessage({
      businessName: activeWorkspace.businessName,
      customerName: payment.customerName,
      amountLabel: formatCurrency(payment.amount, activeWorkspace.currency),
      clearanceStatus: payment.paymentClearanceStatus,
      invoiceNumber: payment.invoiceNumber,
      paymentModeLabel: summarizePaymentMode(payment.paymentMode, payment.paymentDetails),
    });
    await navigator.clipboard.writeText(message);
    showToast('Follow-up message copied.', 'success');
  }

  return (
    <AppShell title="Payments" subtitle="Collect manually today, and connect online checkout when a provider is ready.">
      <section className="ol-metric-grid">
        <Metric label="Events" value={String(stats.total)} helper="Received from payment providers." tone="primary" />
        <Metric label="Applied" value={String(stats.applied)} helper="Updated invoices automatically." tone="success" />
        <Metric label="Manual Review" value={String(stats.manualReview)} helper="Manual payments needing follow-up." tone="warning" />
        <Metric label="Pending" value={String(stats.pendingManual)} helper="Received, post-dated, or deposited." tone="warning" />
      </section>

      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Payment Collection</div>
            <p className="ol-panel-copy" style={{ maxWidth: 680 }}>
              {providerPlan.adminCopy}
            </p>
          </div>
          <span className={providerPlan.statusTone === 'connected' ? 'ol-chip ol-chip--success' : 'ol-chip ol-chip--tax'}>
            {providerPlan.statusLabel}
          </span>
        </div>
        <div className="ol-review-grid">
          <Review label="Collection mode" value={providerPlan.collectionLabel} />
          <Review label="Online checkout" value={providerPlan.canCreateOnlineCheckout ? 'Available' : 'Not connected'} />
          <Review label="Future provider URL" value={webhookUrl} />
          <Review label="Signature header" value="X-Razorpay-Signature" />
          <Review label="Region" value="Asia South" />
          <Review label="Payment page" value={paymentPageUrl} />
        </div>
        <div className="ol-actions ol-actions--compact" style={{ marginTop: 16 }}>
          {providerPlan.mode !== 'manual' ? (
            <button className="ol-button" type="button" onClick={() => void copyWebhookUrl()}>
              Copy provider URL
            </button>
          ) : null}
          <button className="ol-button-secondary" type="button" onClick={() => void copyPaymentPageUrl()}>
            Copy payment page
          </button>
          {providerPlan.canCopyGatewayDraft ? (
            <button className="ol-button-secondary" type="button" onClick={() => void copyRazorpayPaymentLinkDraft()}>
              Copy provider test link
            </button>
          ) : null}
          {providerPlan.mode !== 'manual' ? (
            <button className="ol-button-secondary" type="button" onClick={() => void copyExamplePayload()}>
              Copy sample data
            </button>
          ) : null}
          <Link className="ol-button-secondary" href="/transactions">
            Record payment manually
          </Link>
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Payment Activity Timeline</div>
            <p className="ol-panel-copy" style={{ maxWidth: 720 }}>
              Recent manual and provider payment activity in one audit-friendly view.
            </p>
          </div>
          <span className="ol-chip ol-chip--premium">Audit trail</span>
        </div>
        <div className="ol-list">
          {paymentActivity.map((item) => (
            <article className="ol-list-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="ol-muted" style={{ margin: '4px 0 0' }}>
                  {item.detail}
                </p>
                <p className="ol-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {formatDateTime(item.at)}
                </p>
              </div>
              <div className="ol-inline-actions">
                <span className={`ol-chip ol-chip--${item.tone}`}>{formatCurrency(item.amount, item.currency)}</span>
                {item.invoiceId ? (
                  <Link className="ol-link-button" href={`/invoices/detail?invoiceId=${encodeURIComponent(item.invoiceId)}`}>
                    Open invoice
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
          {!isLoading && !paymentActivity.length ? (
            <div className="ol-empty">No payment activity has been recorded yet.</div>
          ) : null}
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Provider Setup Checklist</div>
            <p className="ol-panel-copy" style={{ maxWidth: 720 }}>
              Use this before accepting real payments so every paid, failed, pending, and refunded payment is handled cleanly.
            </p>
          </div>
          <span className="ol-chip ol-chip--tax">Production checklist</span>
        </div>
        <div className="ol-review-grid">
          {getProviderSetupChecklist(providerPlan.mode).map((item) => (
            <Review key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </section>

      <section className="ol-table">
        <div className="ol-table-tools">
          <label className="ol-field">
            <span className="ol-field-label">Manual payment review</span>
            <select
              className="ol-select"
              value={manualFilter}
              onChange={(event) => setManualFilter(event.target.value as ManualPaymentFilter)}
            >
              <option value="needs_action">Needs action</option>
              <option value="pending">Pending clearance</option>
              <option value="bounced">Bounced or failed</option>
              <option value="all">All manual review</option>
            </select>
          </label>
          <div className="ol-table-actions">
            <Link className="ol-button-secondary" href="/transactions">
              Record manual payment
            </Link>
          </div>
        </div>
        <div className="ol-table-summary">
          {isLoading
            ? 'Loading manual payments...'
            : `${manualReviewItems.length} manual payment${manualReviewItems.length === 1 ? '' : 's'} in this queue.`}
        </div>
        <div className="ol-table-head" style={{ gridTemplateColumns: '0.9fr 0.9fr 0.8fr 1.2fr 1fr' }}>
          <span>Customer</span>
          <span>Payment</span>
          <span>Match</span>
          <span>Follow-up</span>
          <span>Action</span>
        </div>
        {manualReviewItems.map((payment) => {
          const plan = getManualPaymentVerificationPlan({
            allocationStrategy: payment.invoiceId ? 'selected_invoice' : 'ledger_only',
            clearanceStatus: payment.paymentClearanceStatus,
          });
          return (
            <div
              className="ol-table-row"
              key={`${payment.transactionId}-${payment.allocationId ?? 'ledger'}`}
              style={{ gridTemplateColumns: '0.9fr 0.9fr 0.8fr 1.2fr 1fr' }}
            >
              <span>
                <strong>{payment.customerName}</strong>
                <br />
                <span className="ol-muted" style={{ fontSize: 13 }}>
                  {payment.effectiveDate || payment.createdAt.slice(0, 10)}
                </span>
              </span>
              <span>
                <strong>{formatCurrency(payment.amount, activeWorkspace?.currency ?? 'INR')}</strong>
                <br />
                <span className="ol-muted" style={{ fontSize: 13 }}>
                  {summarizePaymentMode(payment.paymentMode, payment.paymentDetails)}
                </span>
              </span>
              <span>
                {payment.invoiceId ? (
                  <Link className="ol-link-button" href={`/invoices/detail?invoiceId=${encodeURIComponent(payment.invoiceId)}`}>
                    {payment.invoiceNumber ?? 'Open invoice'}
                  </Link>
                ) : (
                  <span className="ol-muted">Ledger only</span>
                )}
              </span>
              <span>
                <strong>{plan.statusLabel}</strong>
                <br />
                <span className="ol-muted" style={{ fontSize: 13 }}>
                  {plan.invoiceEffect}
                </span>
                {payment.note ? (
                  <>
                    <br />
                    <span className="ol-muted" style={{ fontSize: 13 }}>
                      {payment.note}
                    </span>
                  </>
                ) : null}
              </span>
              <span className="ol-inline-actions">
                <button
                  className="ol-button"
                  disabled={busyManualPaymentId === payment.transactionId}
                  type="button"
                  onClick={() => void updateManualPayment(payment, 'cleared')}
                >
                  Verify cleared
                </button>
                <button
                  className="ol-button-ghost"
                  disabled={busyManualPaymentId === payment.transactionId}
                  type="button"
                  onClick={() => void updateManualPayment(payment, 'bounced')}
                >
                  Mark bounced
                </button>
                <button
                  className="ol-button-secondary"
                  disabled={busyManualPaymentId === payment.transactionId}
                  type="button"
                  onClick={() => void copyManualPaymentFollowUp(payment)}
                >
                  Copy follow-up
                </button>
              </span>
            </div>
          );
        })}
        {!isLoading && !manualReviewItems.length ? (
          <div className="ol-empty">No manual payments need follow-up right now.</div>
        ) : null}
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

function getProviderSetupChecklist(mode: string) {
  if (mode === 'manual') {
    return [
      {
        label: 'Active collection',
        value: 'Use UPI, payment page details, cash, bank transfer, cheque, draft, and recorded payments.',
      },
      {
        label: 'Invoice sharing',
        value: 'Show payment details on invoices and copy payment messages from the invoice editor.',
      },
      {
        label: 'Future providers',
        value: 'Razorpay can be connected later without changing manual payment workflows.',
      },
      {
        label: 'Owner review',
        value: 'Provider event review stays available for future connected checkout or imported events.',
      },
    ];
  }

  return [
    {
      label: 'Provider account',
      value: 'Create the account later and keep it in test mode until the full payment test passes.',
    },
    {
      label: 'Test link details',
      value: 'Use Copy provider test link after opening an invoice so amount, reference, and invoice details stay aligned.',
    },
    {
      label: 'Secure provider access',
      value: 'Add the provider webhook secret inside the payment provider dashboard. Do not place it in the payment link.',
    },
    {
      label: 'Success event',
      value: 'Send one paid test payment and confirm the invoice payment amount updates once.',
    },
    {
      label: 'Review event',
      value: 'Send one unmatched payment and confirm it waits for owner review.',
    },
    {
      label: 'Refund event',
      value: 'Send one refund and confirm the ledger reversal appears without deleting the original payment.',
    },
    {
      label: 'Customer page',
      value: 'Open the payment page from an invoice and confirm the amount, customer, and invoice number are correct.',
    },
    {
      label: 'Go live',
      value: 'Keep provider test mode off only after the above checks pass.',
    },
  ];
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
