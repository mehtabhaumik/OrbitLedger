import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

import { WEB_BETA_TO_PAID_POLICY } from '@/lib/web-monetization';
import { LandingNav } from './landing-nav';
import { LandingSessionGate } from './landing-session-gate';
import { LandingTemplateShowcase } from './landing-template-showcase';

const workflowSteps = ['Invoice', 'Reminder', 'Payment', 'Ledger', 'Day closed'] as const;

const features = [
  {
    title: 'Live payment updates',
    body: 'Know the moment money arrives across UPI, NEFT, cheque, and cash, all in one operating stream.',
  },
  {
    title: 'Invoice version history',
    body: 'See exactly what changed, when it changed, and which version reached the customer.',
  },
  {
    title: 'Quiet automation',
    body: 'Reminders, daily close prompts, and collection signals stay useful without making the workspace noisy.',
  },
] as const;

const operatingSystemStages = ['Draft', 'Sent', 'Reminder', 'Paid'] as const;

const liveRadarRows = [
  ['K. Jain', 'Rs 12,400', '2m ago', 'active'],
  ['Sonali Traders', 'Rs 13,334', '9m ago', 'idle'],
] as const;

const collectRows = [
  ['MC', 'Mehra & Co.', 'Invoice #1092 - 4 days overdue', 'Rs 45,000', 'Overdue'],
  ['VS', 'Vertex Solutions', 'Invoice #1095 - due today', 'Rs 1,12,000', 'Due'],
  ['NR', 'Northline Repair', 'Invoice WEB-1048 - reminder scheduled', 'Rs 17,700', 'Scheduled'],
] as const;

const footerLinks = {
  Product: [
    ['Templates', '#templates'],
    ['Invoicing', '#product'],
    ['Payments', '#product'],
    ['Daily close', '#workflow'],
  ],
  Company: [
    ['Pricing', '#pricing'],
    ['Privacy', '/privacy'],
    ['Terms', '/terms'],
    ['Contact', '/contact'],
  ],
} as const;

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbitledger.rudraix.com';

const landingStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Orbit Ledger',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.png`,
    parentOrganization: {
      '@type': 'Organization',
      name: 'Rudraix',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Orbit Ledger',
    url: siteUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Rudraix',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Orbit Ledger',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Orbit Ledger is a calm operating system for receivables, invoices, payments, follow-ups, and daily closing for Indian SMBs.',
    offers: {
      '@type': 'Offer',
      category: 'Public beta',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Rudraix',
    },
  },
];

export default function LandingPage() {
  const appCtaHref = '/login' as Route;

  return (
    <main className="ol-landing-page ol-landing-page--revamp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingStructuredData) }}
      />
      <LandingSessionGate />
      <LandingNav appCtaHref={appCtaHref} />
      <Hero appCtaHref={appCtaHref} />
      <WorkflowRibbon />
      <FeatureBand />
      <TemplatesBand />
      <BetaCta appCtaHref={appCtaHref} />
      <LandingFooter />
    </main>
  );
}

