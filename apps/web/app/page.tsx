import Link from 'next/link';
import type { Route } from 'next';
import { LandingTemplateShowcase } from './landing-template-showcase';

const actionTiles = [
  ['Collect today', '3 customers', 'Follow-up queue sorted by urgency.'],
  ['Verify payments', '2 entries', 'Clear money before balances change.'],
  ['Review overdue', '5 invoices', 'See unpaid invoices by age.'],
  ['Close the day', '3 min', 'Confirm cash, dues, and tomorrow.'],
] as const;

const storyCards = [
  {
    eyebrow: 'Collection coach',
    title: 'Recover dues with a guided follow-up rhythm.',
    copy: 'Know who to contact first, what to say, and which promises need attention.',
    points: ['Reminder tone', 'Promise tracking', 'Broken-promise history'],
  },
  {
    eyebrow: 'Customer memory',
    title: 'Every customer has a clear business history.',
    copy: 'Invoices, reminders, payments, notes, disputes, and risk signals stay in one timeline.',
    points: ['Payment behavior', 'Trust timeline', 'Risk notes'],
  },
  {
    eyebrow: 'Recurring invoices',
    title: 'Monthly billing without surprise emails.',
    copy: 'Prepare before send day, require approval, and mark the exact version that went out.',
    points: ['72-hour review', 'Approved email', 'Version badge'],
  },
  {
    eyebrow: 'Closing ritual',
    title: 'Close each day with fewer loose ends.',
    copy: 'Review collections, pending clearance, new credit, overdue work, and tomorrow’s follow-ups.',
    points: ['Daily close', 'Pending clearance', 'Next actions'],
  },
] as const;

const trustSignals = [
  'Secure sign-in',
  'Role-aware access',
  'Audit history',
  'Protected uploads',
  'Backup review',
  'Approved automation',
] as const;

