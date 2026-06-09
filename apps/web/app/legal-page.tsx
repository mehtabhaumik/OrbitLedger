import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

type LegalPageSection = {
  title: string;
  body: ReactNode;
};

export function LegalPage({
  children,
  eyebrow,
  intro,
  sections,
  title,
}: {
  children?: ReactNode;
  eyebrow: string;
  intro: string;
  sections: LegalPageSection[];
  title: string;
}) {
  return (
    <main className="ol-public-page">
      <header className="ol-public-nav">
        <Link className="ol-landing-brand" href="/">
          <img
            alt="Orbit Ledger"
            className="ol-brand-logo"
            src="/branding/orbit-ledger-logo-primary.png"
          />
        </Link>
        <nav aria-label="Public pages">
          <Link href={'/privacy' as Route}>Privacy</Link>
          <Link href={'/terms' as Route}>Terms</Link>
          <Link href={'/refunds' as Route}>Refunds</Link>
          <Link href={'/contact' as Route}>Contact</Link>
          <Link className="ol-button-secondary" href="/login">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="ol-public-hero">
        <span className="ol-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <div className="ol-public-meta">
          <span>Orbit Ledger</span>
          <span>By Rudraix</span>
          <span>Last updated: June 4, 2026</span>
        </div>
      </section>

      <section className="ol-public-card">
        {sections.map((section) => (
          <article className="ol-public-section" key={section.title}>
            <h2>{section.title}</h2>
            <div>{section.body}</div>
          </article>
        ))}
        {children}
      </section>
    </main>
  );
}
