'use client';

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

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Monthly business review
          </div>
          <p className="ol-panel-copy">
            Monthly reviews, compliance summaries, and aging reports belong here because the wider
            canvas makes them easier to compare than a stacked mobile screen.
          </p>
        </article>
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Report direction
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">M</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Month-end review</div>
                <div className="ol-list-text">
                  Surface business movement, payment quality, and follow-up work without crowding
                  the interface.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">C</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Compliance-friendly summaries</div>
                <div className="ol-list-text">
                  Keep report structure calm and export-friendly so it feels closer to operations
                  software than a decorative dashboard.
                </div>
              </div>
            </div>
          </div>
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
