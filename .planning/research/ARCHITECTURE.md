# Architecture Research

**Domain:** AI-driven logistics dispatching (Telegram + voice intake → LLM extract → PostGIS match → deterministic price → order + GPS tracking → admin SSR + live WS)
**Researched:** 2026-06-08
**Confidence:** HIGH for module boundaries, FSM choice, PostGIS geo-fencing, Next.js SSR/WS boundary. MEDIUM for queueing and idempotency strategy at demo scale (defensible call, not exhaustively benchmarked).

This document confirms the spec's implicit architecture (§2 data, §3 pipeline, §6 API, §7.4 admin) and prescribes the smallest credible structure that lets each module evolve independently after the demo. **Do not gold-plate the demo:** every "later" note below is an explicit invitation to defer.

---

## Standard Architecture

### System Overview — Modular Monolith (Demo)

```
                       External world
   ┌─────────────┬───────────────┬───────────────┬────────────────┐
   │  Telegram   │  Voice (SIP)  │   Driver app  │   Admin user   │
   │   client    │   ElevenLabs  │   / simulator │  (Next.js web) │
   └──────┬──────┴───────┬───────┴───────┬───────┴────────┬───────┘
          │              │               │                │
          │ webhook      │ webhook       │ /webhook/gps   │ HTTPS + WS
          ▼              ▼               ▼                ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                  Backend monolith (Node.js / TS, Fastify)        │
   │                                                                 │
   │  ┌──────────┐  ┌──────────────────────────┐  ┌───────────────┐ │
   │  │ Channels │  │       Pipeline (§3)       │  │  Admin API    │ │
   │  │          │  │                          │  │  (REST + WS)  │ │
   │  │ telegram │→ │  intake → matching →     │← │               │ │
   │  │ voice    │  │  pricing → lifecycle     │  │ /api/leads    │ │
   │  │ gps      │  │  → notification          │  │ /api/orders   │ │
   │  └──────────┘  └────┬───────────┬─────────┘  │ /api/trucks   │ │
   │        │            │           │            │ /ws/inbox     │ │
   │        │      ┌─────▼─────┐ ┌───▼────────┐   │ /ws/tracking  │ │
   │        │      │ LLM tools │ │  Tracking  │   └───┬───────────┘ │
   │        │      │ adapter   │ │   loop     │       │             │
   │        │      │ (OpenAI / │ │  (geofence)│       │             │
   │        │      │  Claude)  │ │            │       │             │
   │        │      └───────────┘ └─────┬──────┘       │             │
   │        │                          │              │             │
   │        └───────── WS Hub ─────────┴──────────────┘             │
   │                       │                                        │
   │                       ▼                                        │
   │            ┌────────────────────────┐                          │
   │            │   Persistence layer    │                          │
   │            │   (repositories)       │                          │
   │            └────────────┬───────────┘                          │
   └─────────────────────────┼──────────────────────────────────────┘
                             ▼
            ┌────────────────────────────────┐
            │  PostgreSQL 15 + PostGIS       │
            │  (single primary, no replica)  │
            └────────────────────────────────┘

            ┌────────────────────────────────┐
            │  Redis (optional for demo)     │
            │  — bourse_cache, FSM scratch    │
            └────────────────────────────────┘
```

**Key principles enforced by the architecture:**
1. **Deterministic code owns money and matching.** LLM is a side-effect-free language-to-JSON adapter; it cannot mutate price or assign trucks except by calling typed tools.
2. **Channels are dumb adapters.** Telegram and voice translate to/from a single internal `ChannelMessage` type. The pipeline never knows which channel triggered it after intake.
3. **Tracking loop is the only producer of live truck movement.** Everything reading positions (admin map, order events, notifications) consumes from the WS Hub or DB — never polls the GPS source directly.

### Component Responsibilities (modules inside the monolith)

| Component | Owns | Talks to | Public surface |
|-----------|------|----------|----------------|
| `channels/telegram` | Telegram webhook parsing, outbound message formatting, inline keyboards | Pipeline (in), Notification (out) | `POST /webhook/telegram` |
| `channels/voice` (stub for demo) | ElevenLabs webhook parsing, tool-result formatting for voice | Pipeline, LLM tools | `POST /webhook/voice` |
| `channels/gps` | GPS push/poll ingestion, position normalization | Tracking | `POST /webhook/gps` |
| `pipeline/intake` | Language detection, client upsert, message logging, hand-off to LLM | LLM tools, `clients`, `messages` repos | internal `handleInbound(channelMsg)` |
| `pipeline/llm-tools` | Tool registry, schema validation, dialog state per client | OpenAI/Claude SDK, all business modules below | internal `runTool(name, args)` |
| `matching` | PostGIS KNN query, capacity/body filter, routing for top-N candidates, bourse fallback (stub) | `trucks` repo, Routing API, bourse adapter | `nearestTruck(req) → Match[]` |
| `pricing` | Deterministic price formula, coefficient lookup, negotiation corridor | Routing API, config table | `calcPrice(route, params) → Quote` |
| `lifecycle/lead-fsm` | Lead funnel transitions §4.4, follow-up timers | `leads` repo, Notification | `transition(leadId, event)` |
| `lifecycle/order-fsm` | Order lifecycle transitions §4.5, event log writes | `orders`, `order_events` repos, Notification | `transition(orderId, event)` |
| `tracking` | Position upserts, per-order geofence checks, ETA recompute, WS publish | `trucks` repo, `orders` repo, Routing API, WS Hub | `ingestPosition(truckId, geom)` |
| `notification` | Outbound message routing (Telegram now, SMS/email later) | Channels (Telegram), template store | `notify(clientId, kind, payload)` |
| `admin-api` (REST) | Resource endpoints §6 for the web admin | All read repos, FSM modules for mutations | HTTP routes under `/api/*` |
| `admin-api` (WS Hub) | `/ws/tracking` and `/ws/inbox` fan-out, auth, filtered subscriptions | Tracking, Pipeline, Notification | WS endpoints |
| `admin-web` | Next.js 16 App Router admin (Zenith template fork) | `admin-api` REST + WS | browser |
| `persistence` | Repository functions over `pg` driver, transactions, query helpers | Postgres + PostGIS | typed function exports |

