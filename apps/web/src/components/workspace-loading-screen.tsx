'use client';

import { useEffect, useMemo, useState } from 'react';

const loadingSteps = [
  'Checking your business',
  'Restoring the latest business profile',
  'Preparing invoices, customers, and reports',
  'Getting the workspace ready',
] as const;

const capabilityCards = [
  {
    title: 'Fast collections control',
    copy: 'Track receivables, record payments quickly, and keep every amount readable in Indian format.',
  },
  {
    title: 'Trust-first documents',
    copy: 'Generate invoices, statements, backups, and business records from the same workspace.',
  },
  {
    title: 'Ready when work starts',
    copy: 'Orbit Ledger keeps important screens prepared so review work feels quick.',
  },
] as const;

export function WorkspaceLoadingScreen() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % loadingSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(
    () => `${((activeStep + 1) / loadingSteps.length) * 100}%`,
    [activeStep]
  );

  return (
    <main className="ol-loading-page">
      <div className="ol-loading-shell">
        <section className="ol-loading-main">
          <div className="ol-brand-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <img
              className="ol-brand-logo"
              alt="Orbit Ledger"
              src="/branding/orbit-ledger-logo-transparent.png"
              style={{ height: 32, maxWidth: 'min(420px, 100%)', objectFit: 'contain' }}
            />
            <span className="ol-brand-header-copy">Workspace preparation</span>
          </div>

          <div className="ol-loading-top">
            <div>
              <div className="ol-onboarding-headline">
                Preparing your workspace
              </div>
              <p className="ol-panel-copy" style={{ maxWidth: 520 }}>
                Orbit Ledger is checking your business and preparing the latest details for smooth
                work.
              </p>
            </div>
            <div className="ol-loader-cluster" aria-hidden="true">
              <div className="ol-loader-ring" />
              <div className="ol-loader-core" />
            </div>
          </div>

          <div className="ol-loading-progress" aria-hidden="true">
            <span style={{ width: progress }} />
          </div>

          <div className="ol-loading-steps">
            {loadingSteps.map((step, index) => (
              <div
                key={step}
                className={`ol-loading-step${index === activeStep ? ' is-active' : ''}`}
              >
                <span className="ol-chip ol-chip--primary" style={{ minWidth: 82, justifyContent: 'center' }}>
                  Step {index + 1}
                </span>
                <span>{step}</span>
                <span
                  className="ol-dot"
                  style={{
                    marginLeft: 'auto',
                    color: index <= activeStep ? 'var(--primary)' : 'rgba(125, 139, 160, 0.45)',
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="ol-onboarding-showcase">
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--tax">
              <span className="ol-dot" />
              Web workspace
            </span>
            <span className="ol-chip ol-chip--success">
              <span className="ol-dot" />
              Works with saved data
            </span>
          </div>

          <div className="ol-onboarding-headline" style={{ fontSize: '2.2rem' }}>
            Built for serious small businesses
          </div>
          <p className="ol-auth-showcase-copy">
            Orbit Ledger brings collections, invoices, reports, and backup confidence into one
            calm workspace while your business opens.
          </p>

          <div className="ol-showcase-stack">
            {capabilityCards.map((card) => (
              <article key={card.title} className="ol-showcase-card">
                <div className="ol-showcase-card-title">{card.title}</div>
                <div className="ol-showcase-card-copy">{card.copy}</div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
