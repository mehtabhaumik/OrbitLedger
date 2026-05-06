'use client';

import Link from 'next/link';
import type { Route } from 'next';
import {
  buildBusinessHealthScore,
  getBusinessHealthScoreActionFlow,
  type BusinessHealthScoreActionTarget,
  type BusinessHealthScoreFactor,
  type BusinessHealthScoreTone,
} from '@orbit-ledger/core';
import { useEffect, useMemo, useState } from 'react';

import {
  ActionableCustomerDialog,
  ActionableInvoiceDialog,
  ActionablePaymentDialog,
  ActionableProductDialog,
} from '@/components/actionable-customer-dialog';
import { AppShell } from '@/components/app-shell';
import { WorkspaceStatusCards } from '@/components/workspace-status-cards';
import {
  buildWebDailyClosingReview,
  buildWebMonthlyReview,
  type ReviewAction,
  type ReviewMetric,
} from '@/lib/business-reviews';
import {
  listWorkspaceCustomers,
  listWorkspaceInvoices,
  getWorkspaceInvoiceDetail,
  listWorkspaceManualPaymentReviewItems,
  listWorkspacePaymentPromises,
  listWorkspaceProducts,
  listWorkspaceTransactions,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspaceInvoiceDetail,
  type WorkspaceManualPaymentReviewItem,
  type WorkspacePaymentPromise,
  type WorkspaceProduct,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { buildProductReorderSuggestions } from '@/lib/workspace-products';
import { buildCsv, downloadTextFile, makeExportFileName } from '@/lib/workspace-power';
import { resolveWebFeatureAccess } from '@/lib/web-monetization';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type ReportActionDialog =
  | 'follow_up_customers'
  | 'promise_customers'
  | 'unpaid_invoices'
  | 'payment_review'
  | 'low_stock'
  | 'month_invoices';

export default function ReportsPage() {
  const { dashboardSnapshot, activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [invoiceDetails, setInvoiceDetails] = useState<WorkspaceInvoiceDetail[]>([]);
  const [manualPayments, setManualPayments] = useState<WorkspaceManualPaymentReviewItem[]>([]);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [promises, setPromises] = useState<WorkspacePaymentPromise[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewLoadMessage, setReviewLoadMessage] = useState<string | null>(null);
  const [activeActionDialog, setActiveActionDialog] = useState<ReportActionDialog | null>(null);
  const currency = activeWorkspace?.currency ?? 'INR';
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const taxReportAccess = resolveWebFeatureAccess(subscription, 'tax_ready_documents');
  const auditReportAccess = resolveWebFeatureAccess(subscription, 'audit_ready_reports');

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    setIsLoadingReviews(true);
    setReviewLoadMessage(null);
    void Promise.allSettled([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceTransactions(activeWorkspace.workspaceId),
      listWorkspaceInvoices(activeWorkspace.workspaceId),
      listWorkspaceManualPaymentReviewItems(activeWorkspace.workspaceId),
      listWorkspaceProducts(activeWorkspace.workspaceId),
      listWorkspacePaymentPromises(activeWorkspace.workspaceId),
    ])
      .then((results) => {
        const [nextCustomers, nextTransactions, nextInvoices, nextManualPayments, nextProducts, nextPromises] = results;
        if (nextCustomers.status === 'fulfilled') {
          setCustomers(nextCustomers.value);
        }
        if (nextTransactions.status === 'fulfilled') {
          setTransactions(nextTransactions.value);
        }
        if (nextInvoices.status === 'fulfilled') {
          setInvoices(nextInvoices.value);
        }
        if (nextManualPayments.status === 'fulfilled') {
          setManualPayments(nextManualPayments.value);
        }
        if (nextProducts.status === 'fulfilled') {
          setProducts(nextProducts.value);
        }
        if (nextPromises.status === 'fulfilled') {
          setPromises(nextPromises.value);
        }
        const failed = results.filter((result) => result.status === 'rejected');
        if (failed.length) {
          setReviewLoadMessage('Some report details could not load. Available sections are shown with the latest data we could confirm.');
        }
      })
      .finally(() => setIsLoadingReviews(false));
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace || !invoices.length) {
      setInvoiceDetails([]);
      return;
    }

    let isMounted = true;
    void Promise.all(
      invoices
        .filter((invoice) => invoice.documentState !== 'cancelled' && !invoice.isArchived)
        .slice(0, 80)
        .map((invoice) => getWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoice.id).catch(() => null))
    ).then((details) => {
      if (isMounted) {
        setInvoiceDetails(details.filter((detail): detail is WorkspaceInvoiceDetail => Boolean(detail)));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, invoices]);

  const dailyClosing = useMemo(
    () => buildWebDailyClosingReview({ date: today, transactions, products, promises }),
    [products, promises, today, transactions]
  );
  const monthlyReview = useMemo(
    () => buildWebMonthlyReview({ month, transactions, invoices, customers }),
    [customers, invoices, month, transactions]
  );
  const followUpCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          !customer.isArchived &&
          customer.balance > 0 &&
          ['needs_follow_up', 'high_risk'].includes(customer.health.rank)
      ),
    [customers]
  );
  const duePromiseCustomers = useMemo(() => {
    const dueCustomerIds = new Set(
      promises
        .filter((promise) => promise.status === 'open' && promise.promisedDate <= today)
        .map((promise) => promise.customerId)
    );
    return customers.filter((customer) => dueCustomerIds.has(customer.id));
  }, [customers, promises, today]);
  const unpaidInvoices = useMemo(
    () =>
      invoices.filter((invoice) =>
        ['unpaid', 'partially_paid', 'overdue', 'pending_clearance'].includes(invoice.paymentStatus)
      ),
    [invoices]
  );
  const monthInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.issueDate.startsWith(month)),
    [invoices, month]
  );
  const stockSuggestions = useMemo(
    () => buildProductReorderSuggestions(products).filter((suggestion) => suggestion.urgency !== 'healthy'),
    [products]
  );
  const pendingPaymentReviews = useMemo(
    () => manualPayments.filter((payment) => payment.paymentClearanceStatus !== 'cleared'),
    [manualPayments]
  );
  const sharedBusinessHealth = useMemo(
    () =>
      buildBusinessHealthScore({
        businessName: activeWorkspace?.businessName,
        currency,
        signal: {
          receivableAmount: dashboardSnapshot?.receivableTotal ?? 0,
          customerCount: dashboardSnapshot?.customerCount ?? customers.length,
          riskyCustomerCount: customers.filter((customer) => ['needs_follow_up', 'high_risk'].includes(customer.health.rank)).length,
          overdueCustomerCount: customers.filter((customer) => !customer.isArchived && customer.balance > 0 && customer.health.rank === 'high_risk').length,
          unpaidInvoiceCount: unpaidInvoices.length,
          overdueInvoiceCount: unpaidInvoices.filter((invoice) => invoice.paymentStatus === 'overdue').length,
          pendingPaymentCount: pendingPaymentReviews.length,
          pendingClearanceCount:
            pendingPaymentReviews.length +
            unpaidInvoices.filter((invoice) => invoice.paymentStatus === 'pending_clearance').length,
          lowStockCount: stockSuggestions.length,
          outOfStockCount: stockSuggestions.filter((suggestion) => suggestion.urgency === 'out_of_stock').length,
          backupStatus: 'healthy',
          documentReadinessIssues: activeWorkspace?.defaultInvoiceTemplate ? 0 : 1,
          localSetupIssues: countLocalSetupIssues(activeWorkspace),
          dailyClosingOpenItems: dailyClosing.actions.filter((action) => action.title !== 'Day looks ready to close').length,
          collectionRatePercent: calculateWebCollectionRate(transactions, dashboardSnapshot?.receivableTotal ?? 0),
        },
      }),
    [
      activeWorkspace,
      currency,
      customers,
      dailyClosing.actions,
      dashboardSnapshot?.customerCount,
      dashboardSnapshot?.receivableTotal,
      pendingPaymentReviews,
      stockSuggestions,
      transactions,
      unpaidInvoices,
    ]
  );
  const complianceSummary = useMemo(
    () => buildComplianceSummary(invoiceDetails, month),
    [invoiceDetails, month]
  );

  function exportReportJson() {
    if (!activeWorkspace || !dashboardSnapshot) {
      return;
    }
    if (!auditReportAccess.allowed) {
      showToast(auditReportAccess.message ?? 'Audit-ready reports are not included in your plan.', 'info');
      return;
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      business: {
        name: activeWorkspace.businessName,
        currency: activeWorkspace.currency,
        countryCode: activeWorkspace.countryCode,
        stateCode: activeWorkspace.stateCode,
      },
      summary: dashboardSnapshot,
      reviews: {
        dailyClosing,
        businessHealth: sharedBusinessHealth,
        monthlyReview,
      },
    };
    downloadTextFile(
      makeExportFileName([activeWorkspace.businessName, 'business-review'], 'json'),
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  function exportReportCsv() {
    if (!activeWorkspace || !dashboardSnapshot) {
      return;
    }
    if (!auditReportAccess.allowed) {
      showToast(auditReportAccess.message ?? 'Audit-ready reports are not included in your plan.', 'info');
      return;
    }

    const csv = buildCsv(
      ['Metric', 'Value'],
      [
        ['Receivable', dashboardSnapshot.receivableTotal],
        ['Payments', dashboardSnapshot.recentPayments],
        ['Customers', dashboardSnapshot.customerCount],
        ['Invoices', dashboardSnapshot.invoiceCount],
        ['Daily promises due', dailyClosing.metrics.find((metric) => metric.label === 'Promises due')?.value ?? 0],
        ['Business health score', sharedBusinessHealth.score],
      ]
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, 'business-review']), csv);
  }

  function exportComplianceCsv() {
    if (!activeWorkspace) {
      return;
    }
    if (!taxReportAccess.allowed) {
      showToast(taxReportAccess.message ?? 'Tax-ready exports are not included in your plan.', 'info');
      return;
    }

    const csv = buildCsv(
      ['Report', 'Month', 'Invoice count', 'Taxable sales', 'Tax amount', 'Invoice total', 'Outstanding'],
      [
        [
          'Tax summary',
          month,
          complianceSummary.invoiceCount,
          complianceSummary.subtotal,
          complianceSummary.taxAmount,
          complianceSummary.total,
          complianceSummary.outstanding,
        ],
      ]
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, 'tax-summary', month]), csv);
  }

  return (
    <AppShell title="Reports" subtitle="Business summaries with calm, readable signal instead of dashboard noise.">
      <div className="ol-actions ol-actions--sticky">
        <button className="ol-button" type="button" onClick={exportReportCsv} disabled={!dashboardSnapshot || !auditReportAccess.allowed}>
          Export summary
        </button>
        <button className="ol-button-secondary" type="button" onClick={exportReportJson} disabled={!dashboardSnapshot || !auditReportAccess.allowed}>
          Save full copy
        </button>
      </div>
      {!auditReportAccess.allowed ? (
        <div className="ol-message" style={{ marginBottom: 16 }}>
          {auditReportAccess.message}
        </div>
      ) : null}

      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, currency),
            helper: 'Outstanding customer balance in this workspace.',
            tone: 'warning',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, currency),
            helper: 'Recent payments recorded in this workspace.',
            tone: 'success',
          },
          {
            label: 'Customers',
            value: String(dashboardSnapshot?.customerCount ?? 0),
            helper: 'Customers included in this business review.',
            tone: 'primary',
          },
          {
            label: 'Invoices',
            value: String(dashboardSnapshot?.invoiceCount ?? 0),
            helper: 'Invoices included in this business review.',
            tone: 'premium',
          },
        ]}
      />

      {reviewLoadMessage ? (
        <div className="ol-message ol-message--warning">{reviewLoadMessage}</div>
      ) : null}

      <section className="ol-page-grid ol-page-grid--3">
        <ReviewPanel
          id="daily-closing-review"
          title="Daily closing"
          subtitle={isLoadingReviews ? 'Loading review...' : 'Confirm today’s payments, dues, promises, and stock before closing.'}
          metrics={dailyClosing.metrics}
          actions={dailyClosing.actions}
          currency={currency}
          isActionable={(action) => action.title !== 'Day looks ready to close'}
          onActionClick={(action) => {
            if (action.title === 'Review promised payments') {
              setActiveActionDialog('promise_customers');
            }
            if (action.title === 'Check low stock') {
              setActiveActionDialog('low_stock');
            }
            if (action.title === 'No money movement recorded') {
              window.location.href = '/transactions';
            }
          }}
        />
        <article className="ol-panel" id="business-health">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Business health</div>
              <p className="ol-panel-copy">{sharedBusinessHealth.summary}</p>
            </div>
            <span className={`ol-chip ol-chip--${getSharedHealthChipTone(sharedBusinessHealth.tone)}`}>
              {sharedBusinessHealth.score}/100
            </span>
          </div>
          <div className="ol-health-score-card" data-tone={sharedBusinessHealth.tone}>
            <div>
              <div className="ol-metric-label">Health</div>
              <div className="ol-metric-value">{sharedBusinessHealth.label}</div>
              <div className="ol-metric-helper">
                {sharedBusinessHealth.topFactor?.message ?? 'Use this to decide what needs attention before the next work session.'}
              </div>
            </div>
            <strong>{sharedBusinessHealth.score}</strong>
          </div>
          <div className="ol-health-factor-list">
            {(sharedBusinessHealth.factors.length ? sharedBusinessHealth.factors.slice(0, 4) : buildHealthyBusinessFactors()).map((factor) => {
              const flow = getBusinessHealthScoreActionFlow(factor.actionTarget);
              return (
                <button
                  className="ol-health-factor"
                  data-tone={factor.tone}
                  key={`${factor.area}:${factor.label}`}
                  type="button"
                  onClick={() => openSharedHealthAction(factor.actionTarget, setActiveActionDialog)}
                >
                  <span>
                    <strong>{factor.label}</strong>
                    <small>{factor.message}</small>
                    <small className="ol-health-flow">{flow.userGoal}</small>
                  </span>
                  <em>
                    {factor.valueLabel}
                    <b>{flow.primaryActionLabel}</b>
                  </em>
                </button>
              );
            })}
          </div>
        </article>
        <ReviewPanel
          title="Monthly review"
          subtitle={`Monthly summary for ${month}.`}
          metrics={monthlyReview.metrics}
          actions={monthlyReview.actions}
          currency={currency}
          isActionable={() => true}
          onActionClick={(action) => {
            if (action.title === 'Save month review') {
              setActiveActionDialog('month_invoices');
            } else if (action.title === 'No invoices this month') {
              window.location.href = '/invoices/detail';
            } else if (action.title === 'Collections need attention') {
              setActiveActionDialog('follow_up_customers');
            } else if (action.title === 'Collections look balanced') {
              setActiveActionDialog('month_invoices');
            }
          }}
        />
      </section>

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Monthly business review
          </div>
          <p className="ol-panel-copy">
            Use reports to compare money owed, payments received, customers, and invoices before
            exporting a copy for review.
          </p>
        </article>
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Report actions
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">M</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Month-end review</div>
                <div className="ol-list-text">
                  Keep the main numbers easy to scan so review work stays quick.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">C</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Accountant-ready copies</div>
                <div className="ol-list-text">
                  Export a summary or save a detailed copy for review.
                </div>
              </div>
            </div>
          </div>
        </article>
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Balance quality
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">R</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Receivable focus</div>
                <div className="ol-list-text">
                  Keep receivables visible before opening detailed customer records.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">E</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Export ready</div>
                <div className="ol-list-text">
                  Save a current business review before exports, monthly review, or backup work.
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Tax and compliance review</div>
            <p className="ol-panel-copy">
              Review tax-ready invoice totals for the current month before sharing records with an accountant.
            </p>
          </div>
          <div className="ol-actions">
            <button className="ol-button-secondary" type="button" onClick={exportComplianceCsv} disabled={!taxReportAccess.allowed}>
              Export tax summary
            </button>
            <Link className="ol-button-secondary" href={'/settings#invoice-document-settings' as Route}>
              Open tax settings
            </Link>
          </div>
        </div>
        {!taxReportAccess.allowed ? (
          <div className="ol-message" style={{ marginBottom: 16 }}>
            {taxReportAccess.message}
          </div>
        ) : null}
        <div className="ol-review-grid">
          <ReviewMetricCard label="Month" value={month} helper="Current report period." />
          <ReviewMetricCard label="Invoices" value={String(complianceSummary.invoiceCount)} helper="Non-cancelled invoices reviewed." />
          <ReviewMetricCard label="Taxable sales" value={formatCurrency(complianceSummary.subtotal, currency)} helper="Subtotal before tax." />
          <ReviewMetricCard label="Tax amount" value={formatCurrency(complianceSummary.taxAmount, currency)} helper="Tax from invoice line items." />
          <ReviewMetricCard label="Invoice total" value={formatCurrency(complianceSummary.total, currency)} helper="Total billed with tax." />
          <ReviewMetricCard label="Outstanding" value={formatCurrency(complianceSummary.outstanding, currency)} helper="Amount not fully paid yet." />
        </div>
      </section>

      <ActionableCustomerDialog
        currency={currency}
        customers={activeActionDialog === 'promise_customers' ? duePromiseCustomers : followUpCustomers}
        isOpen={activeActionDialog === 'follow_up_customers' || activeActionDialog === 'promise_customers'}
        onClose={() => setActiveActionDialog(null)}
        title={activeActionDialog === 'promise_customers' ? 'Promised payments needing follow-up' : 'Customers needing follow-up'}
        subtitle="Open a customer to review balance, timeline, promises, reminders, and payment actions."
      />
      <ActionableInvoiceDialog
        currency={currency}
        invoices={activeActionDialog === 'month_invoices' ? monthInvoices : unpaidInvoices}
        isOpen={activeActionDialog === 'unpaid_invoices' || activeActionDialog === 'month_invoices'}
        onClose={() => setActiveActionDialog(null)}
        title={activeActionDialog === 'month_invoices' ? 'Invoices included this month' : 'Invoices needing payment attention'}
        subtitle="Open an invoice to view, print, revise, record payment, or review payment status."
      />
      <ActionablePaymentDialog
        currency={currency}
        isOpen={activeActionDialog === 'payment_review'}
        onClose={() => setActiveActionDialog(null)}
        payments={pendingPaymentReviews}
        title="Payments needing verification"
        subtitle="Open payment review to clear, correct, bounce, reverse, or leave a payment for follow-up."
      />
      <ActionableProductDialog
        currency={currency}
        isOpen={activeActionDialog === 'low_stock'}
        onClose={() => setActiveActionDialog(null)}
        suggestions={stockSuggestions}
        title="Products needing stock review"
        subtitle="Review low-stock products before creating more invoices or committing stock."
      />
    </AppShell>
  );
}

