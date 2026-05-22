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
import { WebLockProvider } from './web-lock-provider';
import { WorkspaceProvider } from './workspace-provider';

export function WebAppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLandingRoute = pathname === '/';
  const isPublicPreviewRoute = pathname === '/template-preview';
  const isPlatformAdminRoute = pathname?.startsWith('/platform-admin');
  const isPublicMarketingRoute = isLandingRoute || isPublicPreviewRoute;

  useEffect(() => {
    if (isPublicMarketingRoute) {
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

  if (isPlatformAdminRoute) {
    return (
      <AuthProvider
        absoluteTimeoutMs={WEB_PLATFORM_ADMIN_ABSOLUTE_TIMEOUT_MS}
        idleTimeoutMs={WEB_PLATFORM_ADMIN_IDLE_TIMEOUT_MS}
      >
        <ToastProvider>
          <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
