// Source pattern: https://github.com/drizzle-team/drizzle-orm/discussions/1618
// Adapted for geography(Point, 4326) per CONTEXT.md D-02.
// PostGIS WKT format on the wire: 'SRID=4326;POINT(lon lat)'

import { customType } from 'drizzle-orm/pg-core';

export type LngLat = { lng: number; lat: number };

/**
 * geography(Point, 4326) column type.
 * Reads/writes EWKT 'SRID=4326;POINT(lon lat)' strings on the toDriver side.
 *
 * IMPORTANT CAVEAT (verified against node-postgres):
 * node-postgres returns PostGIS columns as HEX EWKB by default, not EWKT.
 * The fromDriver below works only when the SQL explicitly returns text
 * (e.g. ST_AsText(geom)). For typed reads, prefer hand-written sql`` with
 * ST_X(geom::geometry) AS lng, ST_Y(geom::geometry) AS lat and map manually.
 *
 * customType is here PRIMARILY so drizzle-kit emits the correct
 * `geography(Point, 4326)` DDL when generating migrations.
 */
/**
 * Parse a PostGIS EWKB hex string for a POINT geometry/geography.
 * Layout (little-endian, with SRID flag):
 *   1 byte  byte order (01 = LE)
 *   4 bytes type (0x20000001 = POINT with SRID)
 *   4 bytes SRID
 *   8 bytes lng (double LE)
 *   8 bytes lat (double LE)
 * Returns null when the input doesn't match this exact shape.
 */
function parsePointEwkbHex(hex: string): LngLat | null {
  if (!/^[0-9A-Fa-f]+$/.test(hex)) return null;
  if (hex.length < 50) return null;
  // Byte 0: byte order. We only handle little-endian (01).
  if (hex.slice(0, 2).toLowerCase() !== '01') return null;
  // Bytes 1..4: type. With SRID flag this is 20000001 little-endian → '01000020'.
  if (hex.slice(2, 10).toLowerCase() !== '01000020') return null;
  const buf = Buffer.from(hex, 'hex');
  // 1 byte order + 4 bytes type + 4 bytes SRID = offset 9 for lng, then +8 for lat.
  const lng = buf.readDoubleLE(9);
  const lat = buf.readDoubleLE(17);
  return { lng, lat };
}

export const geographyPoint = customType<{
  data: LngLat;
  driverData: string;
}>({
  dataType() {
    return 'geography(Point, 4326)';
  },
  toDriver(value: LngLat): string {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  /**
   * node-postgres delivers PostGIS columns as either EWKT
   * ('SRID=4326;POINT(lng lat)') when the SQL wraps the column in ST_AsText(),
   * or as HEX EWKB ('0101000020E6100000...') when selected directly. Handle
   * both shapes so naive SELECTs don't crash the request pipeline.
   */
  fromDriver(value: string): LngLat {
    const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(value);
    if (m) return { lng: Number(m[1]), lat: Number(m[2]) };
    const ewkb = parsePointEwkbHex(value);
    if (ewkb) return ewkb;
    throw new Error(`Cannot parse geography point from driver: ${value}`);
  },
});
