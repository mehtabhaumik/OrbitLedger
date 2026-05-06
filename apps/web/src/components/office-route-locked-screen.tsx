'use client';

import Link from 'next/link';
import type { Route } from 'next';

import { AppShell } from './app-shell';

export function OfficeRouteLockedScreen({
  message,
  permissionLabel,
  roleLabel,
  title,
}: {
  title: string;
  message: string;
  roleLabel: string;
  permissionLabel?: string | null;
}) {
  return (
    <AppShell title={title} subtitle="This workspace action is protected by Office access controls.">
      <section className="ol-panel">
        <div className="ol-panel-header">
          <div>
            <p className="ol-eyebrow">Access locked</p>
            <div className="ol-panel-title">{title}</div>
            <p className="ol-panel-copy">{message}</p>
          </div>
          <span className="ol-chip ol-chip--warning">{roleLabel}</span>
        </div>
        {permissionLabel ? (
          <div className="ol-review-grid" style={{ marginTop: 16 }}>
            <div className="ol-review-item">
              <span className="ol-review-label">Required access</span>
              <strong>{permissionLabel}</strong>
            </div>
            <div className="ol-review-item">
              <span className="ol-review-label">What to do</span>
              <strong>Ask the workspace owner or admin to update your role.</strong>
            </div>
          </div>
        ) : null}
        <div className="ol-actions" style={{ marginTop: 18 }}>
          <Link className="ol-button-secondary" href={'/dashboard' as Route}>
            Back to home
          </Link>
          <Link className="ol-button-secondary" href={'/team' as Route}>
            View team access
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
