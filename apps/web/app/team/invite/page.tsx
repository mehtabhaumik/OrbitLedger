'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { acceptWebOfficeInvitation } from '@/lib/office-team';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function OfficeInviteAcceptPage() {
  return (
    <Suspense fallback={<OfficeInviteLoading />}>
      <OfficeInviteAcceptContent />
    </Suspense>
  );
}

function OfficeInviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { refresh } = useWorkspace();
  const { showToast } = useToast();
  const [isAccepting, setIsAccepting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceId = searchParams.get('workspaceId') ?? '';
  const invitationId = searchParams.get('invitationId') ?? '';
  const canAccept = useMemo(
    () => Boolean(user && workspaceId && invitationId && !isAccepting),
    [invitationId, isAccepting, user, workspaceId]
  );

  async function acceptInvitation() {
    if (!user || !workspaceId || !invitationId) {
      return;
    }

    setIsAccepting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await acceptWebOfficeInvitation({
        workspaceId,
        invitationId,
        displayName: user.displayName || user.email || null,
      });
      setMessage(result.message ?? 'Office invitation accepted.');
      showToast('Office invitation accepted.', 'success');
      await refresh();
      router.replace('/dashboard');
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'This invitation could not be accepted.');
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="ol-auth-page">
      <section className="ol-auth-panel" style={{ maxWidth: 720, width: 'min(720px, 100%)' }}>
        <div className="ol-brand-header">
          <img
            className="ol-brand-logo"
            alt="Orbit Ledger"
            src="/branding/orbit-ledger-logo-transparent.png"
          />
          <span className="ol-brand-header-copy">Office invitation</span>
        </div>
        <div>
          <div className="ol-panel-title">Join an Office workspace</div>
          <p className="ol-panel-copy">
            Accept this invitation only if it was sent to your email address. Orbit Ledger will add this workspace to your account after acceptance.
          </p>
        </div>

        {!workspaceId || !invitationId ? (
          <div className="ol-message ol-message--danger">This invitation link is missing required details.</div>
        ) : null}

        {isLoading ? (
          <div className="ol-message">Checking your sign-in session...</div>
        ) : !user ? (
          <div className="ol-message ol-message--warning">
            <strong>Sign in required</strong>
            <p>Sign in with the email address that received this invitation, then open this link again.</p>
            <div className="ol-actions">
              <Link className="ol-button" href="/login">
                Sign in
              </Link>
            </div>
          </div>
        ) : (
          <div className="ol-message ol-message--success">
            <strong>Signed in as {user.email}</strong>
            <p>When accepted, this workspace will appear in your workspace selector.</p>
          </div>
        )}

        {error ? <div className="ol-message ol-message--danger">{error}</div> : null}
        {message ? <div className="ol-message ol-message--success">{message}</div> : null}

        <div className="ol-actions">
          <button className="ol-button" disabled={!canAccept} type="button" onClick={() => void acceptInvitation()}>
            {isAccepting ? 'Accepting invitation' : 'Accept invitation'}
          </button>
          <Link className="ol-button-secondary" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

function OfficeInviteLoading() {
  return (
    <main className="ol-auth-page">
      <section className="ol-auth-panel" style={{ maxWidth: 720, width: 'min(720px, 100%)' }}>
        <div className="ol-brand-header">
          <img
            className="ol-brand-logo"
            alt="Orbit Ledger"
            src="/branding/orbit-ledger-logo-transparent.png"
          />
          <span className="ol-brand-header-copy">Office invitation</span>
        </div>
        <div className="ol-message">Opening invitation...</div>
      </section>
    </main>
  );
}
