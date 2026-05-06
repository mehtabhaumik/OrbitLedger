'use client';

import {
  getLocalBusinessPack,
  getOrbitLedgerControlledPaymentTestReadiness,
  getOrbitLedgerMonetizationFreezeReadiness,
  getOrbitLedgerPriceMappingValidation,
  getOrbitLedgerPurchaseProviderSafetyState,
  getOrbitLedgerPurchaseSupportPolicies,
  ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS,
  type OrbitLedgerPaidPlanId,
  type OrbitLedgerControlledPaymentTestReadiness,
  type OrbitLedgerMonetizationFreezeReadiness,
  type OrbitLedgerControlledPaymentTestStep,
  type OrbitLedgerPriceMappingValidation,
  type OrbitLedgerPurchaseProviderSafetyState,
  type OrbitLedgerPurchaseSupportPolicy,
} from '@orbit-ledger/core';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  downloadBillingReceiptPdf,
  openBillingDocumentViewer,
  type WebSubscriptionBillingDocument,
} from '@/lib/subscription-billing-documents';
import {
  createBillingPortalSession,
  createSubscriptionCheckout,
  manageSubscriptionBillingDocument,
} from '@/lib/subscription-checkout';
import {
  cancelSubscriptionRenewalChange,
  loadSubscriptionPurchaseReview,
  loadSubscriptionRenewalAudit,
  loadSubscriptionRenewalChanges,
  queueSubscriptionRenewalChange,
  type WebSubscriptionBillingFields,
  type WebSubscriptionCheckoutRecord,
  type WebSubscriptionEntitlementAuditItem,
  type WebSubscriptionPurchaseEvent,
  type WebSubscriptionPurchaseReview,
  type WebSubscriptionRenewalAuditItem,
  type WebSubscriptionRenewalChange,
} from '@/lib/subscription-entitlements';
import {
  buildWebPurchaseOperationsSnapshot,
  type WebPurchaseOperationsSnapshot,
} from '@/lib/subscription-operations';
import {
  buildRazorpayProviderReadiness,
  type RazorpayProviderReadiness,
} from '@/lib/razorpay-provider-readiness';
import {
  buildWebPurchaseLaunchMonitoringSnapshot,
  type WebPurchaseLaunchMonitoringSnapshot,
} from '@/lib/purchase-launch-monitoring';
import {
  WEB_COUNTRY_PACK_PRODUCT_CATALOG,
  WEB_PRO_BRAND_THEMES,
  WEB_TIER_PLAN_COMPARISON,
  getWebPaidPlanCatalogForCountry,
  getWebPurchaseStatusCopy,
  resolveWebPlanChangeRule,
} from '@/lib/web-monetization';
import { getWebDocumentTemplates } from '@/lib/web-documents';
import { useAuth } from '@/providers/auth-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function MarketPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const {
    status: subscription,
    checkoutIntent,
    startCheckout,
    attachCheckoutProvider,
    failCheckout,
    retryCheckout,
    cancelCheckout,
    resetPlan,
    recoverFromServer,
    isLoading: isSubscriptionLoading,
  } = useWebSubscription();
  const { showToast } = useToast();
  const [preparingPlanId, setPreparingPlanId] = useState<string | null>(null);
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false);
  const [purchaseReview, setPurchaseReview] = useState<WebSubscriptionPurchaseReview | null>(null);
  const [renewalChanges, setRenewalChanges] = useState<WebSubscriptionRenewalChange[]>([]);
  const [renewalAuditItems, setRenewalAuditItems] = useState<WebSubscriptionRenewalAuditItem[]>([]);
  const [isLoadingPurchaseReview, setIsLoadingPurchaseReview] = useState(false);
  const [isSavingRenewalChange, setIsSavingRenewalChange] = useState(false);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [billingDocumentActionId, setBillingDocumentActionId] = useState<string | null>(null);
  const purchaseStatus = getWebPurchaseStatusCopy(
    subscription,
    checkoutIntent,
    isSubscriptionLoading || isCheckingPurchase
  );
  const localPack = activeWorkspace
    ? getLocalBusinessPack({
        countryCode: activeWorkspace.countryCode,
        regionCode: activeWorkspace.stateCode,
      })
    : null;
  const paidPlanCatalog = useMemo(
    () => getWebPaidPlanCatalogForCountry(activeWorkspace?.countryCode ?? 'IN'),
    [activeWorkspace?.countryCode]
  );
  const purchaseOperations = useMemo(
    () => buildWebPurchaseOperationsSnapshot({ checkoutIntent, purchaseReview, renewalChanges }),
    [checkoutIntent, purchaseReview, renewalChanges]
  );
  const razorpayReadiness = useMemo(() => buildRazorpayProviderReadiness(), []);
  const livePriceMapping = useMemo(
    () => getOrbitLedgerPriceMappingValidation({ requireActiveProviderPrices: true }),
    []
  );
  const controlledPaymentReadiness = useMemo(() => getOrbitLedgerControlledPaymentTestReadiness(), []);
  const providerSafety = useMemo(() => getOrbitLedgerPurchaseProviderSafetyState('provider_pending'), []);
  const purchaseSupportPolicies = useMemo(() => getOrbitLedgerPurchaseSupportPolicies(), []);
  const launchMonitoring = useMemo(
    () => buildWebPurchaseLaunchMonitoringSnapshot({ launchStartedAt: null, purchaseReview }),
    [purchaseReview]
  );
  const monetizationFreeze = useMemo(
    () =>
      getOrbitLedgerMonetizationFreezeReadiness({
        providerMode: providerSafety.mode,
        livePriceMapping,
        controlledPayment: controlledPaymentReadiness,
      }),
    [controlledPaymentReadiness, livePriceMapping, providerSafety.mode]
  );
  const invoiceTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'invoice') : [];
  const statementTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'statement') : [];

  async function prepareCheckout(planId: OrbitLedgerPaidPlanId, retryIntentId?: string) {
    if (!activeWorkspace) {
      showToast('Create or select a workspace before starting checkout.', 'info');
      return;
    }

    setPreparingPlanId(planId);
    const intent = retryIntentId ? retryCheckout(retryIntentId) : startCheckout(planId, activeWorkspace.countryCode);
    if (!intent) {
      setPreparingPlanId(null);
      showToast('Checkout could not be prepared. Please try again.', 'danger');
      return;
    }

    try {
      const checkout = await createSubscriptionCheckout({
        workspaceId: activeWorkspace.workspaceId,
        checkoutIntentId: intent.id,
        planId,
        callbackUrl: `${window.location.origin}/market`,
      });
      attachCheckoutProvider(intent.id, {
        provider: checkout.provider,
        amountLabel: checkout.amountDisplay,
        amountMinor: checkout.amountMinor,
        currencyCode: checkout.currency,
        pricingCountryCode: checkout.pricingCountry,
        providerPriceId: checkout.providerPriceId,
        providerPriceStatus: checkout.providerPriceStatus,
        providerCheckoutUrl: checkout.checkoutUrl,
        providerReference: checkout.reference ?? checkout.checkoutId,
      });
      showToast(
        checkout.checkoutUrl
          ? 'Checkout is ready. Plan access turns on only after payment confirmation.'
          : 'Checkout is prepared. Payment activation will be available after the provider is connected.',
        'info'
      );
      void refreshPurchaseReview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Checkout could not be prepared.';
      failCheckout(intent.id, message);
      showToast(`${message} Your current plan did not change.`, 'danger');
      void refreshPurchaseReview();
    } finally {
      setPreparingPlanId(null);
    }
  }

  async function refreshRenewalChanges() {
    if (!activeWorkspace?.workspaceId) {
      setRenewalChanges([]);
      setRenewalAuditItems([]);
      return [];
    }

    try {
      const [changes, auditItems] = await Promise.all([
        loadSubscriptionRenewalChanges(activeWorkspace.workspaceId),
        loadSubscriptionRenewalAudit(activeWorkspace.workspaceId),
      ]);
      setRenewalChanges(changes);
      setRenewalAuditItems(auditItems);
      return changes;
    } catch {
      setRenewalChanges([]);
      setRenewalAuditItems([]);
      return [];
    }
  }

  async function queueRenewalChange(planId: OrbitLedgerPaidPlanId) {
    if (!user?.uid || !activeWorkspace?.workspaceId || !subscription.planId) {
      showToast('Sign in and select a workspace before requesting a renewal change.', 'info');
      return;
    }
    const planChange = resolveWebPlanChangeRule(subscription, planId, checkoutIntent);
    if (!planChange.canQueueRenewalChange || planChange.kind === 'current_plan') {
      showToast(planChange.helper, 'info');
      return;
    }
    const activeChange = renewalChanges.find((item) => item.status === 'queued');
    if (activeChange?.targetPlanId === planId) {
      showToast('This renewal change is already queued.', 'info');
      return;
    }
    if (activeChange) {
      showToast('Cancel the current renewal change before choosing a different one.', 'info');
      return;
    }

    setIsSavingRenewalChange(true);
    try {
      await queueSubscriptionRenewalChange({
        userId: user.uid,
        workspaceId: activeWorkspace.workspaceId,
        currentPlanId: subscription.planId,
        targetPlanId: planId,
        changeKind: planChange.kind === 'downgrade' ? 'downgrade' : 'billing_change',
        applyAfter: subscription.validUntil,
      });
      await refreshRenewalChanges();
      showToast('Renewal change queued. Your current plan stays active until renewal.', 'success');
    } catch {
      showToast('Renewal change could not be saved right now.', 'danger');
    } finally {
      setIsSavingRenewalChange(false);
    }
  }

  async function cancelRenewalChange(changeId: string) {
    if (!activeWorkspace?.workspaceId) {
      return;
    }

    setIsSavingRenewalChange(true);
    try {
      await cancelSubscriptionRenewalChange(activeWorkspace.workspaceId, changeId);
      await refreshRenewalChanges();
      showToast('Renewal change cancelled. Your current plan remains unchanged.', 'info');
    } catch {
      showToast('Renewal change could not be cancelled right now.', 'danger');
    } finally {
      setIsSavingRenewalChange(false);
    }
  }

  async function openBillingPortal() {
    if (!activeWorkspace?.workspaceId) {
      showToast('Select a workspace before opening billing management.', 'info');
      return;
    }

    setIsOpeningBillingPortal(true);
    try {
      const portal = await createBillingPortalSession({
        workspaceId: activeWorkspace.workspaceId,
        callbackUrl: `${window.location.origin}/market`,
      });
      if (portal.portalUrl) {
        window.open(portal.portalUrl, '_blank', 'noopener,noreferrer');
        showToast('Billing portal opened in a new tab.', 'success');
      } else {
        showToast(portal.message ?? 'Billing portal will be available after the payment provider is connected.', 'info');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Billing management could not be opened right now.';
      showToast(message, 'danger');
    } finally {
      setIsOpeningBillingPortal(false);
    }
  }

  async function refreshPurchaseReview() {
    if (!user?.uid || !activeWorkspace?.workspaceId) {
      setPurchaseReview(null);
      return null;
    }

    setIsLoadingPurchaseReview(true);
    try {
      const review = await loadSubscriptionPurchaseReview(user.uid, activeWorkspace.workspaceId);
      setPurchaseReview(review);
      return review;
    } catch {
      setPurchaseReview({ checkouts: [], events: [], auditItems: [] });
      return null;
    } finally {
      setIsLoadingPurchaseReview(false);
    }
  }

  useEffect(() => {
    void refreshPurchaseReview();
    void refreshRenewalChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, activeWorkspace?.workspaceId]);

  function viewBillingDocument(document: WebSubscriptionBillingDocument) {
    try {
      openBillingDocumentViewer(document, activeWorkspace);
      showToast('Billing document opened in a new tab.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Billing document could not be opened.', 'danger');
    }
  }

  async function downloadBillingDocument(document: WebSubscriptionBillingDocument) {
    try {
      await downloadBillingReceiptPdf(document, activeWorkspace);
      showToast('Billing document downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Billing document could not be downloaded.', 'danger');
    }
  }

  async function queueBillingReceiptEmail(checkout: WebSubscriptionCheckoutRecord) {
    if (!activeWorkspace?.workspaceId) {
      showToast('Select a workspace before sending billing email.', 'info');
      return;
    }

    setBillingDocumentActionId(`email:${checkout.id}`);
    try {
      const result = await manageSubscriptionBillingDocument({
        action: 'queue_email',
        workspaceId: activeWorkspace.workspaceId,
        checkoutIntentId: checkout.id,
        recipientEmail: checkout.billingEmailRecipient ?? checkout.buyerEmail ?? activeWorkspace.email,
      });
      await refreshPurchaseReview();
      showToast(result.message ?? receiptEmailActionMessage(result.deliveryStatus, result.recipientEmail), 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Receipt email could not be queued.', 'danger');
    } finally {
      setBillingDocumentActionId(null);
    }
  }

  async function recoverBillingDocument(checkout: WebSubscriptionCheckoutRecord) {
    if (!activeWorkspace?.workspaceId) {
      showToast('Select a workspace before recovering a billing document.', 'info');
      return;
    }

    setBillingDocumentActionId(`recover:${checkout.id}`);
    try {
      const result = await manageSubscriptionBillingDocument({
        action: 'recover_document',
        workspaceId: activeWorkspace.workspaceId,
        checkoutIntentId: checkout.id,
      });
      await refreshPurchaseReview();
      showToast(
        result.receiptNumber ? `Receipt ${result.receiptNumber} is ready for review.` : 'Billing document recovered.',
        'success'
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Billing document could not be recovered.', 'danger');
    } finally {
      setBillingDocumentActionId(null);
    }
  }

  return (
    <AppShell title="Market" subtitle="Plans, document templates, and local business packs for this workspace.">
      <section className="ol-split-grid">
        <article className="ol-panel-dark ol-pricing-panel">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Orbit Ledger plans</div>
              <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
                Start free, then choose the level that matches how often you send documents,
                collect payments, and review office work.
              </p>
            </div>
            <span className={`ol-chip ${subscription.isPro ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
              Current plan: {subscription.tierLabel}
            </span>
          </div>
          <p className="ol-panel-copy" style={{ marginTop: -10 }}>
            {subscription.validUntil
              ? `Plan access is saved for this workspace until ${formatPlanDate(subscription.validUntil)}.`
              : 'Plan access is saved per user and workspace when a purchase is confirmed.'}
          </p>
          <div className={`ol-message ${purchaseStatus.tone === 'restored' || purchaseStatus.tone === 'active' ? 'ol-message--success' : ''}`} style={{ marginTop: 18 }}>
            <div className="ol-market-status">
              <div>
                <strong>{purchaseStatus.title}</strong>
                <p>{purchaseStatus.message}</p>
              </div>
              <span className={`ol-chip ${purchaseStatus.tone === 'pending' ? 'ol-chip--warning' : purchaseStatus.tone === 'free' ? 'ol-chip--primary' : 'ol-chip--success'}`}>
                {purchaseStatus.chip}
              </span>
            </div>
            <div className="ol-actions ol-actions--compact" style={{ marginTop: 12 }}>
              <button
                className="ol-button-secondary"
                disabled={!activeWorkspace || isCheckingPurchase}
                type="button"
                onClick={async () => {
                  setIsCheckingPurchase(true);
                  try {
                    const recovered = await recoverFromServer();
                    showToast(
                      recovered
                        ? `${recovered.tierLabel} access was restored for this workspace.`
                        : 'No confirmed paid purchase was found for this workspace.',
                      recovered ? 'success' : 'info'
                    );
                    void refreshPurchaseReview();
                  } catch {
                    showToast('Purchase status could not be checked right now.', 'danger');
                  } finally {
                    setIsCheckingPurchase(false);
                  }
                }}
              >
                {isCheckingPurchase ? 'Checking status' : 'Check purchase status'}
              </button>
            </div>
          </div>
          <div className="ol-market-grid ol-market-grid--plans">
            {paidPlanCatalog.map((plan) => {
              const planChange = resolveWebPlanChangeRule(subscription, plan.id, checkoutIntent);
              const isPreparingPlan = preparingPlanId === plan.id;
              const isPlanLocked = !planChange.canStartCheckout && !planChange.canQueueRenewalChange;
              const queuedRenewalChange = renewalChanges.find(
                (item) => item.status === 'queued' && item.targetPlanId === plan.id
              );
              return (
                <article className="ol-market-card ol-pricing-card" key={plan.id}>
                  <div className="ol-market-card-header">
                    <div>
                      <div className="ol-market-title">{plan.title}</div>
                      <div className="ol-market-price">{plan.price}</div>
                      <div className="ol-muted">{plan.cadence}</div>
                    </div>
                    <span
                      className={`ol-chip ${
                        planChange.tone === 'success'
                          ? 'ol-chip--success'
                          : planChange.tone === 'warning'
                            ? 'ol-chip--warning'
                            : planChange.tone === 'locked'
                              ? 'ol-chip--muted'
                              : plan.isBestValue
                                ? 'ol-chip--premium'
                                : 'ol-chip--primary'
                      }`}
                    >
                      {plan.isBestValue && planChange.kind === 'new_purchase' ? 'Best value' : planChange.chip}
                    </span>
                  </div>
                  <p>{plan.helper}</p>
                  <p className="ol-muted">{planChange.helper}</p>
                  <button
                    className={plan.isBestValue && !isPlanLocked ? 'ol-button' : 'ol-button-secondary'}
                    disabled={isPlanLocked || Boolean(preparingPlanId) || isSavingRenewalChange || Boolean(queuedRenewalChange)}
                    type="button"
                    onClick={() => {
                      if (queuedRenewalChange) {
                        showToast('This renewal change is already queued.', 'info');
                        return;
                      }
                      if (planChange.canQueueRenewalChange) {
                        void queueRenewalChange(plan.id);
                        return;
                      }
                      if (!planChange.canStartCheckout) {
                        showToast(planChange.helper, 'info');
                        return;
                      }
                      void prepareCheckout(plan.id);
                    }}
                  >
                    {queuedRenewalChange
                      ? 'Queued for renewal'
                      : isPreparingPlan
                        ? 'Preparing checkout'
                        : isSavingRenewalChange && planChange.canQueueRenewalChange
                          ? 'Saving renewal change'
                          : planChange.buttonLabel}
                  </button>
                </article>
              );
            })}
          </div>
          {checkoutIntent?.status === 'pending' || checkoutIntent?.status === 'failed' ? (
            <div className="ol-message" style={{ marginTop: 18 }}>
              {checkoutIntent.status === 'pending'
                ? `Checkout is waiting for payment confirmation: ${checkoutIntent.planLabel} · ${checkoutIntent.amountLabel}. Paid access is not active yet.`
                : `Checkout could not be completed for ${checkoutIntent.planLabel}. ${checkoutIntent.failureReason ?? 'Please retry when ready.'}`}
              <div className="ol-actions" style={{ marginTop: 12 }}>
                {checkoutIntent.status === 'pending' && checkoutIntent.providerCheckoutUrl ? (
                  <a className="ol-button" href={checkoutIntent.providerCheckoutUrl} target="_blank" rel="noreferrer">
                    Continue checkout
                  </a>
                ) : checkoutIntent.status === 'pending' ? (
                  <span className="ol-chip ol-chip--warning">Payment provider not connected</span>
                ) : (
                  <button
                    className="ol-button"
                    disabled={Boolean(preparingPlanId)}
                    type="button"
                    onClick={() => {
                      void prepareCheckout(checkoutIntent.planId, checkoutIntent.id);
                    }}
                  >
                    Retry checkout
                  </button>
                )}
                <button
                  className="ol-button-secondary"
                  type="button"
                  onClick={() => {
                    cancelCheckout(checkoutIntent.id);
                    void refreshPurchaseReview();
                    showToast('Checkout cancelled. Your current plan did not change.', 'info');
                  }}
                >
                  {checkoutIntent.status === 'failed' ? 'Dismiss' : 'Cancel checkout'}
                </button>
              </div>
            </div>
          ) : null}
          {subscription.tier !== 'free' ? (
            <BillingManagementPanel
              currentPlanLabel={subscription.tierLabel}
              isBusy={isSavingRenewalChange || isOpeningBillingPortal}
              isOpeningPortal={isOpeningBillingPortal}
              renewalAuditItems={renewalAuditItems}
              renewalChanges={renewalChanges}
              renewalDate={subscription.validUntil}
              onCancel={(changeId) => {
                void cancelRenewalChange(changeId);
              }}
              onOpenPortal={() => {
                void openBillingPortal();
              }}
            />
          ) : null}
          {subscription.tier !== 'free' ? (
            <div className="ol-actions" style={{ marginTop: 18 }}>
              <button
                className="ol-button-ghost"
                disabled={subscription.source === 'server_entitlement'}
                type="button"
                onClick={() => {
                  resetPlan();
                  showToast('Plan reset to Free for this workspace.', 'info');
                }}
              >
                {subscription.source === 'server_entitlement' ? 'Confirmed purchase active' : 'Reset to Free'}
              </button>
            </div>
          ) : null}
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            How to choose
          </div>
          <div className="ol-list">
            {[
              ['Free', 'Daily ledger, customers, basic invoices, exports, backup, and restore.'],
              ['Plus', 'Customer reports, health ranking, payment links, proof files, and batch statements.'],
              ['Pro Plus', 'Premium templates, branding, recurring auto email, tax surfaces, and reconciliation.'],
              ['Office', 'Bulk operations, team controls, accountant exports, and priority support.'],
            ].map(([tier, detail]) => (
              <div className="ol-list-item" key={tier}>
                <div className="ol-list-icon">{tier.slice(0, 1)}</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{tier}</div>
                  <div className="ol-list-text">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <PurchaseOperationsDashboard
        snapshot={purchaseOperations}
        isRefreshing={isLoadingPurchaseReview}
        onRefresh={() => {
          void refreshPurchaseReview();
          void refreshRenewalChanges();
        }}
      />

      <RazorpayReadinessPanel readiness={razorpayReadiness} />

      <LivePriceMappingPanel validation={livePriceMapping} />

      <ControlledPaymentTestPanel readiness={controlledPaymentReadiness} steps={ORBIT_LEDGER_CONTROLLED_PAYMENT_TEST_STEPS} />

      <ProviderRollbackPanel safety={providerSafety} />

      <PurchaseSupportPolicyPanel policies={purchaseSupportPolicies} />

      <First72HoursMonitoringPanel snapshot={launchMonitoring} />

      <MonetizationFreezePanel freeze={monetizationFreeze} />

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Purchase review</div>
            <p className="ol-panel-copy">
              Review checkout events and confirmed plan changes for this workspace.
            </p>
          </div>
          <div className="ol-actions ol-actions--compact">
            <span className={`ol-chip ${subscription.source === 'server_entitlement' ? 'ol-chip--success' : 'ol-chip--primary'}`}>
              {subscription.source === 'server_entitlement' ? 'Server confirmed' : 'No confirmed purchase'}
            </span>
            <button
              className="ol-button-secondary"
              disabled={isLoadingPurchaseReview}
              type="button"
              onClick={() => {
                void refreshPurchaseReview();
              }}
            >
              {isLoadingPurchaseReview ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="ol-page-grid ol-page-grid--2">
          <PurchaseReviewList
            emptyText="No billing documents have been prepared yet."
            items={(purchaseReview?.checkouts ?? []).map((checkout) => {
              const document = billingDocumentFromCheckout(checkout);
              return {
                id: checkout.id,
                title: purchasePlanLabel(checkout.planId),
                chip: checkout.status,
                meta: [checkout.provider, formatPlanDateTime(checkout.updatedAt)].filter(Boolean).join(' · '),
                detail: checkout.receiptNumber
                  ? `Receipt ${checkout.receiptNumber}`
                  : checkout.checkoutIntentId
                    ? `Checkout ${checkout.checkoutIntentId}`
                    : 'Billing document is being prepared.',
                secondaryDetail: [
                  checkout.amountDisplay,
                  checkout.taxInvoiceNumber ? `Tax invoice ${checkout.taxInvoiceNumber}` : null,
                  billingTaxReviewDetail(checkout),
                  billingEmailDetail(checkout),
                ].filter(Boolean).join(' · '),
                actions: [
                  {
                    label: 'View',
                    onClick: () => {
                      viewBillingDocument(document);
                    },
                  },
                  {
                    label: 'Download',
                    onClick: () => {
                      void downloadBillingDocument(document);
                    },
                  },
                  {
                    label:
                      billingDocumentActionId === `email:${checkout.id}`
                        ? checkout.billingEmailRequestId
                          ? 'Resending'
                          : 'Queuing email'
                        : checkout.billingEmailRequestId
                          ? 'Resend receipt'
                          : 'Email receipt',
                    disabled: billingDocumentActionId !== null || !billingDocumentCanEmail(checkout, activeWorkspace?.email),
                    onClick: () => {
                      void queueBillingReceiptEmail(checkout);
                    },
                  },
                  {
                    label: billingDocumentActionId === `recover:${checkout.id}` ? 'Recovering' : 'Recover',
                    disabled: billingDocumentActionId !== null,
                    onClick: () => {
                      void recoverBillingDocument(checkout);
                    },
                  },
                ],
              };
            })}
            title="Billing documents"
          />
          <PurchaseReviewList
            emptyText="No purchase events have been recorded yet."
            items={(purchaseReview?.events ?? []).map((event) => {
              const document = billingDocumentFromPurchaseEvent(event);
              return {
                id: event.id,
                title: purchasePlanLabel(event.planId),
                chip: event.status,
                meta: [event.provider, formatPlanDateTime(event.receivedAt)].filter(Boolean).join(' · '),
                detail: event.transactionId
                  ? `Transaction ${event.transactionId}`
                  : event.providerReference
                    ? `Reference ${event.providerReference}`
                    : event.checkoutIntentId
                      ? `Checkout ${event.checkoutIntentId}`
                      : event.receiptNumber
                        ? `Receipt ${event.receiptNumber}`
                        : 'Waiting for confirmation details.',
                secondaryDetail: [
                  event.amountDisplay,
                  event.receiptNumber ? `Receipt ${event.receiptNumber}` : null,
                  event.taxInvoiceNumber ? `Tax invoice ${event.taxInvoiceNumber}` : null,
                  billingTaxReviewDetail(event),
                ].filter(Boolean).join(' · '),
                actions: event.receiptNumber
                  ? [
                      {
                        label: 'View',
                        onClick: () => {
                          viewBillingDocument(document);
                        },
                      },
                      {
                        label: 'Download',
                        onClick: () => {
                          void downloadBillingDocument(document);
                        },
                      },
                    ]
                  : undefined,
              };
            })}
            title="Checkout events"
          />
          <PurchaseReviewList
            emptyText="No entitlement changes have been confirmed yet."
            items={(purchaseReview?.auditItems ?? []).map((item) => {
              const document = billingDocumentFromAuditItem(item);
              return {
                id: item.id,
                title: purchaseActionLabel(item.action),
                chip: item.status,
                meta: [purchasePlanLabel(item.planId), formatPlanDateTime(item.receivedAt)].filter(Boolean).join(' · '),
                detail: item.validUntil
                  ? `Access valid until ${formatPlanDate(item.validUntil)}.`
                  : item.transactionId
                    ? `Transaction ${item.transactionId}.`
                    : item.receiptNumber
                      ? `Receipt ${item.receiptNumber}.`
                      : 'Recorded for review.',
                secondaryDetail: [
                  item.amountDisplay,
                  item.receiptNumber ? `Receipt ${item.receiptNumber}` : null,
                  item.taxInvoiceNumber ? `Tax invoice ${item.taxInvoiceNumber}` : null,
                  billingTaxReviewDetail(item),
                ].filter(Boolean).join(' · '),
                actions: item.receiptNumber
                  ? [
                      {
                        label: 'View',
                        onClick: () => {
                          viewBillingDocument(document);
                        },
                      },
                      {
                        label: 'Download',
                        onClick: () => {
                          void downloadBillingDocument(document);
                        },
                      },
                    ]
                  : undefined,
              };
            })}
            title="Entitlement audit"
          />
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Compare plans</div>
            <p className="ol-panel-copy">
              See what each plan adds before you decide.
            </p>
          </div>
          <span className="ol-chip ol-chip--premium">Upgrade only when the extra workflow saves time</span>
        </div>
        <div className="ol-plan-compare ol-plan-compare--tiers">
          <div className="ol-plan-compare-row ol-plan-compare-row--head ol-plan-compare-row--tiers">
            <span>Feature</span>
            <span>Free</span>
            <span>Plus</span>
            <span>Pro Plus</span>
            <span>Office</span>
          </div>
          {WEB_TIER_PLAN_COMPARISON.map((item) => (
            <div className="ol-plan-compare-row ol-plan-compare-row--tiers" key={item.feature}>
              <strong>{item.feature}</strong>
              <span>{item.free}</span>
              <span className={item.highlightTier === 'plus' ? 'ol-plan-compare-pro' : undefined}>{item.plus}</span>
              <span className={item.highlightTier === 'pro' ? 'ol-plan-compare-pro' : undefined}>{item.pro}</span>
              <span className={item.highlightTier === 'office' ? 'ol-plan-compare-pro' : undefined}>{item.office}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Current business pack</div>
            <p className="ol-panel-copy">
              Local labels, reminders, document wording, and starter compliance summaries follow
              the selected market.
            </p>
          </div>
          <span className="ol-chip ol-chip--success">{localPack?.packageName ?? 'Business Pack'}</span>
        </div>
        <div className="ol-review-grid">
          <Review label="Market" value={localPack?.marketName ?? 'General'} />
          <Review label="Tax label" value={localPack?.labels.taxName ?? 'Tax'} />
          <Review label="Invoice" value={localPack?.documents.invoiceTitle ?? 'Invoice'} />
          <Review label="Statement" value={localPack?.documents.statementTitle ?? 'Statement'} />
          <Review label="Collection rhythm" value={localPack?.rhythms.collectionWindow ?? 'Daily review'} />
          <Review label="Compliance summary" value={localPack?.compliance.summaryLabel ?? 'Starter tax summary'} />
        </div>
      </section>

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Country packs
          </div>
          <div className="ol-market-grid">
            {WEB_COUNTRY_PACK_PRODUCT_CATALOG.map((pack) => (
              <article className="ol-market-card" key={pack.productId}>
                <div className="ol-market-card-header">
                  <div className="ol-market-title">{pack.title}</div>
                  <span className="ol-chip ol-chip--warning">{pack.availabilityLabel}</span>
                </div>
                <div className="ol-market-price">{pack.fallbackPrice}</div>
                <p>{pack.helper}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Pro document themes
          </div>
          <div className="ol-market-grid">
            {Object.values(WEB_PRO_BRAND_THEMES).map((theme) => (
              <article className="ol-market-card" key={theme.key}>
                <div className="ol-theme-swatch" style={{ background: theme.accentColor }} />
                <div className="ol-market-title">{theme.label}</div>
                <p>{theme.description}</p>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Document templates included on web</div>
            <p className="ol-panel-copy">
              Invoice and statement templates use the same Orbit Ledger catalog with web-specific
              review, print, and download controls.
            </p>
          </div>
        </div>
        <div className="ol-market-grid">
          {[...invoiceTemplates, ...statementTemplates].map((template) => (
            <article className="ol-market-card" key={template.key}>
              <div className="ol-market-card-header">
                <div className="ol-market-title">{template.label}</div>
                <span className={`ol-chip ${template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
                  {template.tier === 'pro' ? 'Pro Plus' : 'Free'}
                </span>
              </div>
              <p>{template.description}</p>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function BillingManagementPanel({
  currentPlanLabel,
  isBusy,
  isOpeningPortal,
  onCancel,
  onOpenPortal,
  renewalAuditItems,
  renewalChanges,
  renewalDate,
}: {
  currentPlanLabel: string;
  isBusy: boolean;
  isOpeningPortal: boolean;
  onCancel(changeId: string): void;
  onOpenPortal(): void;
  renewalAuditItems: WebSubscriptionRenewalAuditItem[];
  renewalChanges: WebSubscriptionRenewalChange[];
  renewalDate: string | null;
}) {
  const activeChanges = renewalChanges.filter((item) => item.status === 'queued');

  return (
    <div className="ol-message" style={{ marginTop: 18 }}>
      <div className="ol-market-status">
        <div>
          <strong>Billing management</strong>
          <p>
            {activeChanges.length
              ? 'A renewal change is queued. Your current plan stays active until the renewal date.'
              : 'Renewal changes can be queued here. Current access does not change until renewal.'}
          </p>
        </div>
        <span className="ol-chip ol-chip--warning">Portal coming soon</span>
      </div>
      <div className="ol-actions ol-actions--compact" style={{ marginTop: 12 }}>
        <button
          className="ol-button-secondary"
          disabled={isBusy}
          type="button"
          onClick={onOpenPortal}
        >
          {isOpeningPortal ? 'Opening billing management' : 'Open billing management'}
        </button>
      </div>
      <div className="ol-review-grid" style={{ marginTop: 12 }}>
        <Review label="Current plan" value={currentPlanLabel} />
        <Review label="Renewal date" value={renewalDate ? formatPlanDate(renewalDate) : 'Not set yet'} />
        <Review label="Billing portal" value="Not connected yet" />
      </div>
      {activeChanges.length ? (
        <div className="ol-list" style={{ marginTop: 14 }}>
          {activeChanges.map((change) => (
            <div className="ol-list-item" key={change.id}>
              <div className="ol-list-icon">R</div>
              <div className="ol-list-copy">
                <div className="ol-market-card-header">
                  <div>
                    <div className="ol-list-title">
                      {change.currentPlanLabel} to {change.targetPlanLabel}
                    </div>
                    <div className="ol-list-text">
                      Applies at renewal{change.applyAfter ? ` after ${formatPlanDate(change.applyAfter)}` : ''}.
                      {' '}Review status: {renewalReviewLabel(change.reviewStatus)}.
                    </div>
                  </div>
                  <span className={`ol-chip ${change.reviewStatus === 'ready_for_review' ? 'ol-chip--premium' : 'ol-chip--warning'}`}>
                    {renewalReviewLabel(change.reviewStatus)}
                  </span>
                </div>
                <div className="ol-list-text" style={{ marginTop: 4 }}>
                  {change.lastReviewNote ?? 'This request is waiting for billing review.'}
                </div>
                <div className="ol-actions ol-actions--compact" style={{ marginTop: 10 }}>
                  <button
                    className="ol-button-secondary"
                    disabled={isBusy}
                    type="button"
                    onClick={() => {
                      onCancel(change.id);
                    }}
                  >
                    Cancel renewal change
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {renewalAuditItems.length ? (
        <div className="ol-list" style={{ marginTop: 14 }}>
          {renewalAuditItems.map((item) => (
            <div className="ol-list-item" key={item.id}>
              <div className="ol-list-icon">A</div>
              <div className="ol-list-copy">
                <div className="ol-market-card-header">
                  <div>
                    <div className="ol-list-title">{renewalAuditActionLabel(item.action)}</div>
                    <div className="ol-list-text">
                      {[item.currentPlanLabel && item.targetPlanLabel ? `${item.currentPlanLabel} to ${item.targetPlanLabel}` : null, formatPlanDateTime(item.createdAt)]
                        .filter(Boolean)
                        .join(' · ') || 'Recorded'}
                    </div>
                  </div>
                  <span className={`ol-chip ${item.reviewStatus === 'completed' ? 'ol-chip--success' : item.reviewStatus === 'rejected' || item.reviewStatus === 'cancelled' ? 'ol-chip--warning' : 'ol-chip--primary'}`}>
                    {renewalAuditStatusLabel(item.reviewStatus)}
                  </span>
                </div>
                <div className="ol-list-text" style={{ marginTop: 4 }}>
                  {item.note ?? 'Renewal review activity was recorded.'}
                  {item.resolvedBy ? ` Reviewed by ${item.resolvedBy}.` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PurchaseOperationsDashboard({
  isRefreshing,
  onRefresh,
  snapshot,
}: {
  isRefreshing: boolean;
  onRefresh(): void;
  snapshot: WebPurchaseOperationsSnapshot;
}) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Purchase operations</div>
          <p className="ol-panel-copy">
            Admin review for checkout failures, provider setup, receipt recovery, billing email delivery,
            tax review, and renewal changes.
          </p>
        </div>
        <div className="ol-actions ol-actions--compact">
          <span className={`ol-chip ${snapshot.health.tone === 'success' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
            {snapshot.health.tone === 'success' ? 'Clear' : 'Needs review'}
          </span>
          <button className="ol-button-secondary" disabled={isRefreshing} type="button" onClick={onRefresh}>
            {isRefreshing ? 'Refreshing' : 'Refresh operations'}
          </button>
        </div>
      </div>

      <div className={`ol-message ${snapshot.health.tone === 'success' ? 'ol-message--success' : ''}`}>
        <div className="ol-market-status">
          <div>
            <strong>{snapshot.health.title}</strong>
            <p>{snapshot.health.message}</p>
          </div>
          <span className={`ol-chip ${snapshot.health.tone === 'success' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
            Admin view
          </span>
        </div>
      </div>
      <div
        className={`ol-message ${snapshot.providerSetup.status === 'ready_for_test' ? 'ol-message--success' : ''}`}
        style={{ marginTop: 12 }}
      >
        <div className="ol-market-status">
          <div>
            <strong>{snapshot.providerSetup.title}</strong>
            <p>{snapshot.providerSetup.message}</p>
          </div>
          <span
            className={`ol-chip ${
              snapshot.providerSetup.status === 'ready_for_test'
                ? 'ol-chip--success'
                : snapshot.providerSetup.status === 'needs_review'
                  ? 'ol-chip--warning'
                  : 'ol-chip--premium'
            }`}
          >
            Razorpay
          </span>
        </div>
      </div>

      <div className="ol-metric-grid" style={{ marginTop: 16 }}>
        {snapshot.metrics.map((metric) => (
          <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
            <div className="ol-metric-label">{metric.label}</div>
            <div className="ol-metric-value">{metric.value}</div>
            <div className="ol-metric-helper">{metric.helper}</div>
          </article>
        ))}
      </div>

      <div className="ol-panel-glass" style={{ boxShadow: 'none', marginTop: 16 }}>
        <div className="ol-panel-title" style={{ marginBottom: 12 }}>
          Operations queue
        </div>
        {snapshot.queue.length ? (
          <div className="ol-list">
            {snapshot.queue.map((item) => (
              <div className="ol-list-item" key={item.id}>
                <div className="ol-list-icon">O</div>
                <div className="ol-list-copy">
                  <div className="ol-market-card-header">
                    <div>
                      <div className="ol-list-title">{item.title}</div>
                      <div className="ol-list-text">{item.detail}</div>
                    </div>
                    <span
                      className={`ol-chip ${
                        item.tone === 'success'
                          ? 'ol-chip--success'
                          : item.tone === 'premium'
                            ? 'ol-chip--premium'
                            : item.tone === 'warning'
                              ? 'ol-chip--warning'
                              : 'ol-chip--primary'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="ol-list-text" style={{ marginTop: 4 }}>
                    {item.actionHint}
                  </div>
                  <div className="ol-actions ol-actions--compact" style={{ marginTop: 10 }}>
                    <span className="ol-chip ol-chip--primary">{item.actionLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ol-message ol-message--success">
            No purchase operations need admin attention right now.
          </div>
        )}
      </div>
    </section>
  );
}

function RazorpayReadinessPanel({ readiness }: { readiness: RazorpayProviderReadiness }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Razorpay setup readiness</div>
          <p className="ol-panel-copy">
            Checkout stays in safe preparation mode until these setup checks are completed.
            No live payment is collected from this screen.
          </p>
        </div>
        <span
          className={`ol-chip ${
            readiness.status === 'ready_for_controlled_test'
              ? 'ol-chip--success'
              : readiness.status === 'partially_ready'
                ? 'ol-chip--warning'
                : 'ol-chip--premium'
          }`}
        >
          {readiness.missingRequiredCount ? `${readiness.missingRequiredCount} pending` : 'Ready for test'}
        </span>
      </div>
      <div className={`ol-message ${readiness.status === 'ready_for_controlled_test' ? 'ol-message--success' : ''}`}>
        <strong>{readiness.title}</strong>
        <p>{readiness.message}</p>
      </div>
      <div className="ol-page-grid ol-page-grid--2" style={{ marginTop: 16 }}>
        {readiness.checks.map((check) => (
          <article className="ol-panel-glass" key={check.id} style={{ boxShadow: 'none' }}>
            <div className="ol-market-card-header">
              <div className="ol-list-title">{check.label}</div>
              <span
                className={`ol-chip ${
                  check.status === 'ready'
                    ? 'ol-chip--success'
                    : check.status === 'missing'
                      ? 'ol-chip--warning'
                      : 'ol-chip--primary'
                }`}
              >
                {check.status === 'ready' ? 'Ready' : check.status === 'missing' ? 'Missing' : 'Not checked'}
              </span>
            </div>
            <p className="ol-panel-copy" style={{ marginTop: 8 }}>{check.helper}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LivePriceMappingPanel({ validation }: { validation: OrbitLedgerPriceMappingValidation }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Live price mapping</div>
          <p className="ol-panel-copy">
            Every launch country and plan is mapped to Razorpay. Live checkout remains off until active
            Razorpay price IDs are saved.
          </p>
        </div>
        <span className={`ol-chip ${validation.readyForLiveCheckout ? 'ol-chip--success' : 'ol-chip--warning'}`}>
          {validation.readyForLiveCheckout ? 'Ready' : 'Live IDs pending'}
        </span>
      </div>
      <div className="ol-metric-grid">
        <article className="ol-metric-card" data-tone="success">
          <div className="ol-metric-label">Mapped prices</div>
          <div className="ol-metric-value">{validation.checkedPrices}</div>
          <div className="ol-metric-helper">Country and plan prices checked.</div>
        </article>
        <article className="ol-metric-card" data-tone={validation.pendingPrices ? 'warning' : 'success'}>
          <div className="ol-metric-label">Pending live IDs</div>
          <div className="ol-metric-value">{validation.pendingPrices}</div>
          <div className="ol-metric-helper">Razorpay live price IDs still need activation.</div>
        </article>
        <article className="ol-metric-card" data-tone={validation.activePrices ? 'success' : 'premium'}>
          <div className="ol-metric-label">Active live IDs</div>
          <div className="ol-metric-value">{validation.activePrices}</div>
          <div className="ol-metric-helper">Confirmed provider-ready price IDs.</div>
        </article>
      </div>
      {validation.issues.length ? (
        <div className="ol-message" style={{ marginTop: 16 }}>
          {validation.issues.length} live price mapping item{validation.issues.length === 1 ? '' : 's'} need provider setup before launch.
        </div>
      ) : null}
    </section>
  );
}

function ControlledPaymentTestPanel({
  readiness,
  steps,
}: {
  readiness: OrbitLedgerControlledPaymentTestReadiness;
  steps: OrbitLedgerControlledPaymentTestStep[];
}) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Controlled live payment test</div>
          <p className="ol-panel-copy">
            Use this checklist only after Razorpay is connected. It prepares the live smoke test
            without collecting any payment right now.
          </p>
        </div>
        <span className={`ol-chip ${readiness.readyForPublicLaunch ? 'ol-chip--success' : 'ol-chip--warning'}`}>
          {readiness.completedSteps}/{readiness.totalSteps} complete
        </span>
      </div>
      <div className="ol-list">
        {steps.map((step, index) => (
          <div className="ol-list-item" key={step.id}>
            <div className="ol-list-icon">{index + 1}</div>
            <div className="ol-list-copy">
              <div className="ol-market-card-header">
                <div className="ol-list-title">{step.label}</div>
                <span className="ol-chip ol-chip--primary">Not run</span>
              </div>
              <div className="ol-list-text">{step.expectedEvidence}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProviderRollbackPanel({ safety }: { safety: OrbitLedgerPurchaseProviderSafetyState }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Provider rollback switch</div>
          <p className="ol-panel-copy">
            This safety state controls whether new checkout can be created. Existing paid access must stay intact.
          </p>
        </div>
        <span className={`ol-chip ${safety.canCreateCheckout ? 'ol-chip--success' : 'ol-chip--warning'}`}>
          {safety.canCreateCheckout ? 'Checkout allowed' : 'Checkout held'}
        </span>
      </div>
      <div className="ol-review-grid">
        <Review label="Mode" value={purchasePlanLabel(safety.mode)} />
        <Review label="New checkout" value={safety.canCreateCheckout ? 'Allowed' : 'Blocked'} />
        <Review label="Existing access" value={safety.preservesExistingEntitlements ? 'Preserved' : 'Review required'} />
      </div>
      <div className="ol-message" style={{ marginTop: 16 }}>
        <strong>{safety.adminMessage}</strong>
        <p>{safety.userMessage}</p>
      </div>
    </section>
  );
}

function PurchaseSupportPolicyPanel({ policies }: { policies: OrbitLedgerPurchaseSupportPolicy[] }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Refund, cancellation, and support flow</div>
          <p className="ol-panel-copy">
            Support-safe guidance for failed checkout, duplicate charge, refund, cancellation, and missing access cases.
          </p>
        </div>
        <span className="ol-chip ol-chip--primary">Support ready</span>
      </div>
      <div className="ol-page-grid ol-page-grid--2">
        {policies.map((policy) => (
          <article className="ol-panel-glass" key={policy.id} style={{ boxShadow: 'none' }}>
            <div className="ol-list-title">{policy.title}</div>
            <p className="ol-panel-copy" style={{ marginTop: 8 }}>{policy.customerMessage}</p>
            <div className="ol-message" style={{ marginTop: 12 }}>
              <strong>Support action</strong>
              <p>{policy.supportAction}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function First72HoursMonitoringPanel({ snapshot }: { snapshot: WebPurchaseLaunchMonitoringSnapshot }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">First 72 hours monitoring</div>
          <p className="ol-panel-copy">
            Heightened launch monitoring for checkout failures, purchase confirmation, receipt recovery,
            billing email delivery, refunds, and support messages.
          </p>
        </div>
        <span className={`ol-chip ${snapshot.status === 'completed' ? 'ol-chip--success' : snapshot.status === 'active' ? 'ol-chip--warning' : 'ol-chip--primary'}`}>
          {snapshot.status === 'not_started' ? 'Not started' : snapshot.status === 'active' ? `${snapshot.remainingHours}h left` : 'Complete'}
        </span>
      </div>
      <div className={`ol-message ${snapshot.status === 'completed' ? 'ol-message--success' : ''}`}>
        <div className="ol-market-status">
          <div>
            <strong>{snapshot.title}</strong>
            <p>{snapshot.message}</p>
          </div>
          <span className="ol-chip ol-chip--premium">Launch monitor</span>
        </div>
      </div>
      <div className="ol-metric-grid" style={{ marginTop: 16 }}>
        <article className="ol-metric-card" data-tone={snapshot.status === 'active' ? 'warning' : 'premium'}>
          <div className="ol-metric-label">Elapsed</div>
          <div className="ol-metric-value">{snapshot.elapsedHours}</div>
          <div className="ol-metric-helper">Hours since live checkout opened.</div>
        </article>
        <article className="ol-metric-card" data-tone={snapshot.remainingHours ? 'warning' : 'success'}>
          <div className="ol-metric-label">Remaining</div>
          <div className="ol-metric-value">{snapshot.remainingHours}</div>
          <div className="ol-metric-helper">Hours in heightened monitoring.</div>
        </article>
        {snapshot.metrics.map((metric) => (
          <article className="ol-metric-card" data-tone={metric.tone} key={metric.id}>
            <div className="ol-metric-label">{metric.label}</div>
            <div className="ol-metric-value">{metric.value}</div>
            <div className="ol-metric-helper">{metric.helper}</div>
          </article>
        ))}
      </div>
      <div className="ol-list" style={{ marginTop: 16 }}>
        {snapshot.checkpoints.map((checkpoint, index) => (
          <div className="ol-list-item" key={checkpoint}>
            <div className="ol-list-icon">{index + 1}</div>
            <div className="ol-list-copy">
              <div className="ol-list-title">{checkpoint}</div>
              <div className="ol-list-text">Keep notes for support and rollback decisions.</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonetizationFreezePanel({ freeze }: { freeze: OrbitLedgerMonetizationFreezeReadiness }) {
  return (
    <section className="ol-panel">
      <div className="ol-panel-header">
        <div>
          <div className="ol-panel-title">Final purchase launch QA</div>
          <p className="ol-panel-copy">
            Monetization is frozen for launch safety. Paid checkout opens only after Razorpay setup,
            live price IDs, and controlled payment testing are complete.
          </p>
        </div>
        <span className={`ol-chip ${freeze.readyForPublicPaidCheckout ? 'ol-chip--success' : 'ol-chip--warning'}`}>
          {freeze.readyForPublicPaidCheckout ? 'Ready for launch' : 'Frozen'}
        </span>
      </div>
      <div className={`ol-message ${freeze.readyForPublicPaidCheckout ? 'ol-message--success' : ''}`}>
        <strong>
          {freeze.readyForPublicPaidCheckout
            ? 'Public paid checkout can be opened.'
            : 'Public paid checkout remains closed.'}
        </strong>
        <p>
          {freeze.readyForPublicPaidCheckout
            ? 'All launch blockers are clear.'
            : 'This is intentional until Razorpay is plugged in and the controlled live payment test passes.'}
        </p>
      </div>
      <div className="ol-page-grid ol-page-grid--2" style={{ marginTop: 16 }}>
        <article className="ol-panel-glass" style={{ boxShadow: 'none' }}>
          <div className="ol-panel-title" style={{ marginBottom: 10 }}>Completed rails</div>
          <div className="ol-list">
            {freeze.completedRails.map((rail, index) => (
              <div className="ol-list-item" key={rail}>
                <div className="ol-list-icon">{index + 1}</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{rail}</div>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="ol-panel-glass" style={{ boxShadow: 'none' }}>
          <div className="ol-panel-title" style={{ marginBottom: 10 }}>Launch blockers</div>
          {freeze.blockers.length ? (
            <div className="ol-list">
              {freeze.blockers.map((blocker) => (
                <div className="ol-list-item" key={blocker}>
                  <div className="ol-list-icon">!</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">{blocker}</div>
                    <div className="ol-list-text">Keep checkout in provider-pending mode.</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ol-message ol-message--success">No launch blockers remain.</div>
          )}
        </article>
      </div>
    </section>
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

function PurchaseReviewList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: Array<{
    id: string;
    title: string;
    chip: string;
    meta: string;
    detail: string;
    secondaryDetail?: string;
    actions?: Array<{ label: string; onClick(): void; disabled?: boolean }>;
  }>;
  title: string;
}) {
  return (
    <article className="ol-panel-glass" style={{ boxShadow: 'none' }}>
      <div className="ol-panel-title" style={{ marginBottom: 12 }}>
        {title}
      </div>
      {items.length ? (
        <div className="ol-list">
          {items.map((item) => (
            <div className="ol-list-item" key={item.id}>
              <div className="ol-list-icon">{item.title.slice(0, 1)}</div>
              <div className="ol-list-copy">
                <div className="ol-market-card-header">
                  <div>
                    <div className="ol-list-title">{item.title}</div>
                    <div className="ol-list-text">{item.meta || 'Recorded'}</div>
                  </div>
                  <span className={`ol-chip ${item.chip === 'confirmed' ? 'ol-chip--success' : 'ol-chip--warning'}`}>
                    {purchaseStatusLabel(item.chip)}
                  </span>
                </div>
                <div className="ol-list-text">{item.detail}</div>
                {item.secondaryDetail ? <div className="ol-list-text">{item.secondaryDetail}</div> : null}
                {item.actions?.length ? (
                  <div className="ol-actions ol-actions--compact" style={{ marginTop: 10 }}>
                    {item.actions.map((action) => (
                      <button
                        className="ol-button-secondary"
                        disabled={action.disabled}
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ol-message">{emptyText}</div>
      )}
    </article>
  );
}

function billingDocumentFromCheckout(checkout: WebSubscriptionCheckoutRecord): WebSubscriptionBillingDocument {
  return {
    ...checkout,
    planLabel: purchasePlanLabel(checkout.planId),
    recordedAt: checkout.updatedAt,
  };
}

function billingDocumentFromPurchaseEvent(event: WebSubscriptionPurchaseEvent): WebSubscriptionBillingDocument {
  return {
    ...event,
    planLabel: purchasePlanLabel(event.planId),
    recordedAt: event.receivedAt,
  };
}

function billingDocumentFromAuditItem(item: WebSubscriptionEntitlementAuditItem): WebSubscriptionBillingDocument {
  return {
    ...item,
    planLabel: purchasePlanLabel(item.planId),
    providerReference: null,
    recordedAt: item.receivedAt,
  };
}

function billingEmailDetail(checkout: WebSubscriptionCheckoutRecord) {
  if (checkout.billingEmailSentAt) {
    return `Receipt emailed ${formatPlanDateTime(checkout.billingEmailSentAt)}`;
  }
  if (checkout.billingEmailDeliveryStatus === 'pending_provider_connection') {
    return 'Receipt email is queued for delivery';
  }
  if (checkout.billingEmailDeliveryStatus === 'failed') {
    return checkout.billingEmailLastError ? `Receipt email failed: ${checkout.billingEmailLastError}` : 'Receipt email could not be sent';
  }
  if (checkout.billingEmailStatus === 'queued' || checkout.billingEmailDeliveryStatus === 'queued') {
    const resendDetail = checkout.billingEmailResendCount && checkout.billingEmailResendCount > 1
      ? ` · ${checkout.billingEmailResendCount} attempts`
      : '';
    return checkout.billingEmailRecipient
      ? `Receipt email queued for ${checkout.billingEmailRecipient}${resendDetail}`
      : `Receipt email queued${resendDetail}`;
  }
  if (checkout.billingRecoveryStatus === 'completed' && checkout.billingRecoveredAt) {
    return `Recovered ${formatPlanDateTime(checkout.billingRecoveredAt)}`;
  }
  return null;
}

function billingTaxReviewDetail(document: WebSubscriptionBillingFields) {
  if (!document.taxComplianceReviewStatus) {
    return null;
  }
  if (document.taxComplianceReviewStatus === 'ready_for_review') {
    return `${document.taxLabel ?? 'Tax'} review ready`;
  }
  if (document.taxComplianceReviewStatus === 'business_tax_id_missing') {
    return `${document.taxRegistrationLabel ?? 'Tax ID'} not saved`;
  }
  if (document.taxComplianceReviewStatus === 'country_tax_review_required') {
    return 'Country tax review required';
  }
  if (document.taxComplianceReviewStatus === 'pending_payment_confirmation') {
    return 'Tax review pending payment confirmation';
  }
  return document.taxComplianceMessage ?? 'Tax review required';
}

function billingDocumentCanEmail(checkout: WebSubscriptionCheckoutRecord, workspaceEmail: string | undefined) {
  return Boolean(checkout.receiptNumber && (checkout.billingEmailRecipient || checkout.buyerEmail || workspaceEmail));
}

function receiptEmailActionMessage(deliveryStatus: string | null, recipientEmail: string | null) {
  if (deliveryStatus === 'sent') {
    return recipientEmail ? `Receipt email sent to ${recipientEmail}.` : 'Receipt email sent.';
  }
  if (deliveryStatus === 'pending_provider_connection') {
    return 'Receipt email is queued and will send when email delivery is connected.';
  }
  if (deliveryStatus === 'failed') {
    return 'Receipt email could not be sent.';
  }
  return recipientEmail ? `Receipt email queued for ${recipientEmail}.` : 'Receipt email queued.';
}

function formatPlanDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(timestamp));
}

function formatPlanDateTime(value: string | null) {
  if (!value) {
    return '';
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function purchasePlanLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function purchaseActionLabel(value: string) {
  if (value === 'entitlement_confirmed') {
    return 'Plan access confirmed';
  }
  return purchasePlanLabel(value);
}

function purchaseStatusLabel(value: string) {
  if (value === 'confirmed') {
    return 'Confirmed';
  }
  if (value === 'pending') {
    return 'Pending';
  }
  if (value === 'cancelled' || value === 'canceled') {
    return 'Cancelled';
  }
  if (value === 'failed') {
    return 'Failed';
  }
  return 'Recorded';
}

function renewalReviewLabel(value: WebSubscriptionRenewalChange['reviewStatus']) {
  if (value === 'ready_for_review') {
    return 'Ready for review';
  }
  if (value === 'processing') {
    return 'Processing';
  }
  if (value === 'completed') {
    return 'Completed';
  }
  if (value === 'cancelled') {
    return 'Cancelled';
  }
  if (value === 'rejected') {
    return 'Rejected';
  }
  return 'Needs review';
}

function renewalAuditActionLabel(value: string) {
  if (value === 'mark_processing') {
    return 'Renewal processing started';
  }
  if (value === 'complete') {
    return 'Renewal change completed';
  }
  if (value === 'reject') {
    return 'Renewal change rejected';
  }
  if (value === 'cancelled') {
    return 'Renewal change cancelled';
  }
  if (value === 'ready_for_review') {
    return 'Renewal ready for review';
  }
  return 'Renewal activity recorded';
}

function renewalAuditStatusLabel(value: string) {
  if (value === 'completed') {
    return 'Completed';
  }
  if (value === 'processing') {
    return 'Processing';
  }
  if (value === 'rejected') {
    return 'Rejected';
  }
  if (value === 'cancelled') {
    return 'Cancelled';
  }
  if (value === 'ready_for_review') {
    return 'Ready for review';
  }
  return 'Recorded';
}
