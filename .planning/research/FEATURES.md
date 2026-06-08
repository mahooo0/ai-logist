# Feature Research — AI-Логист

**Domain:** Logistics dispatching / TMS demo (small-to-mid fleet, RU/UA market, FTL road freight)
**Researched:** 2026-06-08
**Confidence:** MEDIUM-HIGH (specs read in full, 3 named competitors deeply analyzed: ATI.SU, Lardi-Trans, Project44/Motive ecosystem; demo-viewer perspective verified against industry guidance)

---

## Executive Snapshot

The spec author got the **headline workflow right** (Telegram → LLM extract → PostGIS match → deterministic price → tracked order). What a logistics buyer expects in a 20-minute demo is broader: **counterparty verification**, **document attach/generate (TTN/CMR/waybill)**, **driver confirmation loop**, **client-facing tracking link**, and a **price-coridor with manager override audit trail**. The current spec under-serves the "trust layer" that distinguishes ATI.SU and Lardi-Trans from a generic chatbot.

Three things will make the demo land or fail:
1. **A live map that actually moves** during the 10-min pitch (spec covers this — simulator must be reliable).
2. **One end-to-end story from Telegram message to delivered status** — buyer must *see* the funnel transition states, not be told about them.
3. **Generated TTN/CMR PDF preview** even if stubbed — without it, the demo feels like a chatbot, not a TMS.

---

## Feature Landscape

### Table Stakes — ALREADY IN SPEC (in-scope for v1)

Features the spec correctly identifies as must-have. Confidence these are needed: HIGH.

| Feature | Why Expected | Complexity | Spec Reference |
|---------|--------------|------------|----------------|
| Multi-channel intake (Telegram, voice-stub) with unified inbox | All competitors (ATI.SU, Lardi-Trans, Convoy) treat omnichannel as baseline; spec captures it via `/dashboard/chat` + WS | MEDIUM | §3, §5.1, §7.2 |
| LLM intent extraction → structured fields (from/to/tons/body_type) | Lardi-Trans launched same feature ("AI-powered tool to automate cargo search… text, voice, file, screenshot, spreadsheet") in 2025; baseline expectation now | MEDIUM | §4.1 |
| Nearest-truck matching by geo + capacity + body-type filter | Core dispatcher value — every TMS (PCS, DispatchTrack, Motive) shows this; PostGIS KNN is correct approach | MEDIUM | §4.2 |
| Deterministic pricing with coefficients (direction, season, route_km × rate) | Project44 and SONAR pushed pricing transparency hard in 2026 (Broker Transparency Law); LLM-set pricing would FAIL the demo trust test — spec correctly puts this in code | MEDIUM | §4.3 |
| Kanban sales funnel (NEW → QUALIFIED → … → DONE/LOST) | Universal CRM pattern; Lardi-Trans, ATI.SU and every modern TMS have funnel/stage view | LOW (shadcn template provides DnD) | §4.4, §7.2 |
| Order lifecycle FSM with timeline events | Standard everywhere; geo-fence-triggered events is the differentiator | MEDIUM | §4.5, §4.7 |
| Live tracking map (truck positions, routes, ETA) | Project44 ETA accuracy (95%+/15min) is the public benchmark; Motive Vehicle Gateway streams telemetry; buyers expect "show me the map" within the first 5 minutes | MEDIUM-HIGH | §4.7, §7.2 |
| Fleet CRUD (trucks, drivers, capacity, body type, status) | Cannot demo dispatch without showing the parked-and-available fleet | LOW | §7.2 |
| KPI dashboard (calls, conversion, revenue) | Every TMS demo opens with a dashboard tile; manager-buyer wants to see this | LOW (shadcn provides) | §7.2 |
| Bilingual RU/UA UI | Market-specific; Omniful Russia review specifically highlights "bilingual interface" as a localized differentiator | LOW (template has Language preference toggle) | §7.2, §9.7 |
| Bourse fallback (ATI.SU/Lardi-Trans stub) | Without this, demo viewer asks "what if your fleet is busy?" within 2 minutes; even a stub answers it | LOW (mocked) | §4.6 |
| Geo-fence event automation (at_loading, at_border, delivered) | Tive, Terminal49, DispatchTrack all show exception/milestone alerts as core 2026 feature | MEDIUM | §4.7 |

