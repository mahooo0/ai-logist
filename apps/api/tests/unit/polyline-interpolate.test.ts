// Phase 6 Wave 2 — D-04 port from web. Live tests (flipped from Wave 0 scaffold).
import { describe, it, expect } from 'vitest';
import { interpolateAlongPolyline, closestPointOnPolyline, buildSegments } from '../../src/lib/polyline-interpolate.js';

describe('polyline-interpolate', () => {
  it('returns midpoint of horizontal segment', () => {
    const r = interpolateAlongPolyline([[0, 0], [10, 0]], 0.5);
    expect(r[0]).toBeCloseTo(5, 6);
    expect(r[1]).toBeCloseTo(0, 6);
  });

  it('clamps progress=0 to first coord, progress=1 to last', () => {
    expect(interpolateAlongPolyline([[0, 0], [10, 0]], 0)).toEqual([0, 0]);
    expect(interpolateAlongPolyline([[0, 0], [10, 0]], 1)).toEqual([10, 0]);
  });

  it('clamps out-of-range progress', () => {
    expect(interpolateAlongPolyline([[0, 0], [10, 0]], -1)).toEqual([0, 0]);
    expect(interpolateAlongPolyline([[0, 0], [10, 0]], 2)).toEqual([10, 0]);
  });

  it('handles empty + single-point coords', () => {
    expect(interpolateAlongPolyline([], 0.5)).toEqual([0, 0]);
    expect(interpolateAlongPolyline([[3, 4]], 0.5)).toEqual([3, 4]);
  });

  it('matches web math on 4-segment polyline (snapshot)', () => {
    // Moscow -> Tula -> Voronezh -> Rostov approximate.
    const coords: [number, number][] = [
      [37.6173, 55.7558],
      [37.6173, 54.1961],
      [39.1843, 51.6720],
      [39.7233, 47.2225],
    ];
    const mid = interpolateAlongPolyline(coords, 0.5);
    // The equirectangular midpoint falls in the Voronezh region.
    // Snapshot values computed from identical math as web's polyline-utils.ts.
    expect(mid[0]).toBeCloseTo(39.197, 2);
    expect(mid[1]).toBeCloseTo(51.568, 2);
  });

  it('buildSegments returns empty for less than 2 coords', () => {
    expect(buildSegments([])).toEqual([]);
    expect(buildSegments([[1, 2]])).toEqual([]);
  });

  it('closestPointOnPolyline returns target for empty coords', () => {
    const t: [number, number] = [5, 5];
    const r = closestPointOnPolyline([], t);
    expect(r.point).toEqual(t);
    expect(r.progress).toBe(0);
  });

  it('closestPointOnPolyline snaps to nearest point on segment', () => {
    // Horizontal line from [0,0] to [10,0]; target at [5,1].
    const r = closestPointOnPolyline([[0, 0], [10, 0]], [5, 1]);
    // Projection onto segment should land at roughly x=5.
    expect(r.point[0]).toBeCloseTo(5, 0);
    expect(r.progress).toBeCloseTo(0.5, 1);
  });
});
