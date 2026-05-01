'use client';

import { getLocalBusinessPack } from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  WEB_COUNTRY_PACK_PRODUCT_CATALOG,
  WEB_PRO_BRAND_THEMES,
  WEB_PRO_PLAN_CATALOG,
  getDefaultWebSubscriptionStatus,
} from '@/lib/web-monetization';
import { getWebDocumentTemplates } from '@/lib/web-documents';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function MarketPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const subscription = getDefaultWebSubscriptionStatus();
  const localPack = activeWorkspace
    ? getLocalBusinessPack({
        countryCode: activeWorkspace.countryCode,
        regionCode: activeWorkspace.stateCode,
      })
    : null;
  const invoiceTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'invoice') : [];
  const statementTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'statement') : [];

  return (
    <AppShell title="Market" subtitle="Plans, document templates, and local business packs for this workspace.">
      <section className="ol-split-grid">
        <article className="ol-panel-dark">
          <div className="ol-panel-header">
            <div>
              <div className="ol-panel-title">Orbit Ledger Pro</div>
              <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
                Pro improves presentation. Daily dues, payments, customers, basic PDF exports,
                backups, and lock stay available on Free.
              </p>
            </div>
            <span className={`ol-chip ${subscription.isPro ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
              {subscription.tierLabel}
            </span>
          </div>
          <div className="ol-market-grid">
            {WEB_PRO_PLAN_CATALOG.map((plan) => (
              <article className="ol-market-card" key={plan.id}>
                <div className="ol-market-card-header">
                  <div>
                    <div className="ol-market-title">{plan.title}</div>
                    <div className="ol-market-price">{plan.price}</div>
                    <div className="ol-muted">{plan.cadence}</div>
                  </div>
                  {plan.isBestValue ? <span className="ol-chip ol-chip--premium">Best value</span> : null}
                </div>
                <p>{plan.helper}</p>
                <button
                  className="ol-button-secondary"
                  type="button"
                  onClick={() => showToast('Purchase confirmation must finish before Pro turns on.', 'info')}
                >
                  View plan
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Pro benefits
          </div>
          <div className="ol-list">
            {[
              'Advanced PDF styling',
              'Custom document branding',
              'Advanced statement templates',
              'Tax-ready documents',
              'Bulk document export',
              'Multi-business profiles',
              'Advanced insights',
            ].map((feature) => (
              <div className="ol-list-item" key={feature}>
                <div className="ol-list-icon">P</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{feature}</div>
                  <div className="ol-list-text">Available with Orbit Ledger Pro.</div>
                </div>
              </div>
            ))}
          </div>
        </article>
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
                  {template.tier === 'pro' ? 'Pro' : 'Free'}
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

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-review-item">
      <span className="ol-review-label">{label}</span>
      <strong className="ol-review-value">{value}</strong>
    </div>
  );
}
