'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BrandOrbitalLoader } from '@/components/brand-loader';
import { useAuth } from '@/providers/auth-provider';

export function LandingSessionGate() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);
  const [hasPublicCheckTimedOut, setHasPublicCheckTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      setIsOpeningDashboard(true);
      router.replace('/dashboard');
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (!isLoading || user || isOpeningDashboard) {
      setHasPublicCheckTimedOut(false);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setHasPublicCheckTimedOut(true);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [isLoading, isOpeningDashboard, user]);

  if ((!isLoading || hasPublicCheckTimedOut) && !user && !isOpeningDashboard) {
    return null;
  }

  return (
    <div className="ol-landing-session-gate" role="status" aria-live="polite">
      <div className="ol-auth-loading-card ol-landing-session-gate-card">
        <img
          className="ol-brand-logo ol-brand-logo--md"
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-primary.png"
          width={180}
          height={38}
        />
        <BrandOrbitalLoader
          size="md"
          label={user || isOpeningDashboard ? 'Opening dashboard' : 'Checking secure session'}
        />
        <strong>{user || isOpeningDashboard ? 'Opening your dashboard...' : 'Checking your session...'}</strong>
      </div>
    </div>
  );
}
