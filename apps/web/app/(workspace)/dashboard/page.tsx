'use client';

import type { CSSProperties } from 'react';
import { AppShell } from '@/components/app-shell';
import { WorkspaceStatusCards } from '@/components/workspace-status-cards';
import { useWorkspace } from '@/providers/workspace-provider';

export default function DashboardPage() {
  const { activeWorkspace, dashboardSnapshot } = useWorkspace();

  return (
    <AppShell
      title="Home"
      subtitle="Today’s receivables, recent activity, and workspace status."
    >
      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, activeWorkspace?.currency ?? 'INR'),
            helper: activeWorkspace ? `${activeWorkspace.businessName} workspace` : 'No workspace',
            tone: 'warning',
          },
          {
            label: 'Customers',
            value: String(dashboardSnapshot?.customerCount ?? 0),
            helper: 'Active customer records in this workspace.',
            tone: 'primary',
          },
          {
            label: 'Invoices',
            value: String(dashboardSnapshot?.invoiceCount ?? 0),
            helper: 'Issued and draft invoices linked to this workspace.',
            tone: 'premium',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, activeWorkspace?.currency ?? 'INR'),
            helper: 'Payment entries currently cached for this workspace.',
            tone: 'success',
          },
        ]}
      />

      <section style={styles.panelRow}>
        <article style={styles.panel}>
          <div style={styles.panelTitle}>Needs attention</div>
          <p style={styles.bodyText}>
            Keep one source of truth. Use the same signed-in workspace across devices, and keep
            backup exports current before major changes.
          </p>
        </article>
        <article style={styles.panel}>
          <div style={styles.panelTitle}>Workspace readiness</div>
          <p style={styles.bodyText}>
            This web app runs with signed-in workspaces, browser-local persistence, and cloud
            recovery. Local mobile-only businesses must be linked from the mobile app before they
            appear here.
          </p>
        </article>
      </section>
    </AppShell>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

const styles: Record<string, CSSProperties> = {
  panelRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  panel: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
    display: 'grid',
    gap: 10,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 900,
  },
  bodyText: {
    margin: 0,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
};
