'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useRef, useState } from 'react';

import { buildPublicTemplateDemoData } from '@/lib/template-preview-demo';

const templates = [
  {
    name: 'India GST Standard',
    plan: 'Free',
    tone: 'gst',
    templateKey: 'IN_GST_STANDARD_FREE',
    layout: 'tax',
    footer: 'CGST + SGST ready',
  },
  {
    name: 'Clean Basic',
    plan: 'Free',
    tone: 'basic',
    templateKey: 'IN_CLEAN_BASIC_FREE',
    layout: 'basic',
    footer: 'Generated using Orbit Ledger',
  },
  {
    name: 'Service Invoice',
    plan: 'Free',
    tone: 'service',
    templateKey: 'IN_SIMPLE_SERVICE_FREE',
    layout: 'service',
    footer: 'Service notes included',
  },
  {
    name: 'Professional Letterhead',
    plan: 'Pro',
    tone: 'letterhead',
    templateKey: 'IN_GST_LETTERHEAD_PRO',
    layout: 'letterhead',
    footer: 'Logo, color, and signature',
  },
  {
    name: 'Payment-focused',
    plan: 'Pro',
    tone: 'payment',
    templateKey: 'IN_PAYMENT_FOCUSED_PRO',
    layout: 'payment',
    footer: 'Payment link and QR area',
  },
  {
    name: 'Branded Premium',
    plan: 'Pro',
    tone: 'premium',
    templateKey: 'IN_BRANDED_ADVANCED_PRO',
    layout: 'premium',
    footer: 'Watermark and premium brand polish',
  },
] as const;

const templateAutoRotateMs = 6500;
const templateManualResumeMs = 3000;

function templatePreviewHref(templateKey: string) {
  return `/template-preview?template=${encodeURIComponent(templateKey)}` as Route;
}

export function LandingTemplateShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isManualPause, setIsManualPause] = useState(false);
  const manualResumeTimerRef = useRef<number | null>(null);
  const activeTemplate = templates[activeIndex] ?? templates[0];
  const templateDemoData = useMemo(
    () => templates.map((template) => buildPublicTemplateDemoData(template.templateKey)),
    []
  );

  useEffect(() => {
    if (isManualPause) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % templates.length);
    }, templateAutoRotateMs);

    return () => window.clearTimeout(timer);
  }, [activeIndex, isManualPause]);

  useEffect(() => {
    return () => {
      if (manualResumeTimerRef.current !== null) {
        window.clearTimeout(manualResumeTimerRef.current);
      }
    };
  }, []);

  function selectTemplate(index: number) {
    setActiveIndex(index);
    setIsManualPause(true);
    if (manualResumeTimerRef.current !== null) {
      window.clearTimeout(manualResumeTimerRef.current);
    }
    manualResumeTimerRef.current = window.setTimeout(() => {
      setIsManualPause(false);
      manualResumeTimerRef.current = null;
    }, templateManualResumeMs);
  }

  return (
    <>
      <div className="ol-template-stage" aria-label="Invoice template showcase">
        <div className="ol-template-viewport" aria-live="polite">
          {templates.map((template, index) => {
            const demoData = templateDemoData[index] ?? templateDemoData[0];
            return (
              <Link
                aria-hidden={index !== activeIndex}
                aria-label={`Open ${template.name} sample preview`}
                className={`ol-template-preview ol-template-preview--${template.tone} ol-template-preview--layout-${template.layout}${index === activeIndex ? ' is-active' : ''}`}
                href={templatePreviewHref(template.templateKey)}
                key={template.name}
                rel="noopener noreferrer"
                tabIndex={index === activeIndex ? 0 : -1}
                target="_blank"
              >
                <TemplatePreviewSheet
                  footer={template.footer}
                  layout={template.layout}
                  name={template.name}
                  plan={template.plan}
                  demoData={demoData}
                />
              </Link>
            );
          })}
        </div>
        <div
          className="ol-template-tabs"
          role="group"
          aria-label="Invoice template selector"
          data-paused={isManualPause ? 'true' : 'false'}
        >
          {templates.map((template, index) => (
            <button
              aria-pressed={index === activeIndex}
              aria-label={`Show ${template.name} template preview`}
              className="ol-template-tab"
              key={template.name}
              onClick={() => selectTemplate(index)}
              type="button"
            >
              <span>{template.plan}</span>
              {template.name}
            </button>
          ))}
        </div>
      </div>
      <Link
        aria-label={`Open the ${activeTemplate.name} template preview in a new tab`}
        className="ol-button-secondary ol-landing-inline-cta"
        href={templatePreviewHref(activeTemplate.templateKey)}
        rel="noopener noreferrer"
        target="_blank"
      >
        View {activeTemplate.name} preview
      </Link>
    </>
  );
}

