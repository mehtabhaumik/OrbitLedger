'use client';

import type { ReactNode } from 'react';

import type { DashboardAnalytics, DashboardChartPoint, DashboardSegment } from '@/lib/dashboard-analytics';

import { AreaLineChart } from './charts/area-line-chart';

export type DashboardChartInsight =
  | { kind: 'receivable-day'; id: string; label: string }
  | { kind: 'invoice-status'; id: string; label: string }
  | { kind: 'cash-week'; id: string; label: string }
  | { kind: 'month'; id: string; label: string }
  | { kind: 'customer'; id: string; label: string }
  | { kind: 'invoice-aging'; id: string; label: string }
  | { kind: 'customer-health'; id: string; label: string }
  | { kind: 'payment-mode'; id: string; label: string }
  | { kind: 'inventory-pressure'; id: string; label: string };

type DashboardChartsProps = {
  analytics: DashboardAnalytics;
  currency: string;
  onOpenInsight(insight: DashboardChartInsight): void;
  onOpenCollections(): void;
  onOpenInvoices(): void;
  onOpenInventory(): void;
  onOpenPayments(): void;
};

/**
 * Segment tones are assigned semantically by dashboard-analytics (paid ->
 * success, overdue -> danger, …), so they map onto the semantic colour tokens
 * rather than the categorical --chart-* ramp. Returning CSS var() references
 * (not hex) is what makes these charts theme- and dark-mode-aware; the old
 * hardcoded hex map is why chart colours never followed the reskin.
 */
const toneColors: Record<DashboardSegment['tone'], string> = {
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  premium: 'var(--premium)',
  neutral: 'var(--text-soft)',
};

