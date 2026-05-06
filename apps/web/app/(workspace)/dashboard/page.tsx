'use client';

import type {
  DailyActionCenterActionTarget,
  LocalBusinessIntelligenceActionTarget,
  LocalBusinessIntelligenceItem,
  MistakeRecoveryAction,
  MistakeRecoveryActionTarget,
  MistakeRecoverySignal,
  OwnerClosingRitualOutput,
  OwnerClosingRitualStep,
  OwnerClosingRitualStepId,
} from '@orbit-ledger/core';
import {
  buildDailyActionCenter,
  buildLocalBusinessIntelligence,
  buildMistakeRecoveryMode,
  buildOwnerClosingRitual,
} from '@orbit-ledger/core';
import Link from 'next/link';
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
  listWorkspaceCustomers,
  listWorkspaceInvoices,
  listWorkspaceManualPaymentReviewItems,
  listWorkspaceProducts,
  listWorkspaceRecurringInvoiceRules,
  listWorkspaceTransactions,
  type WorkspaceCustomer,
  type WorkspaceInvoice,
  type WorkspaceManualPaymentReviewItem,
  type WorkspaceProduct,
  type WorkspaceRecurringInvoiceRule,
  type WorkspaceTransaction,
} from '@/lib/workspace-data';
import { buildProductReorderSuggestions, summarizeWorkspaceProducts } from '@/lib/workspace-products';
import { useWorkspace } from '@/providers/workspace-provider';

type DashboardDialog = 'collections' | 'invoices' | 'inventory' | 'payments' | 'closing' | 'recovery' | null;

type ClosingCheckState = Record<Exclude<OwnerClosingRitualStepId, 'review'>, boolean>;

const DEFAULT_CLOSING_CHECKS: ClosingCheckState = {
  cash: false,
  payments: false,
  credit: false,
  stock: false,
  follow_up: false,
};

