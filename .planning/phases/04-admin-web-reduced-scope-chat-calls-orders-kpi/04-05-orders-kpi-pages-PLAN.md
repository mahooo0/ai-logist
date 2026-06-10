---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 05
type: execute
wave: 3
depends_on: [04-02, 04-03]
files_modified:
  - apps/web/src/app/(main)/dashboard/orders/page.tsx
  - apps/web/src/app/(main)/dashboard/orders/_components/orders-app.tsx
  - apps/web/src/app/(main)/dashboard/orders/_components/orders-table.tsx
  - apps/web/src/app/(main)/dashboard/orders/_components/orders-filters.tsx
  - apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx
  - apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx
  - apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx
  - apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-cards.tsx
  - apps/web/src/app/(main)/dashboard/default/page.tsx
  - apps/web/src/app/(main)/dashboard/default/_components/default-app.tsx
  - apps/web/src/app/(main)/dashboard/default/_components/kpi-tile.tsx
  - apps/web/src/app/(main)/dashboard/analytics/page.tsx
  - apps/web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx
  - apps/web/src/app/(main)/dashboard/analytics/_components/conversion-funnel.tsx
  - apps/web/src/app/(main)/dashboard/analytics/_components/channel-split.tsx
  - apps/web/src/app/(main)/dashboard/analytics/_components/revenue-trend.tsx
  - apps/web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx
  - apps/web/tests/unit/pages-smoke.test.ts
  - apps/api/tests/unit/phase-4-stubs.test.ts
autonomous: true
requirements:
  - ADMIN-05
  - ADMIN-NEW-02
  - ADMIN-NEW-03

must_haves:
  truths:
    - "`apps/web/src/app/(main)/dashboard/orders/page.tsx` is a Server Component (NO 'use client', NO 'use cache' — D-12/D-59) that parses OrderListQuerySchema from `await searchParams` and fetches `/api/orders?...` via apiGet returning `OrderListItem[]` (Plan 04-03 schema)."
    - "`_components/orders-app.tsx` is the SOLE 'use client' boundary; uses SWR with refreshInterval=15000 per D-56 + tab-visibility pause per D-57; filter changes update URL search params via router.push (D-33)."
    - "`_components/orders-table.tsx` renders 7 columns matching D-32: number (`#KU-...`), createdAt (Intl relative), client_name, `from → to` (joined city names), status (color Badge per FSM), price (formatMoney from lib/format), channel badge (voice/telegram derived from lead.channel)."
    - "Row click navigates to `/dashboard/orders/[id]` via Next Link/router (D-34) — NOT a modal."
    - "`apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx` is a Server Component using `await params` (Next.js 16 async params) + `apiGet('/orders/:id', ExtendedOrderDetailSchema)` (Plan 04-03 extends OrderDetailSchema with `client + fromCity + toCity + truck` — D-39)."
    - "`_components/order-detail-app.tsx` renders header (number + status badge + price) + 2-column layout (Left: client/route/truck/cargo cards; Right: vertical timeline of order_events per D-36). NO actions in v1 (D-37) — read-only."
    - "`_components/order-timeline.tsx` renders stacked entries with type icon (lucide-react) + actor pill (ai/manager/system) + Intl timestamp + payload `<details>`-wrapped JSON pretty-print (D-36)."
    - "Source channel breadcrumb at top of order detail (D-38): voice → 'Прослушать звонок' button linking to `/dashboard/calls?openCall=<callId>`; Telegram → 'Открыть диалог' button linking to `/dashboard/chat?clientId=<clientId>`."
    - "`apps/web/src/app/(main)/dashboard/default/page.tsx` is a Server Component, MAY use `'use cache'` with `cacheLife('minutes')` per D-13 (KPI aggregated, not realtime); fetches `/api/analytics/kpi?window=week` + last 5 calls (`/api/calls?limit=5`) + last 5 orders (`/api/orders?limit=5`) — D-40."
    - "`_components/default-app.tsx` renders compact KPI tiles + last-5 lists (calls + orders); no recharts — those live in /analytics."
    - "`apps/web/src/app/(main)/dashboard/analytics/page.tsx` Server Component; MAY use `'use cache'` per D-13; fetches KPI by `?window=` query param (default 'week'); passes to `<AnalyticsApp>` (D-41)."
    - "`_components/analytics-app.tsx` is `'use client'` boundary mounting recharts components (recharts requires client boundary — Pitfall #6); renders 5 charts per D-41: calls per day bar (7/30d), conversion funnel vertical, channel split donut, revenue line, avg call duration big number + sparkline. All from recharts (already in Zenith — D-42)."
    - "`_components/window-selector.tsx` is `'use client'`; renders `day | week | month` toggle; on change updates URL `?window=` param via `router.push` (D-43)."
    - "All visible UI strings flow through `useT()`; recharts axis labels use `formatDate` + `formatMoney` from `lib/format.ts`."
    - "Pitfall #13 grep guards from Wave 0 still PASS on new pages (no `'use cache'` on /orders dynamic pages; `'use cache'` ALLOWED on /default + /analytics per D-13; no bare `border`; page.tsx is server)."
    - "`pages-smoke.test.ts` flips 4 todos to it() — orders + order-detail + default + analytics smoke tests; 0 todos remain in pages-smoke (chat + calls were flipped in Plan 04-04)."
    - "3 stub markers in `phase-4-stubs.test.ts` flip: ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05. Marker count: 3 → 0."
    - "`pnpm --filter @ai-logist/web build` exits 0; Next.js generates all 6 dashboard pages (default, analytics, chat, calls, orders, orders/[id])."
  artifacts:
    - path: "apps/web/src/app/(main)/dashboard/orders/page.tsx"
      provides: "Server Component fetching initial OrderListItem[] via apiGet"
      contains: "apiGet,OrderListItemSchema,async function,searchParams"
    - path: "apps/web/src/app/(main)/dashboard/orders/_components/orders-app.tsx"
      provides: "'use client' SWR + filters + table orchestration"
      contains: "'use client',useSWR,refreshInterval: 15"
      min_lines: 60
    - path: "apps/web/src/app/(main)/dashboard/orders/_components/orders-table.tsx"
      provides: "@tanstack/react-table with D-32 columns"
      contains: "useReactTable,formatMoney,from,to,status,channel"
    - path: "apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx"
      provides: "Server Component with await params + extended order detail fetch"
      contains: "await params,apiGet,OrderDetailSchema"
    - path: "apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx"
      provides: "Read-only detail layout — header + 2 columns + timeline"
      contains: "channel,Прослушать,Открыть"
    - path: "apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx"
      provides: "Vertical event timeline with actor pills + payload details"
      contains: "order_events,actor,payload"
    - path: "apps/web/src/app/(main)/dashboard/default/page.tsx"
      provides: "Server Component with cacheLife minutes + KPI + last-5 lists"
      contains: "apiGet,KpiResponseSchema"
    - path: "apps/web/src/app/(main)/dashboard/analytics/page.tsx"
      provides: "Server Component with cacheLife minutes + KPI window fetch"
      contains: "apiGet,KpiResponseSchema,window"
    - path: "apps/web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx"
      provides: "'use client' recharts boundary — 5 charts"
      contains: "'use client',BarChart,LineChart,PieChart,ResponsiveContainer"
      min_lines: 80
    - path: "apps/web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx"
      provides: "'use client' day/week/month toggle"
      contains: "'use client',day,week,month,router.push"
  key_links:
    - from: "orders-app.tsx"
      to: "GET /api/orders (Plan 04-03 handler)"
      via: "apiGet + SWR consume joined list"
      pattern: "/api/orders"
    - from: "order-detail-app.tsx"
      to: "GET /api/orders/:id (Plan 04-03 extended detail)"
      via: "apiGet inside Server Component, props down"
      pattern: "/orders/"
    - from: "default-app.tsx + analytics-app.tsx"
      to: "GET /api/analytics/kpi (Plan 04-03 handler)"
      via: "apiGet with ?window= param"
      pattern: "/api/analytics/kpi"
    - from: "Order detail channel breadcrumb"
      to: "/dashboard/chat?clientId=... OR /dashboard/calls?openCall=..."
      via: "Next Link with derived URL"
      pattern: "/dashboard/chat,/dashboard/calls"
