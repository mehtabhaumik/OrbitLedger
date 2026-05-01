'use client';

import type { FormEvent } from 'react';
import { ORBIT_LEDGER_POSITIONING } from '@orbit-ledger/core';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { validateEmail, validateName } from '@/lib/form-validation';
import { useAuth } from '@/providers/auth-provider';

const loginFeatures = [
  {
    title: 'Collections first',
    copy: 'Review who owes money, what was paid, and which documents need attention.',
  },
  {
    title: 'Backup confidence',
    copy: 'Save reviewed copies and restore only after checking what will change.',
  },
  {
    title: 'Local business fit',
    copy: 'Use familiar money, document, and customer details for everyday business work.',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { signIn, register, sendPasswordReset, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'register'>('sign_in');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{
    name: string | null;
    email: string | null;
    password: string | null;
  }>({
    name: null,
    email: null,
    password: null,
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
  });
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

  function validateField(
    field: 'name' | 'email' | 'password',
    value: string,
    nextMode: 'sign_in' | 'register' = mode
  ) {
    if (field === 'name') {
      if (nextMode !== 'register') {
        return null;
      }
      return validateName(value, 'Full name', true);
    }

    if (field === 'email') {
      return validateEmail(value, true);
    }

    const normalized = value.trim();
    if (!normalized) {
      return 'Password is required.';
    }
    if (nextMode === 'register' && normalized.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    return null;
  }

  function setFieldValue(field: 'name' | 'email' | 'password', value: string) {
    setForm((current) => ({ ...current, [field]: value }));

    if (!touched[field]) {
      return;
    }

    const nextError = validateField(field, value);
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function touchAndValidate(field: 'name' | 'email' | 'password') {
    setTouched((current) => ({ ...current, [field]: true }));
    const nextError = validateField(field, form[field]);
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function validateBeforeSubmit(nextMode: 'sign_in' | 'register') {
    const nextErrors = {
      name: validateField('name', form.name, nextMode),
      email: validateField('email', form.email, nextMode),
      password: validateField('password', form.password, nextMode),
    };

    setTouched({ name: true, email: true, password: true });
    setFieldErrors(nextErrors);
    return !nextErrors.name && !nextErrors.email && !nextErrors.password;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateBeforeSubmit(mode)) {
      return;
    }
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
    setTouched((current) => ({ ...current, email: true }));
    const emailError = validateField('email', email);
    if (emailError) {
      setFieldErrors((current) => ({ ...current, email: emailError }));
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      setNotice(
        `If ${email} is linked to Orbit Ledger, a password reset link has been sent.`
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
            className="ol-brand-logo"
            alt="Orbit Ledger"
            src="/branding/orbit-ledger-logo-transparent.png"
          />
          <span className="ol-brand-header-copy">Business workspace</span>
        </div>

        <aside className="ol-auth-showcase">
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--success">
              <span className="ol-dot" />
              Business workspace
            </span>
            <span className="ol-chip ol-chip--tax">Ready for web review</span>
          </div>

          <div className="ol-onboarding-headline">Daily money control for small businesses</div>
          <p className="ol-auth-showcase-copy">
            {ORBIT_LEDGER_POSITIONING.promise}
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
              {mode === 'sign_in' ? 'Sign in to your workspace' : 'Create your account'}
            </div>
            <p className="ol-panel-copy">
              Use web when you want a wider screen for customer cleanup, invoice review, reports,
              and backup confidence.
            </p>
          </div>

          <div className="ol-segmented">
            <button
              className={`ol-segment${mode === 'sign_in' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('sign_in');
                setFieldErrors((current) => ({ ...current, name: null }));
                setTouched((current) => ({ ...current, name: false }));
                setError(null);
                setNotice(null);
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`ol-segment${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('register');
                setError(null);
                setNotice(null);
              }}
              type="button"
            >
              Create account
            </button>
          </div>

          <form className="ol-form-grid" onSubmit={submit}>
            {mode === 'register' ? (
              <label className={`ol-field${fieldErrors.name ? ' is-invalid' : ''}`}>
                <span className="ol-field-label">Full name</span>
                <input
                  autoComplete="name"
                  className="ol-input"
                  value={form.name}
                  onBlur={() => touchAndValidate('name')}
                  onChange={(event) => setFieldValue('name', event.target.value)}
                />
                {fieldErrors.name ? <span className="ol-field-error">{fieldErrors.name}</span> : null}
              </label>
            ) : null}

            <label className={`ol-field${fieldErrors.email ? ' is-invalid' : ''}`}>
              <span className="ol-field-label">Email</span>
              <input
                autoComplete="email"
                className="ol-input"
                inputMode="email"
                type="email"
                value={form.email}
                onBlur={() => touchAndValidate('email')}
                onChange={(event) => setFieldValue('email', event.target.value)}
              />
              {fieldErrors.email ? <span className="ol-field-error">{fieldErrors.email}</span> : null}
            </label>

            <label className={`ol-field${fieldErrors.password ? ' is-invalid' : ''}`}>
              <span className="ol-field-label">Password</span>
              <input
                autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                className="ol-input"
                type="password"
                value={form.password}
                onBlur={() => touchAndValidate('password')}
                onChange={(event) => setFieldValue('password', event.target.value)}
              />
              {fieldErrors.password ? (
                <span className="ol-field-error">{fieldErrors.password}</span>
              ) : null}
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
    return 'Google sign-in was blocked. Try again in this browser.';
  }
  if (raw.includes('auth/operation-not-supported-in-this-environment')) {
    return 'This browser blocked Google sign-in. Try again in a full browser window.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    return 'Google sign-in is not ready for this web address yet.';
  }
  if (raw.includes('auth/too-many-requests')) {
    return 'Too many attempts were made. Wait a moment and try again.';
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'A network connection is required right now.';
  }

  return raw;
}