export default function DashboardPage() {
  const { activeWorkspace, dashboardSnapshot } = useWorkspace();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [manualPayments, setManualPayments] = useState<WorkspaceManualPaymentReviewItem[]>([]);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [recurringRules, setRecurringRules] = useState<WorkspaceRecurringInvoiceRule[]>([]);
  const [transactions, setTransactions] = useState<WorkspaceTransaction[]>([]);
  const [activeDialog, setActiveDialog] = useState<DashboardDialog>(null);
  const [closingChecks, setClosingChecks] = useState<ClosingCheckState>(DEFAULT_CLOSING_CHECKS);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closingSavedAt, setClosingSavedAt] = useState<string | null>(null);
  const currency = activeWorkspace?.currency ?? 'INR';
  const today = new Date().toISOString().slice(0, 10);
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
  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          !invoice.isArchived &&
          invoice.documentState !== 'cancelled' &&
          invoice.paymentStatus !== 'paid'
      ),
    [invoices]
  );
  const overdueInvoices = useMemo(
    () => unpaidInvoices.filter((invoice) => invoice.paymentStatus === 'overdue'),
    [unpaidInvoices]
  );
  const unpaidInvoiceAmount = useMemo(
    () => unpaidInvoices.reduce((total, invoice) => total + Math.max(invoice.totalAmount - invoice.paidAmount, 0), 0),
    [unpaidInvoices]
  );
  const productSummary = useMemo(() => summarizeWorkspaceProducts(products), [products]);
  const reorderSuggestions = useMemo(
    () => buildProductReorderSuggestions(products).filter((suggestion) => suggestion.urgency !== 'healthy'),
    [products]
  );
  const pendingVerificationCount = useMemo(
    () => manualPayments.filter((payment) => payment.paymentClearanceStatus !== 'cleared').length,
    [manualPayments]
  );
  const todayTransactions = useMemo(
    () => transactions.filter((transaction) => (transaction.effectiveDate || transaction.createdAt.slice(0, 10)) === today),
    [today, transactions]
  );
  const todayPayments = useMemo(
    () => todayTransactions.filter((transaction) => transaction.type === 'payment'),
    [todayTransactions]
  );
  const todayCredits = useMemo(
    () => todayTransactions.filter((transaction) => transaction.type === 'credit'),
    [todayTransactions]
  );
  const expectedCash = useMemo(
    () => todayPayments.reduce((total, transaction) => total + transaction.amount, 0),
    [todayPayments]
  );
  const countedCash = parseClosingAmount(countedCashInput);
  const closingRitual = useMemo(
    () =>
      buildOwnerClosingRitual({
        businessName: activeWorkspace?.businessName,
        currency,
        date: today,
        cash: {
          expectedCash,
          countedCash,
          cashConfirmed: closingChecks.cash,
        },
        credit: {
          creditReviewed: closingChecks.credit,
          unreviewedCreditCount: closingChecks.credit ? 0 : todayCredits.length,
        },
        followUp: {
          customersDueTomorrow: followUpCustomers.length,
          overdueCustomers: overdueInvoices.length,
          promisesDueTomorrow: 0,
          followUpsPlanned: closingChecks.follow_up,
        },
        ledger: {
          cashCollected: expectedCash,
          creditCount: todayCredits.length,
          creditGivenAmount: todayCredits.reduce((total, transaction) => total + transaction.amount, 0),
          paymentCount: todayPayments.length,
          paymentsRecordedAmount: expectedCash,
        },
        payments: {
          paymentsReviewed: closingChecks.payments,
          pendingVerificationCount: closingChecks.payments ? 0 : pendingVerificationCount,
        },
        stock: {
          lowStockCount: closingChecks.stock ? 0 : productSummary.lowStockCount,
          mismatchCount: 0,
          movementCount: 0,
          stockReviewed: closingChecks.stock,
        },
      }),
    [
      activeWorkspace?.businessName,
      closingChecks,
      countedCash,
      currency,
      expectedCash,
      followUpCustomers.length,
      overdueInvoices.length,
      pendingVerificationCount,
      productSummary.lowStockCount,
      today,
      todayCredits,
      todayPayments.length,
    ]
  );
  const mistakeRecovery = useMemo(
    () =>
      buildMistakeRecoveryMode({
        businessName: activeWorkspace?.businessName,
        signals: buildDashboardMistakeRecoverySignals({
          customers,
          invoices,
          manualPayments,
          products,
          transactions,
        }),
      }),
    [activeWorkspace?.businessName, customers, invoices, manualPayments, products, transactions]
  );
  const dailyCenter = useMemo(
    () =>
      buildDailyActionCenter({
        businessName: activeWorkspace?.businessName,
        currency,
        collections: {
          amountDue: dashboardSnapshot?.receivableTotal ?? followUpCustomers.reduce((total, customer) => total + customer.balance, 0),
          customerCount: followUpCustomers.length,
        },
        invoices: {
          amountDue: unpaidInvoiceAmount,
          invoiceCount: unpaidInvoices.length,
          overdueCount: overdueInvoices.length,
        },
        inventory: {
          lowStockCount: productSummary.lowStockCount,
          outOfStockCount: productSummary.outOfStockCount,
        },
        payments: {
          pendingVerificationCount,
        },
        backup: {
          status: 'healthy',
        },
        businessTrend: null,
        closing: {
          completedToday: Boolean(closingSavedAt),
          openItemCount: closingSavedAt ? 0 : closingRitual.flags.length,
        },
      }),
    [
      activeWorkspace?.businessName,
      closingRitual.flags.length,
      closingSavedAt,
      currency,
      dashboardSnapshot?.receivableTotal,
      followUpCustomers,
      overdueInvoices.length,
      pendingVerificationCount,
      productSummary.lowStockCount,
      productSummary.outOfStockCount,
      unpaidInvoiceAmount,
      unpaidInvoices.length,
    ]
  );
  const localBusinessIntelligence = useMemo(
    () =>
      buildLocalBusinessIntelligence({
        businessName: activeWorkspace?.businessName,
        signal: {
          countryCode: activeWorkspace?.countryCode,
          stateCode: activeWorkspace?.stateCode,
          city: activeWorkspace?.city,
          month: new Date().getMonth() + 1,
          hasTaxProfile: Boolean(activeWorkspace?.gstin || activeWorkspace?.taxNumber || activeWorkspace?.defaultTaxRate),
          hasLocalPaymentDetails: Boolean(
            activeWorkspace?.paymentInstructions?.upiId ||
              activeWorkspace?.paymentInstructions?.bankAccountNumber ||
              activeWorkspace?.paymentInstructions?.paymentPageUrl
          ),
          hasInvoiceTemplate: Boolean(activeWorkspace?.defaultInvoiceTemplate),
          overdueCustomerCount: followUpCustomers.length,
          unpaidInvoiceCount: unpaidInvoices.length,
          taxInvoiceCount: invoices.filter((invoice) => !invoice.isArchived && invoice.totalAmount > 0).length,
          localCurrency: activeWorkspace?.currency,
        },
      }),
    [
      activeWorkspace?.businessName,
      activeWorkspace?.city,
      activeWorkspace?.countryCode,
      activeWorkspace?.currency,
      activeWorkspace?.defaultInvoiceTemplate,
      activeWorkspace?.defaultTaxRate,
      activeWorkspace?.gstin,
      activeWorkspace?.paymentInstructions?.bankAccountNumber,
      activeWorkspace?.paymentInstructions?.paymentPageUrl,
      activeWorkspace?.paymentInstructions?.upiId,
      activeWorkspace?.stateCode,
      activeWorkspace?.taxNumber,
      followUpCustomers.length,
      invoices,
      unpaidInvoices.length,
    ]
  );

  useEffect(() => {
    if (!activeWorkspace) {
      setCustomers([]);
      setInvoices([]);
      setManualPayments([]);
      setProducts([]);
      setRecurringRules([]);
      setTransactions([]);
      setClosingChecks(DEFAULT_CLOSING_CHECKS);
      setCountedCashInput('');
      setClosingSavedAt(null);
      return;
    }

    void Promise.all([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceInvoices(activeWorkspace.workspaceId),
      listWorkspaceManualPaymentReviewItems(activeWorkspace.workspaceId),
      listWorkspaceProducts(activeWorkspace.workspaceId),
      listWorkspaceRecurringInvoiceRules(activeWorkspace.workspaceId),
      listWorkspaceTransactions(activeWorkspace.workspaceId),
    ])
      .then(([nextCustomers, nextInvoices, nextManualPayments, nextProducts, nextRules, nextTransactions]) => {
        setCustomers(nextCustomers);
        setInvoices(nextInvoices);
        setManualPayments(nextManualPayments);
        setProducts(nextProducts);
        setRecurringRules(nextRules);
        setTransactions(nextTransactions);
        const saved = loadClosingState(activeWorkspace.workspaceId, today);
        setClosingChecks(saved?.checks ?? DEFAULT_CLOSING_CHECKS);
        setCountedCashInput(saved?.countedCashInput ?? '');
        setClosingSavedAt(saved?.savedAt ?? null);
      })
      .catch(() => {
        setCustomers([]);
        setInvoices([]);
        setManualPayments([]);
        setProducts([]);
        setRecurringRules([]);
        setTransactions([]);
      });
  }, [activeWorkspace, today]);
  const autoEmailWarnings = useMemo(() => buildDashboardAutoEmailWarnings(recurringRules, invoices), [invoices, recurringRules]);

  function updateClosingCheck(step: Exclude<OwnerClosingRitualStepId, 'review'>, checked: boolean) {
    setClosingSavedAt(null);
    setClosingChecks((current) => ({ ...current, [step]: checked }));
  }

  function updateCountedCash(value: string) {
    setClosingSavedAt(null);
    setCountedCashInput(value.replace(/[^\d.]/g, ''));
  }

  function saveClosingReview() {
    if (!activeWorkspace) {
      return;
    }
    const savedAt = new Date().toISOString();
    setClosingSavedAt(savedAt);
    saveClosingState(activeWorkspace.workspaceId, today, {
      checks: closingChecks,
      countedCashInput,
      savedAt,
    });
  }

  return (
    <AppShell title="Home" subtitle="Daily actions, receivables, and workspace status.">
      <section className="ol-panel-dark ol-action-center-hero">
        <div className="ol-panel-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 14 }}>
              <span className={`ol-chip ol-chip--${dailyCenter.topAction.tone === 'danger' ? 'warning' : dailyCenter.topAction.tone}`}>
                {dailyCenter.topAction.priority === 'critical' ? 'Handle first' : 'Today'}
              </span>
              <span className="ol-chip ol-chip--success">Action ready</span>
            </div>
            <div className="ol-onboarding-headline ol-action-center-title">{dailyCenter.topAction.title}</div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              {dailyCenter.topAction.message}
            </p>
            <strong className="ol-action-center-value">{dailyCenter.topAction.value}</strong>
          </div>
          <div className="ol-actions">
            <ActionCenterCta target={dailyCenter.topAction.action.target} onOpen={setActiveDialog}>
              {dailyCenter.topAction.action.label}
            </ActionCenterCta>
            <Link className="ol-button-secondary" href="/transactions">
              Record payment
            </Link>
          </div>
        </div>
      </section>

      <section className="ol-action-center-grid" aria-label="Daily Action Center">
        {dailyCenter.items.map((item) => (
          <article className="ol-action-card" data-tone={item.tone} key={item.id}>
            <div className="ol-action-card-main">
              <span className="ol-action-icon">{getActionIcon(item.id)}</span>
              <div>
                <div className="ol-action-card-title">{item.title}</div>
                <p>{item.message}</p>
              </div>
            </div>
            <div className="ol-action-card-footer">
              <strong>{item.value}</strong>
              <ActionCenterCta isSecondary target={item.action.target} onOpen={setActiveDialog}>
                {item.action.label}
              </ActionCenterCta>
            </div>
          </article>
        ))}
      </section>

      <section className="ol-panel ol-closing-preview">
        <div className="ol-panel-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 12 }}>
              <span className={`ol-chip ol-chip--${closingSavedAt ? 'success' : closingRitual.flags.length ? 'warning' : 'primary'}`}>
                {closingSavedAt ? 'Saved today' : closingRitual.flags.length ? 'Needs review' : 'Ready to review'}
              </span>
              <span className="ol-chip ol-chip--primary">
                {closingRitual.completion.completed}/{closingRitual.completion.total - 1} checks
              </span>
            </div>
            <div className="ol-panel-title">3-minute closing</div>
            <p className="ol-panel-copy">{closingRitual.summary}</p>
          </div>
          <button className="ol-button" type="button" onClick={() => setActiveDialog('closing')}>
            Start closing
          </button>
        </div>
        <div className="ol-closing-step-grid">
          {closingRitual.steps.filter((step) => step.id !== 'review').map((step) => (
            <article className="ol-closing-step" data-tone={step.tone} key={step.id}>
              <span>{step.title}</span>
              <strong>{step.value || (step.completed ? 'Done' : 'Open')}</strong>
              <p>{step.helper}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ol-panel ol-recovery-preview">
        <div className="ol-panel-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 12 }}>
              <span className={`ol-chip ol-chip--${mistakeRecovery.actions.length ? 'warning' : 'success'}`}>
                {mistakeRecovery.actions.length ? `${mistakeRecovery.actions.length} review item${mistakeRecovery.actions.length === 1 ? '' : 's'}` : 'Clear'}
              </span>
              <span className="ol-chip ol-chip--primary">History protected</span>
            </div>
            <div className="ol-panel-title">Mistake Recovery</div>
            <p className="ol-panel-copy">{mistakeRecovery.summary}</p>
          </div>
          <button className="ol-button-secondary" type="button" onClick={() => setActiveDialog('recovery')}>
            Open recovery
          </button>
        </div>
        <div className="ol-recovery-action-row">
          {(mistakeRecovery.actions.length ? mistakeRecovery.actions.slice(0, 3) : buildRecoveryEmptyCards()).map((action) => (
            <RecoveryActionCard action={action} key={action.id} />
          ))}
        </div>
      </section>

      <section className="ol-panel ol-local-intelligence">
        <div className="ol-panel-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 12 }}>
              <span className="ol-chip ol-chip--primary">{localBusinessIntelligence.topInsight?.countryCode ?? activeWorkspace?.countryCode ?? 'IN'}</span>
              <span className={`ol-chip ol-chip--${localBusinessIntelligence.topInsight?.priority === 'critical' ? 'warning' : 'success'}`}>
                {localBusinessIntelligence.emptyState ? 'Ready' : 'Local review'}
              </span>
            </div>
            <div className="ol-panel-title">Local Business Intelligence</div>
            <p className="ol-panel-copy">{localBusinessIntelligence.summary}</p>
          </div>
          <Link className="ol-button-secondary" href="/settings">
            Review settings
          </Link>
        </div>
        <div className="ol-local-intelligence-grid">
          {(localBusinessIntelligence.items.length ? localBusinessIntelligence.items.slice(0, 4) : buildLocalIntelligenceEmptyItems(activeWorkspace?.countryCode)).map((item) => (
            <LocalIntelligenceCard item={item} key={item.id} />
          ))}
        </div>
      </section>

      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, currency),
            helper: activeWorkspace ? `${activeWorkspace.businessName} workspace` : 'No workspace',
            tone: 'warning',
          },
          {
            label: 'Customers',
            value: String(dashboardSnapshot?.customerCount ?? 0),
            helper: 'Customers in this workspace.',
            tone: 'primary',
          },
          {
            label: 'Invoices',
            value: String(dashboardSnapshot?.invoiceCount ?? 0),
            helper: 'Issued and draft invoices.',
            tone: 'premium',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, currency),
            helper: 'Recent payments recorded here.',
            tone: 'success',
          },
        ]}
      />

      <section className="ol-split-grid">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Upcoming automation
          </div>
          <div className="ol-list">
            {autoEmailWarnings.map((warning) => (
              <Link className="ol-list-item ol-list-action" href={`/invoices/automation?ruleId=${encodeURIComponent(warning.ruleId)}`} key={warning.id}>
                <div className="ol-list-icon">E</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{warning.title}</div>
                  <div className="ol-list-text">{warning.message}</div>
                  <span className="ol-action-link">Review auto email</span>
                </div>
              </Link>
            ))}
            {!autoEmailWarnings.length ? (
              <div className="ol-list-item">
                <div className="ol-list-icon">E</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">No scheduled email needs review</div>
                  <div className="ol-list-text">Automatic invoice emails will appear here when they are close to sending.</div>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Workspace readiness
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">W</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Wide-screen review</div>
                <div className="ol-list-text">
                  Review reports, backups, and invoices with more room for comparison and verification.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">S</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Business workspace</div>
                <div className="ol-list-text">
                  Review the same customers, transactions, invoices, and reports across Orbit Ledger.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">B</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Backup discipline</div>
                <div className="ol-list-text">
                  Export reviewed copies before major edits, imports, restores, or launch testing.
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <ActionableCustomerDialog
        currency={currency}
        customers={followUpCustomers}
        isOpen={activeDialog === 'collections'}
        onClose={() => setActiveDialog(null)}
        title="Customers needing follow-up"
        subtitle="Open a customer to review balance, timeline, promises, reminders, and payment actions."
      />
      <ActionableInvoiceDialog
        currency={currency}
        invoices={overdueInvoices.length ? overdueInvoices : unpaidInvoices}
        isOpen={activeDialog === 'invoices'}
        onClose={() => setActiveDialog(null)}
        title={overdueInvoices.length ? 'Overdue invoices' : 'Unpaid invoices'}
        subtitle="Open an invoice to view, revise, collect payment, or download the latest saved version."
      />
      <ActionableProductDialog
        currency={currency}
        isOpen={activeDialog === 'inventory'}
        onClose={() => setActiveDialog(null)}
        suggestions={reorderSuggestions}
        title="Stock needing attention"
        subtitle="Review products that are out of stock, low, or close to the alert level."
      />
      <ActionablePaymentDialog
        currency={currency}
        isOpen={activeDialog === 'payments'}
        onClose={() => setActiveDialog(null)}
        payments={manualPayments}
        title="Payments needing review"
        subtitle="Verify received, pending, bounced, or uncleared payments before trusting balances."
      />
      <OwnerClosingRitualDialog
        countedCashInput={countedCashInput}
        currency={currency}
        isOpen={activeDialog === 'closing'}
        onClose={() => setActiveDialog(null)}
        onCountedCashChange={updateCountedCash}
        onSave={saveClosingReview}
        onToggleCheck={updateClosingCheck}
        ritual={closingRitual}
        savedAt={closingSavedAt}
        checks={closingChecks}
      />
      <MistakeRecoveryDialog
        actions={mistakeRecovery.actions}
        guardrails={mistakeRecovery.guardrails}
        isOpen={activeDialog === 'recovery'}
        onClose={() => setActiveDialog(null)}
        summary={mistakeRecovery.summary}
      />
    </AppShell>
  );
}