---

<objective>
Land the three remaining frontend surfaces: `/dashboard/orders` (table with filters), `/dashboard/orders/[id]` (read-only detail with timeline + channel breadcrumb), `/dashboard/default` (compact KPI tiles + last-5 lists), `/dashboard/analytics` (full recharts dashboards). Together they close ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05 — the last three Phase 4 requirements that close the marker count to 0.

Purpose:
- Build `/dashboard/orders` consuming the joined list endpoint from Plan 04-03 (city names + client + channel) — D-32..D-35.
- Build `/dashboard/orders/[id]` as a read-only detail (NO actions in v1 — D-37); 2-column layout + vertical event timeline + source-channel breadcrumb.
- Rewire Zenith's `/dashboard/default` to our `/api/analytics/kpi` — compact tiles + last-5 lists (D-40).
- Rewire `/dashboard/analytics` to render recharts dashboards (D-41) — 5 charts driven by the extended `KpiResponseSchema` from Plan 04-03.
- Use Pitfall #13 escape: `'use cache'` IS allowed on /default + /analytics (D-13 — KPI is aggregated) but BANNED on /orders (D-12 — dynamic).
- Window selector at top of /analytics — day/week/month — uses `router.push` to update URL `?window=`.
- All UI strings via `useT()`; recharts axis labels via `formatDate` + `formatMoney`.
- Flip 4 pages-smoke todos to it() + 3 stub markers (ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05). Marker count: 3 → 0.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@apps/web/VENDOR.md
@apps/web/src/app/\(main\)/dashboard/default/page.tsx
@apps/web/src/app/\(main\)/dashboard/analytics/page.tsx
@apps/web/src/lib/api.ts
@apps/web/src/lib/format.ts
@apps/web/src/lib/i18n/dict.ts
@apps/api/src/routes/orders.ts
@apps/api/src/routes/analytics.ts
@packages/shared-types/src/api/orders.ts
@packages/shared-types/src/api/analytics.ts

<interfaces>
<!-- Backend endpoints consumed by this plan (all live after Plan 04-03): -->
<!--   GET /api/orders?status=&channel=&from=&to=&limit=&offset= → OrderListItem[] -->
<!--   GET /api/orders/:id → ExtendedOrderDetail = { order, events, client, fromCity, toCity, truck } -->
<!--   GET /api/analytics/kpi?window=day|week|month → KpiResponse (extended per D-44) -->
<!--   GET /api/calls?limit=5 → Call[] (for /default "last 5 calls" — Plan 04-04 endpoint) -->
<!--
<!-- Key D-codes for this plan:
<!--   D-13: /default + /analytics CAN use 'use cache' with cacheLife('minutes')
<!--   D-32: orders table columns: #KU- / createdAt / client_name / from→to / status / price / channel
<!--   D-34: row click → navigate (not modal)
<!--   D-36: order detail = header + 2 cols + vertical event timeline
<!--   D-37: NO actions in v1 — read-only
<!--   D-38: channel breadcrumb (voice/telegram → links)
<!--   D-40: /default = compact KPI tiles + last-5 calls + last-5 orders
<!--   D-41: /analytics = 5 charts (calls per day bar, conversion funnel, channel split donut, revenue line, avg call duration big number + sparkline)
<!--   D-43: window selector day|week|month → updates ?window=
<!--   D-44: KpiResponseSchema extended with avgCallDurationS + byChannel + conversionFunnel
<!--   D-56: polling intervals — /orders 15s, /order-detail 10s, /default + /analytics 60s
<!--   D-57: tab-visibility-aware pause

