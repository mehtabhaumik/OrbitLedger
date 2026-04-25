'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '@/providers/auth-provider';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, register, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'sign_in' | 'register'>('sign_in');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'sign_in') {
        await signIn(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password);
      }
      router.replace('/dashboard');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <img
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-transparent.png"
          style={{ height: '1.6rem', width: 'auto' }}
        />
        <div style={styles.heading}>Business ledger workspace</div>
        <div style={styles.copy}>
          Web access uses a signed-in workspace so the same business can be used across signed-in devices.
        </div>

        <div style={styles.segmented}>
          <button onClick={() => setMode('sign_in')} style={{ ...styles.segment, ...(mode === 'sign_in' ? styles.segmentActive : null) }} type="button">
            Sign in
          </button>
          <button onClick={() => setMode('register')} style={{ ...styles.segment, ...(mode === 'register' ? styles.segmentActive : null) }} type="button">
            Create account
          </button>
        </div>

        <form onSubmit={submit} style={styles.form}>
          {mode === 'register' ? (
            <label style={styles.field}>
              <span style={styles.label}>Full name</span>
              <input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
          ) : null}
          <label style={styles.field}>
            <span style={styles.label}>Email</span>
            <input style={styles.input} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label style={styles.field}>
            <span style={styles.label}>Password</span>
            <input style={styles.input} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {error ? <div style={styles.error}>{error}</div> : null}
          <button disabled={isSubmitting} style={styles.primaryButton} type="submit">
            {isSubmitting ? 'Please wait...' : mode === 'sign_in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => {
            void signInWithGoogle().then(() => router.replace('/dashboard')).catch((nextError) => {
              setError(nextError instanceof Error ? nextError.message : 'Google sign-in failed.');
            });
          }}
          style={styles.secondaryButton}
          type="button"
        >
          Continue with Google
        </button>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: 'linear-gradient(180deg, #f7fbff 0%, #eef4fb 100%)',
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    borderRadius: 8,
    padding: 28,
    display: 'grid',
    gap: 16,
    backdropFilter: 'blur(18px)',
  },
  heading: {
    fontSize: 28,
    fontWeight: 900,
  },
  copy: {
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
  segmented: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: 'var(--surface-muted)',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  segment: {
    minHeight: 42,
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontWeight: 800,
  },
  segmentActive: {
    background: '#fff',
    color: 'var(--primary)',
  },
  form: {
    display: 'grid',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    border: '1px solid var(--border)',
    padding: '0 14px',
    background: '#fff',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 800,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text)',
    fontWeight: 800,
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
  },
};