export default function LandingPage() {
  const appCtaHref = '/login' as Route;

  return (
    <main className="ol-landing-page">
      <header className="ol-landing-nav" aria-label="Landing navigation">
        <Link className="ol-landing-brand" href="/">
          <img
            alt="Orbit Ledger"
            className="ol-brand-logo"
            src="/branding/orbit-ledger-logo-transparent.png"
          />
        </Link>
        <nav className="ol-landing-links" aria-label="Page sections">
          <a href="#templates">Templates</a>
          <a href="#how-it-works">How it works</a>
          <a href="#office">Office</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="ol-landing-nav-actions">
          <Link className="ol-button-ghost ol-landing-signin" href="/login">
            Sign in
          </Link>
          <Link className="ol-button ol-landing-primary" href={appCtaHref}>
            Start free
          </Link>
        </div>
      </header>

      <section className="ol-landing-hero" aria-labelledby="landing-hero-title">
        <div className="ol-landing-hero-glow" aria-hidden="true" />
        <div className="ol-landing-hero-copy">
          <span className="ol-eyebrow">Small business command center</span>
          <h1 id="landing-hero-title">
            Know who owes you. Collect faster. Close every day with confidence.
          </h1>
          <p>
            Orbit Ledger brings customers, invoices, payments, reminders, and daily review into one
            calm web workspace.
          </p>
          <div className="ol-landing-hero-actions">
            <Link className="ol-button" href={appCtaHref}>
              Start free
            </Link>
            <a className="ol-button-secondary" href="#templates">
              See invoice templates
            </a>
          </div>
        </div>

        <div className="ol-command-stage" aria-label="Animated command center preview">
          <div className="ol-command-frame">
            <div className="ol-command-frame-top">
              <span>Today</span>
              <strong>Receivables Command Center</strong>
              <em>Live preview</em>
            </div>
            <div className="ol-command-focus-grid">
              <a className="ol-command-primary-card" href="#pricing">
                <div>
                  <span>Outstanding balance</span>
                  <strong>Rs 84,200</strong>
                </div>
                <div className="ol-command-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="ol-command-pill-row">
                  <span>Collected Rs 21,400</span>
                  <span>Overdue Rs 12,700</span>
                </div>
              </a>

              <a className="ol-command-side-card ol-command-side-card--queue" href="#how-it-works">
                <span>Collect today</span>
                <strong>3 customers</strong>
                <div>
                  <b>Sonali Traders</b>
                  <b>Aarav Stores</b>
                  <b>Mehta Services</b>
                </div>
              </a>

              <a className="ol-command-side-card ol-command-side-card--invoice" href="#templates">
                <span>Invoice WEB-1048</span>
                <strong>Rs 17,700</strong>
                <b>PAID</b>
              </a>

              <a className="ol-command-side-card ol-command-side-card--verify" href="#how-it-works">
                <span>Payment verification</span>
                <strong>2 waiting</strong>
                <em>UPI and cheque</em>
              </a>

              <a className="ol-command-side-card ol-command-side-card--auto" href="#office">
                <span>Auto email</span>
                <strong>Scheduled</strong>
                <em>Latest approved version</em>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="ol-landing-beta-banner" aria-label="Public beta pricing note">
        <div>
          <strong>Public beta is free.</strong>
          <span>Use the web workspace now. Paid plans are coming soon.</span>
        </div>
        <Link className="ol-button-secondary" href={appCtaHref}>
          Start free
        </Link>
      </section>

      <section className="ol-landing-section" id="how-it-works">
        <div className="ol-landing-section-head">
          <span className="ol-eyebrow">Daily control</span>
          <h2>Start each day with the work that matters.</h2>
          <p>Short, actionable views keep owners focused without hiding important records.</p>
        </div>
        <div className="ol-daily-action-strip">
          {actionTiles.map(([title, value, copy]) => (
            <a className="ol-landing-action-card" href="#final-cta" key={title}>
              <span>{title}</span>
              <strong>{value}</strong>
              <p>{copy}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="ol-landing-section ol-landing-template-section" id="templates">
        <div className="ol-landing-section-head">
          <span className="ol-eyebrow">Invoice templates</span>
          <h2>Documents that look ready before they are sent.</h2>
          <p>
            Preview polished invoice styles with sample data, premium branding areas, payment
            details, tax sections, and status stamps.
          </p>
        </div>
        <LandingTemplateShowcase />
      </section>

      <section className="ol-landing-story-grid">
        {storyCards.map((card) => (
          <article className="ol-landing-story-card" key={card.title}>
            <span className="ol-eyebrow">{card.eyebrow}</span>
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
            <div className="ol-story-chip-row">
              {card.points.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="ol-landing-section ol-landing-office-section" id="office">
        <div>
          <span className="ol-eyebrow">Office</span>
          <h2>Built for team roles and multi-company work.</h2>
          <p>
            Invite-only access adds safer operations for businesses that need member roles,
            approval trails, multiple companies, and controlled support review.
          </p>
        </div>
        <Link className="ol-button-secondary" href="/login">
          Request Office access
        </Link>
      </section>

      <section className="ol-landing-section ol-landing-trust-section">
        <div className="ol-landing-section-head">
          <span className="ol-eyebrow">Trust layer</span>
          <h2>Built for sensitive business records.</h2>
          <p>Security and review controls are presented clearly, without turning the page into a settings manual.</p>
        </div>
        <div className="ol-trust-grid">
          {trustSignals.map((signal) => (
            <span key={signal}>
              <i aria-hidden="true" />
              {signal}
            </span>
          ))}
        </div>
      </section>

      <section className="ol-landing-section ol-landing-pricing" id="pricing">
        <span className="ol-eyebrow">Public beta</span>
        <h2>Free during public beta.</h2>
        <p>Orbit Ledger web is free during beta. Paid plans are coming soon.</p>
        <Link className="ol-button" href={appCtaHref}>
          Start free
        </Link>
      </section>

      <section className="ol-landing-final" id="final-cta">
        <h2>Run tomorrow’s business with more control.</h2>
        <div className="ol-landing-hero-actions">
          <Link className="ol-button" href={appCtaHref}>
            Start free
          </Link>
          <Link className="ol-button-secondary" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
