'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/providers/auth-provider';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    router.replace(user ? '/dashboard' : '/login');
  }, [isLoading, router, user]);

  return (
    <main className="ol-auth-page">
      <div className="ol-auth-loading-card" role="status" aria-live="polite">
        <img
          className="ol-brand-logo ol-brand-logo--md"
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-transparent.png"
          width="180"
          height="38"
        />
        <strong>Opening Orbit Ledger...</strong>
      </div>
    </main>
  );
}
