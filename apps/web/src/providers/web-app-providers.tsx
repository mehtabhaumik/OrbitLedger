'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { AuthProvider } from './auth-provider';
import { ConfirmDialogProvider } from './confirm-dialog-provider';
import { DeviceSettingsProvider } from './device-settings-provider';
import { LiveCollectionsFeedProvider } from './live-collections-feed-provider';
import { OfficeAccessProvider } from './office-access-provider';
import {
  WEB_PLATFORM_ADMIN_ABSOLUTE_TIMEOUT_MS,
  WEB_PLATFORM_ADMIN_IDLE_TIMEOUT_MS,
} from '@/lib/session-security';
import { ToastProvider } from './toast-provider';
import { SubscriptionProvider } from './subscription-provider';
import { UserContextProvider } from './user-context-provider';
import { WebLockProvider } from './web-lock-provider';
import { WorkspaceProvider } from './workspace-provider';

export function WebAppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingRoute = pathname === '/';
  const isPublicPreviewRoute = pathname === '/template-preview';
  const isPlatformAdminRoute = pathname?.startsWith('/platform-admin');
  const isBackofficeRoute = pathname?.startsWith('/backoffice');
  const isPublicMarketingRoute = isLandingRoute || isPublicPreviewRoute;

  useEffect(() => {
    if (isPublicMarketingRoute) {
      return;
    }

    // App Hosting is not reliably serving the repo public/ service worker yet,
    // so keep production service worker registration off until that path is stable.
    if (process.env.NEXT_PUBLIC_ORBIT_LEDGER_ENABLE_SERVICE_WORKER !== '1') {
      return;
    }

    let hasReloadedForServiceWorkerUpdate = false;
    function handleServiceWorkerControllerChange() {
      if (hasReloadedForServiceWorkerUpdate) {
        return;
      }

      hasReloadedForServiceWorkerUpdate = true;
      window.location.reload();
    }

    if (process.env.NODE_ENV !== 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerControllerChange);
      void navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => registration.update())
        .catch(() => undefined);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerControllerChange);
      }
    };
  }, [isPublicMarketingRoute]);

  if (isPublicPreviewRoute) {
    return <>{children}</>;
  }

  if (isLandingRoute) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  if (isPlatformAdminRoute || isBackofficeRoute) {
    return (
      <AuthProvider
        absoluteTimeoutMs={WEB_PLATFORM_ADMIN_ABSOLUTE_TIMEOUT_MS}
        idleTimeoutMs={WEB_PLATFORM_ADMIN_IDLE_TIMEOUT_MS}
      >
        <UserContextProvider>
          <WorkspaceProvider>
            <OfficeAccessProvider>
              <SubscriptionProvider>
                <DeviceSettingsProvider>
                  <WebLockProvider>
                    <ToastProvider>
                      <LiveCollectionsFeedProvider>
                        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
                      </LiveCollectionsFeedProvider>
                    </ToastProvider>
                  </WebLockProvider>
                </DeviceSettingsProvider>
              </SubscriptionProvider>
            </OfficeAccessProvider>
          </WorkspaceProvider>
        </UserContextProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <UserContextProvider>
        <WorkspaceProvider>
          <OfficeAccessProvider>
            <SubscriptionProvider>
              <DeviceSettingsProvider>
                <WebLockProvider>
                  <ToastProvider>
                    <LiveCollectionsFeedProvider>
                      <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
                    </LiveCollectionsFeedProvider>
                  </ToastProvider>
                </WebLockProvider>
              </DeviceSettingsProvider>
            </SubscriptionProvider>
          </OfficeAccessProvider>
        </WorkspaceProvider>
      </UserContextProvider>
    </AuthProvider>
  );
}
