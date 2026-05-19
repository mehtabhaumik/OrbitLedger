'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useState } from 'react';

const landingLinks = [
  { href: '#templates', label: 'Templates' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#office', label: 'Office' },
  { href: '#pricing', label: 'Pricing' },
] as const;

type LandingNavProps = {
  appCtaHref: Route;
};

export function LandingNav({ appCtaHref }: LandingNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="ol-landing-nav" aria-label="Landing navigation">
      <Link className="ol-landing-brand" href="/" onClick={closeMenu}>
        <img
          alt="Orbit Ledger"
          className="ol-brand-logo"
          src="/branding/orbit-ledger-logo-transparent.png"
        />
      </Link>

      <nav className="ol-landing-links" aria-label="Page sections">
        {landingLinks.map((item) => (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="ol-landing-nav-actions">
        <Link className="ol-button-ghost ol-landing-signin" href="/login">
          Sign in
        </Link>
        <Link className="ol-button ol-landing-primary" href={appCtaHref}>
          Start free
        </Link>
      </div>

      <button
        aria-controls="landing-mobile-menu"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        className="ol-landing-menu-button"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="ol-landing-mobile-layer is-open">
          <button
            aria-label="Close navigation menu"
            className="ol-landing-mobile-backdrop"
            onClick={closeMenu}
            type="button"
          />
          <nav
            aria-label="Mobile page sections"
            className="ol-landing-mobile-panel"
            id="landing-mobile-menu"
          >
            <div className="ol-landing-mobile-head">
              <img
                alt="Orbit Ledger"
                className="ol-brand-logo"
                src="/branding/orbit-ledger-logo-transparent.png"
              />
              <button
                aria-label="Close navigation menu"
                className="ol-landing-mobile-close"
                onClick={closeMenu}
                type="button"
              >
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
            </div>

            <div className="ol-landing-mobile-links">
              {landingLinks.map((item) => (
                <a href={item.href} key={item.href} onClick={closeMenu}>
                  {item.label}
                </a>
              ))}
            </div>

            <div className="ol-landing-mobile-actions">
              <Link className="ol-button-ghost" href="/login" onClick={closeMenu}>
                Sign in
              </Link>
              <Link className="ol-button" href={appCtaHref} onClick={closeMenu}>
                Start free
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
