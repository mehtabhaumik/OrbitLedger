'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { AuthProvider } from './auth-provider';
import { WebLockProvider } from './web-lock-provider';
import { WorkspaceProvider } from './workspace-provider';

export function WebAppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <WebLockProvider>{children}</WebLockProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