### Table Stakes — MISSING FROM SPEC (must add for credible demo) ⚠️ CRITICAL

These are the gaps a logistics buyer will spot in the first demo. Adding them now is cheaper than missing them.

| Feature | Why Expected | Complexity | Verdict |
|---------|--------------|------------|---------|
| **Client-facing tracking link** (shareable URL, no admin login) | DispatchTrack, Xpert Dispatch, TruckMaster all foreground this; spec mentions "ссылка на страницу трекинга" in §5.1 but no public `/track/[order_token]` route is defined. **Demo buyer will ask: "can my client see this without an account?"** | MEDIUM | **MUST ADD v1** — simple SSR page reading the same `/api/orders/:id` data, masked for public view |
| **Document attach / generate (TTN, CMR, waybill)** | Universal TMS feature (Cargoson, Dashdoc, pLG TMS, e-CMR). For RU/UA market: **ТТН (товарно-транспортная накладная)** is legally required in Russia; **CMR** is required for cross-border RU↔UA↔EU. Without showing even a PDF preview, demo feels incomplete | MEDIUM | **MUST ADD v1 (as PDF stub minimum)** — generate from order data, even mock signature/stamp |
| **Driver assignment confirmation loop** | Modern dispatch: dispatcher assigns → driver receives notification → driver accepts/rejects → confirmation back. Motive, PCS, DispatchTrack all do this. Spec jumps from `DRIVER_ASSIGNED` → `AT_LOADING` with no driver confirmation step | MEDIUM | **MUST ADD v1** — even a Telegram message to driver_phone with "Принять / Отказаться" buttons; in demo can be simulated |
| **Cargo description fields beyond from/to/tons** (volume m³, dimensions LxWxH, packaging type, value, ADR-class) | spec captures only `tons + body_type + budget`. Real freight requests have: cargo name, packages count, dimensions (pallet/full), declared value (for insurance), ADR hazard class (if applicable), loading method (rear/side/top). Without these, the demo "matching" looks too simple | LOW-MEDIUM | **MUST ADD v1** — extend `leads` schema; even if LLM extracts only some, schema must exist |
| **Counterparty verification / trust signal** | ATI.SU "auto verification of counterparties"; Lardi-Trans "Reliability Zone"; Opendatabot for EDRPOU; this is **the** differentiator of RU/UA freight platforms. Without a "verified ✓" badge on a client card, demo looks naive | LOW (mock badge for demo) | **SHOULD ADD v1** — even a static "Verified by EDRPOU" badge with mock data |
| **Proof of Delivery (POD)** capture step | Spoke Dispatch, Track-POD, FleetRabbit: signature/photo/timestamp/GPS at delivery is universal. Spec ends at `DELIVERED → CLOSED` with no POD artifact | MEDIUM | **MUST ADD v1** — order detail page shows "POD: signature image + photo + GPS coords" placeholder; can be mocked |
| **Manager pricing override + audit log** | 2026 freight buyers know about Broker Transparency Law; they expect to see "who changed the price, when, and why". Spec mentions "коридор" min/max and "эскалация менеджеру" but no UI/data trail | LOW (one column in `leads`, one badge in UI) | **MUST ADD v1** — `leads.price_overrides jsonb[]` with `{by, at, old, new, reason}` |
| **ETA delay / route exception alerts** | Tive, project44, DispatchTrack: predictive ETA + delay alert is *the* feature buyers cite. Spec has tracking but no "this truck is 2 hours late, ping client" automation | MEDIUM | **SHOULD ADD v1** — simple rule: if `eta_diff > 60min`, push notification to `/ws/inbox` + Telegram to client |
| **Order number search / global search** | Every dispatcher's first action on opening admin: "find me order #KU-4471". Spec doesn't mention search | LOW | **MUST ADD v1** — shadcn command palette (likely in template already) wired to orders/leads |
| **Status notification audit** (what was sent to client, when) | Buyers want to see "client was notified about loading at 14:32 via Telegram"; differentiates from "we promise to notify" | LOW | **SHOULD ADD v1** — `order_events` already supports this if `payload` records channel + message |
| **Driver phone normalization & validation** (libphonenumber-js) | Spec mentions phone-input from template; good. But cross-border RU↔UA phone formats (+7, +380) must be auto-detected | LOW | Already covered by template's libphonenumber-js |

