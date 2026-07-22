/**
 * Small SVG chart primitives.
 *
 * Deliberately dependency-free: the web app ships only firebase/jspdf/next/
 * react/zod, and these charts render server-side on Next 15 / React 19. Pure
 * geometry helpers live here so they can be unit-tested without a DOM.
 *
 * All charts draw into a fixed user-space viewBox and are scaled to their
 * container with CSS (width: 100%), so one coordinate system serves every
 * breakpoint.
 */

export type XY = { x: number; y: number };

export type ChartBox = {
  width: number;
  height: number;
  /** Inner padding that leaves room for axes and so strokes are not clipped. */
  padding: { top: number; right: number; bottom: number; left: number };
};

export const DEFAULT_BOX: ChartBox = {
  width: 320,
  height: 180,
  padding: { top: 12, right: 12, bottom: 22, left: 12 },
};

export function innerWidth(box: ChartBox): number {
  return box.width - box.padding.left - box.padding.right;
}

export function innerHeight(box: ChartBox): number {
  return box.height - box.padding.top - box.padding.bottom;
}

/**
 * Maps a value in [domainMin, domainMax] onto a pixel range. A zero-width
 * domain (all points equal) is pinned to the range midpoint rather than
 * dividing by zero, so a flat series renders as a centered flat line.
 */
export function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): number {
  const span = domainMax - domainMin;
  if (span === 0) {
    return (rangeMin + rangeMax) / 2;
  }
  const t = (value - domainMin) / span;
  return rangeMin + t * (rangeMax - rangeMin);
}

/**
 * Evenly spaces N points across the inner plot width. One point sits at the
 * left edge; the caller decides whether a single point should be centered.
 */
export function pointPositions(count: number, box: ChartBox): number[] {
  const left = box.padding.left;
  const w = innerWidth(box);
  if (count <= 1) {
    return [left + w / 2];
  }
  return Array.from({ length: count }, (_, i) => left + (i / (count - 1)) * w);
}

/**
 * Converts a data series into plotted points using a shared y-domain.
 * The y-domain floor is min(0, dataMin) so bars/areas read against a real
 * baseline, and the ceiling has a small headroom factor so the peak never
 * touches the top edge.
 */
export function plotSeries(values: number[], box: ChartBox): { points: XY[]; domain: [number, number] } {
  const top = box.padding.top;
  const h = innerHeight(box);
  const xs = pointPositions(values.length, box);

  const dataMax = values.length ? Math.max(...values) : 1;
  const dataMin = values.length ? Math.min(...values) : 0;
  const domainMax = dataMax <= 0 ? 1 : dataMax * 1.08;
  const domainMin = Math.min(0, dataMin);

  const points = values.map((v, i) => ({
    x: xs[i],
    // SVG y grows downward, so the range is inverted (top+h .. top).
    y: linearScale(v, domainMin, domainMax, top + h, top),
  }));

  return { points, domain: [domainMin, domainMax] };
}

/**
 * Monotone-cubic path through the points — a smooth curve that, unlike a naive
 * Catmull-Rom/Bezier, never overshoots the data. That matters for money charts:
 * a curve that dips below zero between two positive points would imply a value
 * that does not exist. Ported from the standard monotone algorithm (Fritsch-
 * Carlson tangents).
 */
export function smoothLinePath(points: XY[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (points.length === 2) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }

  const n = points.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const hx = points[i + 1].x - points[i].x;
    dx.push(hx);
    dy.push(points[i + 1].y - points[i].y);
    slope.push(hx === 0 ? 0 : (points[i + 1].y - points[i].y) / hx);
  }

  // Tangents at each point.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0; // local extremum: flat tangent prevents overshoot
    } else {
      m[i] = (slope[i - 1] + slope[i]) / 2;
    }
  }

  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = points[i].x + dx[i] / 3;
    const c1y = points[i].y + (m[i] * dx[i]) / 3;
    const c2x = points[i + 1].x - dx[i] / 3;
    const c2y = points[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(points[i + 1].x)} ${fmt(points[i + 1].y)}`;
  }
  return d;
}

/** Closes a line path down to the baseline to make a fillable area. */
export function areaFromLine(linePath: string, points: XY[], baselineY: number): string {
  if (points.length === 0) return '';
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePath} L ${fmt(last.x)} ${fmt(baselineY)} L ${fmt(first.x)} ${fmt(baselineY)} Z`;
}

/** Length of a polyline through the points — used to seed draw-in animations. */
export function polylineLength(points: XY[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, '') : '0';
}