function TemplatePreviewSheet({
  demoData,
  footer,
  layout,
  name,
  plan,
}: {
  demoData: ReturnType<typeof buildPublicTemplateDemoData>;
  footer: string;
  layout: (typeof templates)[number]['layout'];
  name: string;
  plan: string;
}) {
  const stamp = demoData.invoice.paymentStatus === 'paid' ? 'PAID' : layout === 'payment' ? 'PAY NOW' : 'UNPAID';
  const rows = demoData.invoice.items.slice(0, 3);

  return (
    <>
      <div className="ol-template-ribbon">{plan}</div>
      <div className="ol-template-watermark">SAMPLE</div>
      <div className="ol-template-header">
        <div>
          <span className="ol-template-logo">OL</span>
          <strong>{demoData.workspace.businessName}</strong>
        </div>
        <b>{stamp}</b>
      </div>
      <div className="ol-template-meta">
        <span>{name}</span>
        <strong>{demoData.invoice.invoiceNumber}</strong>
      </div>
      <div className="ol-template-customer-band">
        <span>Bill to</span>
        <strong>{demoData.customer.name}</strong>
        <small>{demoData.customer.city}, {demoData.customer.stateCode}</small>
      </div>
      {layout === 'tax' ? <TaxPreviewRows rows={rows} /> : null}
      {layout === 'basic' ? <BasicPreviewRows rows={rows} /> : null}
      {layout === 'service' ? <ServicePreviewRows rows={rows} /> : null}
      {layout === 'letterhead' ? <LetterheadPreviewRows rows={rows} /> : null}
      {layout === 'payment' ? <PaymentPreviewRows rows={rows} total={demoData.invoice.totalAmount} /> : null}
      {layout === 'premium' ? <PremiumPreviewRows rows={rows} total={demoData.invoice.totalAmount} /> : null}
      <div className="ol-template-footer">
        <span>{footer}</span>
        <span>{formatInr(demoData.invoice.totalAmount)}</span>
      </div>
    </>
  );
}

function TaxPreviewRows({ rows }: { rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'] }) {
  return (
    <div className="ol-template-tax-grid">
      <span>Description</span>
      <span>HSN/SAC</span>
      <span>Taxable</span>
      <span>CGST</span>
      <span>SGST</span>
      <span>Total</span>
      {rows.map((row) => (
        <div className="ol-template-tax-row" key={row.id}>
          <strong>{row.name}</strong>
          <em>HSN/SAC</em>
          <b>{formatInr(row.quantity * row.price)}</b>
          <b>{formatInr((row.total - row.quantity * row.price) / 2)}</b>
          <b>{formatInr((row.total - row.quantity * row.price) / 2)}</b>
          <b>{formatInr(row.total)}</b>
        </div>
      ))}
    </div>
  );
}

function BasicPreviewRows({ rows }: { rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'] }) {
  return (
    <div className="ol-template-basic-list">
      {rows.map((row) => (
        <div key={row.id}>
          <span>{row.name}</span>
          <strong>{formatInr(row.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function ServicePreviewRows({ rows }: { rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'] }) {
  return (
    <div className="ol-template-service-layout">
      <div>
        {rows.map((row) => (
          <p key={row.id}>
            <strong>{row.name}</strong>
            <span>{row.description}</span>
          </p>
        ))}
      </div>
      <aside>
        <span>Terms</span>
        <strong>Net 7</strong>
        <small>Notes and service scope included</small>
      </aside>
    </div>
  );
}

function LetterheadPreviewRows({ rows }: { rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'] }) {
  return (
    <div className="ol-template-letterhead-layout">
      <div className="ol-template-letterhead-strip">Professional letterhead</div>
      <div className="ol-template-basic-list">
        {rows.slice(0, 2).map((row) => (
          <div key={row.id}>
            <span>{row.name}</span>
            <strong>{formatInr(row.total)}</strong>
          </div>
        ))}
      </div>
      <div className="ol-template-signature-line">Authorized signature</div>
    </div>
  );
}

function PaymentPreviewRows({
  rows,
  total,
}: {
  rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'];
  total: number;
}) {
  return (
    <div className="ol-template-payment-layout">
      <div className="ol-template-payment-due">
        <span>Amount due</span>
        <strong>{formatInr(total)}</strong>
        <small>Payment link and manual payment instructions</small>
      </div>
      <div className="ol-template-basic-list">
        {rows.slice(0, 2).map((row) => (
          <div key={row.id}>
            <span>{row.name}</span>
            <strong>{formatInr(row.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumPreviewRows({
  rows,
  total,
}: {
  rows: ReturnType<typeof buildPublicTemplateDemoData>['invoice']['items'];
  total: number;
}) {
  return (
    <div className="ol-template-premium-layout">
      <div className="ol-template-premium-watermark">BRAND</div>
      <div className="ol-template-basic-list">
        {rows.map((row) => (
          <div key={row.id}>
            <span>{row.name}</span>
            <strong>{formatInr(row.total)}</strong>
          </div>
        ))}
      </div>
      <div className="ol-template-premium-summary">
        <span>Premium branded total</span>
        <strong>{formatInr(total)}</strong>
      </div>
    </div>
  );
}

function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    currency: 'INR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}
