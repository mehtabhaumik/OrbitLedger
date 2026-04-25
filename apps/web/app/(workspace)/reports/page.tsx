'use client';

import type { CSSProperties } from 'react';
import { AppShell } from '@/components/app-shell';
import { WorkspaceStatusCards } from '@/components/workspace-status-cards';
import { useWorkspace } from '@/providers/workspace-provider';

export default function ReportsPage() {
  const { dashboardSnapshot, activeWorkspace } = useWorkspace();

  return (
    <AppShell title="Reports" subtitle="Business summaries with calm, readable signal instead of dashboard noise.">
      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, activeWorkspace?.currency ?? 'INR'),
            helper: 'Outstanding customer balance across current cached records.',
            tone: 'warning',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, activeWorkspace?.currency ?? 'INR'),
            helper: 'Payment entries currently available on this workspace.',
            tone: 'success',
          },
        ]}
      />
      <section style={styles.panel}>
        <div style={styles.title}>Monthly business review</div>
        <p style={styles.copy}>
          Monthly reviews, compliance summaries, and aging reports belong here in the web shell
          because they are easier to compare on a wider canvas.
        </p>
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
  panel: {
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 20,
    display: 'grid',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 900,
  },
  copy: {
    margin: 0,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
};
