---
phase: 01-database-backend-skeleton
plan: 09
type: execute
wave: 9
depends_on: ["01-07"]
files_modified:
  - apps/api/package.json
  - apps/api/src/seed/data/cities.json
  - apps/api/src/seed/data/trucks.json
  - apps/api/src/seed/data/clients.json
  - apps/api/src/seed/data/pricing.json
  - apps/api/src/seed/run.ts
  - apps/api/src/seed/smoke.ts
  - apps/api/tests/integration/seed.test.ts
  - apps/api/tests/unit/phase-1-stubs.test.ts
autonomous: true
requirements: ["DB-10"]
must_haves:
  truths:
    - "pnpm seed loads JSON fixtures and inserts ~30 cities (Russian + Ukrainian + 5+ border crossings), 12 trucks (tent×5, ref×3, iso×2, container×2), 8 clients (4 RU + 4 UA), pricing config (rate_per_km, dir_coef, season_coef) per D-19"
    - "Every INSERT uses .onConflictDoNothing() targeted at unique columns (cities.slug, trucks.plateNumber, clients.phone, pricing_config.key) per D-20"
    - "Re-running pnpm seed twice produces exactly the same DB state — no duplicates, no errors"
    - "After seed, the canonical KNN smoke query (printNearestTrucksSmoke) prints '3 nearest trucks from Kyiv center' with ascending meters values"
    - "rate_per_km is stored as bigint kopecks (4200 = 42 ₽/км per D-19) — never as decimal/string"
    - "Cities include realistic RU/UA pairs (Київ↔Киев, Львів↔Львов, Одеса↔Одесса) and >=5 border crossings (Гоптівка/Goptivka, Шегині/Sheheni, Краковец, Ягодин/Yagodyn, Брест/Brest)"
  artifacts:
    - path: "apps/api/src/seed/data/cities.json"
      provides: "~30 city fixtures (slug, name_ru, name_ua, country_code, lng, lat)"
      contains: "kyiv"
    - path: "apps/api/src/seed/data/trucks.json"
      provides: "12 truck fixtures with realistic positions across RU + UA"
      contains: "plate_number"
    - path: "apps/api/src/seed/data/clients.json"
      provides: "8 client fixtures (4 RU lang='ru' + 4 UA lang='ua')"
      contains: "telegram_id"
    - path: "apps/api/src/seed/data/pricing.json"
      provides: "rate_per_km / dir_coef / season_coef per D-19"
      contains: "rate_per_km"
    - path: "apps/api/src/seed/run.ts"
      provides: "Seed entry — loads JSON, inserts via repos+drizzle, idempotent, prints smoke"
      exports: ["seed"]
    - path: "apps/api/src/seed/smoke.ts"
      provides: "Canonical KNN smoke — overfetch by <-> + re-rank by ST_Distance(geog, true)"
      exports: ["printNearestTrucksSmoke"]
  key_links:
    - from: "apps/api/src/seed/run.ts"
      to: "apps/api/src/persistence/schema/* + db.ts"
      via: "Drizzle insert with onConflictDoNothing"
      pattern: "onConflictDoNothing"
    - from: "apps/api/src/seed/smoke.ts"
      to: "Postgres via db.execute(sql)"
      via: "raw SQL with CTE re-rank"
      pattern: "ORDER BY t\\.geom <->"
---

<objective>
Wave 9 closes DB-10. Ships 4 JSON data fixtures (~30 cities, 12 trucks, 8 clients, pricing config per D-19), the seed entry script that idempotently loads them via Drizzle (per D-18, D-20), and the canonical KNN smoke query that prints "3 nearest trucks from Kyiv center" — closing success criterion #3 of the phase.

Per RESEARCH.md Open Question 1: fixtures are JSON files (not hardcoded TS) for portability and easy review. Per D-20: every INSERT uses `.onConflictDoNothing()` so `pnpm seed && pnpm seed` is safe.

Purpose: Demonstrate the foundation works end-to-end. After this plan, running on a clean machine: `docker compose up -d postgres redis && pnpm db:migrate && pnpm seed` populates a realistic dataset and prints the KNN smoke output proving PostGIS is wired correctly.

