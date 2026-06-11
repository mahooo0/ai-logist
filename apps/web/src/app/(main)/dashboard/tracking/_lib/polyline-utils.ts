// Pure helpers for interpolating positions along a polyline of [lng, lat]
// points and finding the closest point on the polyline for a given target.
//
// Distance metric: equirectangular approximation (cos-latitude scaled) —
// good enough for highway-scale polylines, no need for haversine accuracy
// at the per-segment granularity, and keeps the closest-point math linear.

export type LngLat = readonly [number, number];

interface Segment {
  readonly from: LngLat;
  readonly to: LngLat;
  /** Length of this segment in equirectangular "units" (degrees-scaled). */
  readonly segLen: number;
  /** Cumulative length up to AND INCLUDING this segment. */
  readonly cumLen: number;
}

function segLength(a: LngLat, b: LngLat): number {
  // Equirectangular: dx = (lng2-lng1) * cos(meanLat), dy = lat2-lat1.
  const meanLatRad = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = (b[0] - a[0]) * Math.cos(meanLatRad);
  const dy = b[1] - a[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Precompute segment + cumulative-length data. Empty / degenerate input → []. */
export function buildSegments(coords: LngLat[]): Segment[] {
  if (coords.length < 2) return [];
  const segs: Segment[] = [];
  let cum = 0;
  for (let i = 1; i < coords.length; i++) {
    const from = coords[i - 1];
    const to = coords[i];
    const segLen = segLength(from, to);
    cum += segLen;
    segs.push({ from, to, segLen, cumLen: cum });
  }
  return segs;
}

/**
 * Position along the polyline at fractional `progress` ∈ [0..1].
 * Returns the first vertex when progress ≤ 0, last when ≥ 1, otherwise
 * interpolates linearly inside the matching segment.
 */
export function interpolateAlongPolyline(coords: LngLat[], progress: number): LngLat {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  const segs = buildSegments(coords);
  const total = segs[segs.length - 1].cumLen;
  if (progress <= 0 || total === 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];
  const target = progress * total;
  for (const seg of segs) {
    if (seg.cumLen >= target) {
      const segStart = seg.cumLen - seg.segLen;
      const t = (target - segStart) / seg.segLen;
      return [seg.from[0] + (seg.to[0] - seg.from[0]) * t, seg.from[1] + (seg.to[1] - seg.from[1]) * t];
    }
  }
  return coords[coords.length - 1];
}

/**
 * Project an arbitrary [lng, lat] onto the polyline and return:
 *  - `point` — the perpendicular projection (snapped to the closest segment),
 *  - `progress` — fractional position ∈ [0..1] along the polyline.
 */
export function closestPointOnPolyline(
  coords: LngLat[],
  target: LngLat
): { point: LngLat; progress: number } {
  if (coords.length === 0) return { point: target, progress: 0 };
  if (coords.length === 1) return { point: coords[0], progress: 0 };
  const segs = buildSegments(coords);
  const total = segs[segs.length - 1].cumLen;
  if (total === 0) return { point: coords[0], progress: 0 };

  let bestDist = Number.POSITIVE_INFINITY;
  let bestPoint: LngLat = coords[0];
  let bestProgress = 0;

  for (const seg of segs) {
    const meanLatRad = (((seg.from[1] + seg.to[1]) / 2) * Math.PI) / 180;
    const cosLat = Math.cos(meanLatRad);
    // Project (target - from) onto (to - from) in equirectangular space.
    const fx = 0;
    const fy = 0;
    const sx = (seg.to[0] - seg.from[0]) * cosLat;
    const sy = seg.to[1] - seg.from[1];
    const px = (target[0] - seg.from[0]) * cosLat;
    const py = target[1] - seg.from[1];
    const segLenSq = sx * sx + sy * sy;
    let t = segLenSq === 0 ? 0 : ((px - fx) * sx + (py - fy) * sy) / segLenSq;
    t = Math.max(0, Math.min(1, t));
    const snappedX = seg.from[0] + (seg.to[0] - seg.from[0]) * t;
    const snappedY = seg.from[1] + (seg.to[1] - seg.from[1]) * t;
    // Distance from target to snapped point (equirectangular).
    const ddx = (target[0] - snappedX) * cosLat;
    const ddy = target[1] - snappedY;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = [snappedX, snappedY];
      const traveled = seg.cumLen - seg.segLen + t * seg.segLen;
      bestProgress = traveled / total;
    }
  }
  return { point: bestPoint, progress: bestProgress };
}
