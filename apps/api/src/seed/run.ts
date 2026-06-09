// Seed runner — D-18 + D-20 + D-21.
//
// Loads 4 JSON fixtures and inserts via Drizzle + onConflictDoNothing so
// `pnpm seed && pnpm seed` is idempotent. Finishes by printing the canonical
// KNN smoke from Kyiv (closes Phase 1 success criterion #3).
//
// JSON imports use the `with { type: 'json' }` attribute (ES2025; Node 22 LTS
// supports natively under `module: nodenext`).

import { sql } from 'drizzle-orm';
import { createDb, createPool } from '../db.js';
import * as schema from '../persistence/schema/index.js';
import citiesData from './data/cities.json' with { type: 'json' };
import clientsData from './data/clients.json' with { type: 'json' };
import pricingData from './data/pricing.json' with { type: 'json' };
import trucksData from './data/trucks.json' with { type: 'json' };
import { printNearestTrucksSmoke } from './smoke.js';

type CityFixture = {
  slug: string;
  name_ru: string;
  name_ua: string;
  country_code: string;
  lng: number;
  lat: number;
};

type TruckFixture = {
  name: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  capacity_t: number;
  body_type: 'tent' | 'ref' | 'iso' | 'container';
  lng: number;
  lat: number;
};

type ClientFixture = {
  name: string;
  phone: string;
  telegram_id: string | null;
  lang: 'ru' | 'ua';
  tax_id: string | null;
  tax_id_country: string | null;
};

type PricingFixture = {
  rate_per_km: number;
  dir_coef: Record<string, number>;
  season_coef: number;
};

export async function seed(): Promise<void> {
  const pool = createPool();
  const db = await createDb(pool);

  try {
    console.log('Seeding cities...');
    for (const city of citiesData as CityFixture[]) {
      await db
        .insert(schema.cities)
        .values({
          slug: city.slug,
          nameRu: city.name_ru,
          nameUa: city.name_ua,
          countryCode: city.country_code,
          geom: { lng: city.lng, lat: city.lat },
        })
        .onConflictDoNothing({ target: schema.cities.slug });
    }

    console.log('Seeding trucks...');
    for (const truck of trucksData as TruckFixture[]) {
      await db
        .insert(schema.trucks)
        .values({
          name: truck.name,
          plateNumber: truck.plate_number,
          driverName: truck.driver_name,
          driverPhone: truck.driver_phone,
          capacityT: truck.capacity_t,
          bodyType: truck.body_type,
          geom: { lng: truck.lng, lat: truck.lat },
          status: 'available',
        })
        .onConflictDoNothing({ target: schema.trucks.plateNumber });
    }

    console.log('Seeding clients...');
    for (const client of clientsData as ClientFixture[]) {
      await db
        .insert(schema.clients)
        .values({
          name: client.name,
          phone: client.phone,
          telegramId: client.telegram_id,
          lang: client.lang,
          taxId: client.tax_id,
          taxIdCountry: client.tax_id_country,
        })
        .onConflictDoNothing({ target: schema.clients.phone });
    }

    console.log('Seeding pricing config...');
    const pricing = pricingData as PricingFixture;
    await db.execute(sql`
      INSERT INTO pricing_config (key, value)
      VALUES
        ('rate_per_km', ${JSON.stringify(pricing.rate_per_km)}::jsonb),
        ('dir_coef', ${JSON.stringify(pricing.dir_coef)}::jsonb),
        ('season_coef', ${JSON.stringify(pricing.season_coef)}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);

    await printNearestTrucksSmoke(db);

    console.log('Seed complete');
  } finally {
    await pool.end();
  }
}

// When run as `pnpm seed` via tsx
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