<!-- RESEARCH Pattern 6 — Recharts is client-only (requires 'use client'); fetch on server, pass data down. -->
<!-- RESEARCH Pattern 5 — Next.js 16 async params/searchParams — must `await` -->

<!-- Zenith's existing /default and /analytics pages may already render charts with mock data; -->
<!-- audit them on Step 1 and rewrite to consume our API. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /dashboard/orders + /dashboard/orders/[id] (ADMIN-NEW-02 + ADMIN-NEW-03)</name>
  <files>
    apps/web/src/app/(main)/dashboard/orders/page.tsx,
    apps/web/src/app/(main)/dashboard/orders/_components/orders-app.tsx,
    apps/web/src/app/(main)/dashboard/orders/_components/orders-table.tsx,
    apps/web/src/app/(main)/dashboard/orders/_components/orders-filters.tsx,
    apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx,
    apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx,
    apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx,
    apps/web/src/app/(main)/dashboard/orders/[id]/_components/order-cards.tsx
  </files>
  <read_first>
    apps/web/src/components/ui/table.tsx,
    apps/web/src/components/ui/badge.tsx,
    apps/web/src/components/ui/button.tsx,
    apps/web/src/components/ui/select.tsx,
    apps/web/src/lib/api.ts,
    apps/web/src/lib/format.ts,
    apps/web/src/lib/i18n/dict.ts,
    packages/shared-types/src/api/orders.ts,
    apps/api/src/routes/orders.ts,
    apps/web/VENDOR.md
  </read_first>
  <behavior>
    - `/orders/page.tsx` (Server): parses OrderListQuerySchema from `await searchParams`; fetches `/api/orders?...` via apiGet; passes to `<OrdersApp>`.
    - `<OrdersApp>` (Client): SWR with refreshInterval=15000 + tab-visibility pause; filter changes update URL via router.push.
    - `<OrdersTable>`: @tanstack/react-table with D-32 columns; row click → `router.push('/dashboard/orders/' + row.original.id)`.
    - `<OrdersFilters>`: status multi-select, channel select (voice/telegram/all), date range presets. URL search params bookmarkable.
    - `/orders/[id]/page.tsx` (Server): awaits `params` → `apiGet('/orders/:id', ExtendedOrderDetailSchema)`; passes to `<OrderDetailApp>`.
    - `<OrderDetailApp>`: header (number + status + price) + grid 2 columns; Left = `<OrderCards>` (client/route/truck/cargo); Right = `<OrderTimeline>` (vertical event list). NO actions.
    - Channel breadcrumb at top: voice lead → "Прослушать звонок" link; telegram lead → "Открыть диалог" link.
    - All strings via `useT()`; money via `formatMoney`; dates via `formatDate`.
  </behavior>
  <action>
Step 1 — Create `apps/web/src/app/(main)/dashboard/orders/page.tsx`:

```tsx
// apps/web/src/app/(main)/dashboard/orders/page.tsx — Phase 4 ADMIN-NEW-02
// Server Component — NO 'use client', NO 'use cache' (D-12 — orders is dynamic).
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { OrderListItemSchema, OrderListQuerySchema } from '@ai-logist/shared-types/api/orders';
import { OrdersApp } from './_components/orders-app';

export const metadata: Metadata = { title: 'Заказы' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const parsed = OrderListQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : { limit: 50, offset: 0 };
  const qs = new URLSearchParams(query as Record<string, string>).toString();

  let initial: import('@ai-logist/shared-types/api/orders').OrderListItem[] = [];
  try {
    initial = await apiGet(`/orders?${qs}`, z.array(OrderListItemSchema));
  } catch {
    initial = [];
  }

  return (
    <div className="space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Заказы</h1>
        <p className="text-muted-foreground text-sm">
          Заказы из голосового и Telegram канала
        </p>
      </header>
      <OrdersApp initialOrders={initial} initialQuery={query as Record<string, string>} />
    </div>
  );
}
```

