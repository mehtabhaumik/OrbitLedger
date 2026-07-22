'use client';

import { useId, useMemo, useRef, useState } from 'react';

import type { DashboardChartPoint } from '@/lib/dashboard-analytics';

import {
  DEFAULT_BOX,
  areaFromLine,
  innerHeight,
  plotSeries,
  smoothLinePath,
  type XY,
} from './primitives';
import { usePrefersReducedMotion } from './use-reduced-motion';

type AreaLineChartProps = {
  points: DashboardChartPoint[];
  valueFormatter(value: number): string;
  onPointClick(point: DashboardChartPoint): void;
  /** Accessible name for the plot. */
  ariaLabel?: string;
};

/**
 * Smooth gradient area chart with an animated draw-in and a hover crosshair.
 *
 * Geometry comes from ./primitives (unit-tested, no overshoot). Colour and
 * motion are token-driven so the chart tracks the theme and honours
 * prefers-reduced-motion. Replaces the old flat 0-100 viewBox line chart while
 * keeping its onPointClick contract and keyboard access.
 */
export function AreaLineChart({ points, valueFormatter, onPointClick, ariaLabel }: AreaLineChartProps) {
  const box = DEFAULT_BOX;
  const gradientId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { plotted, linePath, areaPath, baselineY } = useMemo(() => {
    const values = points.map((point) => point.value);
    const { points: xy } = plotSeries(values, box);
    const line = smoothLinePath(xy);
    const base = box.padding.top + innerHeight(box);
    return { plotted: xy, linePath: line, areaPath: areaFromLine(line, xy, base), baselineY: base };
  }, [points, box]);

  if (points.length === 0) {
    return null;
  }

  const active = hover != null ? plotted[hover] : null;
  const activePoint = hover != null ? points[hover] : null;

  // Map a pointer x onto the nearest data index, so the crosshair snaps to
  // points rather than floating between them.
  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const x = ratio * box.width;
    let nearest = 0;
    let best = Infinity;
    plotted.forEach((p, i) => {
      const dist = Math.abs(p.x - x);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  return (
    <div className="ol-chart2 ol-chart2--area">
      <svg
        ref={svgRef}
        className="ol-chart2-svg"
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        aria-label={ariaLabel ?? 'Trend chart'}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="ol-chart2-fill-top" />
            <stop offset="100%" className="ol-chart2-fill-bottom" />
          </linearGradient>
        </defs>

        {/* Baseline + two guide lines, recessive. */}
        <line className="ol-chart2-grid" x1={box.padding.left} y1={baselineY} x2={box.width - box.padding.right} y2={baselineY} />

        <path className="ol-chart2-area" d={areaPath} fill={`url(#${gradientId})`} />
        <path
          className={`ol-chart2-line${reducedMotion ? '' : ' ol-chart2-line--draw'}`}
          d={linePath}
        />

        {/* Crosshair + emphasized dot on hover. */}
        {active && (
          <g className="ol-chart2-cursor" aria-hidden="true">
            <line className="ol-chart2-crosshair" x1={active.x} y1={box.padding.top} x2={active.x} y2={baselineY} />
            <circle className="ol-chart2-dot-halo" cx={active.x} cy={active.y} r={7} />
            <circle className="ol-chart2-dot-core" cx={active.x} cy={active.y} r={3.2} />
          </g>
        )}

        {/* Invisible hit targets for click/keyboard on every point. */}
        {plotted.map((p, index) => (
          <circle
            key={`${points[index].label}-${index}`}
            className="ol-chart2-hit"
            cx={p.x}
            cy={p.y}
            r={10}
            role="button"
            tabIndex={0}
            aria-label={`${points[index].label}: ${valueFormatter(points[index].value)}`}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            onClick={() => onPointClick(points[index])}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPointClick(points[index]);
              }
            }}
          />
        ))}
      </svg>

      <Tooltip active={activePoint} plotted={active} box={box} valueFormatter={valueFormatter} />

      <div className="ol-chart2-axis">
        <span>{points[0]?.label ?? 'Start'}</span>
        <strong>{valueFormatter(points.at(-1)?.value ?? 0)}</strong>
        <span>{points.at(-1)?.label ?? 'Now'}</span>
      </div>
    </div>
  );
}

function Tooltip({
  active,
  plotted,
  box,
  valueFormatter,
}: {
  active: DashboardChartPoint | null;
  plotted: XY | null;
  box: typeof DEFAULT_BOX;
  valueFormatter(value: number): string;
}) {
  if (!active || !plotted) return null;
  // Position as a percentage of the plot so the HTML tooltip tracks the SVG
  // under any container width. Clamped away from the edges.
  const leftPct = Math.min(88, Math.max(6, (plotted.x / box.width) * 100));
  return (
    <div className="ol-chart2-tooltip" style={{ left: `${leftPct}%` }} role="status" aria-live="polite">
      <span className="ol-chart2-tooltip-label">{active.label}</span>
      <strong className="ol-chart2-tooltip-value">{valueFormatter(active.value)}</strong>
    </div>
  );
}
