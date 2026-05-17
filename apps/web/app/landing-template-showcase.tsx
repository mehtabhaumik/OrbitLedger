'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';

const templates = [
  {
    name: 'India GST Standard',
    plan: 'Free',
    tone: 'gst',
    templateKey: 'IN_GST_STANDARD_FREE',
    business: 'Aarav Sample Stores',
    invoice: 'GST-2026-041',
    stamp: 'PAID',
    footer: 'CGST + SGST ready',
  },
  {
    name: 'Clean Basic',
    plan: 'Free',
    tone: 'basic',
    templateKey: 'IN_CLEAN_BASIC_FREE',
    business: 'Orbit Demo Services',
    invoice: 'INV-BASIC-1024',
    stamp: 'UNPAID',
    footer: 'Generated using Orbit Ledger',
  },
  {
    name: 'Service Invoice',
    plan: 'Free',
    tone: 'service',
    templateKey: 'IN_SIMPLE_SERVICE_FREE',
    business: 'Northline Repair Co.',
    invoice: 'SVC-7782',
    stamp: 'DUE',
    footer: 'Service notes included',
  },
  {
    name: 'Professional Letterhead',
    plan: 'Pro',
    tone: 'letterhead',
    templateKey: 'IN_GST_LETTERHEAD_PRO',
    business: 'Rudraix Consulting',
    invoice: 'PRO-2290',
    stamp: 'PAID',
    footer: 'Logo, color, and signature',
  },
  {
    name: 'Payment-focused',
    plan: 'Pro',
    tone: 'payment',
    templateKey: 'IN_PAYMENT_FOCUSED_PRO',
    business: 'PromptPay Studio',
    invoice: 'PAY-3108',
    stamp: 'PAY NOW',
    footer: 'Payment link and QR area',
  },
  {
    name: 'Branded Premium',
    plan: 'Pro',
    tone: 'premium',
    templateKey: 'IN_BRANDED_ADVANCED_PRO',
    business: 'BluePeak Trading',
    invoice: 'BRAND-6401',
    stamp: 'PAID',
    footer: 'Watermark and premium brand polish',
  },
] as const;

function templatePreviewHref(templateKey: string) {
  return `/template-preview?template=${encodeURIComponent(templateKey)}` as Route;
}

export function LandingTemplateShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasUserSelectedTemplate, setHasUserSelectedTemplate] = useState(false);
  const activeTemplate = templates[activeIndex] ?? templates[0];

  useEffect(() => {
    if (hasUserSelectedTemplate) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % templates.length);
    }, 6500);

    return () => window.clearTimeout(timer);
  }, [activeIndex, hasUserSelectedTemplate]);

  return (
    <>
      <div className="ol-template-stage" aria-label="Invoice template showcase">
        <div className="ol-template-viewport" aria-live="polite">
          {templates.map((template, index) => (
            <Link
              aria-hidden={index !== activeIndex}
              aria-label={`Open ${template.name} sample preview`}
              className={`ol-template-preview ol-template-preview--${template.tone}${index === activeIndex ? ' is-active' : ''}`}
              href={templatePreviewHref(template.templateKey)}
              key={template.name}
              rel="noopener noreferrer"
              tabIndex={index === activeIndex ? 0 : -1}
              target="_blank"
            >
              <div className="ol-template-ribbon">{template.plan}</div>
              <div className="ol-template-watermark">SAMPLE</div>
              <div className="ol-template-header">
                <div>
                  <span className="ol-template-logo">OL</span>
                  <strong>{template.business}</strong>
                </div>
                <b>{template.stamp}</b>
              </div>
              <div className="ol-template-meta">
                <span>{template.name}</span>
                <strong>{template.invoice}</strong>
              </div>
              <div className="ol-template-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="ol-template-payment-row">
                <span>Payment link</span>
                <span>Signature</span>
                <span>Tax details</span>
              </div>
              <div className="ol-template-footer">
                <span>{template.footer}</span>
                <span>Sample data only</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="ol-template-tabs" role="group" aria-label="Invoice template selector">
          {templates.map((template, index) => (
            <button
              aria-pressed={index === activeIndex}
              className="ol-template-tab"
              key={template.name}
              onClick={() => {
                setActiveIndex(index);
                setHasUserSelectedTemplate(true);
              }}
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