Output: 4 JSON fixtures + 2 TS scripts (run + smoke) + 1 integration test + flipped DB-10 stub test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-database-backend-skeleton/01-CONTEXT.md
@.planning/phases/01-database-backend-skeleton/01-RESEARCH.md
@CLAUDE.md
@apps/api/src/db.ts
@apps/api/src/persistence/schema/index.ts
@apps/api/src/persistence/repos/index.ts
@apps/api/package.json
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: 4 JSON data fixtures — cities, trucks, clients, pricing</name>
  <read_first>
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-19 (exact counts and city names), D-20, D-21
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — section "Open Question 5: cities.slug exactly" (slug = ASCII Latin canonical of UA spelling)
    - apps/api/src/persistence/schema/cities.ts (Wave 3b — column names)
    - apps/api/src/persistence/schema/trucks.ts (Wave 3b — column names)
    - apps/api/src/persistence/schema/clients.ts (Wave 3b — column names)
  </read_first>
  <files>
    - apps/api/src/seed/data/cities.json
    - apps/api/src/seed/data/trucks.json
    - apps/api/src/seed/data/clients.json
    - apps/api/src/seed/data/pricing.json
  </files>
  <action>
    Four JSON fixtures. Slugs are ASCII Latin canonical of UA spelling per RESEARCH.md Open Question 5.

    **`apps/api/src/seed/data/cities.json`** — ~30 cities. RU cities (10), UA cities (12), 5 border crossings. Coordinates from OpenStreetMap (lng, lat order):

    ```json
    [
      { "slug": "moscow", "name_ru": "Москва", "name_ua": "Москва", "country_code": "RU", "lng": 37.6173, "lat": 55.7558 },
      { "slug": "saint-petersburg", "name_ru": "Санкт-Петербург", "name_ua": "Санкт-Петербург", "country_code": "RU", "lng": 30.3158, "lat": 59.9391 },
      { "slug": "voronezh", "name_ru": "Воронеж", "name_ua": "Воронеж", "country_code": "RU", "lng": 39.1843, "lat": 51.6720 },
      { "slug": "rostov-on-don", "name_ru": "Ростов-на-Дону", "name_ua": "Ростов-на-Дону", "country_code": "RU", "lng": 39.7015, "lat": 47.2357 },
      { "slug": "krasnodar", "name_ru": "Краснодар", "name_ua": "Краснодар", "country_code": "RU", "lng": 38.9753, "lat": 45.0355 },
      { "slug": "sochi", "name_ru": "Сочи", "name_ua": "Сочі", "country_code": "RU", "lng": 39.7233, "lat": 43.5855 },
      { "slug": "kazan", "name_ru": "Казань", "name_ua": "Казань", "country_code": "RU", "lng": 49.1064, "lat": 55.7963 },
      { "slug": "nizhny-novgorod", "name_ru": "Нижний Новгород", "name_ua": "Нижній Новгород", "country_code": "RU", "lng": 44.0020, "lat": 56.3269 },
      { "slug": "samara", "name_ru": "Самара", "name_ua": "Самара", "country_code": "RU", "lng": 50.1606, "lat": 53.2415 },
      { "slug": "ekaterinburg", "name_ru": "Екатеринбург", "name_ua": "Єкатеринбург", "country_code": "RU", "lng": 60.6122, "lat": 56.8431 },
      { "slug": "novosibirsk", "name_ru": "Новосибирск", "name_ua": "Новосибірськ", "country_code": "RU", "lng": 82.9357, "lat": 55.0084 },
      { "slug": "kaliningrad", "name_ru": "Калининград", "name_ua": "Калінінград", "country_code": "RU", "lng": 20.4522, "lat": 54.7104 },

      { "slug": "kyiv", "name_ru": "Киев", "name_ua": "Київ", "country_code": "UA", "lng": 30.5234, "lat": 50.4501 },
      { "slug": "lviv", "name_ru": "Львов", "name_ua": "Львів", "country_code": "UA", "lng": 24.0297, "lat": 49.8397 },
      { "slug": "odesa", "name_ru": "Одесса", "name_ua": "Одеса", "country_code": "UA", "lng": 30.7233, "lat": 46.4825 },
      { "slug": "kharkiv", "name_ru": "Харьков", "name_ua": "Харків", "country_code": "UA", "lng": 36.2304, "lat": 49.9935 },
      { "slug": "dnipro", "name_ru": "Днепр", "name_ua": "Дніпро", "country_code": "UA", "lng": 35.0462, "lat": 48.4647 },
      { "slug": "zaporizhzhia", "name_ru": "Запорожье", "name_ua": "Запоріжжя", "country_code": "UA", "lng": 35.1396, "lat": 47.8388 },
      { "slug": "chernihiv", "name_ru": "Чернигов", "name_ua": "Чернігів", "country_code": "UA", "lng": 31.2893, "lat": 51.4982 },
      { "slug": "poltava", "name_ru": "Полтава", "name_ua": "Полтава", "country_code": "UA", "lng": 34.5514, "lat": 49.5883 },
      { "slug": "vinnytsia", "name_ru": "Винница", "name_ua": "Вінниця", "country_code": "UA", "lng": 28.4682, "lat": 49.2331 },
      { "slug": "lutsk", "name_ru": "Луцк", "name_ua": "Луцьк", "country_code": "UA", "lng": 25.3424, "lat": 50.7472 },
      { "slug": "uzhhorod", "name_ru": "Ужгород", "name_ua": "Ужгород", "country_code": "UA", "lng": 22.2879, "lat": 48.6208 },
      { "slug": "ivano-frankivsk", "name_ru": "Ивано-Франковск", "name_ua": "Івано-Франківськ", "country_code": "UA", "lng": 24.7111, "lat": 48.9226 },

      { "slug": "border-hoptivka", "name_ru": "Гоптовка (КПП)", "name_ua": "Гоптівка (КПП)", "country_code": "border", "lng": 36.4253, "lat": 50.3608 },
      { "slug": "border-shehyni", "name_ru": "Шегини (КПП)", "name_ua": "Шегині (КПП)", "country_code": "border", "lng": 22.9550, "lat": 49.7986 },
      { "slug": "border-krakovets", "name_ru": "Краковец (КПП)", "name_ua": "Краковець (КПП)", "country_code": "border", "lng": 23.1675, "lat": 49.9419 },
      { "slug": "border-yahodyn", "name_ru": "Ягодин (КПП)", "name_ua": "Ягодин (КПП)", "country_code": "border", "lng": 23.7544, "lat": 51.5436 },
      { "slug": "border-brest", "name_ru": "Брест (КПП)", "name_ua": "Брест (КПП)", "country_code": "border", "lng": 23.7227, "lat": 52.0976 }
    ]
    ```

    Count: 12 RU + 12 UA + 5 border = 29. Close to "~30". If you want exactly 30, add `kursk` (RU, 36.1873, 51.7373).

    **`apps/api/src/seed/data/trucks.json`** — 12 trucks per D-19 (tent×5, ref×3, iso×2, container×2). Realistic positions across Russia + Ukraine border region:

    ```json
    [
      { "name": "Volvo FH 540 #1", "plate_number": "А123ВС777", "driver_name": "Иван Петров", "driver_phone": "+79001234501", "capacity_t": 20, "body_type": "tent", "lng": 37.6173, "lat": 55.7558 },
      { "name": "Scania R 500 #2", "plate_number": "А234ВС777", "driver_name": "Алексей Смирнов", "driver_phone": "+79001234502", "capacity_t": 22, "body_type": "tent", "lng": 39.1843, "lat": 51.6720 },
      { "name": "MAN TGX 540 #3", "plate_number": "А345ВС777", "driver_name": "Сергей Кузнецов", "driver_phone": "+79001234503", "capacity_t": 18, "body_type": "tent", "lng": 39.7015, "lat": 47.2357 },
      { "name": "DAF XF 480 #4", "plate_number": "АА1234АА", "driver_name": "Олег Бондаренко", "driver_phone": "+380501234504", "capacity_t": 20, "body_type": "tent", "lng": 30.5234, "lat": 50.4501 },
      { "name": "Mercedes Actros #5", "plate_number": "АА2345АА", "driver_name": "Микола Іванов", "driver_phone": "+380501234505", "capacity_t": 18, "body_type": "tent", "lng": 24.0297, "lat": 49.8397 },

      { "name": "Volvo FH 460 Ref #6", "plate_number": "А456ВС777", "driver_name": "Дмитрий Соколов", "driver_phone": "+79001234506", "capacity_t": 10, "body_type": "ref", "lng": 30.3158, "lat": 59.9391 },
      { "name": "Renault Premium Ref #7", "plate_number": "АА3456АА", "driver_name": "Андрій Шевченко", "driver_phone": "+380501234507", "capacity_t": 10, "body_type": "ref", "lng": 30.7233, "lat": 46.4825 },
      { "name": "Iveco Stralis Ref #8", "plate_number": "А567ВС777", "driver_name": "Павел Морозов", "driver_phone": "+79001234508", "capacity_t": 5, "body_type": "ref", "lng": 38.9753, "lat": 45.0355 },

      { "name": "Mercedes Atego ISO #9", "plate_number": "А678ВС777", "driver_name": "Виктор Лебедев", "driver_phone": "+79001234509", "capacity_t": 5, "body_type": "iso", "lng": 49.1064, "lat": 55.7963 },
      { "name": "Volvo FL ISO #10", "plate_number": "АА4567АА", "driver_name": "Тарас Коваль", "driver_phone": "+380501234510", "capacity_t": 10, "body_type": "iso", "lng": 36.2304, "lat": 49.9935 },

      { "name": "MAN TGS Container #11", "plate_number": "А789ВС777", "driver_name": "Николай Орлов", "driver_phone": "+79001234511", "capacity_t": 22, "body_type": "container", "lng": 39.7233, "lat": 43.5855 },
      { "name": "DAF CF Container #12", "plate_number": "АА5678АА", "driver_name": "Богдан Мельник", "driver_phone": "+380501234512", "capacity_t": 20, "body_type": "container", "lng": 35.0462, "lat": 48.4647 }
    ]
    ```

    Counts verify: tent×5 (#1-#5), ref×3 (#6-#8), iso×2 (#9-#10), container×2 (#11-#12). Total = 12.

    **`apps/api/src/seed/data/clients.json`** — 8 clients (4 RU + 4 UA), 2 have telegram_id (for Phase 3):

    ```json
    [
      { "name": "ООО Логистика-Москва", "phone": "+74951234567", "telegram_id": "100001", "lang": "ru", "tax_id": "7700000001", "tax_id_country": "RU" },
      { "name": "Грузоперевозки Северная Столица", "phone": "+78121234567", "telegram_id": null, "lang": "ru", "tax_id": "7800000002", "tax_id_country": "RU" },
      { "name": "Южный Транзит", "phone": "+78631234567", "telegram_id": null, "lang": "ru", "tax_id": "6100000003", "tax_id_country": "RU" },
      { "name": "Уральская Логистика", "phone": "+73431234567", "telegram_id": null, "lang": "ru", "tax_id": "6600000004", "tax_id_country": "RU" },

      { "name": "ТОВ Київ-Транс", "phone": "+380441234567", "telegram_id": "200001", "lang": "ua", "tax_id": "37000005", "tax_id_country": "UA" },
      { "name": "Львівська Логістика", "phone": "+380321234567", "telegram_id": null, "lang": "ua", "tax_id": "37000006", "tax_id_country": "UA" },
      { "name": "ТОВ Одеса-Карго", "phone": "+380481234567", "telegram_id": null, "lang": "ua", "tax_id": "37000007", "tax_id_country": "UA" },
      { "name": "Харків-Логістика", "phone": "+380571234567", "telegram_id": null, "lang": "ua", "tax_id": "37000008", "tax_id_country": "UA" }
    ]
    ```

    **`apps/api/src/seed/data/pricing.json`** — D-19 exact values (kopecks for rate_per_km):

    ```json
    {
      "rate_per_km": 4200,
      "dir_coef": { "default": 1.0, "back_haul": 0.85 },
      "season_coef": 1.1
    }
    ```

    Note: `rate_per_km: 4200` = 42 ₽/км per D-19. JSON numbers are fine since `pricingConfig.value` is `jsonb`.

    Verify TS still passes (these are JSON, no code change): `pnpm exec tsc --noEmit -p apps/api/tsconfig.json`.

    Verify Biome formatter is happy with JSON (Biome formats JSON too): `pnpm exec biome check apps/api/src/seed/data`.
  </action>
  <verify>
    <automated>for f in cities trucks clients pricing; do test -f "apps/api/src/seed/data/$f.json" || { echo MISSING:$f; exit 1; }; done && node -e "const c=require('./apps/api/src/seed/data/cities.json'); if (c.length < 25) {console.error('cities count:', c.length); process.exit(1)} console.log('cities:', c.length)" && node -e "const t=require('./apps/api/src/seed/data/trucks.json'); if (t.length !== 12) {console.error('trucks count:', t.length); process.exit(1)} const tent=t.filter(x=>x.body_type==='tent').length; const ref=t.filter(x=>x.body_type==='ref').length; if (tent!==5||ref!==3) {console.error('body counts wrong'); process.exit(1)} console.log('trucks ok')" && node -e "const cl=require('./apps/api/src/seed/data/clients.json'); if (cl.length!==8) {console.error('clients count:', cl.length); process.exit(1)} const ru=cl.filter(x=>x.lang==='ru').length; const ua=cl.filter(x=>x.lang==='ua').length; if (ru!==4||ua!==4) {console.error('lang split wrong'); process.exit(1)} console.log('clients ok')" && node -e "const p=require('./apps/api/src/seed/data/pricing.json'); if (p.rate_per_km!==4200) {console.error('rate_per_km wrong:', p.rate_per_km); process.exit(1)} console.log('pricing ok')" && grep -q "kyiv" apps/api/src/seed/data/cities.json && grep -q "border-hoptivka\\|border-shehyni\\|border-krakovets\\|border-yahodyn\\|border-brest" apps/api/src/seed/data/cities.json && pnpm exec biome check apps/api/src/seed/data 2>&1 | tail -3 && echo OK</automated>
  </verify>
  <done>
    4 JSON fixtures exist with correct counts (~30 cities incl. 5+ borders, 12 trucks with tent×5/ref×3/iso×2/container×2, 8 clients with 4 RU + 4 UA, pricing with rate_per_km=4200 kopecks).
  </done>
  <acceptance_criteria>
    - All 4 JSON files exist
    - `cities.json` array length is at least 25 (target ~30)
    - `trucks.json` array length is exactly 12 with body_type counts: tent=5, ref=3, iso=2, container=2
    - `clients.json` length exactly 8 with lang=ru count of 4 and lang=ua count of 4
    - `pricing.json` has `rate_per_km: 4200` (kopecks, NOT decimal)
    - `cities.json` includes slug `kyiv` AND at least 5 entries with country_code `border`
    - `pnpm exec biome check apps/api/src/seed/data` exits 0
  </acceptance_criteria>
</task>

<task type="auto" tdd="false">
  <name>Task 2: seed/run.ts + seed/smoke.ts + integration test + flip DB-10 stub + package.json script</name>
  <read_first>
    - apps/api/src/seed/data/*.json (Task 1 above)
    - apps/api/src/db.ts (Wave 3a — createPool, createDb)
    - apps/api/src/persistence/schema/index.ts (Wave 3d — all 13 tables)
    - .planning/phases/01-database-backend-skeleton/01-RESEARCH.md — sections "Canonical KNN smoke query (printed at end of seed)", "Idempotent seed with .onConflictDoNothing()"
    - .planning/phases/01-database-backend-skeleton/01-CONTEXT.md — D-18, D-20, D-21
  </read_first>
  <files>
    - apps/api/src/seed/run.ts
    - apps/api/src/seed/smoke.ts
    - apps/api/tests/integration/seed.test.ts
    - apps/api/tests/unit/phase-1-stubs.test.ts
    - apps/api/package.json
  </files>
  <action>
    Three TS files + test + script update.

    **`apps/api/src/seed/smoke.ts`** (per RESEARCH.md §"Canonical KNN smoke query" — copy VERBATIM with proper imports):

    ```typescript
    import { sql } from 'drizzle-orm';
    import type { Db } from '../db.js';

    /**
     * Canonical KNN smoke query — closes success criterion #3 of Phase 1.
     *
     * Phase 2 will implement the proper CTE re-rank pattern (PITFALLS.md #2):
     *   1. Overfetch 20 by `<->` (GiST-accelerated sphere distance)
     *   2. Filter by capacity_t and body_type INSIDE the CTE
     *   3. Re-rank by ST_Distance(geog, geog, true) (spheroid, meters)
     *
     * For Phase 1 we use the same pattern with a fixed point (Kyiv) and no filters,
     * which is enough to verify (a) GiST index is used, (b) <-> works on geography,
     * (c) ST_Distance returns meters.
     */
    export async function printNearestTrucksSmoke(db: Db): Promise<void> {
      // Kyiv center: 30.5234 E, 50.4501 N
      const lng = 30.5234;
      const lat = 50.4501;
      const pickup = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

      const result = await db.execute<{
        name: string;
        plate_number: string;
        capacity_t: number;
        body_type: string;
        meters: number;
      }>(sql`
        WITH knn AS (
          SELECT t.id
          FROM trucks t
          WHERE t.status = 'available'
          ORDER BY t.geom <-> ${pickup}
          LIMIT 20
        )
        SELECT
          t.name,
          t.plate_number,
          t.capacity_t,
          t.body_type::text AS body_type,
          ST_Distance(t.geom, ${pickup}, true)::int AS meters
        FROM knn JOIN trucks t USING (id)
        ORDER BY meters
        LIMIT 3
      `);

      console.log('\n📦 Canonical KNN smoke (pickup = Kyiv center)');
      console.log('─'.repeat(60));
      for (const row of result.rows) {
        const km = (Number(row.meters) / 1000).toFixed(1);
        console.log(
          `  ${row.name.padEnd(22)} ${row.plate_number.padEnd(12)} ${row.capacity_t}т ${row.body_type.padEnd(10)} ${km} км`
        );
      }
      console.log('─'.repeat(60));
      console.log('If you see 3 trucks above with ascending km values, PostGIS is wired correctly.\n');
    }
    ```

    **`apps/api/src/seed/run.ts`** (per RESEARCH.md §"Idempotent seed" — adapted to our schema barrel and use `with { type: 'json' }` for ESM JSON imports):

    ```typescript
    import { sql } from 'drizzle-orm';
    import { createDb, createPool } from '../db.js';
    import * as schema from '../persistence/schema/index.js';
    import citiesData from './data/cities.json' with { type: 'json' };
    import trucksData from './data/trucks.json' with { type: 'json' };
    import clientsData from './data/clients.json' with { type: 'json' };
    import pricingData from './data/pricing.json' with { type: 'json' };
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
        console.log('🌱 Seeding cities…');
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

        console.log('🚛 Seeding trucks…');
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

        console.log('👤 Seeding clients…');
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

        console.log('💰 Seeding pricing config…');
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

        console.log('✅ Seed complete');
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
    ```

    Update `apps/api/package.json` to add the seed script (Edit, do not overwrite):

    ```json
    "seed": "tsx --env-file=../../.env.local src/seed/run.ts"
    ```

    Step: Run the seed against the live Docker Postgres:

    ```bash
    docker compose up -d postgres redis
    pnpm db:migrate
    pnpm seed
    ```

    Expected stdout:
    - "🌱 Seeding cities…"
    - "🚛 Seeding trucks…"
    - "👤 Seeding clients…"
    - "💰 Seeding pricing config…"
    - "📦 Canonical KNN smoke (pickup = Kyiv center)"
    - 3 lines with truck name, plate, capacity, body type, and km distance — ASCENDING by km
    - "✅ Seed complete"

    Verify idempotency:
    ```bash
    pnpm seed
    pnpm seed
    ```
    Both calls succeed. Verify row counts didn't double:
    ```bash
    docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM trucks"
    # Should be 12

    docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM cities"
    # Should be at least 25 (whatever cities.json contains)

    docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM clients"
    # Should be 8

    docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM pricing_config"
    # Should be 3
    ```

    **Integration test** — `apps/api/tests/integration/seed.test.ts`:

    ```typescript
    import { afterAll, beforeAll, describe, expect, test } from 'vitest';
    import { exec as execCb } from 'node:child_process';
    import { promisify } from 'node:util';
    import path from 'node:path';
    import pg from 'pg';
    import {
      startPostgisContainer,
      stopPostgisContainer,
    } from '../_helpers/test-db.js';

    const exec = promisify(execCb);
    const { Pool } = pg;

    describe('Seed (integration)', () => {
      let dbUrl: string;
      let pool: pg.Pool;

      beforeAll(async () => {
        dbUrl = await startPostgisContainer();
        process.env.DATABASE_URL = dbUrl;

        const cwd = path.resolve(import.meta.dirname, '..', '..');

        await exec(`node --import tsx ./node_modules/.bin/drizzle-kit migrate`, {
          cwd,
          env: { ...process.env, DATABASE_URL: dbUrl },
        });

        // Run seed twice — verify idempotency
        await exec(`node --import tsx src/seed/run.ts`, {
          cwd,
          env: { ...process.env, DATABASE_URL: dbUrl, REDIS_URL: 'redis://localhost:6379' },
        });
        await exec(`node --import tsx src/seed/run.ts`, {
          cwd,
          env: { ...process.env, DATABASE_URL: dbUrl, REDIS_URL: 'redis://localhost:6379' },
        });

        pool = new Pool({ connectionString: dbUrl });
      }, 180_000);

      afterAll(async () => {
        if (pool) await pool.end();
        await stopPostgisContainer();
      });

      test('seed is idempotent — running twice produces stable row counts', async () => {
        const trucks = await pool.query<{ count: string }>("SELECT count(*) FROM trucks");
        expect(Number(trucks.rows[0]?.count)).toBe(12);

        const clients = await pool.query<{ count: string }>("SELECT count(*) FROM clients");
        expect(Number(clients.rows[0]?.count)).toBe(8);

        const cities = await pool.query<{ count: string }>("SELECT count(*) FROM cities");
        expect(Number(cities.rows[0]?.count)).toBeGreaterThanOrEqual(25);

        const pricing = await pool.query<{ count: string }>("SELECT count(*) FROM pricing_config");
        expect(Number(pricing.rows[0]?.count)).toBe(3);
      });

      test('seed populates 4 RU + 4 UA clients', async () => {
        const ruCount = await pool.query<{ count: string }>("SELECT count(*) FROM clients WHERE lang='ru'");
        const uaCount = await pool.query<{ count: string }>("SELECT count(*) FROM clients WHERE lang='ua'");
        expect(Number(ruCount.rows[0]?.count)).toBe(4);
        expect(Number(uaCount.rows[0]?.count)).toBe(4);
      });

      test('seed populates the expected body_type mix (tent×5, ref×3, iso×2, container×2)', async () => {
        const r = await pool.query<{ body_type: string; count: string }>(
          "SELECT body_type::text AS body_type, count(*) AS count FROM trucks GROUP BY body_type"
        );
        const counts: Record<string, number> = {};
        for (const row of r.rows) counts[row.body_type] = Number(row.count);
        expect(counts.tent).toBe(5);
        expect(counts.ref).toBe(3);
        expect(counts.iso).toBe(2);
        expect(counts.container).toBe(2);
      });

      test('canonical KNN from Kyiv returns 3 trucks with ascending meters', async () => {
        const r = await pool.query<{ name: string; meters: number }>(`
          WITH knn AS (
            SELECT t.id FROM trucks t
            WHERE t.status='available'
            ORDER BY t.geom <-> ST_SetSRID(ST_MakePoint(30.5234, 50.4501), 4326)::geography
            LIMIT 20
          )
          SELECT t.name, ST_Distance(t.geom, ST_SetSRID(ST_MakePoint(30.5234, 50.4501), 4326)::geography, true)::int AS meters
          FROM knn JOIN trucks t USING (id)
          ORDER BY meters
          LIMIT 3
        `);
        expect(r.rows).toHaveLength(3);
        const m = r.rows.map((row) => Number(row.meters));
        expect(m[0]).toBeLessThanOrEqual(m[1] ?? Number.MAX_SAFE_INTEGER);
        expect(m[1]).toBeLessThanOrEqual(m[2] ?? Number.MAX_SAFE_INTEGER);
      });

      test('cities have a border-* slug for ≥5 crossings', async () => {
        const r = await pool.query<{ count: string }>(
          "SELECT count(*) FROM cities WHERE slug LIKE 'border-%'"
        );
        expect(Number(r.rows[0]?.count)).toBeGreaterThanOrEqual(5);
      });
    });
    ```

    Flip DB-10 stub in `apps/api/tests/unit/phase-1-stubs.test.ts` — since the heavy verification is in integration test, the unit-level check asserts the seed fixtures exist and have correct counts:

    ```typescript
      test('DB-10: seed fixtures shape — 12 trucks, ~30 cities, 8 clients, rate_per_km=4200', async () => {
        const cities = (await import('../../src/seed/data/cities.json', { with: { type: 'json' } }))
          .default as Array<{ slug: string; country_code: string }>;
        const trucks = (await import('../../src/seed/data/trucks.json', { with: { type: 'json' } }))
          .default as Array<{ body_type: string }>;
        const clients = (await import('../../src/seed/data/clients.json', { with: { type: 'json' } }))
          .default as Array<{ lang: string }>;
        const pricing = (await import('../../src/seed/data/pricing.json', { with: { type: 'json' } }))
          .default as { rate_per_km: number };

        expect(cities.length).toBeGreaterThanOrEqual(25);
        expect(cities.filter((c) => c.country_code === 'border').length).toBeGreaterThanOrEqual(5);
        expect(trucks).toHaveLength(12);
        expect(trucks.filter((t) => t.body_type === 'tent')).toHaveLength(5);
        expect(trucks.filter((t) => t.body_type === 'ref')).toHaveLength(3);
        expect(clients).toHaveLength(8);
        expect(clients.filter((c) => c.lang === 'ru')).toHaveLength(4);
        expect(clients.filter((c) => c.lang === 'ua')).toHaveLength(4);
        expect(pricing.rate_per_km).toBe(4200);
      });
    ```

    Unit suite count after this task: previous 12 passing + 1 (DB-10) = 13. Todos remaining: 4 (DEPLOY-01..04).
  </action>
  <verify>
    <automated>test -f apps/api/src/seed/run.ts && test -f apps/api/src/seed/smoke.ts && test -f apps/api/tests/integration/seed.test.ts && grep -q "onConflictDoNothing" apps/api/src/seed/run.ts && grep -q "ORDER BY t.geom <->" apps/api/src/seed/smoke.ts && grep -q "\"seed\":" apps/api/package.json && pnpm exec tsc --noEmit -p apps/api/tsconfig.json 2>&1 | tail -3 && pnpm exec biome check apps/api/src/seed 2>&1 | tail -3 && docker compose up -d postgres redis 2>&1 | tail -3 && pnpm db:migrate 2>&1 | tail -3 && pnpm seed 2>&1 | tee /tmp/seed1.out | grep -q "Canonical KNN" && pnpm seed 2>&1 | tee /tmp/seed2.out | tail -5 && docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM trucks" | tr -d ' ' | xargs -I {} test {} -eq 12 && docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM clients" | tr -d ' ' | xargs -I {} test {} -eq 8 && docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM pricing_config" | tr -d ' ' | xargs -I {} test {} -eq 3 && cd apps/api && pnpm exec vitest run --project unit 2>&1 | tail -5 && pnpm exec vitest run --project unit 2>&1 | grep -q "13 passed" && echo OK</automated>
  </verify>
  <done>
    `pnpm seed` ingests fixtures, prints KNN smoke from Kyiv, completes idempotently; trucks=12, clients=8, pricing_config=3; KNN integration test passes; DB-10 stub flipped (13 passing / 4 todo).
  </done>
  <acceptance_criteria>
    - `test -f apps/api/src/seed/run.ts && test -f apps/api/src/seed/smoke.ts && test -f apps/api/tests/integration/seed.test.ts` returns 0
    - `grep -c "onConflictDoNothing" apps/api/src/seed/run.ts` is at least 3 (cities, trucks, clients)
    - `grep -q "ORDER BY t.geom <->" apps/api/src/seed/smoke.ts && grep -q "ST_Distance.*true" apps/api/src/seed/smoke.ts` returns 0
    - `grep -q "\"seed\":" apps/api/package.json` returns 0
    - `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` exits 0
    - `pnpm exec biome check apps/api/src/seed` exits 0
    - `pnpm seed` runs successfully, prints "Canonical KNN" block with 3 trucks and km values
    - `pnpm seed` re-run produces no errors and same row counts
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM trucks"` returns 12 after seed (and after re-seed)
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM clients WHERE lang='ru'"` returns 4
    - `docker exec ailogist-postgres psql -U ailogist -d ailogist -tAc "SELECT count(*) FROM clients WHERE lang='ua'"` returns 4
    - Unit suite: 13 passing / 4 todo
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` passes
- `pnpm exec biome check apps/api/src/seed` passes
- `pnpm seed` succeeds and prints canonical KNN smoke from Kyiv
- `pnpm seed` is idempotent — running twice produces stable row counts (12 trucks, 8 clients, 25+ cities, 3 pricing_config rows)
- `cd apps/api && pnpm exec vitest run --project integration` runs seed integration test (passes if Docker is available)
- Unit suite: 13 passing / 4 todo
</verification>

<success_criteria>
1. Four JSON fixtures (cities, trucks, clients, pricing) have correct counts and shape per D-19.
2. `pnpm seed` loads fixtures via Drizzle insert + `.onConflictDoNothing()` per D-20 — idempotent.
3. Seed prints canonical KNN smoke output ("3 nearest trucks from Kyiv center") per D-21 — closes success criterion #3.
4. `rate_per_km` is bigint kopecks (4200, not 42.0) per D-05.
5. Cities include realistic RU/UA pairs (Київ↔Киев etc.) and 5+ border crossings.
6. DB-10 stub test flipped; total unit suite: 13 passing / 4 todo.
7. Integration test (seed.test.ts) verifies idempotency end-to-end against testcontainers PostGIS.
</success_criteria>

<output>
After completion, create `.planning/phases/01-database-backend-skeleton/01-09-SUMMARY.md` documenting:
- Final row counts (trucks=12, clients=8, cities=N, pricing_config=3)
- Canonical KNN smoke output (the 3 truck names + plates + km values for the first run)
- Confirmation that `pnpm seed && pnpm seed` is idempotent
- Unit suite: 13 passing / 4 todo
- Integration tests: 5 (4 from health/swagger plus 5 from seed = depends on what previous plans wrote)
</output>