function Hero({ appCtaHref }: { appCtaHref: Route }) {
  return (
    <section className="ol-revamp-hero" aria-labelledby="landing-hero-title">
      <div className="ol-revamp-hero-copy">
        <span className="ol-revamp-beta-pill">
          <i aria-hidden="true" />
          Available in public beta
        </span>
        <h1 id="landing-hero-title">
          The Ledger for the <span>Calmly Ambitious.</span>
        </h1>
        <p>
          Orbit Ledger streamlines receivables for Indian SMBs. Know what is owed, what changed,
          and what needs action today, then close your books in minutes.
        </p>
        <div className="ol-revamp-actions">
          <Link className="ol-button" href={appCtaHref}>
            <span aria-hidden="true">+</span>
            Start ledger free
          </Link>
          <a className="ol-button-secondary" href="#templates">
            See invoice templates
          </a>
        </div>
        <div className="ol-revamp-stats" aria-label="Orbit Ledger beta metrics">
          <Metric label="App rating" value="4.9/5" />
          <Metric label="Managed monthly" value="Rs 250Cr+" />
          <Metric label="Avg. close time" value="6 min" />
        </div>
      </div>

      <OperatingSystemPreview />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function OperatingSystemPreview() {
  return (
    <div className="ol-os-stage" aria-label="Orbit Ledger operating system preview">
      <div className="ol-os-bento">
        <Tile className="ol-os-tile--receivables">
          <div className="ol-os-tile-label">
            <span>Total receivables</span>
            <em>+12.5% this month</em>
          </div>
          <div className="ol-os-total">
            <small>Rs</small>
            <strong>14,20,500</strong>
          </div>
          <div className="ol-os-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ol-os-split">
            <span>Collected Rs 8,40,000</span>
            <span>Overdue Rs 3,20,000</span>
            <span>Pending Rs 2,60,500</span>
          </div>
        </Tile>

        <Tile className="ol-os-tile--radar">
          <div className="ol-os-tile-label">
            <span>Live radar</span>
            <i />
          </div>
          <div className="ol-os-radar-list">
            {liveRadarRows.map(([name, amount, when, state]) => (
              <span className={state === 'active' ? 'is-active' : undefined} key={name}>
                <b>{name}</b>
                <em>{amount}</em>
                <small>{when}</small>
              </span>
            ))}
          </div>
        </Tile>

        <Tile className="ol-os-tile--close">
          <div className="ol-os-tile-label">
            <span>Daily close</span>
          </div>
          <div className="ol-os-check-list">
            <span className="is-done">Verify bank feed</span>
            <span>Approve 3 drafts</span>
            <span>Send reminders</span>
          </div>
        </Tile>

        <Tile className="ol-os-tile--collect">
          <div className="ol-os-collect-head">
            <span>Collect today - 3 customers</span>
            <em>View all</em>
          </div>
          <div className="ol-os-collect-list">
            {collectRows.map(([initials, name, detail, amount, status]) => (
              <span key={name}>
                <b>{initials}</b>
                <strong>
                  {name}
                  <small>{detail}</small>
                </strong>
                <i>{status}</i>
                <em>{amount}</em>
              </span>
            ))}
          </div>
        </Tile>

        <Tile className="ol-os-tile--flow">
          <div className="ol-os-stage-row">
            {operatingSystemStages.map((stage, index) => (
              <span className={index === 1 || index === 2 ? 'is-active' : undefined} key={stage}>
                {stage}
              </span>
            ))}
          </div>
          <div className="ol-os-balance-note">
            <span>Outstanding balance</span>
            <strong>Rs 84,200</strong>
            <em>down 18% week over week</em>
          </div>
        </Tile>
      </div>
    </div>
  );
}

function Tile({ children, className }: { children: ReactNode; className: string }) {
  return <article className={`ol-os-tile ${className}`}>{children}</article>;
}

function WorkflowRibbon() {
  return (
    <section className="ol-revamp-workflow" id="workflow" aria-label="Orbit Ledger workflow">
      <div>
        {workflowSteps.map((step, index) => (
          <span key={step}>
            <b>{String(index + 1).padStart(2, '0')}</b>
            <em>{step}</em>
          </span>
        ))}
      </div>
    </section>
  );
}

function FeatureBand() {
  return (
    <section className="ol-revamp-feature-band" id="product">
      <div className="ol-revamp-section-head">
        <span>The core engine</span>
        <h2>Precisely mapped receivables. Quietly handled work.</h2>
      </div>
      <div className="ol-revamp-feature-grid">
        {features.map((feature) => (
          <article key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TemplatesBand() {
  return (
    <section className="ol-revamp-template-band" id="templates">
      <div className="ol-revamp-section-head">
        <span>Templates</span>
        <h2>Documents that look ready before they are sent.</h2>
        <p>
          Preview polished invoice styles with sample data, branding areas, payment details,
          tax sections, and clear customer-facing status.
        </p>
      </div>
      <LandingTemplateShowcase />
    </section>
  );
}

function BetaCta({ appCtaHref }: { appCtaHref: Route }) {
  return (
    <section className="ol-revamp-beta-cta" id="pricing">
      <span>Public beta - free</span>
      <h2>Ready for a quieter workday?</h2>
      <p>
        {WEB_BETA_TO_PAID_POLICY.title}. {WEB_BETA_TO_PAID_POLICY.commitments[1]}
      </p>
      <Link className="ol-button" href={appCtaHref}>
        Claim beta access
      </Link>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="ol-revamp-footer">
      <div className="ol-revamp-footer-main">
        <div>
          <img
            alt="Orbit Ledger"
            className="ol-brand-logo"
            src="/branding/orbit-ledger-logo-transparent.png"
          />
          <p>Financial clarity for the modern Indian entrepreneur. Built with precision and calm.</p>
        </div>
        {Object.entries(footerLinks).map(([title, links]) => (
          <nav aria-label={title} key={title}>
            <strong>{title}</strong>
            {links.map(([label, href]) => (
              <a href={href} key={`${title}-${label}`}>
                {label}
              </a>
            ))}
          </nav>
        ))}
      </div>
      <div className="ol-revamp-footer-bottom">
        <span>2026 Orbit Ledger</span>
        <span>Built by Rudraix</span>
      </div>
    </footer>
  );
}
