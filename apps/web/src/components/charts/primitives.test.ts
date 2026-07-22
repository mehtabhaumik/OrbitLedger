import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BOX,
  areaFromLine,
  linearScale,
  plotSeries,
  pointPositions,
  polylineLength,
  smoothLinePath,
  type XY,
} from './primitives';

describe('linearScale', () => {
  it('maps domain endpoints onto range endpoints', () => {
    expect(linearScale(0, 0, 10, 100, 0)).toBe(100);
    expect(linearScale(10, 0, 10, 100, 0)).toBe(0);
    expect(linearScale(5, 0, 10, 100, 0)).toBe(50);
  });

  it('pins a zero-width domain to the range midpoint instead of dividing by zero', () => {
    expect(linearScale(7, 7, 7, 0, 180)).toBe(90);
  });
});

describe('pointPositions', () => {
  it('centers a single point', () => {
    const [x] = pointPositions(1, DEFAULT_BOX);
    expect(x).toBeCloseTo(DEFAULT_BOX.padding.left + (DEFAULT_BOX.width - DEFAULT_BOX.padding.left - DEFAULT_BOX.padding.right) / 2);
  });

  it('spans first point at the left edge and last at the right edge', () => {
    const xs = pointPositions(4, DEFAULT_BOX);
    expect(xs[0]).toBe(DEFAULT_BOX.padding.left);
    expect(xs[xs.length - 1]).toBe(DEFAULT_BOX.width - DEFAULT_BOX.padding.right);
  });
});

describe('plotSeries', () => {
  it('places the minimum lower on screen (larger y) than the maximum', () => {
    const { points } = plotSeries([10, 90], DEFAULT_BOX);
    expect(points[0].y).toBeGreaterThan(points[1].y);
  });

  it('uses a zero floor so a all-positive series reads against a baseline', () => {
    const { domain } = plotSeries([20, 40, 60], DEFAULT_BOX);
    expect(domain[0]).toBe(0);
  });

  it('keeps the peak below the top edge (headroom)', () => {
    const { points } = plotSeries([100], DEFAULT_BOX);
    expect(points[0].y).toBeGreaterThanOrEqual(DEFAULT_BOX.padding.top);
  });
});

describe('smoothLinePath', () => {
  it('returns empty for no points and a move for one', () => {
    expect(smoothLinePath([])).toBe('');
    expect(smoothLinePath([{ x: 1, y: 2 }])).toBe('M 1 2');
  });

  it('draws a straight line for two points', () => {
    expect(smoothLinePath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe('M 0 0 L 10 10');
  });

  it('never overshoots below a valley between two higher points (no phantom negative money)', () => {
    // A dip: high, low, high. The curve between must not go below the low point.
    const pts: XY[] = [
      { x: 0, y: 0 }, // high on screen (small y)
      { x: 10, y: 100 }, // valley (large y)
      { x: 20, y: 0 },
    ];
    const d = smoothLinePath(pts);
    // Extract every control-point / anchor y in the path and assert none exceed
    // the valley depth. Monotone cubic guarantees this; a naive spline would not.
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((_, i) => i % 2 === 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100.001);
  });
});

describe('areaFromLine', () => {
  it('closes the path to the baseline and back', () => {
    const pts: XY[] = [{ x: 0, y: 10 }, { x: 10, y: 5 }];
    const area = areaFromLine('M 0 10 L 10 5', pts, 20);
    expect(area).toContain('L 10 20');
    expect(area.trim().endsWith('Z')).toBe(true);
  });
});

describe('polylineLength', () => {
  it('sums segment lengths', () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 4 }])).toBe(5);
    expect(polylineLength([{ x: 0, y: 0 }])).toBe(0);
  });
});
