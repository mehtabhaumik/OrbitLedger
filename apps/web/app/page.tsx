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

const proofSignals = [
  ['Live payment updates', 'Know when money arrives.'],
  ['Invoice version history', 'See exactly what changed.'],
  ['Customer follow-up memory', 'Track reminders and promises.'],
  ['Office-ready audit trail', 'Keep team activity accountable.'],
  ['Print-ready documents', 'Share clean records anywhere.'],
] as const;

const productFlow = [
  ['Create invoice', 'Prepare branded invoices with tax, payment, and version details.'],
  ['Share payment link', 'Send the invoice by email or message with payment instructions attached.'],
  ['Track payment', 'Live collection status updates when the customer pays.'],
  ['Update ledger', 'Verified payments update invoice state and customer balance.'],
  ['Close the day', 'Review collections, pending work, and tomorrow’s follow-ups.'],
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

        <div className="ol-command-stage" aria-label="Command center product preview">
          <div className="ol-command-frame">
            <div className="ol-command-frame-top">
              <span>Today</span>
              <strong>Receivables command center</strong>
              <em>Live collection radar</em>
            </div>
            <div className="ol-command-dashboard">
              <div className="ol-command-rail" aria-hidden="true">
                {[
                  ['Live', 'Payment received', 'Rs 5,000'],
                  ['Review', '2 payments need verification', 'UPI + cheque'],
                  ['Auto email', 'Invoice WEB-1048 scheduled', 'May 22'],
                ].map(([state, label, value]) => (
                  <div className="ol-command-rail-item" key={label}>
                    <span>{state}</span>
                    <strong>{label}</strong>
                    <em>{value}</em>
                  </div>
                ))}
              </div>

              <div className="ol-command-main-panel">
                <div className="ol-command-main-top">
                  <div>
                    <span>Outstanding balance</span>
                    <strong>Rs 84,200</strong>
                  </div>
                  <b>Down 18%</b>
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
                  <span>Pending Rs 8,600</span>
                </div>
                <div className="ol-command-live-card" aria-hidden="true">
                  <div>
                    <span>Payment received</span>
                    <strong>Rs 5,000</strong>
                    <em>Northline Repair · Invoice WEB-1048</em>
                  </div>
                  <b>✓</b>
                </div>
              </div>

              <div className="ol-command-side-card ol-command-side-card--queue">
                <span>Collect today</span>
                <strong>3 customers</strong>
                <div>
                  <b>North Star Retail</b>
                  <b>Blue Harbor Supply</b>
                  <b>Peakline Services</b>
                </div>
              </div>

              <div className="ol-command-side-card ol-command-side-card--invoice">
                <span>Invoice WEB-1048</span>
                <strong>Rs 17,700</strong>
                <b>PAID</b>
                <em>Version 3 sent automatically</em>
              </div>

              <div className="ol-command-side-card ol-command-side-card--verify">
                <span>Payment verification</span>
                <strong>2 waiting</strong>
                <em>UPI and cheque</em>
              </div>

              <div className="ol-command-side-card ol-command-side-card--close">
                <span>Daily close</span>
                <strong>5 checks</strong>
                <em>Cash, credit, stock, follow-up, backup</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ol-proof-strip" aria-label="Orbit Ledger product proof points">
        <div className="ol-proof-beta">
          <span>Public beta</span>
          <strong>Free while beta is active</strong>
        </div>
        {proofSignals.map(([label, detail]) => (
          <div className="ol-proof-item" key={label}>
            <strong>{label}</strong>
            <span>{detail}</span>
          </div>
        ))}
      </section>

      <section className="ol-landing-section ol-product-flow-section" id="how-it-works">
        <div className="ol-landing-section-head">
          <span className="ol-eyebrow">How it works</span>
          <h2>From invoice to closed day, every step stays visible.</h2>
          <p>Orbit Ledger follows the money path from document creation to collection and review.</p>
        </div>
        <div className="ol-product-flow" aria-label="Orbit Ledger product flow">
          {productFlow.map(([title, copy], index) => (
            <article className="ol-product-flow-step" key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="ol-landing-section-head ol-landing-section-head--compact">
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