### Differentiators (Competitive Advantage Worth Considering)

Features that set this product apart from ATI.SU (which is a marketplace, not a dispatcher) and Lardi-Trans. Pick 1-2 for demo polish.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **LLM transcript → editable summary card** | Manager sees structured summary of LLM extraction *with* original transcript collapsed; can correct fields inline before quote sent | LOW-MEDIUM | This is what makes "AI-логист" feel like an actual product, not a chat wrapper |
| **One-click "Создать рейс" from chat message** | Spec implies this exists; making it visible in demo (button right in chat, opens pre-filled order form) is a differentiator vs. generic chat tools | LOW | Cheap demo win |
| **Price explanation chip** (hover: "route_km=540 × rate=42 × season=1.1 × dir=0.95 = 23,810 → 23,800") | Pricing transparency is the 2026 regulatory wind; showing the formula on hover differentiates vs. "AI black box" | LOW | Trust-builder |
| **Heat map of demand by route** | Lardi-Trans and ATI.SU have lane-level analytics; a simple choropleth would impress | MEDIUM | Defer unless analytics phase has time |
| **Smart re-match button** (truck broke down → re-run nearestTruck with hold on old assignment) | Real-world scenario every dispatcher hits weekly; one button vs. cancel+recreate | LOW | Differentiator that screams "built by dispatchers" |
| **Voice → Telegram recap** (after demo voice call, full structured recap appears in client's Telegram thread) | spec §5.2 hints at this; making it a polished demo moment is differentiating | MEDIUM | Defer to voice phase |
| **Bilingual auto-translate of client message** (UA client writes UA, manager sees RU translation inline) | Lardi-Trans serves Ukrainian carriers; mixed-language traffic is real | LOW (LLM does it) | Cheap to add, demo-impressive |

### Anti-Features (Don't Build for Demo Even If Tempting)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Multi-tenancy / RBAC roles** | Looks "enterprise" | Massive complexity, doubles auth surface, demo audience is one manager | Single-admin login; mention "roles in v2" if asked |
| **Real Wialon integration for demo** | "It's not real GPS" | Wialon API is paid + slow to provision; demo simulator with realistic interpolation is indistinguishable on screen | Driver-app simulator pushing to `/webhook/gps` every 5s |
| **Real ElevenLabs + Twilio voice during demo** | "Voice is in the name" | One bad demo call = lost deal; SIP setup is fragile; spec correctly defers this | Pre-recorded voice demo video; or scripted "fake call" that shows transcript flowing in |
| **Real ATI.SU / Lardi-Trans bourse integration** | "Demo should be real" | Both APIs require commercial agreement; rate limits in seconds; demo failures are visible | `bourse_cache` seeded with realistic mock results; show it once, move on |
| **Email channel + SMS notifications** | "Cover all channels" | Each new channel = new failure mode in demo; Telegram alone proves omnichannel architecture | Show architecture diagram with "+ Email/SMS coming" if asked |
| **Driver mobile app as a product** | "Drivers need an app" | Building two apps doubles scope; for demo, simple web link to driver portal works | Web `/driver/[token]` page + Telegram for driver notifications |
| **Customer signup / registration / billing portal** | "B2B SaaS needs billing" | Demo audience is the *operator* of the system, not its customers | Single-user demo account; "billing in v2" |
| **Real-time everything via WebSocket on every screen** | "Modern apps are real-time" | WS lifecycle bugs are demo-killers; polling 5s is fine for fleet table, KPI tile | Reserve WS for tracking map + chat inbox; HTTP polling elsewhere |
| **Configurable rule engine / no-code workflow builder** | "Show flexibility" | Massive UX surface for a demo; users won't touch it in 20 min | Hardcode rules for demo; "configurable in v2" |
| **Full freight broker accounting (invoices, payments, balances)** | "TMS = billing" | Accounting is a 6-month project; out of scope for AI-dispatcher demo | Show "Invoice generated" toast + PDF stub, defer real accounting |

---

## Domain-Specific Table Stakes (RU/UA Freight)

Specific to the regional market. Demo viewer will know these by heart.

| Feature | Why RU/UA-specific | Where to add |
|---------|--------------------|-----|
| **ТТН (товарно-транспортная накладная)** PDF generator stub | Legally required document in RU for road freight; client expects to see it | New page `/dashboard/orders/[id]/documents` |
| **CMR** (Convention relative au contrat de transport international de Marchandises) PDF for cross-border | Required for UA↔EU, RU↔EU; CMR e-document is the 2025 standard (e-CMR rolling out) | Same documents page |
| **EDRPOU (UA) / ИНН + КПП (RU) field on client** + verification badge | Standard counterparty fields; verification is *the* trust signal in RU/UA market | `clients` table — add `tax_id`, `tax_id_country`, `verified_at` |
| **Vehicle plate format validation** (different RU vs UA plate formats) | Visible quality signal | Fleet form |
| **Cargo insurance disclosure** (insured Y/N, insurer, sum, policy number) | ATI.SU and Lardi-Trans both prominently offer cargo insurance; absence = "is my cargo safe?" question | Order detail card |
| **Border crossing event** in order timeline | spec already has `AT_BORDER` ✓ — make sure it's visible in demo; for RU↔UA route specifically, this is a 6-24h event that drives client anxiety | Already in §4.5 — emphasize in demo script |
| **Loading method** (back/side/top) and **loading time window** | Standard fields in ATI.SU/Lardi-Trans cargo cards | `leads` schema extension |
| **ADR (dangerous goods) class** field | UNECE ADR is the legal regime; UA and RU are signatories; demo without this field looks unprofessional for chemical/fuel shipments | `leads` and `trucks` (driver's ADR cert) |
| **Driver ADR certificate** in driver profile | Required by law if hauling hazardous cargo | Fleet form |

---

## Feature Dependencies

```
[Telegram intake] ──requires──> [LLM extract] ──requires──> [city geocoding cache]
                                                                       │
[Lead Kanban] ──requires──> [Lead FSM (§4.4)] ──requires──> [LLM extract]
                                                                       │
[nearestTruck match] ──requires──> [PostGIS schema] ──requires──> [trucks seeded with geom]
                                          │
[Pricing] ──requires──> [Routing API for route_km] ──requires──> [city geocoding cache]
                                                                       │
[Order creation] ──requires──> [matched truck + agreed price]
                                          │
[Tracking map] ──requires──> [order created + WS /ws/tracking + GPS sim/webhook]
                                          │
[Geo-fence events] ──requires──> [tracking running] ──requires──> [city geocoding cache]
                                          │
[Client tracking link] ──enhances──> [tracking map] (public read-only version)
                                          │
[POD capture] ──requires──> [order DELIVERED state]
                                          │
[TTN/CMR PDF] ──requires──> [order data + client + truck] (can render anytime after CREATE)

[Driver confirmation loop] ──requires──> [driver phone/telegram + assignment event]
                                          │
[Counterparty verification] ──enhances──> [client record] (independent of pipeline)

[Bourse fallback] ──conflicts-with──> [own-fleet-only demo path]
   (must choose which to show first in demo)

[Voice channel] ──requires──> [LLM tools (extractRequest, nearestTruck, calcPrice)]
   (logic shared with Telegram; voice is just I/O layer)
```

### Critical Dependency Notes

- **City geocoding cache is the root dependency** for everything downstream. Seed `cities` with top 30 RU/UA cities BEFORE building anything else, or LLM extraction will look broken on first run.
- **Driver confirmation loop is missing from spec but blocks credible POD** — if you skip the confirmation, the "driver" in the demo is a fiction.
- **Public tracking link (`/track/[token]`)** is independent of admin auth — implement as a separate route, no login.
- **TTN/CMR generation** is data-cheap (renders existing order + client + truck data into a template) but UI-visible — small effort, big demo win.

---

## MVP Definition for Demo

### Launch With (v1 — Demo-Ready)

The minimum to pass the "credible dispatcher demo" bar.

**Backend & Data**
- [ ] Postgres+PostGIS schema (extended per "Missing from Spec" above: tax_id, cargo dimensions, ADR class, price_overrides, POD blob)
- [ ] Seeded fleet (10-15 trucks across realistic RU/UA cities with varied body_type/capacity)
- [ ] Seeded cities table (top 30 RU/UA + key border crossings)
- [ ] REST + WS endpoints per §6
- [ ] Public tracking endpoint: `GET /api/public/orders/:token` (no auth)

**Core LLM + Logic**
- [ ] extractRequest with full field set (incl. dimensions, ADR, packaging) — partial extraction OK
- [ ] nearestTruck with all filters
- [ ] calcPrice deterministic + return breakdown for UI chip
- [ ] Lead FSM with manual override + audit log
- [ ] Driver confirmation loop (Telegram to driver_phone if telegram_id set, else simulated)

**Telegram Channel**
- [ ] Real Telegram bot with webhook
- [ ] Inline buttons (confirm rate, view tracking)
- [ ] Driver-facing bot OR separate driver_chat_id flow for assignment confirmation
- [ ] Manager intervention from `/dashboard/chat`

**Admin UI (shadcn template)**
- [ ] `/dashboard/chat` — wired to `/ws/inbox` + `/api/clients/:id/messages`
- [ ] `/dashboard/kanban` — wired to `/api/leads`, DnD = PATCH stage
- [ ] `/dashboard/fleet` — CRUD with phone-input + plate validation
- [ ] `/dashboard/orders` + `/dashboard/orders/[id]` with timeline + **POD section** + **documents (TTN/CMR PDF preview)**
- [ ] `/dashboard/tracking` — Leaflet+OSM + WS, smooth interpolation between GPS pings
- [ ] `/dashboard/calendar` — load/unload events
- [ ] `/dashboard/default` — KPI from `/api/analytics/kpi`
- [ ] Global search (command palette wired to orders/leads/clients)
- [ ] RU/UA language toggle wired to dictionary
- [ ] Price-override modal with reason field → writes to audit log

**Public Surface**
- [ ] `/track/[order_token]` — public tracking page (map + status + ETA + masked client info)

**Demo Simulators**
- [ ] Driver-app simulator pushing GPS to `/webhook/gps` every 5s with realistic route interpolation
- [ ] Bourse-cache seeded with 3-5 realistic mock offers (for fallback story)

### Add After Validation (v1.x — Post-Demo Wins)

- [ ] ETA delay alert rule + notification
- [ ] Counterparty verification panel (real Opendatabot for UA, mock for RU)
- [ ] Smart re-match button (truck breakdown scenario)
- [ ] Heat map of demand by route
- [ ] Bilingual auto-translate of client messages in admin
- [ ] Email channel as second intake
- [ ] Soft-delete + restore for accidental Kanban moves

### Future Consideration (v2+ — Post-PMF)

- [ ] Real ElevenLabs + Twilio voice channel
- [ ] Real Wialon integration
- [ ] Real ATI.SU / Lardi-Trans bourse API
- [ ] Real e-CMR with carrier signatures
- [ ] Multi-tenancy / RBAC
- [ ] Driver native mobile app
- [ ] Full accounting (invoices, payments, reconciliation)
- [ ] Configurable rule engine / workflow builder
- [ ] CRM segments, mailings, customer cohort analytics

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Telegram intake + LLM extract | HIGH | MEDIUM | P1 |
| nearestTruck PostGIS | HIGH | MEDIUM | P1 |
| Deterministic price | HIGH | LOW | P1 |
| Live tracking map | HIGH | MEDIUM-HIGH | P1 |
| Lead Kanban | HIGH | LOW (template) | P1 |
| Order timeline + FSM | HIGH | MEDIUM | P1 |
| Fleet CRUD | HIGH | LOW | P1 |
| **Public tracking link** (missing) | HIGH | LOW | **P1 ADD** |
| **TTN/CMR PDF stub** (missing) | HIGH | MEDIUM | **P1 ADD** |
| **Driver confirmation loop** (missing) | HIGH | MEDIUM | **P1 ADD** |
| **Extended cargo fields** (dimensions, ADR) (missing) | HIGH | LOW | **P1 ADD** |
| **Price override + audit** (missing) | MEDIUM | LOW | **P1 ADD** |
| **POD section in order** (missing) | HIGH | LOW (mock OK) | **P1 ADD** |
| Bourse fallback stub | MEDIUM | LOW | P1 |
| RU/UA i18n | HIGH | LOW (template) | P1 |
| KPI dashboard | MEDIUM | LOW (template) | P1 |
| Global search | HIGH | LOW (template) | P1 |
| Counterparty verification badge (mock) | MEDIUM | LOW | P2 |
| Price breakdown hover chip | MEDIUM | LOW | P2 |
| ETA delay alert | MEDIUM | MEDIUM | P2 |
| Smart re-match | MEDIUM | LOW | P2 |
| LLM transcript → editable summary | MEDIUM | LOW-MEDIUM | P2 |
| Bilingual auto-translate | LOW-MEDIUM | LOW | P2 |
| Real voice channel | HIGH | HIGH | P3 |
| Real Wialon / ATI.SU integrations | MEDIUM | HIGH | P3 |
| Multi-tenancy / RBAC | LOW (demo) | HIGH | P3 |
| Configurable rule engine | LOW (demo) | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | ATI.SU | Lardi-Trans | Project44 / Motive | Our Approach |
|---------|--------|-------------|---------------------|--------------|
| Intake channel | Web platform marketplace | Web platform + Android app + AI search (text/voice/file/screenshot) | EDI + API + manual | **Telegram bot + LLM extract** (cheaper, faster, mobile-native for RU/UA SMB) |
| Match logic | Marketplace listings; manual selection by carrier | Same as ATI.SU + AI-assisted filter | Algorithmic auto-dispatch on internal TMS | **PostGIS KNN auto-match** (closer to project44 than to ATI.SU model) |
| Pricing | Rate benchmarks; tender-based | Rate benchmarks | ML-based dynamic + transparency | **Deterministic formula with visible breakdown** (regulatory-friendly for 2026) |
| Counterparty trust | "Auto verification of counterparties" + cashback | "Reliability Zone" + insurance | DOT/MC + SCAC for US; carrier vetting | **Mock verification badge for demo**, real Opendatabot/EDRPOU integration v1.x |
| Documents | Legally relevant e-docs exchange | Document management built-in | e-CMR via Trimble integration | **TTN + CMR PDF stub for v1**; e-CMR real in v2 |
| Tracking | Limited (marketplace, not carrier-side) | Fleet management module | Real-time visibility 95%+/15min ETA | **Leaflet+WS for own-fleet** (we own the truck, simpler stack) |
| POD | N/A (marketplace) | Document storage | Full POD module | **Mock signature+photo+GPS for v1** |
| Insurance | Cargo + liability insurance built-in | Cargo + vehicle insurance | Via partner | **Display fields only for v1** (Y/N, insurer); real insurance API v2+ |
| Mobile | Web + apps for carriers | Web + Android app | Driver Vehicle Gateway hardware | **Telegram-as-mobile** (no app needed for v1) |
| Dispatcher screen | N/A (marketplace, not dispatcher) | Built-in dispatcher module | Full TMS dispatcher UI | **shadcn-based, opinionated dispatcher-first** |

**Key insight:** ATI.SU and Lardi-Trans are **marketplaces** that incidentally have dispatcher tools. AI-Логист is a **dispatcher-first tool** that happens to fall back to marketplaces. This is a real positioning differentiator — make sure the demo opens with the dispatcher workflow, not the marketplace fallback.

---

## Demo Script — Feature Reveal Order (Recommended)

For the 15-20 min demo, surface features in this order (industry best-practice: lead with pain, end with wow):

1. **Pain anchor (1 min):** "Manager opens 3 channels, copies info to Excel, calls drivers, sends quotes by hand."
2. **Open `/dashboard/chat` (2 min):** Show Telegram message arriving → LLM extracts summary card on the right → click "Создать рейс"
3. **Lead form pre-filled (1 min):** Show extracted fields (from/to/tons/dimensions/ADR); manager edits one field; clicks "Подобрать"
4. **Match result (2 min):** Show 3 candidate trucks with distance + ETA to pickup; **show price chip with breakdown formula**; click "Цена клиенту"
5. **Quote sent (1 min):** Back in chat — auto-message with rate; client clicks "Согласен" inline
6. **Order created (2 min):** Show `/dashboard/orders/[id]` — timeline, **TTN PDF preview button**, **POD section "awaiting"**
7. **Driver confirmation (1 min):** Show driver's Telegram (mock or simulator) — "Принимаю рейс"
8. **Live tracking (3 min):** Open `/dashboard/tracking` — truck moves on map; status auto-flips to AT_LOADING then IN_TRANSIT via geo-fence
9. **Public tracking link (1 min):** Open `/track/[token]` in incognito — client view, no login
10. **Border crossing event (1 min):** Truck crosses AT_BORDER fence → client gets Telegram notification → show in admin
11. **Delivered + POD (1 min):** Show signature/photo upload, status → CLOSED
12. **Kanban + KPI flyover (1 min):** Show funnel populated, dashboard KPI ticked
13. **The "what if?" (1 min):** Show bourse fallback — own fleet full → 3 mock offers from ATI.SU/Lardi-Trans
14. **RU/UA toggle (15s):** Flip language live — last polish moment

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Spec features (already in scope) | HIGH | Spec is detailed, internally consistent, matches industry standards |
| Missing table stakes (TTN/CMR, POD, public tracking, driver confirmation) | HIGH | All four are confirmed across multiple competitor sources (Dashdoc, Spoke, DispatchTrack, Lardi-Trans, ATI.SU); their absence in a demo would be noticed |
| RU/UA-specific gaps (EDRPOU, ADR, ТТН) | HIGH | Domain knowledge + Opendatabot/Lardi-Trans/ATI.SU sources confirm |
| Anti-features list | MEDIUM-HIGH | Based on demo-best-practices research + spec's own Out-of-Scope alignment |
| Differentiators | MEDIUM | Opinionated picks; some (price chip, smart re-match) are educated guesses about what would impress a 2026 buyer |
| Competitor comparison | MEDIUM | ATI.SU and Lardi-Trans data based on their own marketing + neolit/golden writeups; not first-hand testing |

---

## Open Questions for Requirements Phase

1. **Driver delivery mechanism in demo:** Telegram bot for driver (requires drivers to start a chat with the bot) vs. simulator? Recommend Telegram for one named demo-driver, simulator for the rest.
2. **TTN/CMR template:** Real RU legal template (RB-4 form) or stylized for demo? Recommend stylized but recognizable.
3. **Verification source:** Mock badge only, or wire to real Opendatabot for UA EDRPOU lookup? Opendatabot has free tier — likely worth doing for UA side.
4. **Public tracking page UX:** Map + status only, or include "rate this delivery" CTA? Recommend just map+status for demo simplicity.
5. **POD capture flow:** Who uploads in demo — manager via admin, or driver via Telegram? Recommend Telegram from driver (more realistic).
6. **ADR field in demo:** Show empty by default, or include one demo lead with hazmat to display the field? Recommend the latter — discriminator for serious freight buyers.

---

## Sources

**Competitors analyzed:**
- [ATI.SU — Freight exchange](https://ati.su/en/) — features, scale (150k loads/day), counterparty verification, e-documents, cargo/liability insurance
- [Lardi-Trans — International freight transportation](https://lardi-trans.com/en/) — Reliability Zone, insurance, AI-powered search (text/voice/file/screenshot), fleet management, document management
- [What is Lardi-Trans (Neolit)](https://neolit.ua/en/articles/what-is-lardi-trans-and-how-does-it-work/) — operational detail
- [Project44 TMS Platform](https://www.project44.com/platform/tms/) — booking/tendering/dispatch, ML ETAs 95%+/15min, disruption prediction
- [Motive Fleet Management (Tech.co review)](https://tech.co/fleet-management/motive-review) — Vehicle Gateway, ELD telemetry, AI Dashcam
- [Trimble + KeepTruckin + Project44 integration (FreightWaves)](https://www.freightwaves.com/news/trimble-adds-new-features-to-tms-products-integrations-with-keeptruckin-and-project44) — HOS-into-dispatch flow

**TMS feature standards:**
- [Cargoson: What's a TMS? 2026](https://www.cargoson.com/en/blog/what-is-transport-management-system-tms-for-businesses) — table-stakes feature list
- [Coaxsoft: TMS features & integration guide](https://coaxsoft.com/blog/a-complete-guide-to-tms-features-and-integrations) — feature taxonomy
- [Dashdoc: Waybill (CMR) definition](https://www.dashdoc.com/en/glossary/waybill-cmr) — CMR document role
- [Trimble: e-CMR](https://www.trimbletl.com/track-and-trace/e-cmr/) — digital waybill standard
- [FastForwardTMS: Features & Benefits](https://fastforwardtms.com/blogs/tms-for-carriers-guide/) — carrier-side feature priorities
- [Aptean: What to look for in a TMS demo](https://www.aptean.com/en-US/insights/blog/tms-demo-what-to-look-for) — demo evaluation criteria

**Pricing transparency / 2026 regulation:**
- [SONAR bulk trucking rate benchmarks (FreightWaves)](https://www.freightwaves.com/news/sonar-launches-bulk-trucking-contract-rate-benchmarks-via-api-bringing-pricing-transparency-to-one-of-freights-most-opaque-segments) — transparency direction
- [Broker Transparency Law + TMS (EKA)](https://go-eka.com/article/not-a-threat-a-wake-up-call-broker-transparency-law-and-the-tms-advantage/) — 2026 regulatory context

**POD & exception management:**
- [Spoke: Best POD apps 2026](https://spoke.com/dispatch/blog/proof-of-delivery-app) — POD feature set
- [FleetRabbit: Dispatch software](https://fleetrabbit.com/blogs/post/fleet-dispatch-software-loads) — driver-app POD capture
- [Track-POD](https://www.track-pod.com/) — offline POD capture
- [Tive: Top reasons logistics ops fail](https://www.tive.com/blog/top-5-reasons-logistics-operations-fail-how-to-fix-them) — exception alerts
- [Terminal49: Exception alerts](https://terminal49.com/glossary/exception-alerts) — alert taxonomy
- [Tive: ETA alerts](https://support.tive.com/en-us/eta-alerts-enhancing-shipment-visibility) — ETA delay handling

**ADR / cargo classification:**
- [Hellmann: ADR](https://www.hellmann.com/en/adr) — dangerous goods regime
- [LIS: ADR EU dangerous goods regulations](https://www.lis.eu/en/lexikon/adr/) — ADR field requirements
- [Teleroute: Refrigerated transport](https://www.teleroute.com/en-en/community/blog/refrigerated-transport-what-you-must-keep-in-mind/) — iso/ref/heated body type semantics

**RU/UA verification:**
- [Opendatabot — EDRPOU counterparty check (UA)](https://opendatabot.ua/en/open/counterparty-the-check) — UA verification source

**AI/Chatbot logistics:**
- [Beyond Load Boards: chat-based AI dispatcher (Trucksmarter)](https://www.trucksmarter.com/blog/dispatch-chat) — AI dispatcher positioning
- [AI Chatbot for Logistics features (GetMyAI)](https://www.getmyai.ai/blog/ai-chatbot-for-logistics-10-features/) — chatbot feature standards

**Demo best practices:**
- [Aptean: What to look for in a TMS demo](https://www.aptean.com/en-US/insights/blog/tms-demo-what-to-look-for)
- [Guideflow: Sales demo best practices 2026](https://www.guideflow.com/blog/sales-demo-best-practices)

---
*Feature research for: AI-Логист (logistics dispatching, RU/UA, Telegram + LLM + own-fleet + bourse fallback)*
*Researched: 2026-06-08*
