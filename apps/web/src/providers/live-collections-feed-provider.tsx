'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildLiveCollectionConfirmation,
  formatLiveCollectionAmount,
  parseLiveCollectionNotification,
  shouldSurfaceLiveCollectionNotification,
  type LiveCollectionConfirmation,
  type LiveCollectionNotification,
} from '@/lib/live-collections-notifications';
import { getWebFirestore } from '@/lib/firebase';
import { useAuth } from './auth-provider';
import { useWebDeviceSettings } from './device-settings-provider';
import { useToast } from './toast-provider';
import { useWorkspace } from './workspace-provider';

const SEEN_STORAGE_PREFIX = 'orbit-ledger:live-collection-notifications:seen:';
const MAX_SEEN_IDS = 80;

export function LiveCollectionsFeedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { settings: deviceSettings } = useWebDeviceSettings();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<LiveCollectionNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<LiveCollectionConfirmation | null>(null);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const mountedAtRef = useRef(Date.now());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const workspaceId = activeWorkspace?.workspaceId ?? null;

  const storageKey = useMemo(() => {
    if (!workspaceId || !user?.uid) {
      return null;
    }
    return `${SEEN_STORAGE_PREFIX}${workspaceId}:${user.uid}`;
  }, [user?.uid, workspaceId]);

  const openNotification = useCallback(
    (notification: LiveCollectionNotification) => {
      setIsOpen(false);
      setConfirmation(null);
      router.push(notification.deepLinkPath as Route);
    },
    [router]
  );

  const openConfirmationPath = useCallback(
    (path: string) => {
      setConfirmation(null);
      router.push(path as Route);
    },
    [router]
  );

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, [workspaceId]);

  useEffect(() => {
    seenIdsRef.current = readSeenIds(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!workspaceId || !user) {
      setNotifications([]);
      setListenerError(null);
      return undefined;
    }

    const firestore = getWebFirestore();
    const notificationsQuery = query(
      collection(firestore, 'workspaces', workspaceId, 'live_payment_notifications'),
      orderBy('created_at', 'desc'),
      limit(8)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const nextNotifications = snapshot.docs
          .map((entry) => parseLiveCollectionNotification(entry.id, entry.data()))
          .filter((entry): entry is LiveCollectionNotification => Boolean(entry));

        setNotifications(nextNotifications);
        setListenerError(null);

        for (const notification of nextNotifications.slice().reverse()) {
          if (
            !shouldSurfaceLiveCollectionNotification({
              notification,
              knownIds: seenIdsRef.current,
              mountedAtMs: mountedAtRef.current,
            })
          ) {
            continue;
          }

          seenIdsRef.current.add(notification.id);
          persistSeenIds(storageKey, seenIdsRef.current);
          const nextConfirmation = buildLiveCollectionConfirmation(notification);
          if (nextConfirmation) {
            setConfirmation(nextConfirmation);
            playLiveCollectionChime({ muted: deviceSettings.reducedMotion });
          }
          showToast(notification.message, notification.tone === 'warning' ? 'info' : notification.tone, {
            title: notification.title,
            actionLabel: 'View',
            onAction: () => openNotification(notification),
          });
        }
      },
      () => {
        setListenerError('Live payment updates are temporarily unavailable.');
      }
    );

    return () => unsubscribe();
  }, [deviceSettings.reducedMotion, openNotification, showToast, storageKey, user, workspaceId]);

  useEffect(() => {
    setIsOpen(false);
    setConfirmation(null);
  }, [pathname, workspaceId]);

  useEffect(() => {
    if (!confirmation) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setConfirmation(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation]);

  return (
    <>
      {children}
      {confirmation ? (
        <div className="ol-paid-confirmation-backdrop" role="presentation" onMouseDown={() => setConfirmation(null)}>
          <section
            aria-modal="true"
            aria-labelledby="live-payment-confirmation-title"
            className="ol-paid-confirmation-card"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ol-paid-confirmation-mark" aria-hidden="true" />
            <div className="ol-paid-confirmation-copy">
              <p className="ol-paid-confirmation-eyebrow">Verified payment</p>
              <h2 id="live-payment-confirmation-title">{confirmation.title}</h2>
              {confirmation.amountLabel ? <div className="ol-paid-confirmation-amount">{confirmation.amountLabel}</div> : null}
              <p>{confirmation.message}</p>
            </div>
            <div className="ol-paid-confirmation-actions">
              <button className="ol-button" type="button" onClick={() => openConfirmationPath(confirmation.primaryPath)}>
                {confirmation.invoiceId ? 'View invoice' : 'View payment'}
              </button>
              {confirmation.customerId ? (
                <button
                  className="ol-button-secondary"
                  type="button"
                  onClick={() => openConfirmationPath(`/customers/detail/?customerId=${encodeURIComponent(confirmation.customerId!)}`)}
                >
                  View customer
                </button>
              ) : null}
              <button className="ol-button-ghost" type="button" onClick={() => setConfirmation(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {workspaceId ? (
        <aside className="ol-live-feed" aria-label="Live payment updates">
          <button
            aria-expanded={isOpen}
            className="ol-live-feed-trigger"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="ol-live-feed-orb" aria-hidden="true" />
            <span>
              <strong>Live collections</strong>
              <span>{notifications[0] ? shortFeedStatus(notifications[0]) : 'No new payments'}</span>
            </span>
            {notifications.length ? <span className="ol-live-feed-count">{notifications.length}</span> : null}
          </button>
          {isOpen ? (
            <div className="ol-live-feed-panel">
              <div className="ol-live-feed-head">
                <div>
                  <strong>Payment updates</strong>
                  <span>Backend-verified activity from this workspace.</span>
                </div>
                <button className="ol-live-feed-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close payment updates">
                  x
                </button>
              </div>
              {listenerError ? <div className="ol-message ol-message--warning">{listenerError}</div> : null}
              <div className="ol-live-feed-list">
                {notifications.map((notification) => (
                  <button
                    className="ol-live-feed-item"
                    data-tone={notification.tone}
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                  >
                    <span className="ol-live-feed-item-icon" aria-hidden="true">
                      {iconForNotification(notification)}
                    </span>
                    <span className="ol-live-feed-item-copy">
                      <strong>{notification.title}</strong>
                      <span>{notification.message}</span>
                      <span className="ol-live-feed-meta">
                        {formatLiveCollectionAmount(notification.amount, notification.currency) ?? notification.currency}
                        {' · '}
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {notifications.length ? null : (
                  <div className="ol-empty ol-live-feed-empty">
                    Live payment updates will appear here after a verified payment event is reconciled.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}

function shortFeedStatus(notification: LiveCollectionNotification) {
  const amount = formatLiveCollectionAmount(notification.amount, notification.currency);
  return amount ? `${notification.title} · ${amount}` : notification.title;
}

function iconForNotification(notification: LiveCollectionNotification) {
  switch (notification.kind) {
    case 'payment_received':
      return 'OK';
    case 'payment_failed':
      return '!';
    case 'payment_refunded':
      return 'RF';
    case 'payment_needs_review':
    default:
      return '?';
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Time unavailable';
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function readSeenIds(storageKey: string | null) {
  if (!storageKey || typeof window === 'undefined') {
    return new Set<string>();
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function persistSeenIds(storageKey: string | null, seenIds: Set<string>) {
  if (!storageKey || typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seenIds).slice(-MAX_SEEN_IDS)));
  } catch {
    // Local read-state is a notification convenience only.
  }
}

function playLiveCollectionChime({ muted }: { muted: boolean }) {
  if (muted || typeof window === 'undefined' || typeof document === 'undefined' || document.visibilityState !== 'visible') {
    return;
  }

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }
    const context = new AudioContextConstructor();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);

    for (const [index, frequency] of [587.33, 783.99].entries()) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.09);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.09);
      oscillator.stop(context.currentTime + 0.34 + index * 0.09);
    }

    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 650);
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}
