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
  fromDriver(value: string): LngLat {
    const m = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i.exec(value);
    if (!m) throw new Error(`Cannot parse geography point from driver: ${value}`);
    return { lng: Number(m[1]), lat: Number(m[2]) };
  },
});
