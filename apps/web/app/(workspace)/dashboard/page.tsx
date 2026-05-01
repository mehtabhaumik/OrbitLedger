'use client';

import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import { WorkspaceStatusCards } from '@/components/workspace-status-cards';
import { useWorkspace } from '@/providers/workspace-provider';

const focusItems = [
  {
    label: 'Keep receivables visible',
    copy: 'Use the customer and transaction views to record credits and payments the moment they happen.',
  },
  {
    label: 'Protect document trust',
    copy: 'Invoices, reports, and backups work better when the same signed-in workspace is used consistently.',
  },
  {
    label: 'Prepare for month-end',
    copy: 'This web shell is the best place to review business health, export backups, and compare activity on a wider canvas.',
  },
] as const;

export default function DashboardPage() {
  const { activeWorkspace, dashboardSnapshot } = useWorkspace();
  const currency = activeWorkspace?.currency ?? 'INR';

  return (
    <AppShell title="Home" subtitle="Today’s receivables, recent activity, and workspace status.">
      <section className="ol-panel-dark">
        <div className="ol-panel-header">
          <div>
            <div className="ol-chip-row" style={{ marginBottom: 14 }}>
              <span className="ol-chip ol-chip--warning">Receivables</span>
              <span className="ol-chip ol-chip--success">Cloud ready</span>
            </div>
            <div className="ol-onboarding-headline" style={{ fontSize: '2.4rem' }}>
              {formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, currency)}
            </div>
            <p className="ol-panel-copy" style={{ maxWidth: 620 }}>
              Current receivable balance for {activeWorkspace?.businessName ?? 'this workspace'}.
              Start here, then move to customers, transactions, invoices, or backup when the day
              needs review.
            </p>
          </div>
          <div className="ol-actions">
            <Link className="ol-button" href="/transactions">
              Record transaction
            </Link>
            <Link className="ol-button-secondary" href="/invoices">
              Open invoices
            </Link>
          </div>
        </div>
      </section>

      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, currency),
            helper: activeWorkspace ? `${activeWorkspace.businessName} workspace` : 'No workspace',
            tone: 'warning',
          },
          {
            label: 'Customers',
            value: String(dashboardSnapshot?.customerCount ?? 0),
            helper: 'Customers in this workspace.',
            tone: 'primary',
          },
          {
            label: 'Invoices',
            value: String(dashboardSnapshot?.invoiceCount ?? 0),
            helper: 'Issued and draft invoices.',
            tone: 'premium',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, currency),
            helper: 'Recent payments recorded here.',
            tone: 'success',
          },
        ]}
      />

      <section className="ol-split-grid">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Needs attention
          </div>
          <div className="ol-list">
            {focusItems.map((item, index) => (
              <div className="ol-list-item" key={item.label}>
                <div className="ol-list-icon">{index + 1}</div>
                <div className="ol-list-copy">
                  <div className="ol-list-title">{item.label}</div>
                  <div className="ol-list-text">{item.copy}</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 14 }}>
            Workspace readiness
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">W</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Wide-screen review</div>
                <div className="ol-list-text">
                  Reports, backups, and invoices belong here because the broader canvas makes them
                  easier to trust and compare.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">S</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Business workspace</div>
                <div className="ol-list-text">
                  Review the same customers, transactions, invoices, and reports across Orbit Ledger.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">B</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Backup still matters</div>
                <div className="ol-list-text">
                  Cloud does not replace backup discipline. Export reviewed copies before major
                  changes or broad testing.
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
