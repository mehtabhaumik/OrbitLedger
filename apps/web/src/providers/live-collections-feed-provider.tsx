'use client';

import type { ReactNode } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  formatLiveCollectionAmount,
  parseLiveCollectionNotification,
  shouldSurfaceLiveCollectionNotification,
  type LiveCollectionNotification,
} from '@/lib/live-collections-notifications';
import { getWebFirestore } from '@/lib/firebase';
import { useAuth } from './auth-provider';
import { useToast } from './toast-provider';
import { useWorkspace } from './workspace-provider';

const SEEN_STORAGE_PREFIX = 'orbit-ledger:live-collection-notifications:seen:';
const MAX_SEEN_IDS = 80;

export function LiveCollectionsFeedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<LiveCollectionNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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
      router.push(notification.deepLinkPath as Route);
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
  }, [openNotification, showToast, storageKey, user, workspaceId]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, workspaceId]);

  return (
    <>
      {children}
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