function RecoveryActionCard({ action }: { action: Pick<MistakeRecoveryAction, 'id' | 'title' | 'message' | 'risk' | 'tone'> }) {
  return (
    <article className="ol-recovery-action-card" data-tone={action.tone}>
      <span className={`ol-chip ol-chip--${getRecoveryChipTone(action.risk)}`}>{formatRecoveryRisk(action.risk)}</span>
      <strong>{action.title}</strong>
      <p>{action.message}</p>
    </article>
  );
}

function ActionCenterCta({
  children,
  isSecondary = false,
  onOpen,
  target,
}: {
  children: string;
  isSecondary?: boolean;
  onOpen(value: DashboardDialog): void;
  target: DailyActionCenterActionTarget;
}) {
  const dialog = getDialogForTarget(target);
  const href = getHrefForTarget(target);
  const className = isSecondary ? 'ol-button-secondary ol-button-compact' : 'ol-button';

  if (dialog) {
    return (
      <button className={className} type="button" onClick={() => onOpen(dialog)}>
        {children}
      </button>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

function OwnerClosingRitualDialog({
  checks,
  countedCashInput,
  currency,
  isOpen,
  onClose,
  onCountedCashChange,
  onSave,
  onToggleCheck,
  ritual,
  savedAt,
}: {
  checks: ClosingCheckState;
  countedCashInput: string;
  currency: string;
  isOpen: boolean;
  onClose(): void;
  onCountedCashChange(value: string): void;
  onSave(): void;
  onToggleCheck(step: Exclude<OwnerClosingRitualStepId, 'review'>, checked: boolean): void;
  ritual: OwnerClosingRitualOutput;
  savedAt: string | null;
}) {
  if (!isOpen) {
    return null;
  }

  const reviewSteps = ritual.steps.filter((step): step is OwnerClosingRitualStep & { id: Exclude<OwnerClosingRitualStepId, 'review'> } =>
    isClosingCheckStep(step.id)
  );
  const canSave = ritual.completion.readyToClose;

  return (
    <div className="ol-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="closing-dialog-title">
      <div className="ol-dialog-card ol-closing-dialog">
        <div className="ol-dialog-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 10 }}>
              <span className={`ol-chip ol-chip--${savedAt ? 'success' : ritual.flags.length ? 'warning' : 'primary'}`}>
                {savedAt ? 'Saved' : ritual.flags.length ? 'Review needed' : 'Ready'}
              </span>
              <span className="ol-chip ol-chip--primary">
                {ritual.completion.completed}/{ritual.completion.total - 1} checks
              </span>
            </div>
            <h2 id="closing-dialog-title">3-minute closing</h2>
            <p>{ritual.summary}</p>
          </div>
          <button className="ol-button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ol-closing-cash-band">
          <div>
            <div className="ol-panel-title">Cash check</div>
            <p className="ol-panel-copy">Count today’s cash and compare it with recorded payments.</p>
          </div>
          <label className="ol-field">
            <span className="ol-field-label">Cash counted</span>
            <input
              className="ol-input"
              inputMode="decimal"
              placeholder={formatCurrency(0, currency)}
              value={countedCashInput}
              onChange={(event) => onCountedCashChange(event.target.value)}
            />
          </label>
        </div>

        <div className="ol-closing-check-grid">
          {reviewSteps.map((step) => (
            <label className="ol-closing-check" data-tone={step.tone} key={step.id}>
              <input
                checked={checks[step.id]}
                type="checkbox"
                onChange={(event) => onToggleCheck(step.id, event.target.checked)}
              />
              <span>
                <strong>{step.title}</strong>
                <small>{step.prompt}</small>
                <em>{step.helper}</em>
              </span>
            </label>
          ))}
        </div>

        <div className="ol-split-grid">
          <article className="ol-form-band">
            <div className="ol-form-band-title">Items to review</div>
            <div className="ol-list" style={{ marginTop: 12 }}>
              {ritual.flags.map((flag) => (
                <Link className="ol-list-item ol-list-action" href={getClosingHref(flag.target)} key={flag.id}>
                  <div className="ol-list-icon" data-tone={flag.tone}>{getClosingIcon(flag.target)}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{flag.title}</div>
                    <div className="ol-list-text">{flag.message}</div>
                    <span className="ol-action-link">{flag.actionLabel}</span>
                  </div>
                </Link>
              ))}
              {!ritual.flags.length ? (
                <div className="ol-list-item">
                  <div className="ol-list-icon" data-tone="success">✓</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">No review item waiting</div>
                    <div className="ol-list-text">Today can be closed after the checks are confirmed.</div>
                  </div>
                </div>
              ) : null}
            </div>
          </article>

          <article className="ol-form-band">
            <div className="ol-form-band-title">Tomorrow actions</div>
            <div className="ol-list" style={{ marginTop: 12 }}>
              {ritual.tomorrowActions.map((action) => (
                <Link className="ol-list-item ol-list-action" href={getClosingHref(action.target)} key={action.id}>
                  <div className="ol-list-icon" data-tone={action.tone}>{getClosingIcon(action.target)}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{action.title}</div>
                    <div className="ol-list-text">{action.message}</div>
                    <span className="ol-action-link">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          </article>
        </div>

        {savedAt ? <div className="ol-message ol-message--success">Closing saved for today.</div> : null}

        <div className="ol-actions">
          <button className="ol-button" disabled={!canSave} type="button" onClick={onSave}>
            Save closing
          </button>
          <button className="ol-button-secondary" type="button" onClick={onClose}>
            Keep reviewing
          </button>
        </div>
      </div>
    </div>
  );
}

function MistakeRecoveryDialog({
  actions,
  guardrails,
  isOpen,
  onClose,
  summary,
}: {
  actions: MistakeRecoveryAction[];
  guardrails: string[];
  isOpen: boolean;
  onClose(): void;
  summary: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="ol-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="recovery-dialog-title">
      <div className="ol-dialog-card ol-recovery-dialog">
        <div className="ol-dialog-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 10 }}>
              <span className={`ol-chip ol-chip--${actions.length ? 'warning' : 'success'}`}>
                {actions.length ? 'Review suggested' : 'Nothing waiting'}
              </span>
              <span className="ol-chip ol-chip--primary">Audit friendly</span>
            </div>
            <h2 id="recovery-dialog-title">Mistake Recovery</h2>
            <p>{summary}</p>
          </div>
          <button className="ol-button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ol-recovery-dialog-grid">
          <article className="ol-form-band">
            <div className="ol-form-band-title">Suggested fixes</div>
            <div className="ol-list" style={{ marginTop: 12 }}>
              {(actions.length ? actions : buildRecoveryEmptyCards()).map((action) => (
                <Link
                  className="ol-list-item ol-list-action"
                  href={getRecoveryHref(action.target)}
                  key={action.id}
                  onClick={onClose}
                >
                  <div className="ol-list-icon" data-tone={action.tone}>{getRecoveryIcon(action.target)}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{action.title}</div>
                    <div className="ol-list-text">{action.message}</div>
                    <div className="ol-recovery-meta-row">
                      <span>{formatRecoveryRisk(action.risk)}</span>
                      {action.requiresReason ? <span>Reason required</span> : null}
                      {action.preservesHistory ? <span>History kept</span> : null}
                    </div>
                    <span className="ol-action-link">{action.primaryAction}</span>
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <article className="ol-form-band">
            <div className="ol-form-band-title">Recovery rules</div>
            <div className="ol-recovery-guardrails">
              {guardrails.slice(0, 6).map((guardrail) => (
                <div className="ol-recovery-guardrail" key={guardrail}>
                  <span>✓</span>
                  <p>{guardrail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

function LocalIntelligenceCard({ item }: { item: LocalBusinessIntelligenceItem }) {
  return (
    <Link className="ol-local-intelligence-card" data-tone={item.tone} href={getLocalIntelligenceHref(item.actionTarget)}>
      <div className="ol-local-intelligence-card-top">
        <span className="ol-local-intelligence-icon">{getLocalIntelligenceIcon(item.id)}</span>
        <span className={`ol-chip ol-chip--${item.priority === 'critical' ? 'warning' : item.tone === 'success' ? 'success' : 'primary'}`}>
          {item.localityLabel}
        </span>
      </div>
      <div>
        <strong>{item.title}</strong>
        <p>{item.message}</p>
      </div>
      <small>{item.helper}</small>
      <span className="ol-action-link">{item.actionLabel}</span>
    </Link>
  );
}

function buildLocalIntelligenceEmptyItems(countryCode?: string | null): LocalBusinessIntelligenceItem[] {
  const country = countryCode?.trim().toUpperCase() || 'IN';
  return [
    {
      id: 'regional_formatting',
      title: 'Local settings look ready',
      message: 'Country, currency, document, and payment basics look ready for this workspace.',
      helper: 'Local guidance will appear here when a setting or review needs attention.',
      priority: 'low',
      score: 0,
      tone: 'success',
      actionLabel: 'Review settings',
      actionTarget: 'open_settings',
      countryCode: country,
      localityLabel: country,
    },
  ];
}

function getLocalIntelligenceHref(target: LocalBusinessIntelligenceActionTarget) {
  if (target === 'open_tax_setup' || target === 'open_payment_settings' || target === 'open_document_settings' || target === 'open_settings') {
    return '/settings';
  }
  if (target === 'open_collection_coach') {
    return '/customers';
  }
  return '/reports';
}

function getLocalIntelligenceIcon(area: LocalBusinessIntelligenceItem['id']) {
  if (area === 'tax_labels' || area === 'compliance_review') {
    return 'TAX';
  }
  if (area === 'payment_wording') {
    return 'PAY';
  }
  if (area === 'document_pack') {
    return 'DOC';
  }
  if (area === 'collection_timing') {
    return 'DUE';
  }
  if (area === 'seasonal_nudge') {
    return 'CAL';
  }
  return 'LOC';
}

function getDialogForTarget(target: DailyActionCenterActionTarget): DashboardDialog {
  if (target === 'open_collections') {
    return 'collections';
  }
  if (target === 'open_invoices') {
    return 'invoices';
  }
  if (target === 'open_inventory') {
    return 'inventory';
  }
  if (target === 'open_payment_review') {
    return 'payments';
  }
  if (target === 'open_daily_closing') {
    return 'closing';
  }
  return null;
}

function isClosingCheckStep(step: OwnerClosingRitualStepId): step is Exclude<OwnerClosingRitualStepId, 'review'> {
  return step !== 'review';
}

function getHrefForTarget(target: DailyActionCenterActionTarget) {
  if (target === 'open_backup') {
    return '/backup';
  }
  if (target === 'open_business_health') {
    return '/reports';
  }
  return '/dashboard';
}

function getClosingHref(target: string) {
  if (target === 'review_payments') {
    return '/payments';
  }
  if (target === 'review_credit' || target === 'count_cash') {
    return '/transactions';
  }
  if (target === 'review_stock') {
    return '/products';
  }
  if (target === 'plan_follow_up' || target === 'open_collections') {
    return '/customers';
  }
  return '/dashboard';
}

function getClosingIcon(target: string) {
  if (target === 'review_payments') {
    return 'P';
  }
  if (target === 'review_credit' || target === 'count_cash') {
    return '₹';
  }
  if (target === 'review_stock') {
    return 'S';
  }
  if (target === 'plan_follow_up' || target === 'open_collections') {
    return 'C';
  }
  return '✓';
}

function getActionIcon(id: string) {
  if (id === 'collections') {
    return '₹';
  }
  if (id === 'invoices') {
    return 'I';
  }
  if (id === 'inventory') {
    return 'S';
  }
  if (id === 'payments') {
    return 'P';
  }
  if (id === 'backup') {
    return 'B';
  }
  if (id === 'business_health') {
    return 'H';
  }
  return 'C';
}

function buildDashboardMistakeRecoverySignals({
  customers,
  invoices,
  manualPayments,
  products,
  transactions,
}: {
  customers: WorkspaceCustomer[];
  invoices: WorkspaceInvoice[];
  manualPayments: WorkspaceManualPaymentReviewItem[];
  products: WorkspaceProduct[];
  transactions: WorkspaceTransaction[];
}): MistakeRecoverySignal[] {
  const signals: MistakeRecoverySignal[] = [];

  const bouncedOrCancelledPayment = manualPayments.find((payment) =>
    ['bounced', 'cancelled', 'errored'].includes(payment.paymentClearanceStatus)
  );
  if (bouncedOrCancelledPayment) {
    signals.push({
      id: bouncedOrCancelledPayment.transactionId,
      area: 'payments',
      kind: 'payment_bounced_or_refunded',
      amount: bouncedOrCancelledPayment.amount,
      hasPaymentAllocation: Boolean(bouncedOrCancelledPayment.allocationId || bouncedOrCancelledPayment.invoiceId),
    });
  }

  const allocatedPaymentNeedingReview = manualPayments.find(
    (payment) => payment.invoiceId && payment.paymentClearanceStatus !== 'cleared'
  );
  if (allocatedPaymentNeedingReview) {
    signals.push({
      id: allocatedPaymentNeedingReview.transactionId,
      area: 'payments',
      kind: 'payment_applied_wrong_invoice',
      amount: allocatedPaymentNeedingReview.amount,
      hasPaymentAllocation: true,
    });
  }

  const revisedInvoice = invoices.find(
    (invoice) => !invoice.isArchived && invoice.documentState === 'revised' && invoice.versionNumber > 1
  );
  if (revisedInvoice) {
    signals.push({
      id: revisedInvoice.id,
      area: 'invoices',
      kind: 'saved_invoice_wrong',
      hasFinalRecord: true,
    });
  }

  const staleDraft = invoices.find((invoice) => !invoice.isArchived && invoice.documentState === 'draft');
  if (staleDraft) {
    signals.push({
      id: staleDraft.id,
      area: 'invoices',
      kind: 'invoice_draft_wrong',
      canEditDirectly: true,
    });
  }

  const duplicateCustomer = findDuplicateCustomer(customers);
  if (duplicateCustomer) {
    signals.push({
      id: duplicateCustomer.id,
      area: 'customers',
      kind: 'duplicate_customer',
      hasFinalRecord: true,
    });
  }

  const highRiskBalance = customers.find(
    (customer) => !customer.isArchived && customer.balance > 0 && customer.health.rank === 'high_risk'
  );
  if (highRiskBalance) {
    signals.push({
      id: highRiskBalance.id,
      area: 'customer_ledger',
      kind: 'customer_balance_wrong',
      amount: highRiskBalance.balance,
      hasAuditImpact: true,
    });
  }

  const negativeStock = products.find((product) => product.stockQuantity < 0);
  if (negativeStock) {
    signals.push({
      id: negativeStock.id,
      area: 'inventory',
      kind: 'stock_count_wrong',
      hasAuditImpact: true,
    });
  }

  const correctionEntry = transactions.find((transaction) =>
    /\b(correct|correction|wrong|mistake|reverse|reversal|bounced)\b/i.test(transaction.note ?? '')
  );
  if (correctionEntry) {
    signals.push({
      id: correctionEntry.id,
      area: 'customer_ledger',
      kind: 'customer_balance_wrong',
      amount: correctionEntry.amount,
      hasAuditImpact: true,
    });
  }

  return uniqueSignals(signals).slice(0, 6);
}

function findDuplicateCustomer(customers: WorkspaceCustomer[]) {
  const seen = new Map<string, WorkspaceCustomer>();
  for (const customer of customers) {
    if (customer.isArchived) {
      continue;
    }
    const key = `${customer.name.trim().toLowerCase()}|${customer.phone?.replace(/\D/g, '') ?? ''}`;
    if (!customer.name.trim() || key.endsWith('|')) {
      continue;
    }
    const existing = seen.get(key);
    if (existing) {
      return customer.balance >= existing.balance ? customer : existing;
    }
    seen.set(key, customer);
  }
  return null;
}

function uniqueSignals(signals: MistakeRecoverySignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.kind}:${signal.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildRecoveryEmptyCards(): MistakeRecoveryAction[] {
  return [
    {
      id: 'empty-recovery',
      area: 'settings',
      title: 'No risky correction waiting',
      message: 'When a payment, invoice, balance, stock count, or restore needs review, Orbit Ledger will guide the safest fix here.',
      primaryAction: 'Review workspace',
      target: 'review_setting_audit',
      risk: 'low',
      tone: 'success',
      requiresReason: false,
      preservesHistory: true,
      guardrails: [],
    },
  ];
}

function getRecoveryHref(target: MistakeRecoveryActionTarget) {
  if (['correct_payment', 'move_payment', 'reverse_payment'].includes(target)) {
    return '/payments';
  }
  if (['edit_draft', 'create_invoice_revision', 'restore_invoice_version', 'cancel_invoice', 'send_corrected_document'].includes(target)) {
    return '/invoices';
  }
  if (['add_ledger_correction', 'merge_customer', 'mark_customer_inactive'].includes(target)) {
    return '/customers';
  }
  if (target === 'adjust_stock') {
    return '/products';
  }
  if (target === 'review_setting_audit') {
    return '/settings';
  }
  if (target === 'open_restore_review') {
    return '/backup';
  }
  return '/dashboard';
}

function getRecoveryIcon(target: MistakeRecoveryActionTarget) {
  if (['correct_payment', 'move_payment', 'reverse_payment'].includes(target)) {
    return '₹';
  }
  if (['edit_draft', 'create_invoice_revision', 'restore_invoice_version', 'cancel_invoice', 'send_corrected_document'].includes(target)) {
    return 'I';
  }
  if (['add_ledger_correction', 'merge_customer', 'mark_customer_inactive'].includes(target)) {
    return 'C';
  }
  if (target === 'adjust_stock') {
    return 'S';
  }
  if (target === 'open_restore_review') {
    return 'B';
  }
  return 'R';
}

function formatRecoveryRisk(risk: MistakeRecoveryAction['risk']) {
  if (risk === 'blocked') {
    return 'Blocked';
  }
  if (risk === 'protected') {
    return 'Protected';
  }
  if (risk === 'review') {
    return 'Review';
  }
  return 'Low risk';
}

function getRecoveryChipTone(risk: MistakeRecoveryAction['risk']) {
  if (risk === 'blocked' || risk === 'protected') {
    return 'warning';
  }
  if (risk === 'review') {
    return 'primary';
  }
  return 'success';
}

function buildDashboardAutoEmailWarnings(
  rules: WorkspaceRecurringInvoiceRule[],
  invoices: WorkspaceInvoice[],
  today = new Date().toISOString().slice(0, 10)
) {
  return rules
    .filter((rule) => rule.status === 'active' && rule.emailEnabled && rule.nextEmailDate && daysBetween(today, rule.nextEmailDate) <= 3)
    .slice(0, 3)
    .map((rule) => {
      const billingMonth = rule.nextEmailDate?.slice(0, 7) ?? today.slice(0, 7);
      const monthInvoices = invoices.filter(
        (invoice) =>
          invoice.customerId === rule.customerId &&
          (invoice.billingMonth ?? invoice.issueDate.slice(0, 7)) === billingMonth &&
          invoice.documentState !== 'cancelled' &&
          !invoice.isArchived
      );
      const enabledInvoice = monthInvoices.find((invoice) => invoice.useForMonthlyAutoEmail);
      return {
        id: rule.id,
        ruleId: rule.id,
        title: `${rule.customerName ?? 'Customer'} auto email`,
        message:
          rule.emailApprovalRequired || !rule.emailAutomationApproved
            ? 'Approval is needed before automatic sending resumes.'
            : enabledInvoice
              ? `The latest selected invoice version will be sent on ${rule.nextEmailDate}.`
              : monthInvoices.length
                ? 'An invoice exists, but it is not enabled for monthly auto email yet.'
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

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseClosingAmount(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function closingStorageKey(workspaceId: string, date: string) {
  return `orbit_ledger_web_closing_${workspaceId}_${date}`;
}

function loadClosingState(workspaceId: string, date: string): {
  checks: ClosingCheckState;
  countedCashInput: string;
  savedAt: string | null;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(closingStorageKey(workspaceId, date));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<{
      checks: Partial<ClosingCheckState>;
      countedCashInput: string;
      savedAt: string | null;
    }>;
    return {
      checks: {
        ...DEFAULT_CLOSING_CHECKS,
        ...(parsed.checks ?? {}),
      },
      countedCashInput: typeof parsed.countedCashInput === 'string' ? parsed.countedCashInput : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
    };
  } catch {
    return null;
  }
}

function saveClosingState(
  workspaceId: string,
  date: string,
  state: {
    checks: ClosingCheckState;
    countedCashInput: string;
    savedAt: string;
  }
) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(closingStorageKey(workspaceId, date), JSON.stringify(state));
}