export function DashboardCharts({
  analytics,
  currency,
  onOpenInsight,
  onOpenCollections,
  onOpenInvoices,
  onOpenInventory,
  onOpenPayments,
}: DashboardChartsProps) {
  return (
    <section className="ol-dashboard-visuals" aria-label="Dashboard charts">
      <ChartCard
        actionLabel="Open collections"
        emptyText="Receivable trend appears after credits or payments are recorded."
        isEmpty={!hasAnyValue(analytics.receivablesTrend)}
        onAction={onOpenCollections}
        title="Receivables trend"
      >
        <AreaLineChart
          ariaLabel="Receivables trend"
          points={analytics.receivablesTrend}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onPointClick={(point) => onOpenInsight({ kind: 'receivable-day', id: point.id ?? point.label, label: point.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review invoices"
        emptyText="Invoice health appears after invoices are created."
        isEmpty={!hasAnyValue(analytics.collectionHealth)}
        onAction={onOpenInvoices}
        title="Collection health"
      >
        <DonutChart
          segments={analytics.collectionHealth}
          onSegmentClick={(segment) => onOpenInsight({ kind: 'invoice-status', id: segment.id ?? segment.label, label: segment.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review payments"
        emptyText="Cash inflow appears after payments are recorded."
        isEmpty={!hasAnyValue(analytics.cashInflow)}
        onAction={onOpenPayments}
        title="Cash inflow"
      >
        <BarChart
          points={analytics.cashInflow}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onPointClick={(point) => onOpenInsight({ kind: 'cash-week', id: point.id ?? point.label, label: point.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Open invoices"
        emptyText="Monthly comparison appears after invoice and payment activity."
        isEmpty={!analytics.monthlySnapshot.some((point) => point.collected > 0 || point.invoiced > 0)}
        onAction={onOpenInvoices}
        title="Invoiced vs collected"
      >
        <GroupedBarChart
          points={analytics.monthlySnapshot}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onPointClick={(point) => onOpenInsight({ kind: 'month', id: point.id ?? point.label, label: point.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Open collections"
        emptyText="Outstanding customers appear here when balances are due."
        isEmpty={!hasAnyValue(analytics.topCustomersOutstanding)}
        onAction={onOpenCollections}
        title="Top outstanding customers"
      >
        <HorizontalBars
          points={analytics.topCustomersOutstanding}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onPointClick={(point) => onOpenInsight({ kind: 'customer', id: point.id ?? point.label, label: point.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review invoices"
        emptyText="Aging appears when unpaid invoices exist."
        isEmpty={!hasAnyValue(analytics.invoiceAging)}
        onAction={onOpenInvoices}
        title="Invoice aging"
      >
        <SegmentBars
          segments={analytics.invoiceAging}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onSegmentClick={(segment) => onOpenInsight({ kind: 'invoice-aging', id: segment.id ?? segment.label, label: segment.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review customers"
        emptyText="Customer health appears after customer activity is recorded."
        isEmpty={!hasAnyValue(analytics.customerRiskMix)}
        onAction={onOpenCollections}
        title="Customer risk mix"
      >
        <SegmentBars
          segments={analytics.customerRiskMix}
          valueFormatter={(value) => `${value}`}
          onSegmentClick={(segment) => onOpenInsight({ kind: 'customer-health', id: segment.id ?? segment.label, label: segment.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review payments"
        emptyText="Payment mode mix appears after payments are recorded."
        isEmpty={!hasAnyValue(analytics.paymentModeBreakdown)}
        onAction={onOpenPayments}
        title="Payment modes"
      >
        <SegmentBars
          segments={analytics.paymentModeBreakdown}
          valueFormatter={(value) => formatCompactCurrency(value, currency)}
          onSegmentClick={(segment) => onOpenInsight({ kind: 'payment-mode', id: segment.id ?? segment.label, label: segment.label })}
        />
      </ChartCard>

      <ChartCard
        actionLabel="Review stock"
        emptyText="Inventory pressure appears after products are added."
        isEmpty={!hasAnyValue(analytics.inventoryPressure)}
        onAction={onOpenInventory}
        title="Inventory pressure"
      >
        <SegmentBars
          segments={analytics.inventoryPressure}
          valueFormatter={(value) => `${value}`}
          onSegmentClick={(segment) => onOpenInsight({ kind: 'inventory-pressure', id: segment.id ?? segment.label, label: segment.label })}
        />
      </ChartCard>
    </section>
  );
}

function ChartCard({
  actionLabel,
  children,
  emptyText,
  isEmpty,
  onAction,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  emptyText: string;
  isEmpty: boolean;
  onAction(): void;
  title: string;
}) {
  return (
    <article className="ol-chart-card">
      <div className="ol-chart-card-head">
        <h3>{title}</h3>
        <button className="ol-button-ghost ol-button-compact" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
      <div className="ol-chart-card-body">{children}</div>
      {isEmpty ? <p className="ol-chart-empty">{emptyText}</p> : null}
    </article>
  );
}

function BarChart({
  onPointClick,
  points,
  valueFormatter,
}: {
  onPointClick(point: DashboardChartPoint): void;
  points: DashboardChartPoint[];
  valueFormatter(value: number): string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="ol-bar-chart" role="img" aria-label="Cash inflow chart">
      {points.map((point) => (
        <button className="ol-bar-chart-item" key={point.label} type="button" onClick={() => onPointClick(point)}>
          <span className="ol-bar-chart-bar" style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} />
          <small>{point.label}</small>
          <em>{valueFormatter(point.value)}</em>
        </button>
      ))}
    </div>
  );
}

function GroupedBarChart({
  onPointClick,
  points,
  valueFormatter,
}: {
  onPointClick(point: DashboardChartPoint & { collected: number; invoiced: number }): void;
  points: Array<DashboardChartPoint & { collected: number; invoiced: number }>;
  valueFormatter(value: number): string;
}) {
  const max = Math.max(...points.flatMap((point) => [point.invoiced, point.collected]), 1);
  return (
    <div className="ol-grouped-chart" role="img" aria-label="Invoiced versus collected chart">
      {points.map((point) => (
        <button className="ol-grouped-chart-item" key={point.label} type="button" onClick={() => onPointClick(point)}>
          <div>
            <span style={{ height: `${Math.max(6, (point.invoiced / max) * 100)}%` }} />
            <span data-tone="success" style={{ height: `${Math.max(6, (point.collected / max) * 100)}%` }} />
          </div>
          <small>{point.label}</small>
        </button>
      ))}
      <div className="ol-chart-legend">
        <span><i />Invoiced</span>
        <span><i data-tone="success" />Collected</span>
        <strong>{valueFormatter(points.at(-1)?.value ?? 0)} gap</strong>
      </div>
    </div>
  );
}

function DonutChart({
  onSegmentClick,
  segments,
}: {
  onSegmentClick(segment: DashboardSegment): void;
  segments: DashboardSegment[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 25;
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="ol-donut-wrap">
      <svg className="ol-donut-chart" viewBox="0 0 100 100" role="img" aria-label="Collection health chart">
        <circle className="ol-donut-track" cx="50" cy="50" r={radius} />
        {segments.map((segment) => {
          const length = total ? (segment.value / total) * circumference : 0;
          const dash = `${length} ${circumference - length}`;
          const strokeDashoffset = offset;
          offset -= length;
          return (
            <circle
              cx="50"
              cy="50"
              key={segment.id ?? segment.label}
              r={radius}
              stroke={toneColors[segment.tone]}
              strokeDasharray={dash}
              strokeDashoffset={strokeDashoffset}
              className="ol-donut-segment"
              onClick={() => onSegmentClick(segment)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSegmentClick(segment);
                }
              }}
            />
          );
        })}
        <text x="50" y="48" textAnchor="middle" className="ol-donut-number">{total}</text>
        <text x="50" y="60" textAnchor="middle" className="ol-donut-label">invoices</text>
      </svg>
      <div className="ol-segment-list">
        {segments.map((segment) => (
          <button key={segment.id ?? segment.label} type="button" onClick={() => onSegmentClick(segment)}>
            <i style={{ background: toneColors[segment.tone] }} />
            {segment.label}
            <strong>{segment.value}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function HorizontalBars({
  onPointClick,
  points,
  valueFormatter,
}: {
  onPointClick(point: DashboardChartPoint): void;
  points: DashboardChartPoint[];
  valueFormatter(value: number): string;
}) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="ol-horizontal-bars">
      {(points.length ? points : [{ label: 'No outstanding balance', value: 0 }]).map((point) => (
        <button className="ol-horizontal-bar-row" key={point.id ?? point.label} type="button" onClick={() => onPointClick(point)}>
          <div>
            <span>{point.label}</span>
            <strong>{valueFormatter(point.value)}</strong>
          </div>
          <em><i style={{ width: `${Math.max(point.value ? 8 : 0, (point.value / max) * 100)}%` }} /></em>
        </button>
      ))}
    </div>
  );
}

function SegmentBars({
  onSegmentClick,
  segments,
  valueFormatter,
}: {
  onSegmentClick(segment: DashboardSegment): void;
  segments: DashboardSegment[];
  valueFormatter(value: number): string;
}) {
  const max = Math.max(...segments.map((segment) => segment.value), 1);
  return (
    <div className="ol-segment-bars">
      {segments.map((segment) => (
        <button className="ol-segment-bar-row" key={segment.id ?? segment.label} type="button" onClick={() => onSegmentClick(segment)}>
          <div>
            <span><i style={{ background: toneColors[segment.tone] }} />{segment.label}</span>
            <strong>{valueFormatter(segment.value)}</strong>
          </div>
          <em><i style={{ background: toneColors[segment.tone], width: `${Math.max(segment.value ? 8 : 0, (segment.value / max) * 100)}%` }} /></em>
        </button>
      ))}
    </div>
  );
}

function formatCompactCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 100000 ? 'compact' : 'standard',
    style: 'currency',
  }).format(value);
}

function hasAnyValue(points: Array<{ value: number }>) {
  return points.some((point) => point.value > 0);
}