Step 2 — Create `_components/orders-app.tsx`:

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
import { OrdersFilters } from './orders-filters';
import { OrdersTable } from './orders-table';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function OrdersApp({
  initialOrders,
  initialQuery,
}: {
  initialOrders: OrderListItem[];
  initialQuery: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString() || new URLSearchParams(initialQuery).toString();

  const { data: orders = initialOrders } = useSWR<OrderListItem[]>(
    `/api/orders?${qs}`,
    fetcher,
    {
      fallbackData: initialOrders,
      refreshInterval: 15_000, // D-56
      revalidateOnFocus: true,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    },
  );

  function onFilterChange(next: Record<string, string>) {
    const p = new URLSearchParams(next);
    router.push(`/dashboard/orders?${p.toString()}`);
  }

  function onRowClick(orderId: string) {
    router.push(`/dashboard/orders/${orderId}`);
  }

  return (
    <div className="space-y-4">
      <OrdersFilters value={Object.fromEntries(searchParams.entries())} onChange={onFilterChange} />
      <OrdersTable orders={orders} onRowClick={onRowClick} />
    </div>
  );
}
```

Step 3 — Create `_components/orders-table.tsx` with D-32 columns:

```tsx
'use client';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';
import { useT } from '@/lib/i18n/use-t';

const statusStyles: Record<string, string> = {
  CREATED: 'bg-slate-600',
  DRIVER_ASSIGNED: 'bg-blue-600',
  AT_LOADING: 'bg-cyan-600',
  IN_TRANSIT: 'bg-amber-600',
  AT_BORDER: 'bg-orange-600',
  DELIVERED: 'bg-green-600',
  CLOSED: 'bg-zinc-500',
};

const channelStyles: Record<string, string> = {
  voice: 'bg-purple-600',
  telegram: 'bg-green-600',
  call: 'bg-purple-600',
};

export function OrdersTable({
  orders,
  onRowClick,
}: {
  orders: OrderListItem[];
  onRowClick: (orderId: string) => void;
}) {
  const t = useT();

  const columns: ColumnDef<OrderListItem>[] = [
    {
      header: 'Номер',
      accessorKey: 'number',
      cell: ({ row }) => <span className="font-mono">{row.original.number}</span>,
    },
    {
      header: 'Создан',
      accessorKey: 'createdAt',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt, 'ru')}</span>,
    },
    {
      header: 'Клиент',
      accessorKey: 'clientName',
      cell: ({ row }) => <span className="text-sm">{row.original.clientName ?? '—'}</span>,
    },
    {
      header: 'Маршрут',
      accessorKey: 'fromCityName',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.fromCityName ?? '—'} → {row.original.toCityName ?? '—'}
        </span>
      ),
    },
    {
      header: 'Статус',
      accessorKey: 'status',
      cell: ({ row }) => (
        <Badge className={`${statusStyles[row.original.status] ?? ''} text-white`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      header: 'Цена',
      accessorKey: 'price',
      cell: ({ row }) => <span className="font-mono">{formatMoney(row.original.price, 'ru')}</span>,
    },
    {
      header: 'Канал',
      accessorKey: 'channel',
      cell: ({ row }) => (
        <Badge className={`${channelStyles[row.original.channel ?? ''] ?? ''} text-white`}>
          {row.original.channel ?? '—'}
        </Badge>
      ),
    },
  ];

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid="order-row"
            className="cursor-pointer hover:bg-accent"
            onClick={() => onRowClick(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Step 4 — Create `_components/orders-filters.tsx` (status multi-select + channel select + date range presets). Use `<Select>` from `@/components/ui/select`. URL params shape: `?status=CREATED&channel=voice&from=...&to=...`. On change call `onChange(newParams)`.

Step 5 — Create `apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx`:

```tsx
// apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx — Phase 4 ADMIN-NEW-03
// Server Component — Next.js 16 async params + NO 'use cache' (D-12 — order detail can flip status from voice/telegram).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { ExtendedOrderDetailSchema } from '@ai-logist/shared-types/api/orders';
import { OrderDetailApp } from './_components/order-detail-app';

export const metadata: Metadata = { title: 'Заказ' };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // Next.js 16 async params (RESEARCH Pattern 5)

  let detail;
  try {
    detail = await apiGet(`/orders/${id}`, ExtendedOrderDetailSchema);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-4 p-4">
      <OrderDetailApp detail={detail!} />
    </div>
  );
}
```

Step 6 — Create `_components/order-detail-app.tsx`:

```tsx
'use client';
import useSWR from 'swr';
import type { ExtendedOrderDetail } from '@ai-logist/shared-types/api/orders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { OrderCards } from './order-cards';
import { OrderTimeline } from './order-timeline';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function OrderDetailApp({ detail }: { detail: ExtendedOrderDetail }) {
  const { data = detail } = useSWR<ExtendedOrderDetail>(
    `/api/orders/${detail.order.id}`,
    fetcher,
    {
      fallbackData: detail,
      refreshInterval: 10_000, // D-56
      revalidateOnFocus: true,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    },
  );

  const { order, client, fromCity, toCity, truck, events, lead } = data;

  // D-38 — Channel breadcrumb
  const channel = lead?.channel ?? null;
  const linkedCallId = events.find((e) => e.payload && (e.payload as Record<string, unknown>).call_id)
    ?.payload?.call_id as string | undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl tracking-tight">{order.number}</h1>
          <Badge>{order.status}</Badge>
          <span className="font-mono text-lg">{formatMoney(order.price, 'ru')}</span>
        </div>
        {channel === 'voice' || channel === 'call' ? (
          <Button asChild variant="outline" size="sm" data-testid="open-call">
            <a href={linkedCallId ? `/dashboard/calls?openCall=${linkedCallId}` : '/dashboard/calls'}>
              Прослушать звонок
            </a>
          </Button>
        ) : channel === 'telegram' ? (
          <Button asChild variant="outline" size="sm" data-testid="open-chat">
            <a href={`/dashboard/chat?clientId=${client?.id ?? order.clientId}`}>
              Открыть диалог
            </a>
          </Button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <OrderCards order={order} client={client} fromCity={fromCity} toCity={toCity} truck={truck} />
        <OrderTimeline events={events} />
      </div>
    </div>
  );
}
```

Step 7 — Create `_components/order-timeline.tsx`:

```tsx
import type { OrderEvent } from '@ai-logist/shared-types/api/orders';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';

const actorColor: Record<string, string> = {
  ai: 'bg-blue-600',
  manager: 'bg-purple-600',
  system: 'bg-zinc-600',
};

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <div className="space-y-3 rounded-lg border-border border p-4">
      <h2 className="font-semibold text-lg">События</h2>
      <ol className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="border-border border-l-2 pl-3" data-testid="timeline-event">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{ev.type}</span>
              <Badge className={`${actorColor[ev.actor] ?? ''} text-white text-xs`}>{ev.actor}</Badge>
              <span className="text-muted-foreground text-xs">{formatDate(ev.createdAt, 'ru')}</span>
            </div>
            {ev.payload && Object.keys(ev.payload).length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground text-xs">payload</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(ev.payload, null, 2)}
                </pre>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

Step 8 — Create `_components/order-cards.tsx` (Left column: 4 cards — client, route, truck, cargo). Each card is a `<div className="rounded-lg border-border border p-4">` with header + key-value pairs. NO actions (D-37).

Step 9 — Verify Wave 0 static-rules grep guards still pass:
```bash
cd apps/web && pnpm test -t "static-rules" 2>&1
```

Commit message: `feat(04-05): /dashboard/orders + /orders/[id] (ADMIN-NEW-02 + ADMIN-NEW-03)`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/app/\(main\)/dashboard/orders/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/_components/orders-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/_components/orders-table.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/_components/orders-filters.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/\[id\]/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/\[id\]/_components/order-detail-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/\[id\]/_components/order-timeline.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/orders/\[id\]/_components/order-cards.tsx && \
! grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/orders/page.tsx && \
! grep -q "'use cache'" apps/web/src/app/\(main\)/dashboard/orders/page.tsx && \
! grep -q "'use cache'" apps/web/src/app/\(main\)/dashboard/orders/\[id\]/page.tsx && \
grep -q "refreshInterval: 15" apps/web/src/app/\(main\)/dashboard/orders/_components/orders-app.tsx && \
grep -q "useReactTable" apps/web/src/app/\(main\)/dashboard/orders/_components/orders-table.tsx && \
grep -q "await params" apps/web/src/app/\(main\)/dashboard/orders/\[id\]/page.tsx && \
grep -q "Прослушать\|Открыть" apps/web/src/app/\(main\)/dashboard/orders/\[id\]/_components/order-detail-app.tsx && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test -t "static-rules" 2>&1 | grep -E "passed"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/(main)/dashboard/orders/page.tsx` exists, is a Server Component (NO `'use client'`), uses `await searchParams`, calls `apiGet` with `OrderListItemSchema`
    - `_components/orders-app.tsx` contains `'use client'` AND `useSWR` AND `refreshInterval: 15_000` AND `router.push('/dashboard/orders/'` (row click navigation per D-34)
    - `_components/orders-table.tsx` uses `useReactTable` + 7 columns matching D-32 (number, createdAt, clientName, fromCityName→toCityName, status, price, channel)
    - `_components/orders-filters.tsx` exists with status + channel + date range; calls `onChange(newParams)` on filter changes
    - `apps/web/src/app/(main)/dashboard/orders/[id]/page.tsx` uses `await params` (Next.js 16 async params); calls `apiGet` with `ExtendedOrderDetailSchema`
    - `_components/order-detail-app.tsx` shows header (number + status + price), channel breadcrumb ("Прослушать звонок" for voice, "Открыть диалог" for telegram), 2-column grid, NO action buttons besides the breadcrumb link
    - `_components/order-timeline.tsx` renders `order_events` with type + actor badge + timestamp + payload `<details>`
    - `_components/order-cards.tsx` renders 4 cards (client, route, truck, cargo) read-only
    - All UI strings flow through `useT()` or `formatMoney`/`formatDate` from `lib/format.ts`
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - All 5 static-rules grep guards from Wave 0 remain green (no `'use cache'` on /orders pages; no bare `border`; no sync `cookies()`; no `'use client'` on page.tsx)
  </acceptance_criteria>
  <done>
/dashboard/orders + /orders/[id] fully implemented: list with 7 columns + filters + URL params; detail with header + breadcrumb + 2 cols + timeline. Read-only (D-37). All Wave 0 guards green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /dashboard/default + /dashboard/analytics (ADMIN-05) + recharts + window selector</name>
  <files>
    apps/web/src/app/(main)/dashboard/default/page.tsx,
    apps/web/src/app/(main)/dashboard/default/_components/default-app.tsx,
    apps/web/src/app/(main)/dashboard/default/_components/kpi-tile.tsx,
    apps/web/src/app/(main)/dashboard/analytics/page.tsx,
    apps/web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx,
    apps/web/src/app/(main)/dashboard/analytics/_components/conversion-funnel.tsx,
    apps/web/src/app/(main)/dashboard/analytics/_components/channel-split.tsx,
    apps/web/src/app/(main)/dashboard/analytics/_components/revenue-trend.tsx,
    apps/web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx
  </files>
  <read_first>
    apps/web/src/app/(main)/dashboard/default/page.tsx,
    apps/web/src/app/(main)/dashboard/analytics/page.tsx,
    apps/web/src/components/ui/card.tsx,
    apps/web/src/components/ui/badge.tsx,
    apps/web/src/lib/api.ts,
    apps/web/src/lib/format.ts,
    apps/web/src/lib/i18n/dict.ts,
    packages/shared-types/src/api/analytics.ts,
    apps/api/src/routes/analytics.ts
  </read_first>
  <behavior>
    - `/default/page.tsx` (Server, MAY use `'use cache'` per D-13): fetches KPI (`?window=week`) + last 5 calls (`/api/calls?limit=5`) + last 5 orders (`/api/orders?limit=5`). Passes to `<DefaultApp>`.
    - `<DefaultApp>`: compact KPI tiles (using `<KpiTile>`) + 2 lists (last calls, last orders). No recharts here.
    - `/analytics/page.tsx` (Server, MAY use `'use cache'`): parses `?window=` from `await searchParams`; fetches KPI; passes to `<AnalyticsApp>`.
    - `<AnalyticsApp>` (`'use client'` — recharts needs client per Pitfall #6): renders 5 charts (D-41) — calls per day bar, conversion funnel, channel split donut, revenue line, avg call duration big number + sparkline. Includes `<WindowSelector>` at top.
    - `<WindowSelector>` (`'use client'`): day/week/month toggle; `router.push('/dashboard/analytics?window=' + value)`.
    - All chart labels via `formatDate` + `formatMoney`.
    - Flip 4 todos in pages-smoke (orders + order-detail + default + analytics smoke tests).
    - Flip 3 stub markers (ADMIN-NEW-02 + ADMIN-NEW-03 + ADMIN-05). Marker count: 3 → 0.
  </behavior>
  <action>
Step 1 — Audit Zenith's existing /default + /analytics pages (Pitfall #9):
```bash
cat apps/web/src/app/\(main\)/dashboard/default/page.tsx
cat apps/web/src/app/\(main\)/dashboard/analytics/page.tsx
```
Document in commit message — likely Zenith ships mock-data pages we replace.

Step 2 — Create `apps/web/src/app/(main)/dashboard/default/page.tsx`:

```tsx
// apps/web/src/app/(main)/dashboard/default/page.tsx — Phase 4 ADMIN-05 (KPI manager landing)
// Server Component — MAY use 'use cache' per D-13 (KPI aggregated).
import 'server-only';
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { CallSchema } from '@ai-logist/shared-types/api/calls';
import { OrderListItemSchema } from '@ai-logist/shared-types/api/orders';
import { DefaultApp } from './_components/default-app';

export const metadata: Metadata = { title: 'Сводка' };

export default async function DefaultPage() {
  const [kpi, lastCalls, lastOrders] = await Promise.all([
    apiGet('/analytics/kpi?window=week', KpiResponseSchema).catch(
      () => null as ReturnType<typeof KpiResponseSchema.parse> | null,
    ),
    apiGet('/calls?limit=5&offset=0', z.array(CallSchema)).catch(() => []),
    apiGet('/orders?limit=5&offset=0', z.array(OrderListItemSchema)).catch(() => []),
  ]);

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="font-bold text-2xl tracking-tight">Сводка</h1>
        <p className="text-muted-foreground text-sm">Ключевые показатели за неделю</p>
      </header>
      <DefaultApp kpi={kpi} lastCalls={lastCalls} lastOrders={lastOrders} />
    </div>
  );
}
```

Step 3 — Create `_components/default-app.tsx` + `_components/kpi-tile.tsx`:

```tsx
// kpi-tile.tsx
import { Badge } from '@/components/ui/badge';

export function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1 rounded-lg border-border border bg-card p-4">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-bold text-2xl">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}
```

```tsx
// default-app.tsx
import type { KpiResponse } from '@ai-logist/shared-types/api/analytics';
import type { Call } from '@ai-logist/shared-types/api/calls';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
import { formatDate, formatMoney } from '@/lib/format';
import { KpiTile } from './kpi-tile';

export function DefaultApp({
  kpi,
  lastCalls,
  lastOrders,
}: {
  kpi: KpiResponse | null;
  lastCalls: Call[];
  lastOrders: OrderListItem[];
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile label="Звонки" value={String(kpi?.calls?.total ?? 0)} hint={`${kpi?.calls?.answered ?? 0} отвечено`} />
        <KpiTile label="Лиды" value={String(kpi?.leads?.total ?? 0)} />
        <KpiTile label="Заказы" value={String(kpi?.orders?.created ?? 0)} hint={`${kpi?.orders?.delivered ?? 0} доставлено`} />
        <KpiTile label="Выручка" value={formatMoney(kpi?.revenue?.amount ?? '0', 'ru')} />
      </section>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border-border border p-4">
          <h2 className="mb-3 font-semibold">Последние звонки</h2>
          <ul className="space-y-2">
            {lastCalls.map((c) => (
              <li key={c.id} className="flex justify-between text-sm">
                <span>{formatDate(c.createdAt, 'ru')}</span>
                <span className="text-muted-foreground">{c.outcome ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border-border border p-4">
          <h2 className="mb-3 font-semibold">Последние заказы</h2>
          <ul className="space-y-2">
            {lastOrders.map((o) => (
              <li key={o.id} className="flex justify-between text-sm">
                <span className="font-mono">{o.number}</span>
                <span>{formatMoney(o.price, 'ru')}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
```

Step 4 — Create `apps/web/src/app/(main)/dashboard/analytics/page.tsx`:

```tsx
// apps/web/src/app/(main)/dashboard/analytics/page.tsx — Phase 4 ADMIN-05
// Server Component — MAY use 'use cache' per D-13.
import 'server-only';
import type { Metadata } from 'next';
import { apiGet } from '@/lib/api';
import { KpiResponseSchema } from '@ai-logist/shared-types/api/analytics';
import { AnalyticsApp } from './_components/analytics-app';

export const metadata: Metadata = { title: 'Аналитика' };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: 'day' | 'week' | 'month' }>;
}) {
  const params = await searchParams;
  const window = params.window ?? 'week';

  let kpi;
  try {
    kpi = await apiGet(`/analytics/kpi?window=${window}`, KpiResponseSchema);
  } catch {
    kpi = null;
  }

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="font-bold text-2xl tracking-tight">Аналитика</h1>
        <p className="text-muted-foreground text-sm">Воронка конверсии, выручка, по каналам</p>
      </header>
      <AnalyticsApp kpi={kpi} window={window} />
    </div>
  );
}
```

Step 5 — Create `_components/window-selector.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const WINDOWS = ['day', 'week', 'month'] as const;

export function WindowSelector({ value }: { value: 'day' | 'week' | 'month' }) {
  const router = useRouter();
  return (
    <div className="flex gap-1" data-testid="window-selector">
      {WINDOWS.map((w) => (
        <Button
          key={w}
          variant={value === w ? 'default' : 'outline'}
          size="sm"
          onClick={() => router.push(`/dashboard/analytics?window=${w}`)}
        >
          {w === 'day' ? 'День' : w === 'week' ? 'Неделя' : 'Месяц'}
        </Button>
      ))}
    </div>
  );
}
```

Step 6 — Create `_components/analytics-app.tsx`:

```tsx
'use client';
// Recharts requires 'use client' — Pitfall #6.
import type { KpiResponse } from '@ai-logist/shared-types/api/analytics';
import { WindowSelector } from './window-selector';
import { ConversionFunnel } from './conversion-funnel';
import { ChannelSplit } from './channel-split';
import { RevenueTrend } from './revenue-trend';
import { formatMoney } from '@/lib/format';

export function AnalyticsApp({
  kpi,
  window,
}: {
  kpi: KpiResponse | null;
  window: 'day' | 'week' | 'month';
}) {
  if (!kpi) {
    return <div className="text-muted-foreground">Нет данных</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">Период:</div>
        <WindowSelector value={window} />
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Ср. длительность звонка</div>
          <div className="font-bold text-2xl">
            {kpi.avgCallDurationS ? `${Math.floor(kpi.avgCallDurationS / 60)}:${String(Math.floor((kpi.avgCallDurationS ?? 0) % 60)).padStart(2, '0')}` : '—'}
          </div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Выручка</div>
          <div className="font-bold text-2xl">{formatMoney(kpi.revenue.amount, 'ru')}</div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Заказы</div>
          <div className="font-bold text-2xl">{kpi.orders.created}</div>
        </div>
        <div className="rounded-lg border-border border bg-card p-4">
          <div className="text-muted-foreground text-sm">Доставлено</div>
          <div className="font-bold text-2xl">{kpi.orders.delivered}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ConversionFunnel funnel={kpi.conversionFunnel} />
        <ChannelSplit byChannel={kpi.byChannel} />
      </div>
      <RevenueTrend amount={kpi.revenue.amount} window={window} />
    </div>
  );
}
```

Step 7 — Create `_components/conversion-funnel.tsx`, `_components/channel-split.tsx`, `_components/revenue-trend.tsx` — all `'use client'` and using recharts (`BarChart`, `PieChart`, `LineChart`, `ResponsiveContainer`) from the `recharts` package (already in Zenith deps).

```tsx
// conversion-funnel.tsx
'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function ConversionFunnel({
  funnel,
}: {
  funnel: { calls: number; answered: number; leadsCreated: number; ordersConfirmed: number; delivered: number } | null;
}) {
  if (!funnel) return <div className="text-muted-foreground">—</div>;
  const data = [
    { stage: 'Звонки', count: funnel.calls },
    { stage: 'Отвечено', count: funnel.answered },
    { stage: 'Лиды', count: funnel.leadsCreated },
    { stage: 'Заказы', count: funnel.ordersConfirmed },
    { stage: 'Доставлено', count: funnel.delivered },
  ];
  return (
    <div className="rounded-lg border-border border bg-card p-4">
      <h2 className="mb-3 font-semibold">Воронка конверсии</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="stage" type="category" />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

Implement `channel-split.tsx` similarly using `PieChart` + `Pie` + `Cell` with voice/telegram counts.
Implement `revenue-trend.tsx` using `LineChart` + `Line` — for v1 it's fine to render a single-point line with the total revenue (real time-series aggregation is Phase 5 polish — D-44 doesn't require time-series; the chart visualizes the window's total).

Step 8 — Flip 4 todos in `apps/web/tests/unit/pages-smoke.test.ts`:

```ts
it('/dashboard/orders renders rows from initial fetch', async () => {
  const { OrdersApp } = await import('@/app/(main)/dashboard/orders/_components/orders-app');
  const { render, screen } = await import('../_helpers/render');
  render(
    <OrdersApp
      initialOrders={[
        {
          id: 'a1', number: '#KU-0001', leadId: null, clientId: 'c1', truckId: null,
          fromCityId: null, toCityId: null, fromCityName: 'Киев', toCityName: 'Львов',
          clientName: 'Acme', channel: 'voice', distanceKm: null,
          price: '420000', currency: 'RUB', status: 'CREATED', publicToken: 't',
          version: 0, createdAt: '2026-06-10T10:00:00Z', updatedAt: '2026-06-10T10:00:00Z',
        },
      ]}
      initialQuery={{}}
    />,
  );
  expect(screen.getByText(/Киев/)).toBeTruthy();
});

it('/dashboard/orders/[id] renders detail with breadcrumb for voice lead', async () => { /* ... */ });
it('/dashboard/default renders KPI tiles', async () => { /* ... */ });
it('/dashboard/analytics renders WindowSelector + recharts boundary', async () => { /* ... */ });
```

Step 9 — Flip 3 stub markers in `apps/api/tests/unit/phase-4-stubs.test.ts`:

```ts
it('ADMIN-NEW-02: /dashboard/orders renders table with 7 columns including channel + city names + price', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  const pagePath = `${cwd}/../web/src/app/(main)/dashboard/orders/page.tsx`;
  expect(existsSync(pagePath)).toBe(true);
  const page = readFileSync(pagePath, 'utf8');
  expect(page).not.toMatch(/^'use client'/m);
  expect(page).toMatch(/OrderListItemSchema/);
  const table = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/orders/_components/orders-table.tsx`, 'utf8');
  expect(table).toMatch(/useReactTable|getCoreRowModel/);
  expect(table).toMatch(/formatMoney/);
  expect(table).toMatch(/channel/);
});

it('ADMIN-NEW-03: /dashboard/orders/[id] renders read-only detail with channel breadcrumb + timeline', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  const pagePath = `${cwd}/../web/src/app/(main)/dashboard/orders/[id]/page.tsx`;
  expect(existsSync(pagePath)).toBe(true);
  const page = readFileSync(pagePath, 'utf8');
  expect(page).toMatch(/await params/);
  expect(page).toMatch(/ExtendedOrderDetailSchema/);
  const app = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/orders/[id]/_components/order-detail-app.tsx`, 'utf8');
  expect(app).toMatch(/Прослушать|Открыть/);
  const timeline = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/orders/[id]/_components/order-timeline.tsx`, 'utf8');
  expect(timeline).toMatch(/actor|order_events|events/);
});

it('ADMIN-05: /dashboard/default + /dashboard/analytics render KPI from /api/analytics/kpi with window selector', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  const defPath = `${cwd}/../web/src/app/(main)/dashboard/default/page.tsx`;
  const anPath = `${cwd}/../web/src/app/(main)/dashboard/analytics/page.tsx`;
  expect(existsSync(defPath)).toBe(true);
  expect(existsSync(anPath)).toBe(true);
  const def = readFileSync(defPath, 'utf8');
  expect(def).toMatch(/KpiResponseSchema/);
  const an = readFileSync(anPath, 'utf8');
  expect(an).toMatch(/await searchParams/);
  expect(an).toMatch(/KpiResponseSchema/);
  const anApp = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/analytics/_components/analytics-app.tsx`, 'utf8');
  expect(anApp).toMatch(/'use client'/);
  const ws = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/analytics/_components/window-selector.tsx`, 'utf8');
  expect(ws).toMatch(/router\.push.*window=/);
});
```

Marker count: 3 → 0.

Commit message: `feat(04-05): /default + /analytics + 4 stub flips (ADMIN-NEW-02/03 + ADMIN-05) — Phase 4 marker count 0`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/app/\(main\)/dashboard/default/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/default/_components/default-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/_components/analytics-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/_components/conversion-funnel.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/_components/channel-split.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/_components/revenue-trend.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/analytics/_components/window-selector.tsx && \
! grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/default/page.tsx && \
! grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/analytics/page.tsx && \
grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/analytics/_components/analytics-app.tsx && \
grep -q "ResponsiveContainer\|BarChart\|LineChart\|PieChart" apps/web/src/app/\(main\)/dashboard/analytics/_components/analytics-app.tsx && \
grep -q "router.push.*window=" apps/web/src/app/\(main\)/dashboard/analytics/_components/window-selector.tsx && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test 2>&1 | grep -E "passed" | tail -2 && \
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "13 passed|0 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - `/default/page.tsx` is a Server Component fetching KPI + last calls + last orders via apiGet, passing to `<DefaultApp>`
    - `_components/default-app.tsx` renders 4 KPI tiles (calls/leads/orders/revenue) + 2 lists (last calls + last orders)
    - `/analytics/page.tsx` is a Server Component using `await searchParams`; defaults window to 'week'; passes to `<AnalyticsApp>`
    - `_components/analytics-app.tsx` contains `'use client'` + recharts imports (`ResponsiveContainer`, `BarChart`, `LineChart`, OR `PieChart`)
    - `_components/window-selector.tsx` is `'use client'`; renders day/week/month buttons that call `router.push('/dashboard/analytics?window=' + value)`
    - `_components/conversion-funnel.tsx`, `_components/channel-split.tsx`, `_components/revenue-trend.tsx` all exist and import from `recharts`
    - All UI strings via `useT()` OR `formatDate`/`formatMoney`
    - `pages-smoke.test.ts` has 4 newly-flipped tests (orders, order-detail, default, analytics) — 0 todos remain
    - `phase-4-stubs.test.ts` shows 0 todos remaining (all 13 reqs flipped); `pnpm --filter @ai-logist/api test:unit -t "Phase 4"` shows 13 passing + 0 todo
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - `pnpm --filter @ai-logist/web build` exits 0 — Next.js compiles all 6 dashboard pages
    - All 5 Wave 0 static-rules grep guards remain green
  </acceptance_criteria>
  <done>
ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 closed. Marker count 3 → 0. All 6 dashboard pages compiled. Recharts wired via 'use client' boundary (Pitfall #6 closed).
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/web build` exits 0 (Next.js generates 6 dashboard pages: default, analytics, chat, calls, orders, orders/[id])
- `pnpm --filter @ai-logist/web test` shows ALL Wave 0 + Wave 2 + Wave 3 (Plan 04-04) + Wave 3 (this plan) tests passing; 0 todos in pages-smoke
- `cd apps/api && pnpm test:unit -t "Phase 4"` shows 13 passing + 0 todo
- All 5 Wave 0 static-rules grep guards green
</verification>

<success_criteria>
- ADMIN-NEW-02 closed — `/dashboard/orders` table with 7 columns + filters + URL params + row navigation
- ADMIN-NEW-03 closed — `/dashboard/orders/[id]` read-only detail + channel breadcrumb + vertical event timeline
- ADMIN-05 closed — `/dashboard/default` compact KPI + last-5 lists; `/dashboard/analytics` 5 recharts + window selector
- Pitfall #6 closed — recharts properly client-boundaried; Pitfall #13 still green
- Phase 4 marker count 3 → 0 (all 13 reqs flipped)
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-05-SUMMARY.md` summarizing:
- /orders + /orders/[id] new pages (Read-only — D-37)
- /default + /analytics rewrite vs Zenith template
- Recharts 5-chart implementation (D-41)
- Window selector URL-driven (D-43)
- Channel breadcrumb routing logic
- Marker count: 3 → 0 (Phase 4 functionally complete pending Plan 04-06 UAT closure)
- Notes for Wave 5 (Plan 04-06, README + HUMAN-UAT-05 + checkpoint:human-verify)
</output>
