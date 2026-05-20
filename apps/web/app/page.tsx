import Link from 'next/link';
import type { Route } from 'next';
import { WEB_BETA_TO_PAID_POLICY } from '@/lib/web-monetization';
import { LandingNav } from './landing-nav';
import { LandingSessionGate } from './landing-session-gate';
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
    title: 'Recover dues with guided follow-up.',
    copy: 'Know who to contact first, the right tone, and which promises need attention.',
    signal: '3 follow-ups ready',
    detail: 'Best next action',
    points: ['Reminder tone', 'Promise tracking', 'Broken-promise history'],
    tone: 'collect',
  },
  {
    eyebrow: 'Customer memory',
    title: 'Know the full customer story.',
    copy: 'Invoices, reminders, payments, notes, disputes, and risk signals stay in one timeline.',
    signal: 'One timeline',
    detail: 'Payment behavior',
    points: ['Trust timeline', 'Risk notes', 'Customer health'],
    tone: 'memory',
  },
  {
    eyebrow: 'Recurring invoices',
    title: 'Monthly billing without surprise emails.',
    copy: 'Prepare before send day, require approval, and mark the exact version that went out.',
    signal: '72-hour review',
    detail: 'Approved email',
    points: ['Version badge', 'Payment link', 'PDF attached'],
    tone: 'recurring',
  },
  {
    eyebrow: 'Closing ritual',
    title: 'Close each day with fewer loose ends.',
    copy: 'Review collections, pending clearance, new credit, overdue work, and tomorrow’s follow-ups.',
    signal: '3-minute close',
    detail: 'Tomorrow ready',
    points: ['Daily close', 'Pending clearance', 'Next actions'],
    tone: 'closing',
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
      <div className="ol-enterprise-ledger-bg" aria-hidden="true">
        <div className="ol-ledger-bg-sheet ol-ledger-bg-sheet--primary">
          {[
            ['20 May', 'Invoice created', 'Sonali Traders', 'Rs 13,334', 'Ready'],
            ['20 May', 'Payment received', 'Northline Repair', 'Rs 5,000', 'Verified'],
            ['21 May', 'Reminder scheduled', 'Aarav Stores', 'Rs 8,334', 'Follow-up'],
            ['21 May', 'Balance updated', 'PromptPay Studio', 'Rs 0', 'Closed'],
            ['22 May', 'Monthly invoice', 'Urban Supply Co.', 'Rs 22,774', 'Approved'],
          ].map(([date, event, customer, amount, status]) => (
            <span key={`${date}-${event}-${customer}`}>
              <b>{date}</b>
              <em>{event}</em>
              <strong>{customer}</strong>
              <i>{amount}</i>
              <small>{status}</small>
            </span>
          ))}
        </div>
        <div className="ol-ledger-bg-sheet ol-ledger-bg-sheet--secondary">
          {[
            ['Invoice', 'Payment link', 'Captured', 'Ledger updated'],
            ['Customer', 'Promise kept', 'Health improved', 'Day closed'],
            ['Audit', 'Version saved', 'Email sent', 'Receipt ready'],
          ].map((row) => (
            <span key={row.join('-')}>
              {row.map((item) => (
                <em key={item}>{item}</em>
              ))}
            </span>
          ))}
        </div>
      </div>
      <LandingSessionGate />
      <LandingNav appCtaHref={appCtaHref} />

      <section className="ol-landing-hero" aria-labelledby="landing-hero-title">
        <div className="ol-landing-hero-ledger" aria-hidden="true">
          <span>Invoice</span>
          <i />
          <span>Reminder</span>
          <i />
          <span>Payment received</span>
          <i />
          <span>Ledger updated</span>
          <i />
          <span>Day closed</span>
        </div>
        <div className="ol-landing-hero-copy">
          <span className="ol-eyebrow">Receivables command center</span>
          <h1 id="landing-hero-title">
            The calm command center for receivables, invoices, and payments.
          </h1>
          <p>
            Orbit Ledger helps business owners know what is owed, what changed, and what needs action today.
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
                  <b>North Star Retail</b>
                  <b>Blue Harbor Supply</b>
                  <b>Peakline Services</b>
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
          <span>{WEB_BETA_TO_PAID_POLICY.summary}</span>
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

      <section
        className="ol-landing-section ol-landing-story-section"
        aria-label="Orbit Ledger business workflows"
      >
        <div className="ol-landing-section-head">
          <span className="ol-eyebrow">Business control</span>
          <h2>Four workflows that keep daily money work under control.</h2>
          <p>
            Collection, customer history, recurring invoices, and daily close stay organized
            without turning the workspace into a manual.
          </p>
        </div>
        <div className="ol-landing-story-grid">
          {storyCards.map((card) => (
            <article className="ol-landing-story-card" data-tone={card.tone} key={card.title}>
              <div className="ol-story-card-copy">
                <span className="ol-eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </div>
              <div className="ol-story-card-panel" aria-hidden="true">
                <span>{card.signal}</span>
                <strong>{card.detail}</strong>
                <i />
              </div>
              <div className="ol-story-chip-row" aria-label={`${card.eyebrow} capabilities`}>
                {card.points.map((point) => (
                  <span key={point}>{point}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
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
        <p>{WEB_BETA_TO_PAID_POLICY.title}. {WEB_BETA_TO_PAID_POLICY.commitments[1]}</p>
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
