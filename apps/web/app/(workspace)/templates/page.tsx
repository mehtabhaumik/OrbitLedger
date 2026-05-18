'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import {
  listWorkspaceCustomers,
  listWorkspaceProducts,
  type WorkspaceCustomer,
  type WorkspaceProduct,
} from '@/lib/workspace-data';
import {
  getWebDocumentTemplates,
  type WebDocumentTemplate,
} from '@/lib/web-documents';
import { buildWorkspaceTemplateDemoData, templatePreviewWorkspace } from '@/lib/template-preview-demo';
import type { TemplateDemoData } from '@/lib/template-demo-data-factory';
import { useWorkspace } from '@/providers/workspace-provider';

export default function TemplateShowcasePage() {
  const { activeWorkspace } = useWorkspace();
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [sampleLoadError, setSampleLoadError] = useState<string | null>(null);
  const workspaceForTemplates = activeWorkspace ?? templatePreviewWorkspace;
  const templates = useMemo(() => getWebDocumentTemplates(workspaceForTemplates, 'invoice'), [workspaceForTemplates]);

  useEffect(() => {
    let isMounted = true;
    if (!activeWorkspace) {
      setCustomers([]);
      setProducts([]);
      setIsLoadingSamples(false);
      setSampleLoadError(null);
      return () => {
        isMounted = false;
      };
    }

    setIsLoadingSamples(true);
    setSampleLoadError(null);
    Promise.all([
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceProducts(activeWorkspace.workspaceId),
    ])
      .then(([nextCustomers, nextProducts]) => {
        if (!isMounted) {
          return;
        }
        setCustomers(nextCustomers);
        setProducts(nextProducts);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setCustomers([]);
        setProducts([]);
        setSampleLoadError('Workspace samples could not be loaded. Showing safe sample data.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingSamples(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace]);

  return (
    <AppShell
      title="Invoice Templates"
      subtitle="Preview free and Pro invoice layouts before choosing one for real documents."
    >
      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Template showcase</div>
            <p className="ol-panel-copy">
              These previews use your selected company branding with safe sample invoice data. Open any template to inspect it in a separate tab.
            </p>
          </div>
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--primary">{workspaceForTemplates.countryCode === 'IN' ? 'India GST ready' : `${workspaceForTemplates.countryCode} templates`}</span>
            <span className="ol-chip ol-chip--success">{isLoadingSamples ? 'Preparing samples' : 'Personalized samples'}</span>
          </div>
        </div>
        {sampleLoadError ? <div className="ol-inline-alert ol-inline-alert--warning">{sampleLoadError}</div> : null}
        <div className="ol-template-showcase-grid">
          {templates.map((template) => (
            <TemplateShowcaseCard
              customers={customers}
              key={template.key}
              products={products}
              template={template}
              workspace={workspaceForTemplates}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function TemplateShowcaseCard({
  customers,
  products,
  template,
  workspace,
}: {
  customers: WorkspaceCustomer[];
  products: WorkspaceProduct[];
  template: WebDocumentTemplate;
  workspace: typeof templatePreviewWorkspace;
}) {
  const demoData = buildWorkspaceTemplateDemoData({
    customers,
    products,
    templateKey: template.key,
    workspace,
  });
  const previewLayout = getTemplateCardLayout(template.key);

  return (
    <article className="ol-template-showcase-card">
      <div className="ol-template-showcase-header">
        <div>
          <strong>{template.label}</strong>
          <p>{template.description}</p>
        </div>
        <span className={`ol-chip ${template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
          {template.tier === 'pro' ? 'Pro Plus' : 'Free'}
        </span>
      </div>
      <TemplateShowcasePreview demoData={demoData} layout={previewLayout} template={template} />
      <Link
        className="ol-button-secondary ol-template-showcase-open"
        href={`/templates/preview?template=${encodeURIComponent(template.key)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open preview
      </Link>
      {template.tier === 'pro' ? (
        <p className="ol-template-lock-note">
          Pro Plus sample. Uses {demoData.customerSource === 'workspace' ? 'a saved customer' : 'safe customer data'} and {demoData.itemSource === 'inventory' ? 'saved inventory items' : 'sample items'}.
        </p>
      ) : (
        <p className="ol-template-lock-note">
          Included in Free. Uses {demoData.customerSource === 'workspace' ? 'a saved customer' : 'safe customer data'} and {demoData.itemSource === 'inventory' ? 'sample invoice items' : 'sample items'}.
        </p>
      )}
    </article>
  );
}

function TemplateShowcasePreview({
  demoData,
  layout,
  template,
}: {
  demoData: TemplateDemoData;
  layout: TemplateCardLayout;
  template: WebDocumentTemplate;
}) {
  const rows = demoData.invoice.items.slice(0, layout === 'compact' ? 4 : 3);
  const stamp = demoData.invoice.paymentStatus === 'paid' ? 'Paid' : layout === 'payment' ? 'Pay now' : 'Unpaid';

  return (
    <div
      aria-label={`${template.label} formatted sample thumbnail`}
      className={`ol-template-showcase-preview ol-template-showcase-preview--${layout}`}
      role="img"
    >
      <div className="ol-template-showcase-paper">
        <div className="ol-template-showcase-sample">Sample preview</div>
        <div className="ol-template-showcase-watermark">Sample</div>
        <header className="ol-template-showcase-paper-head">
          <div className="ol-template-showcase-brand">
            <span>OL</span>
            <div>
              <strong>{demoData.workspace.businessName}</strong>
              <small>{demoData.workspace.address}</small>
            </div>
          </div>
          <div className="ol-template-showcase-number">
            <small>{template.countryFormat === 'india_gst' ? 'Tax invoice' : 'Invoice'}</small>
            <strong>{demoData.invoice.invoiceNumber}</strong>
            <em>{stamp}</em>
          </div>
        </header>

        <section className="ol-template-showcase-billto">
          <div>
            <span>Buyer</span>
            <strong>{demoData.customer.name}</strong>
            <small>{demoData.customer.city}, {demoData.customer.stateCode}</small>
          </div>
          <div>
            <span>Amount</span>
            <strong>{formatInr(demoData.invoice.totalAmount)}</strong>
            <small>{demoData.invoice.dueDate ? `Due ${demoData.invoice.dueDate}` : 'Sample due date'}</small>
          </div>
        </section>

        {layout === 'tax' || layout === 'compact' ? (
          <div className="ol-template-showcase-table ol-template-showcase-table--tax">
            <div className="ol-template-showcase-table-head">
              <span>Item</span>
              <span>Taxable</span>
              <span>GST</span>
              <span>Total</span>
            </div>
            {rows.map((row) => (
              <div className="ol-template-showcase-table-row" key={row.id}>
                <span>{row.name}</span>
                <b>{formatInr(row.quantity * row.price)}</b>
                <b>{row.taxRate}%</b>
                <b>{formatInr(row.total)}</b>
              </div>
            ))}
          </div>
        ) : null}

        {layout === 'basic' || layout === 'service' ? (
          <div className="ol-template-showcase-lines">
            {rows.map((row) => (
              <div key={row.id}>
                <span>{row.name}</span>
                <small>{row.description}</small>
                <strong>{formatInr(row.total)}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {layout === 'letterhead' ? (
          <div className="ol-template-showcase-letterhead">
            <div>Professional letterhead</div>
            <div className="ol-template-showcase-lines">
              {rows.slice(0, 2).map((row) => (
                <div key={row.id}>
                  <span>{row.name}</span>
                  <strong>{formatInr(row.total)}</strong>
                </div>
              ))}
            </div>
            <span>Authorized signature</span>
          </div>
        ) : null}

        {layout === 'payment' ? (
          <div className="ol-template-showcase-payment">
            <div>
              <span>Amount due</span>
              <strong>{formatInr(demoData.invoice.totalAmount)}</strong>
              <small>Payment link and bank details area</small>
            </div>
            <div className="ol-template-showcase-qr">QR</div>
          </div>
        ) : null}

        {layout === 'premium' ? (
          <div className="ol-template-showcase-premium">
            <div className="ol-template-showcase-premium-mark">Brand</div>
            <div className="ol-template-showcase-lines">
              {rows.slice(0, 2).map((row) => (
                <div key={row.id}>
                  <span>{row.name}</span>
                  <strong>{formatInr(row.total)}</strong>
                </div>
              ))}
            </div>
            <div className="ol-template-showcase-premium-total">
              <span>Branded total</span>
              <strong>{formatInr(demoData.invoice.totalAmount)}</strong>
            </div>
          </div>
        ) : null}

        <footer>
          <span>{template.tier === 'pro' ? 'Logo, signature, watermark' : 'Clean sample data'}</span>
          <strong>{template.label}</strong>
        </footer>
      </div>
    </div>
  );
}

type TemplateCardLayout = 'basic' | 'tax' | 'service' | 'letterhead' | 'compact' | 'payment' | 'premium';

function getTemplateCardLayout(templateKey: string): TemplateCardLayout {
  const key = templateKey.toUpperCase();
  if (key.includes('GST_STANDARD') || key.includes('VAT_STANDARD') || key.includes('RETAIL')) return 'tax';
  if (key.includes('CLEAN_BASIC') || key.includes('STANDARD')) return 'basic';
  if (key.includes('SERVICE')) return 'service';
  if (key.includes('COMPACT')) return 'compact';
  if (key.includes('PAYMENT')) return 'payment';
  if (key.includes('BRANDED')) return 'premium';
  if (key.includes('LETTERHEAD') || key.includes('MODERN_BUSINESS')) return 'letterhead';
  return 'basic';
}

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