function buildComplianceSummary(invoiceDetails: WorkspaceInvoiceDetail[], month: string) {
  const monthDetails = invoiceDetails.filter((invoice) => invoice.issueDate.startsWith(month));
  return {
    invoiceCount: monthDetails.length,
    subtotal: sumNumbers(monthDetails.map((invoice) => invoice.subtotal)),
    taxAmount: sumNumbers(monthDetails.map((invoice) => invoice.taxAmount)),
    total: sumNumbers(monthDetails.map((invoice) => invoice.totalAmount)),
    outstanding: sumNumbers(monthDetails.map((invoice) => Math.max(invoice.totalAmount - invoice.paidAmount, 0))),
  };
}

function sumNumbers(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function getSharedHealthChipTone(tone: BusinessHealthScoreTone) {
  if (tone === 'healthy') {
    return 'success';
  }
  if (tone === 'watch') {
    return 'warning';
  }
  return 'danger';
}

function buildHealthyBusinessFactors(): BusinessHealthScoreFactor[] {
  return [
    {
      area: 'daily_rhythm',
      label: 'No urgent health gaps',
      valueLabel: 'Ready',
      impact: 0,
      priority: 'low',
      tone: 'healthy',
      message: 'Collections, invoices, stock, and document setup do not show urgent action right now.',
      actionLabel: 'Review daily rhythm',
      actionTarget: 'open_daily_closing',
    },
  ];
}

function openSharedHealthAction(
  target: BusinessHealthScoreActionTarget,
  setActiveActionDialog: (dialog: ReportActionDialog | null) => void
) {
  if (target === 'open_collection_coach') {
    setActiveActionDialog('follow_up_customers');
    return;
  }
  if (target === 'open_invoices') {
    setActiveActionDialog('unpaid_invoices');
    return;
  }
  if (target === 'open_inventory') {
    setActiveActionDialog('low_stock');
    return;
  }
  if (target === 'open_payment_review') {
    setActiveActionDialog('payment_review');
    return;
  }
  if (target === 'open_daily_closing') {
    document.getElementById('daily-closing-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  window.location.href = getBusinessHealthScoreActionFlow(target).webRoute;
}

function countLocalSetupIssues(
  workspace:
    | {
        countryCode?: string | null;
        currency?: string | null;
        gstin?: string | null;
        taxNumber?: string | null;
        defaultTaxRate?: number | null;
        defaultInvoiceTemplate?: string | null;
        paymentInstructions?: {
          upiId?: string | null;
          paymentPageUrl?: string | null;
          bankAccountNumber?: string | null;
        } | null;
      }
    | null
    | undefined
) {
  if (!workspace) {
    return 1;
  }
  let issues = 0;
  if (!workspace.countryCode || !workspace.currency) {
    issues += 1;
  }
  if (!workspace.gstin && !workspace.taxNumber && !Number.isFinite(workspace.defaultTaxRate ?? Number.NaN)) {
    issues += 1;
  }
  const payment = workspace.paymentInstructions;
  if (!payment?.upiId && !payment?.bankAccountNumber && !payment?.paymentPageUrl) {
    issues += 1;
  }
  if (!workspace.defaultInvoiceTemplate) {
    issues += 1;
  }
  return issues;
}

function calculateWebCollectionRate(transactions: WorkspaceTransaction[], receivableTotal: number) {
  const payments = sumNumbers(
    transactions.filter((transaction) => transaction.type === 'payment').map((transaction) => transaction.amount)
  );
  const credits = sumNumbers(
    transactions.filter((transaction) => transaction.type === 'credit').map((transaction) => transaction.amount)
  );
  const base = payments + credits + Math.max(receivableTotal, 0);
  if (base <= 0) {
    return 100;
  }
  return Math.round((payments / base) * 100);
}

function ReviewPanel({
  actions,
  currency,
  id,
  isActionable,
  metrics,
  onActionClick,
  subtitle,
  title,
}: {
  actions: ReviewAction[];
  currency: string;
  id?: string;
  isActionable?: (action: ReviewAction) => boolean;
  metrics: ReviewMetric[];
  onActionClick?: (action: ReviewAction) => void;
  subtitle: string;
  title: string;
}) {
  return (
    <article className="ol-panel" id={id}>
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">{title}</div>
          <p className="ol-panel-copy">{subtitle}</p>
        </div>
      </div>
      <div className="ol-review-grid">
        {metrics.map((metric) => (
          <div className="ol-review-item" key={metric.label}>
            <span className="ol-review-label">{metric.label}</span>
            <strong className="ol-review-value">
              {metric.label === 'Customers' || metric.label.includes('stock') || metric.label.includes('Promises')
                ? metric.value
                : formatCurrency(metric.value, currency)}
            </strong>
          </div>
        ))}
      </div>
      <ActionList actions={actions} isActionable={isActionable} onActionClick={onActionClick} />
    </article>
  );
}

function ActionList({
  actions,
  getActionHref,
  isActionable,
  onActionClick,
}: {
  actions: ReviewAction[];
  getActionHref?: (action: ReviewAction) => Route | null;
  isActionable?: (action: ReviewAction) => boolean;
  onActionClick?: (action: ReviewAction) => void;
}) {
  return (
    <div className="ol-list" style={{ marginTop: 16 }}>
      {actions.map((action) => {
        const href = getActionHref?.(action) ?? null;
        const canAct = isActionable?.(action) ?? Boolean(onActionClick || href);
        const content = (
          <>
            <div className="ol-list-icon">{action.priority === 'high' ? 'H' : action.priority === 'medium' ? 'M' : 'L'}</div>
            <div className="ol-list-copy">
              <div className="ol-list-title">{action.title}</div>
              <div className="ol-list-text">{action.message}</div>
              {canAct ? <span className="ol-action-link">View details</span> : null}
            </div>
          </>
        );

        if (onActionClick && canAct) {
          return (
            <button
              className="ol-list-item ol-list-action"
              key={`${action.title}-${action.message}`}
              type="button"
              onClick={() => onActionClick(action)}
            >
              {content}
            </button>
          );
        }

        if (href && canAct) {
          return (
            <a className="ol-list-item ol-list-action" href={href} key={`${action.title}-${action.message}`}>
              {content}
            </a>
          );
        }

        return (
          <div className="ol-list-item" key={`${action.title}-${action.message}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function ReviewMetricCard({ helper, label, value }: { label: string; value: string; helper: string }) {
  return (
    <div className="ol-review-item">
      <span className="ol-review-label">{label}</span>
      <strong className="ol-review-value">{value}</strong>
      <span className="ol-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
        {helper}
      </span>
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