**Boundary rule the codebase enforces:** modules cross-talk only through their public function exports (no reaching into another module's internal files). This is the unit of "could become a microservice later" without choosing microservices now.

---

## Recommended Project Structure

```
ai-logist/
├── apps/
│   ├── api/                              # Fastify backend (the monolith)
│   │   ├── src/
│   │   │   ├── server.ts                 # bootstrap, plugin registration
│   │   │   ├── config.ts                 # env validation (zod)
│   │   │   ├── routes/
│   │   │   │   ├── webhook.telegram.ts
│   │   │   │   ├── webhook.voice.ts
│   │   │   │   ├── webhook.gps.ts
│   │   │   │   ├── api.leads.ts
│   │   │   │   ├── api.orders.ts
│   │   │   │   ├── api.trucks.ts
│   │   │   │   ├── api.clients.ts
│   │   │   │   ├── api.analytics.ts
│   │   │   │   └── ws.ts                 # /ws/tracking + /ws/inbox
│   │   │   ├── modules/                  # business modules — internal boundaries
│   │   │   │   ├── channels/
│   │   │   │   │   ├── telegram/         # grammY adapter, formatters
│   │   │   │   │   ├── voice/            # stub for demo
│   │   │   │   │   └── gps/
│   │   │   │   ├── pipeline/
│   │   │   │   │   ├── intake.ts
│   │   │   │   │   ├── language-detect.ts
│   │   │   │   │   └── llm-tools/
│   │   │   │   │       ├── registry.ts   # tool definitions, JSON schemas
│   │   │   │   │       ├── extract.ts    # extractRequest tool body
│   │   │   │   │       └── client.ts     # OpenAI/Anthropic adapter (strict mode)
│   │   │   │   ├── matching/
│   │   │   │   │   ├── nearest-truck.ts  # PostGIS KNN
│   │   │   │   │   └── bourse.ts         # stub returning [] for demo
│   │   │   │   ├── pricing/
│   │   │   │   │   └── calc-price.ts
│   │   │   │   ├── lifecycle/
│   │   │   │   │   ├── lead-fsm.ts       # hand-rolled FSM, see §FSM below
│   │   │   │   │   └── order-fsm.ts
│   │   │   │   ├── tracking/
│   │   │   │   │   ├── loop.ts           # geofence check, event emission
│   │   │   │   │   └── geofence.ts       # ST_DWithin helpers
│   │   │   │   └── notification/
│   │   │   │       └── send.ts           # dispatcher → channels/*
│   │   │   ├── persistence/
│   │   │   │   ├── db.ts                 # pg pool
│   │   │   │   ├── migrations/           # node-pg-migrate / drizzle-kit
│   │   │   │   └── repos/
│   │   │   │       ├── clients.ts
│   │   │   │       ├── leads.ts
│   │   │   │       ├── orders.ts
│   │   │   │       ├── trucks.ts
│   │   │   │       ├── cities.ts
│   │   │   │       └── events.ts
│   │   │   ├── ws/
│   │   │   │   └── hub.ts                # subscribe(filter), publish(topic, msg)
│   │   │   └── lib/
│   │   │       ├── routing.ts            # Mapbox/HERE/OSRM adapter
│   │   │       ├── geocoding.ts          # city normalization + cache
│   │   │       └── i18n.ts               # ru/ua phrase dict (server-side)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                              # Forked next-shadcn-admin-dashboard
│       └── src/                          # per template convention §7.3
│           ├── app/
│           │   └── (main)/dashboard/
│           │       ├── chat/             # existing — wire to /api + /ws/inbox
│           │       ├── kanban/           # existing — wire to /api/leads
│           │       ├── default/          # existing — wire to /api/analytics/kpi
│           │       ├── analytics/        # existing
│           │       ├── calendar/         # existing
│           │       ├── fleet/            # NEW — page.tsx (SSR) + _components/fleet-app.tsx
│           │       ├── orders/           # NEW — page.tsx + [id]/page.tsx + _components/
│           │       └── tracking/         # NEW — page.tsx + _components/tracking-app.tsx (WS)
│           ├── data/
│           │   ├── fleet.ts              # types + fetcher → /api/trucks
│           │   ├── orders.ts
│           │   └── tracking.ts
│           ├── lib/
│           │   ├── api-client.ts         # typed fetch wrapper
│           │   └── ws-client.ts          # reconnecting WS hook
│           └── navigation/sidebar/sidebar-items.ts  # add fleet, orders, tracking
│
├── packages/
│   └── shared-types/                     # request/response DTOs, FSM state enums
│       └── src/
│           ├── leads.ts
│           ├── orders.ts
│           └── ws-messages.ts            # discriminated unions for /ws topics
│
├── docker-compose.yml                    # api + web + postgres+postgis + redis + caddy
├── Caddyfile                             # HTTPS termination + reverse proxy
└── .env.example
```

### Structure Rationale

- **`apps/` vs `packages/`:** a pnpm/npm workspace with one published package (`shared-types`) shared between API and web means the admin gets compile-time guarantees about REST payloads and WS message shapes — the fastest defense against silent contract drift.
- **`apps/api/src/modules/*` as the unit of boundary:** each module exports a small public surface (function signatures in `index.ts`). Routes in `apps/api/src/routes/*` are thin — they validate input, call one module function, format the response. This is the "could become a microservice later" line.
- **`pipeline/llm-tools` lives next to the LLM adapter, not inside matching/pricing.** The tool registry is what the LLM sees; the implementations delegate to the business modules. This keeps the "LLM never reaches into business logic directly" rule structural, not just conventional.
- **`persistence/repos/*.ts` instead of an ORM:** for a demo with rich PostGIS queries, `pg` + hand-written SQL is faster to ship and easier to debug than fighting an ORM for `<->` and `ST_DWithin`. Drizzle is a reasonable upgrade later if migrations get painful.
- **Admin web mirrors template conventions §7.3 exactly.** Reviewers of the template's `CLAUDE.md` should find no surprises: `page.tsx` server, one client container `_components/<feature>-app.tsx`, types from `data/<feature>.ts`.

---

## Architectural Patterns

### Pattern 1: Channel Adapter → Internal `ChannelMessage`

**What:** Telegram, voice, and (future) any new channel normalize their input into one type before reaching the pipeline. Outbound replies do the inverse.

**When to use:** Anytime two channels share business logic (here: the entire intake → match → quote loop is identical for text and voice per §5.2).

**Trade-offs:** Slight overhead translating to/from `ChannelMessage` vs. wiring each channel straight to handlers. Pays for itself the first time someone changes pipeline behavior.

**Example:**
```typescript
// modules/channels/types.ts
export type ChannelMessage = {
  channel: 'telegram' | 'voice';
  externalId: string;        // tg user_id or call sid
  clientHint: { phone?: string; tgId?: string; name?: string };
  text: string;              // for voice: transcript
  receivedAt: Date;
  replyTo: (text: string, opts?: { buttons?: InlineButton[] }) => Promise<void>;
};

// modules/pipeline/intake.ts
export async function handleInbound(msg: ChannelMessage) {
  const client = await upsertClient(msg);
  const lang = await detectLanguage(msg.text);
  await logMessage({ clientId: client.id, role: 'client', text: msg.text });
  return runDialogTurn({ client, lang, text: msg.text, reply: msg.replyTo });
}
```

### Pattern 2: LLM Tool Calling with Strict JSON Schema + Validation Sandwich

**What:** The LLM only mutates the world through registered tools. Each tool has a JSON Schema (strict mode), the result is validated again with zod on the server, and only then does the business module run.

**When to use:** Always, for this product. Per the core value statement: deterministic code owns money and matching.

**Trade-offs:** Two layers of validation (strict mode + zod) feels redundant but catches three classes of bug: (a) provider drift, (b) optional/null field mismatches that strict mode permits, (c) semantic constraints (`tons > 0`, `from_city != to_city`) that JSON Schema can't express. Per OpenAI's [structured outputs guide](https://platform.openai.com/docs/guides/function-calling), strict mode is the production default in 2026.

**Example:**
```typescript
// modules/pipeline/llm-tools/registry.ts
import { z } from 'zod';

const ExtractRequestSchema = z.object({
  from_city: z.string().nullable(),
  to_city: z.string().nullable(),
  tons: z.number().positive().nullable(),
  body_type: z.enum(['tent','ref','iso']).nullable(),
  budget: z.number().positive().nullable(),
  deadline: z.string().datetime().nullable(),
});

export const tools = {
  extractRequest: {
    schema: {                              // sent to LLM (strict mode)
      name: 'extractRequest',
      strict: true,
      parameters: zodToJsonSchema(ExtractRequestSchema, { strictRequired: true }),
    },
    handler: async (raw: unknown, ctx: ToolContext) => {
      const args = ExtractRequestSchema.parse(raw);   // second-pass validation
      // pure transformation — no side effects, no DB writes
      return args;
    },
  },
  nearestTruck: {
    schema: { name: 'nearestTruck', strict: true, parameters: /* ... */ },
    handler: async (raw, ctx) => {
      const args = NearestTruckSchema.parse(raw);
      return matching.nearestTruck(args);             // delegates to module
    },
  },
  calcPrice:   { /* … */ },
  createOrder: { /* … */ },   // this one transitions the FSM
};
```

**Hard rules enforced by the registry:**
- Every tool result is JSON-serializable (no Date/Map/Set in returns — strings for dates).
- Tool handlers are pure or delegate to one module function (never compose business logic inline).
- `createOrder` is the only tool that writes funnel-advancing state; the LLM cannot "skip" stages.

### Pattern 3: Hand-Rolled FSM with Transition Log (Demo) — XState Upgrade Path (Prod)

**What:** Lead funnel §4.4 and order lifecycle §4.5 are implemented as a transition table + a transition function that writes to a log table. No library for demo.

**When to use:** Demo. The funnel has 8 states with mostly linear edges; XState's statechart features (nested, parallel, history) are unused. The [XState author himself](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) recommends starting without a library.

**Trade-offs:**
- *Pro:* Zero dependencies, transitions visible in 30 lines of code, easy to inspect with a SQL query against the log.
- *Con:* No visual editor, no exhaustive-test generator, no replay. If post-demo we add nested states (e.g., `IN_TRANSIT` decomposing into `BORDER_CROSSING`/`CUSTOMS_HOLD`/`MOVING`), migrate to [XState](https://stately.ai/docs/xstate). The transition table maps 1:1 to an XState config — migration is mechanical.

**Example:**
```typescript
// modules/lifecycle/lead-fsm.ts
export const LeadStage = {
  NEW: 'NEW', QUALIFIED: 'QUALIFIED', MATCHED: 'MATCHED',
  QUOTED: 'QUOTED', AGREED: 'AGREED', ORDER_CREATED: 'ORDER_CREATED',
  IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE', LOST: 'LOST',
} as const;
export type LeadStage = typeof LeadStage[keyof typeof LeadStage];

type Event =
  | { kind: 'qualified' }
  | { kind: 'matched'; truckId: string }
  | { kind: 'quoted'; price: number }
  | { kind: 'agreed' }
  | { kind: 'ordered'; orderId: string }
  | { kind: 'lost'; reason: string }
  | { kind: 'manual'; to: LeadStage; by: string };  // manager override from Kanban

const transitions: Record<LeadStage, Partial<Record<Event['kind'], LeadStage>>> = {
  NEW:           { qualified: 'QUALIFIED', lost: 'LOST', manual: '__check__' },
  QUALIFIED:     { matched: 'MATCHED', lost: 'LOST', manual: '__check__' },
  MATCHED:       { quoted: 'QUOTED', lost: 'LOST', manual: '__check__' },
  QUOTED:        { agreed: 'AGREED', lost: 'LOST', manual: '__check__' },
  AGREED:        { ordered: 'ORDER_CREATED', lost: 'LOST', manual: '__check__' },
  ORDER_CREATED: { manual: '__check__' },           // order FSM takes over
  IN_PROGRESS:   { manual: '__check__' },
  DONE:          {},
  LOST:          {},
};

export async function transition(leadId: string, event: Event) {
  return db.transaction(async (tx) => {
    const lead = await leadsRepo.findForUpdate(tx, leadId);
    const next = event.kind === 'manual'
      ? validateManualTransition(lead.stage, event.to)
      : transitions[lead.stage]?.[event.kind];
    if (!next) throw new IllegalTransition(lead.stage, event);
    await leadsRepo.updateStage(tx, leadId, next);
    await eventsRepo.appendLeadEvent(tx, leadId, lead.stage, next, event);
    return next;
  });
}
```

**Why this shape:** The same `transition()` is called from Kanban drag-and-drop (manual event) and from automated pipeline progress. The transition log is the audit trail and the source for Kanban activity feeds — no extra design needed.

### Pattern 4: Single-Process WebSocket Hub with Topic Subscriptions

**What:** One in-memory `WsHub` instance with two methods: `subscribe(connId, topic, filter)` and `publish(topic, message)`. Modules (tracking, notification, pipeline) call `publish`; the WS route layer manages connection lifecycle.

**When to use:** Demo and single-instance prod. As soon as the API runs more than one replica, swap the hub's internal `Map<topic, Set<conn>>` for Redis Pub/Sub — the public surface doesn't change.

**Trade-offs:** Single point of failure (acceptable for demo). All connections live in one Node process — fine up to ~10k concurrent (Fastify's `@fastify/websocket` on a small VM). Multi-instance fan-out is a 50-line change later, not a redesign.

**Example:**
```typescript
// ws/hub.ts
type Topic = 'tracking' | 'inbox';
type Filter = (msg: unknown) => boolean;

class WsHub {
  private subs = new Map<Topic, Map<string, { ws: WebSocket; filter: Filter }>>();

  subscribe(topic: Topic, connId: string, ws: WebSocket, filter: Filter = () => true) {
    if (!this.subs.has(topic)) this.subs.set(topic, new Map());
    this.subs.get(topic)!.set(connId, { ws, filter });
    ws.on('close', () => this.subs.get(topic)?.delete(connId));
  }

  publish(topic: Topic, message: unknown) {
    const payload = JSON.stringify(message);
    this.subs.get(topic)?.forEach(({ ws, filter }) => {
      if (filter(message) && ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}
export const wsHub = new WsHub();

// modules/tracking/loop.ts
import { wsHub } from '../../ws/hub';
export function emitPosition(truckId: string, geom: Geom) {
  wsHub.publish('tracking', { type: 'position', truckId, geom, at: new Date().toISOString() });
}
```

**Why "filter" matters:** the tracking page may show all trucks, but an order detail page only wants positions for one order's truck. Subscribers carry a predicate so we don't broadcast every position to every tab.

### Pattern 5: Geofence Check via PostGIS `ST_DWithin` (not `ST_Within`)

**What:** Each city / loading point / border crossing has a `geom` point. The geofence is a radius (e.g., 1.5 km for cities, 500 m for loading points). The tracking loop asks PostGIS "did the truck just enter the geofence for this order's next expected event?"

**When to use:** Always — `ST_DWithin` is the standard for this. Per the [Crunchy Data geofencing post](https://www.crunchydata.com/blog/moving-objects-and-geofencing-with-postgres-postgis) and the [PostGIS docs](https://postgis.net/docs/ST_DWithin.html), `ST_DWithin` uses the GiST index and is the index-accelerated true/false test. `ST_Within` requires polygon geofences (more work to seed for demo) and offers no advantage here.

**Trade-offs:** Radius geofences are coarse (a truck driving past a city 1 km away triggers "at_loading" falsely). For demo this is fine — every geofence is the city you actually shipped to. For prod, switch high-traffic cities to polygon geofences and use `ST_Within` for those while keeping `ST_DWithin` for the rest.

**Example:**
```sql
-- modules/tracking/geofence.ts (the SQL)
-- Has this truck just entered the loading geofence for this order?
SELECT EXISTS (
  SELECT 1
  FROM cities c
  WHERE c.id = $1                               -- from_city_id of the order
    AND ST_DWithin(c.geom, $2::geography, $3)  -- truck.geom, radius_m
) AS in_zone;
```
```typescript
// modules/tracking/loop.ts
export async function checkGeofencesForOrder(order: Order, truckGeom: Geom) {
  const expected = nextExpectedEvent(order);              // 'at_loading' | 'at_border' | 'delivered'
  const target   = geofenceTargetFor(order, expected);    // city or border point + radius
  const inZone   = await trackingRepo.isInZone(target.cityId, truckGeom, target.radiusM);
  if (inZone && !alreadyEmitted(order, expected)) {
    await orderFsm.transition(order.id, { kind: expected });
  }
}
```

**Crucial debouncer:** a truck circling a loading point oscillates in/out of the zone. The `alreadyEmitted` check is per `(order_id, event_type)` — `order_events` already has uniqueness on those two columns, so a `ON CONFLICT DO NOTHING` insert is the idempotency story for free (see §Idempotency below).

### Pattern 6: Next.js SSR for First Paint, Client Container for Live Updates

**What:** Per template convention §7.3, `page.tsx` is a React Server Component that fetches initial data over REST. One client container `_components/<feature>-app.tsx` receives that data as a prop and subscribes to WS for live updates.

**When to use:** Every dashboard page. For static-ish pages (analytics with daily KPIs), skip the client container entirely.

**Trade-offs:** Two code paths for the same data (REST hydration + WS deltas) feels duplicative. The win is sub-100ms first paint with real data instead of a spinner-driven UI.

**Example:**
```typescript
// app/(main)/dashboard/tracking/page.tsx  — SERVER
import { TrackingApp } from './_components/tracking-app';
import { apiClient } from '@/lib/api-client';

export const metadata = { title: 'Live Tracking' };

export default async function Page() {
  const trucks = await apiClient.get('/api/trucks');            // SSR fetch
  const orders = await apiClient.get('/api/orders?status=IN_TRANSIT,AT_BORDER');
  return <TrackingApp initialTrucks={trucks} initialOrders={orders} />;
}

// app/(main)/dashboard/tracking/_components/tracking-app.tsx  — CLIENT
'use client';
import { useEffect, useState } from 'react';
import { useTrackingSocket } from '@/lib/ws-client';

export function TrackingApp({ initialTrucks, initialOrders }: Props) {
  const [trucks, setTrucks] = useState(initialTrucks);
  useTrackingSocket((msg) => {
    if (msg.type === 'position') {
      setTrucks((prev) => prev.map(t => t.id === msg.truckId ? { ...t, geom: msg.geom } : t));
    }
  });
  return <Map trucks={trucks} orders={initialOrders} />;
}
```

**WS in Next.js — the trap to avoid:** Per the [WebSocket.org Next.js guide](https://websocket.org/guides/frameworks/nextjs/), `new WebSocket()` **must** live inside `useEffect`. The client container is the only place that runs in the browser; SSR pre-render has no `WebSocket` global.

---

## Data Flow

### Flow A: Telegram Text Intake → Quoted Lead

```
Telegram user sends "Киев-Львов, 18 т, тент"
   │
   ▼
POST /webhook/telegram                       (grammY parses update)
   │
   ▼
channels/telegram → ChannelMessage           (normalize)
   │
   ▼
pipeline/intake.handleInbound()
   │  ├── clients.upsert(tg_id)
   │  ├── language-detect (ru/ua)
   │  ├── messages.append(role='client')
   │  └── runDialogTurn()  ──► LLM (system prompt + history + tool registry)
   │                              │
   │                              ▼
   │                          tool call: extractRequest({ raw_text })
   │                              │
   │                              ▼
   │                          llm-tools.extract → zod parse → { from, to, tons, body }
   │                              │
   │                              ▼
   │                          tool call: nearestTruck({ from_geom, tons, body })
   │                              │
   │                              ▼
   │                          matching.nearestTruck → PostGIS KNN → top 3
   │                              │
   │                              ▼
   │                          tool call: calcPrice({ from, to, params })
   │                              │
   │                              ▼
   │                          pricing.calcPrice → routing + formula → { price, corridor }
   │                              │
   │                              ▼
   │                          LLM composes RU/UA reply with price + truck card
   │
   ▼
lifecycle/lead-fsm.transition(leadId, { kind: 'quoted', price })
   │   └── leads.stage = QUOTED, append lead_event
   │
   ▼
notification.notify(clientId, 'quote', { price, truck, route })
   │   └── channels/telegram.send(...)   — message + inline buttons
   │
   ▼
ws.hub.publish('inbox', { leadId, lastMessage, stage })   — admin chat updates live
```

### Flow B: GPS Position → Order Event → Client Notification

```
Driver app POSTs position to /webhook/gps
   │
   ▼
channels/gps  → { truckId, geom, recordedAt }
   │
   ▼
tracking.ingestPosition()
   ├── trucks.updateGeom(truckId, geom)                              (always)
   ├── orders.findActiveByTruck(truckId)  →  [Order]
   └── for each active order:
       │
       ▼
       tracking.checkGeofencesForOrder(order, geom)
       │   ├── geofence.isInZone(nextExpectedZone, geom)             (ST_DWithin)
       │   └── if true and not already emitted:
       │
       ▼
       lifecycle/order-fsm.transition(orderId, { kind: 'at_loading' | … })
       ├── orders.status = AT_LOADING
       ├── order_events.insert(type='at_loading', geom)              (UNIQUE → idempotent)
       └── notification.notify(clientId, 'at_loading', …)
                                  │
                                  ▼
                          channels/telegram.send(...)

ws.hub.publish('tracking', { type: 'position', truckId, geom })      (always)
ws.hub.publish('tracking', { type: 'order_event', orderId, … })      (when emitted)
```

### Flow C: Admin Page Load — SSR First, WS Deltas

```
Browser GET /dashboard/tracking
   │
   ▼
Next.js server runs page.tsx
   ├── fetch /api/trucks               (REST, server-to-server)
   └── fetch /api/orders?status=…
   │
   ▼
Render HTML with TrackingApp(initial data)  →  browser
   │
   ▼
Browser hydrates → useEffect opens WS /ws/tracking
   │
   ▼
WsHub subscribes connection with filter (e.g. only IN_TRANSIT orders)
   │
   ▼
Every tracking.publish() → matching subscribers → React state update → Leaflet redraw
```

### Flow D: Manager Drags Lead in Kanban

```
Browser DnD → POST /api/leads/:id   { stage: 'MATCHED', actor: 'manager' }
   │
   ▼
admin-api route → lifecycle/lead-fsm.transition(leadId, { kind: 'manual', to: 'MATCHED', by: userId })
   │   ├── validate manual transition is allowed (skip-stage policy)
   │   ├── leads.updateStage
   │   └── append lead_event with by=userId   — full audit trail
   │
   ▼
ws.hub.publish('inbox', { leadId, stage, source: 'manual' })   — other tabs reconcile
```

### State Management (admin web)

Zustand stores live only in client containers, scoped per page:
- `tracking-app.tsx` → trucks map keyed by id, WS updates the entry
- `chat-app.tsx` → conversations list, `/ws/inbox` appends messages
- `kanban-app.tsx` → leads grouped by stage, optimistic update on drag → PATCH → reconcile

Cross-page state (auth, theme, language) uses the template's existing Zustand stores. **No global truck/order store** — each page owns its data and re-fetches on mount; the WS supplies deltas only while mounted.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Demo (1 manager, 5–10 trucks)** | Single Node process for API, single Next.js process for web, single Postgres, no Redis required, in-memory WS hub, inline webhook processing. Everything in one `docker-compose.yml`. |
| **Early prod (1–10 managers, 50–200 trucks)** | Add Redis for: `bourse_cache`, dialog-state cache, rate-limiting. Move webhook handlers (Telegram, voice, GPS) to a BullMQ queue so the response is sub-100ms. Add a read replica for analytics queries. Pino → Loki for logs. |
| **Scale prod (50+ managers, 1k+ trucks, real voice volume)** | Two API replicas behind a load balancer → WS hub now requires Redis Pub/Sub fan-out (same public surface, swap backing store). Pull `pipeline/llm-tools` into its own service if LLM latency dominates and you want to autoscale it independently. Wialon polling becomes a dedicated worker. Postgres connection pooling via PgBouncer. |
| **Beyond** | Time to start splitting modules into services — the boundaries are already drawn. Likely first: `tracking` (independent scaling profile from REST), then `pipeline/llm-tools` (cost/latency control). |

### Scaling Priorities — what breaks first

1. **WebSocket fan-out for tracking.** Every connected admin tab consumes every position from every truck. Mitigations (in order): server-side filter by viewport bounds → topic per active order → Redis Pub/Sub when multi-instance.
2. **Webhook processing during LLM latency.** Inline processing means Telegram retries if the LLM call exceeds 10s. Mitigation: enqueue inbound to BullMQ, ack the webhook immediately, process async, reply to Telegram via outbound send. This is the single biggest demo→prod gap.
3. **PostGIS KNN under heavy contention.** The `<->` operator with a GiST index on `trucks.geom` is fast (<5 ms) until `trucks.geom` updates dominate (one update per truck per minute × N trucks). Mitigation: a separate `truck_positions` hot table with no other indexes, write-heavy; `trucks.geom` updated only on status change.

---

## Anti-Patterns

### Anti-Pattern 1: Letting the LLM Set the Price

**What people do:** Include `price` in the LLM system prompt as something the model can negotiate freely, or pass historical prices and ask the model to "be smart".
**Why it's wrong:** Prices become irreproducible. A manager cannot defend a quote to a client. Bug in pricing → silent revenue loss visible only in retrospect.
**Do this instead:** `calcPrice` is a pure function called as a tool. The LLM only relays the result. Negotiation operates within a corridor (`min_price`, `max_price`) computed by the same function; the LLM picks a value in `[min, max]`, never outside. If the client asks below `min`, the LLM hands off to a manager.

### Anti-Pattern 2: Splitting into Microservices Before the Demo Works

**What people do:** Day-one architecture has separate services for intake, matching, pricing, lifecycle, tracking, plus an event bus.
**Why it's wrong:** You spend the demo timeline solving distributed-systems problems (consistency between lead and order state, replaying events on a service that was down) instead of validating the product. The spec's modules don't need network boundaries to be correct.
**Do this instead:** One monolith with module boundaries enforced by package layout and code review. Split only when one module has a different scaling profile or a different team — neither is true at demo time.

### Anti-Pattern 3: Polling the GPS Source from the Admin Map

**What people do:** Admin map fetches `/api/trucks` every 5 seconds.
**Why it's wrong:** Burns bandwidth, looks janky (positions jump), and N tabs × M trucks = N×M reads per polling interval against the DB.
**Do this instead:** Tracking loop publishes to WS; admin map subscribes. The map *also* does a single SSR fetch for the initial render — but no polling afterward. This is exactly the pattern the spec implies in §7.4.

### Anti-Pattern 4: Skipping the FSM and Using Free-form `status` Updates

**What people do:** `PATCH /api/orders/:id { status: 'whatever' }` — accept any string.
**Why it's wrong:** Backwards transitions (DELIVERED → IN_TRANSIT), skipped stages (CREATED → DELIVERED with no driver assigned), and lost audit trail.
**Do this instead:** Mutations go through `lifecycle/*-fsm.transition()`. REST endpoints take *events* (`{ event: 'driver_assigned' }`) not target *states*. The Kanban manual override is the only exception, and it logs `by=userId` for the audit trail.

### Anti-Pattern 5: Putting WebSocket on the Next.js Server

**What people do:** Try to host `/ws/tracking` from a Next.js route handler on Vercel.
**Why it's wrong:** Per the [Next.js WebSocket discussion](https://github.com/vercel/next.js/discussions/58698), App Router route handlers don't support Upgrade requests. Vercel serverless can't hold long-lived connections.
**Do this instead:** WebSocket endpoints live on the Fastify backend (`@fastify/websocket`). The Next.js app is just an HTTP client — it opens the WS to the API host directly.

### Anti-Pattern 6: Idempotency via Application-Level Dedup Tables

**What people do:** A `processed_messages` table with `INSERT … ON CONFLICT` for every webhook.
**Why it's wrong:** Premature for demo, adds writes on the hot path, easy to forget on one endpoint.
**Do this instead (demo minimum):**
- Telegram message dedup: `messages` table already keyed on `(telegram_message_id)` — `ON CONFLICT DO NOTHING`.
- GPS position dedup: `truck_positions` keyed on `(truck_id, recorded_at)` — `ON CONFLICT DO NOTHING`. Drivers retrying within the same second are safe.
- Order event dedup: `order_events` keyed on `(order_id, type)` for the auto-emitted types (`at_loading`, `at_border`, `delivered`) — `ON CONFLICT DO NOTHING`. The geofence debouncer falls out of this constraint for free.
- Order creation: `leads.order_id` is the natural idempotency key — if non-null, return the existing order; never create twice from one lead.

### Anti-Pattern 7: Bilingual via `if (lang === 'ua')` Sprinkled in Business Code

**What people do:** Translation logic inside matching/pricing/lifecycle modules.
**Why it's wrong:** Business modules know about presentation. Adding a third language touches everything.
**Do this instead:** Two i18n dictionaries — one server-side in `lib/i18n.ts` for Telegram replies and voice prompts (keyed by `client.lang`), one client-side in the Next.js app for admin UI (driven by the template's Customize-panel language preference, independent of any client's language). Business modules pass *keys + params*, the i18n layer resolves to RU/UA text at the channel/UI edge.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Telegram Bot API | grammY webhook → `/webhook/telegram`. Outbound via grammY's `bot.api.sendMessage`. | grammY chosen over Telegraf per [grammY's comparison](https://grammy.dev/resources/comparison) — better TypeScript, lighter, current docs. Set webhook URL with `secret_token` header check. |
| ElevenLabs Agents (voice) | Agent dials our tools by HTTP; callbacks to `/webhook/voice`. **Stub for demo** — real integration in a later milestone. | Same tool registry as text channel — only the channel adapter differs. |
| LLM provider (OpenAI / Anthropic) | Strict JSON schema function calling per [OpenAI structured outputs](https://platform.openai.com/docs/guides/function-calling). Adapter pattern in `llm-tools/client.ts` so we can swap providers. | Strict mode requires `additionalProperties: false` and all properties marked `required` (nullable for optional fields). Zod schemas converted via `zod-to-json-schema`. |
| PostgreSQL 15 + PostGIS 3.4 | Direct `pg` driver from `persistence/db.ts`. Migrations via `node-pg-migrate` or `drizzle-kit`. | Single primary for demo. Connection pool size = 10 plenty. |
| Routing API (Mapbox / HERE / OSRM) | Adapter in `lib/routing.ts` — single function `route(from, to): { km, polyline, etaSec }`. | OSRM self-hosted is free and adequate for demo; Mapbox if budget allows; spec leaves this open. Cache results by `(from_city_id, to_city_id)` in DB — routes don't change. |
| Geocoding API | Adapter in `lib/geocoding.ts`. Cache in `cities` table per spec §2. | Geocode lazily on first mention; never geocode twice for the same name. |
| Wialon Open API / driver app | `/webhook/gps` accepts both formats. For demo: driver app or simulator. | Polling Wialon is a separate worker task — deferred per spec §9.5. |
| Redis (optional for demo) | `ioredis` client; used only if `REDIS_URL` is set. | Demo runs without it. First use will be `bourse_cache` TTL and BullMQ. |
| ATI.SU / Lardi-Trans | `matching/bourse.ts` adapter. **Stub for demo** returning `[]`. | Real integration is a post-demo milestone — see spec §4.6. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `channels/*` → `pipeline/intake` | Direct function call with `ChannelMessage` | One direction; channels never call business modules directly. |
| `pipeline/llm-tools` → `matching` / `pricing` / `lifecycle` | Direct function call from tool handlers | Tool handlers are thin — they validate and delegate. |
| `lifecycle/*-fsm` → `notification` | Direct function call after successful transition | Notification failure does **not** roll back the transition (the FSM is the source of truth; the notification is an effect). Failed sends go to a retry queue (deferred for demo). |
| `tracking` → `lifecycle/order-fsm` | Direct function call when geofence triggers | Idempotency from `order_events` UNIQUE constraint. |
| Any module → `ws/hub` | Direct function call (`publish(topic, msg)`) | WS hub has no dependencies on business modules — they call it. |
| `admin-api` (REST routes) → business modules | Direct function call | Routes are validate-and-delegate; no business logic in routes. |
| `admin-web` → `admin-api` | HTTPS REST + WS over the same origin (Caddy reverse proxy) | Single origin keeps cookies/auth simple. |

---

## Build Order (refining spec §9)

The spec's §9 is correct. These refinements front-load the highest-risk integration points and keep every step shippable.

1. **Database + repository scaffolding** (day 1)
   - `docker-compose.yml` with postgres+postgis
   - Migrations for §2 schema, GiST index on `trucks.geom`
   - Seed script: 8–12 trucks across realistic cities, 5–10 sample clients, ~20 city geocodes
   - Repos for `trucks`, `clients`, `cities`, `leads`, `orders`, `messages`
   - **Exit criterion:** `SELECT … ORDER BY geom <-> :pickup LIMIT 3` returns reasonable trucks from a psql prompt.

2. **Backend skeleton + first deterministic tool** (day 1–2)
   - Fastify app, zod-validated config, error middleware
   - `matching.nearestTruck` (PostGIS KNN + filter)
   - `pricing.calcPrice` (formula + corridor)
   - REST endpoints: `GET /api/trucks`, `GET /api/clients/:id/messages`
   - **Exit criterion:** unit tests prove `calcPrice` is deterministic and `nearestTruck` returns expected ranking on seed data.

3. **LLM tool layer + extractRequest** (day 2–3)
   - Tool registry, OpenAI/Anthropic adapter with strict-mode schemas
   - `extractRequest` tool returning the canonical shape
   - A `runDialogTurn(text)` test harness — invoke from a script, no Telegram yet
   - **Exit criterion:** "Киев-Львов, 18 т, тент" returns the expected JSON; missing-field cases produce a clarifying question.

4. **Lead FSM + order FSM + REST CRUD** (day 3)
   - `lifecycle/lead-fsm.ts`, `lifecycle/order-fsm.ts` with transition log
   - `POST /api/orders`, `PATCH /api/leads/:id`, `GET /api/orders/:id`
   - **Exit criterion:** a script driving the dialog harness can move a lead all the way to `ORDER_CREATED` and the FSM rejects illegal transitions.

5. **Telegram channel** (day 4)
   - grammY adapter, webhook route, language detection
   - Wire `handleInbound` end-to-end
   - **Exit criterion:** A real Telegram chat completes the full pipeline and creates an order — visible in psql.

6. **Admin scaffolding** (day 4–5, parallelizable)
   - Fork `next-shadcn-admin-dashboard`, wire the API client + auth
   - Wire existing `chat`, `kanban`, `default` to real endpoints
   - **Exit criterion:** Kanban shows real leads; dragging updates the FSM.

7. **Tracking loop + WebSocket** (day 5–6)
   - `tracking.ingestPosition`, `geofence.isInZone`, WS hub, `/ws/tracking`
   - GPS webhook + simulator script (a node CLI that POSTs positions along a route)
   - Add new `/dashboard/tracking` page with Leaflet
   - **Exit criterion:** Run simulator → admin map updates live → order auto-transitions on geofence entry → client gets a Telegram notification.

8. **New admin pages: fleet, orders** (day 6–7)
   - CRUD for trucks, order detail with event timeline
   - **Exit criterion:** Manager can add a truck, view an order's history.

9. **Bilingual polish + final demo script** (day 7)
   - i18n dict for Telegram replies (RU/UA)
   - Admin UI translation strings (RU/UA), wire to template's Customize panel
   - End-to-end demo script that exercises both languages

**Out of demo path** (deferred): voice channel, real bourse APIs, Wialon polling, SMS, idempotency tables beyond DB constraints, multi-instance WS, BullMQ webhook queue.

**Build-order critical path:** steps 1 → 2 → 3 → 4 → 5 form a single chain; step 6 forks at any point after step 4 (admin can read seeded data while pipeline matures); step 7 depends on the order FSM (step 4). Run admin work in parallel with pipeline work after day 3.

---

## Demo Deployment Topology

```
                ┌──────────────────────────────────┐
                │   Single VM (4 vCPU, 8 GB RAM)    │
                │                                  │
                │   docker-compose:                 │
                │   ┌────────────┐  ┌────────────┐ │
                │   │   caddy    │←→│    web     │ │ Next.js 16 (Node 22)
                │   │  (HTTPS,   │  │   :3000    │ │
                │   │   ACME)    │  └────────────┘ │
                │   │            │  ┌────────────┐ │
                │   │            │←→│    api     │ │ Fastify (Node 22)
                │   │            │  │   :8080    │ │ + grammY webhook
                │   └────────────┘  │            │ │ + /ws/tracking
                │         ▲         │            │ │ + /ws/inbox
                │         │         └─────┬──────┘ │
                │     :443/:80            │        │
                │                         ▼        │
                │                  ┌────────────┐  │
                │                  │  postgres  │  │ Postgres 15 + PostGIS 3.4
                │                  │   :5432    │  │
                │                  └────────────┘  │
                │                  ┌────────────┐  │
                │                  │   redis    │  │ Optional — only if a
                │                  │   :6379    │  │ later module requires it
                │                  └────────────┘  │
                └──────────────────────────────────┘
                         ▲                  ▲
                         │                  │
                  Telegram webhook    Admin browser
                  (HTTPS, public)     (HTTPS, public)
```

**docker-compose services:**
- **`caddy`** — single-config HTTPS termination, auto-renews Let's Encrypt cert for one hostname. Routes `/` → `web:3000`, `/api` → `api:8080`, `/webhook` → `api:8080`, `/ws` → `api:8080` (with WebSocket upgrade headers).
- **`api`** — Fastify monolith. Mounts `./apps/api` source via bind mount in dev, multi-stage build in prod. Env: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`), `MAPBOX_TOKEN`, `WEBHOOK_SECRET`.
- **`web`** — Next.js admin. Built once (`pnpm build`), served with `pnpm start`. Env: `NEXT_PUBLIC_API_BASE_URL=https://<host>` (same origin via Caddy), `NEXT_PUBLIC_WS_URL=wss://<host>/ws`.
- **`postgres`** — `postgis/postgis:15-3.4`. Volume `pgdata:/var/lib/postgresql/data`. Init script runs migrations + seed on first boot.
- **`redis`** — `redis:7-alpine`. Present in the compose file but commented out for the demo; uncomment when a feature requires it.

**Why a single VM with docker-compose:**
- One Caddy = one cert = one DNS record. No load balancer config to debug at demo time.
- WS works without sticky sessions (single API process).
- `docker compose logs -f api` is the one debugging command.
- Total cost: ~$20/month on Hetzner or DigitalOcean.

**Demo-vs-prod differences (explicit, so we don't gold-plate):**

| Concern | Demo | Prod path |
|---------|------|-----------|
| API instances | 1 | 2+ behind LB; WS hub backed by Redis Pub/Sub |
| Webhook processing | Inline (Telegram waits for our response) | BullMQ enqueue + immediate ack |
| Postgres | Single | Primary + read replica for analytics |
| FSM | Hand-rolled transition table | XState if statecharts grow |
| Idempotency | DB UNIQUE constraints only | + dedup table for cross-channel scenarios |
| Voice channel | Stub | ElevenLabs SIP trunk |
| Bourse fallback | Stub returning `[]` | Real ATI.SU + Lardi-Trans calls + cache |
| GPS source | Driver app / simulator | Wialon polling worker |
| Auth | Single admin user, simple session cookie | Roles, audit log, MFA |
| Observability | `pino` to stdout, `docker logs` | Pino → Loki/Grafana, OpenTelemetry traces |
| Secrets | `.env` file | SOPS / Vault / cloud secret manager |
| TLS | Caddy auto-ACME | Same (Caddy scales fine) |

---

## Sources

- [Next.js App Router — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — pattern for SSR + client containers (HIGH)
- [WebSockets with Next.js — guide](https://websocket.org/guides/frameworks/nextjs/) — `useEffect` requirement, why WS lives on backend (HIGH)
- [Next.js GitHub discussion #58698 — WebSocket route handlers](https://github.com/vercel/next.js/discussions/58698) — confirms App Router route handlers don't support Upgrade (HIGH)
- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) — strict mode, schema requirements (HIGH)
- [OpenAI — Structured outputs introduction](https://openai.com/index/introducing-structured-outputs-in-the-api/) — strict mode is the 2026 default (HIGH)
- [PostGIS docs — ST_DWithin](https://postgis.net/docs/ST_DWithin.html) — index-accelerated radius checks (HIGH)
- [Crunchy Data — Moving Objects and Geofencing](https://www.crunchydata.com/blog/moving-objects-and-geofencing-with-postgres-postgis) — canonical pattern for fleet geofencing (HIGH)
- [PostGIS Workshop — Spatial Relationships](http://postgis.net/workshops/postgis-intro/spatial_relationships.html) — ST_Within vs ST_DWithin semantics (HIGH)
- [grammY — comparison with other frameworks](https://grammy.dev/resources/comparison) — rationale for grammY over Telegraf (MEDIUM, author-written)
- [David Khourshid — You don't need a library for state machines](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) — XState author's case for starting without a library (MEDIUM, opinion piece)
- [Stately — XState docs](https://stately.ai/docs/xstate) — upgrade target when statecharts grow (HIGH)
- [Fastify vs NestJS vs Express — 2026 comparison](https://www.index.dev/skill-vs-skill/backend-nestjs-vs-expressjs-vs-fastify) — Fastify chosen for raw throughput + simpler structure at demo size (MEDIUM)

---
*Architecture research for: AI-driven logistics dispatching (Telegram + LLM + PostGIS + admin web)*
*Researched: 2026-06-08*
