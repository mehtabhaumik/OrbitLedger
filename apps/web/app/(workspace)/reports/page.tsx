'use client';

import { AppShell } from '@/components/app-shell';
import { WorkspaceStatusCards } from '@/components/workspace-status-cards';
import { buildCsv, downloadTextFile, makeExportFileName } from '@/lib/workspace-power';
import { useWorkspace } from '@/providers/workspace-provider';

export default function ReportsPage() {
  const { dashboardSnapshot, activeWorkspace } = useWorkspace();
  const currency = activeWorkspace?.currency ?? 'INR';

  function exportReportJson() {
    if (!activeWorkspace || !dashboardSnapshot) {
      return;
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      business: {
        name: activeWorkspace.businessName,
        currency: activeWorkspace.currency,
        countryCode: activeWorkspace.countryCode,
        stateCode: activeWorkspace.stateCode,
      },
      summary: dashboardSnapshot,
    };
    downloadTextFile(
      makeExportFileName([activeWorkspace.businessName, 'business-review'], 'json'),
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  function exportReportCsv() {
    if (!activeWorkspace || !dashboardSnapshot) {
      return;
    }

    const csv = buildCsv(
      ['Metric', 'Value'],
      [
        ['Receivable', dashboardSnapshot.receivableTotal],
        ['Payments', dashboardSnapshot.recentPayments],
        ['Customers', dashboardSnapshot.customerCount],
        ['Invoices', dashboardSnapshot.invoiceCount],
      ]
    );
    downloadTextFile(makeExportFileName([activeWorkspace.businessName, 'business-review']), csv);
  }

  return (
    <AppShell title="Reports" subtitle="Business summaries with calm, readable signal instead of dashboard noise.">
      <div className="ol-actions">
        <button className="ol-button" type="button" onClick={exportReportCsv} disabled={!dashboardSnapshot}>
          Export summary
        </button>
        <button className="ol-button-secondary" type="button" onClick={exportReportJson} disabled={!dashboardSnapshot}>
          Save full copy
        </button>
      </div>

      <WorkspaceStatusCards
        cards={[
          {
            label: 'Receivable',
            value: formatCurrency(dashboardSnapshot?.receivableTotal ?? 0, currency),
            helper: 'Outstanding customer balance in this workspace.',
            tone: 'warning',
          },
          {
            label: 'Payments',
            value: formatCurrency(dashboardSnapshot?.recentPayments ?? 0, currency),
            helper: 'Recent payments recorded in this workspace.',
            tone: 'success',
          },
          {
            label: 'Customers',
            value: String(dashboardSnapshot?.customerCount ?? 0),
            helper: 'Customers included in this business review.',
            tone: 'primary',
          },
          {
            label: 'Invoices',
            value: String(dashboardSnapshot?.invoiceCount ?? 0),
            helper: 'Invoices included in this business review.',
            tone: 'premium',
          },
        ]}
      />

      <section className="ol-page-grid ol-page-grid--2">
        <article className="ol-panel-glass">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Monthly business review
          </div>
          <p className="ol-panel-copy">
            Use reports to compare money owed, payments received, customers, and invoices before
            exporting a copy for review.
          </p>
        </article>
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Report actions
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">M</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Month-end review</div>
                <div className="ol-list-text">
                  Keep the main numbers easy to scan so review work stays quick.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">C</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Accountant-ready copies</div>
                <div className="ol-list-text">
                  Export a simple summary or save a fuller copy for deeper review.
                </div>
              </div>
            </div>
          </div>
        </article>
        <article className="ol-panel">
          <div className="ol-panel-title" style={{ marginBottom: 12 }}>
            Balance quality
          </div>
          <div className="ol-list">
            <div className="ol-list-item">
              <div className="ol-list-icon">R</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Receivable focus</div>
                <div className="ol-list-text">
                  Keep the amount to collect visible before opening detailed customer cleanup.
                </div>
              </div>
            </div>
            <div className="ol-list-item">
              <div className="ol-list-icon">E</div>
              <div className="ol-list-copy">
                <div className="ol-list-title">Export ready</div>
                <div className="ol-list-text">
                  Save a current business review before cleanup, monthly review, or backup work.
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
