'use client';

import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';

const loginFeatures = [
  {
    title: 'Collections first',
    copy: 'Track receivables, invoices, and reports from a signed-in business workspace.',
  },
  {
    title: 'Backup trust',
    copy: 'Use the same workspace identity for exports, restores, and future shared access.',
  },
  {
    title: 'India-ready formatting',
    copy: 'Indian currency formatting, tax-aware direction, and a calmer ledger-focused shell.',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { signIn, register, sendPasswordReset, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'register'>('sign_in');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [localHostFixUrl, setLocalHostFixUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.location.hostname !== '127.0.0.1') {
      return;
    }

    const url = new URL(window.location.href);
    url.hostname = 'localhost';
    setLocalHostFixUrl(url.toString());
    setNotice('Local Google sign-in works on localhost. Open this page on localhost instead of 127.0.0.1.');
  }, []);

  const isGoogleDisabled = useMemo(
    () => Boolean(localHostFixUrl) || isGoogleSubmitting || isSubmitting,
    [isGoogleSubmitting, isSubmitting, localHostFixUrl]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (mode === 'sign_in') {
        await signIn(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      router.replace('/dashboard');
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const email = form.email.trim();
    setError(null);
    setNotice(null);
    if (!email || !isValidEmail(email)) {
      setError('Enter a valid email address first.');
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      setNotice(
        `If ${email} is linked to Orbit Ledger cloud sync, a password reset link has been sent.`
      );
    } catch (nextError) {
      setError(getAuthErrorMessage(nextError));
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <main className="ol-auth-page">
      <div className="ol-auth-grid">
        <div className="ol-brand-header">
          <img
            alt="Orbit Ledger"
            src="/branding/orbit-ledger-logo-transparent.png"
            style={{ height: '1.6rem', width: 'auto' }}
          />
          <span className="ol-brand-header-copy">Signed-in workspace</span>
        </div>

        <aside className="ol-auth-showcase">
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--success">
              <span className="ol-dot" />
              Signed-in workspace
            </span>
            <span className="ol-chip ol-chip--tax">Cloud sync access</span>
          </div>

          <div className="ol-onboarding-headline">Business ledger workspace with real trust signals</div>
          <p className="ol-auth-showcase-copy">
            The web app is the synced Orbit Ledger workspace. Sign in to access customers,
            receivables, invoices, reports, backup control, and a calmer SaaS shell than the old
            flat placeholder UI.
          </p>

          <div className="ol-auth-feature-grid">
            {loginFeatures.map((feature) => (
              <article className="ol-auth-feature" key={feature.title}>
                <strong>{feature.title}</strong>
                <span className="ol-auth-showcase-copy" style={{ margin: 0, fontSize: 14 }}>
                  {feature.copy}
                </span>
              </article>
            ))}
          </div>
        </aside>

        <section className="ol-auth-panel">
          <div>
            <div className="ol-panel-title">
              {mode === 'sign_in' ? 'Sign in to your workspace' : 'Create a synced account'}
            </div>
            <p className="ol-panel-copy">
              Web access always uses a signed-in business workspace so the same ledger can stay
              consistent across signed-in devices.
            </p>
          </div>

          <div className="ol-segmented">
            <button
              className={`ol-segment${mode === 'sign_in' ? ' is-active' : ''}`}
              onClick={() => setMode('sign_in')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`ol-segment${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => setMode('register')}
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="ol-form-grid" onSubmit={submit}>
            {mode === 'register' ? (
              <label className="ol-field">
                <span className="ol-field-label">Full name</span>
                <input
                  className="ol-input"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </label>
            ) : null}

            <label className="ol-field">
              <span className="ol-field-label">Email</span>
              <input
                className="ol-input"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>

            <label className="ol-field">
              <span className="ol-field-label">Password</span>
              <input
                className="ol-input"
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>

            {mode === 'sign_in' ? (
              <button
                className="ol-inline-link"
                disabled={isSendingReset || isSubmitting}
                onClick={() => void handlePasswordReset()}
                type="button"
              >
                {isSendingReset ? 'Sending reset email...' : 'Reset password'}
              </button>
            ) : null}

            {error ? <div className="ol-message ol-message--danger">{error}</div> : null}
            {notice ? (
              <div className="ol-message ol-message--success">
                {notice}
                {localHostFixUrl ? (
                  <>
                    {' '}
                    <a href={localHostFixUrl} style={{ color: 'var(--primary)', fontWeight: 900 }}>
                      Open localhost
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

          <button className="ol-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait...' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

          <button
            className="ol-button-secondary"
            disabled={isGoogleDisabled}
            onClick={() => {
              if (localHostFixUrl) {
                window.location.href = localHostFixUrl;
                return;
              }

              setError(null);
              setNotice(null);
              setIsGoogleSubmitting(true);
              void signInWithGoogle()
                .then(() => router.replace('/dashboard'))
                .catch((nextError) => {
                  setError(getAuthErrorMessage(nextError));
                })
                .finally(() => {
                  setIsGoogleSubmitting(false);
                });
            }}
            type="button"
          >
            {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
          </button>
        </section>
      </div>
    </main>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Authentication failed.';

  if (raw.includes('auth/invalid-credential')) {
    return 'The email or password is not correct.';
  }
  if (raw.includes('auth/invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (raw.includes('auth/email-already-in-use')) {
    return 'This email is already linked to an account.';
  }
  if (raw.includes('auth/weak-password')) {
    return 'Use a stronger password with at least 8 characters.';
  }
  if (raw.includes('auth/user-not-found')) {
    return 'No account was found for that email address.';
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in was cancelled.';
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'Popup access was blocked. Orbit Ledger will fall back to a redirect sign-in flow.';
  }
  if (raw.includes('auth/operation-not-supported-in-this-environment')) {
    return 'This browser blocked popup sign-in. Orbit Ledger will fall back to a redirect sign-in flow.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return 'This domain is not authorized for Google sign-in in Firebase Authentication yet.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Too many attempts were made. Wait a moment and try again.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'A network connection is required right now.';
  }

  return raw;
}
