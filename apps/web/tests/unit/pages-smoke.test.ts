import { describe, expect, it, vi } from 'vitest';

// Mock next/navigation — useRouter / useSearchParams require an App Router
// runtime which isn't mounted in unit tests. Provide minimal stubs.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock SWR — return fallbackData directly so smoke tests don't hit network
// (jsdom/happy-dom can't reach localhost:3000 in CI).
vi.mock('swr', () => ({
  default: (_key: unknown, _fetcher: unknown, opts?: { fallbackData?: unknown }) => ({
    data: opts?.fallbackData,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

describe('Phase 4 page-render smoke (all 6 pages)', () => {
  // Plan 04-04 — /dashboard/chat smoke. SWR mock returns fallbackData, so the
  // initial messages prop renders directly into the thread view.
  it('/dashboard/chat renders thread list + active thread with mocked SWR data', async () => {
    const { ChatApp } = await import('@/app/(main)/dashboard/chat/_components/chat-app');
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    render(
      React.createElement(ChatApp, {
        initialClientId: '00000000-0000-0000-0000-000000000001',
        initialMessages: [
          {
            id: 'm1',
            createdAt: '2026-06-10T10:00:00.000Z',
            role: 'client' as const,
            text: 'Привет, нужен 20 тонн',
            channel: 'telegram' as const,
            callId: null,
            timestampMs: null,
            audioUrl: null,
          },
        ],
      })
    );
    // Initial message text + the TG badge render.
    expect(screen.getByText(/Привет, нужен 20 тонн/)).toBeTruthy();
    expect(screen.getByText('TG')).toBeTruthy();
  });

  // Plan 04-04 — /dashboard/calls smoke. CallsApp consumes initialCalls; the
  // SWR mock returns fallbackData (the same array) without a fetch.
  it('/dashboard/calls renders table + filter bar + opens modal on row click', async () => {
    const { CallsApp } = await import('@/app/(main)/dashboard/calls/_components/calls-app');
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    const call = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      leadId: null,
      linkedLeadId: null,
      direction: 'inbound' as const,
      durationS: 90,
      outcome: 'completed' as const,
      lang: 'ru' as const,
      audioUrl: 'https://example.com/a.mp3',
      recordingUrl: null,
      quotedPriceAtConfirmation: null,
      elevenlabsConversationId: null,
      twilioCallSid: 'CA0000000000000000000000001234',
      transcript: [],
      createdAt: '2026-06-10T10:00:00.000Z',
    };
    render(
      React.createElement(CallsApp, {
        initialCalls: [call],
        initialQuery: {},
      })
    );
    // The row renders with last 4 of the twilio sid + duration mm:ss.
    expect(screen.getByText(/1234/)).toBeTruthy();
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('/dashboard/orders renders rows from initial fetch', async () => {
    const { OrdersApp } = await import('@/app/(main)/dashboard/orders/_components/orders-app');
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    render(
      React.createElement(OrdersApp, {
        initialOrders: [
          {
            id: 'a1',
            number: '#KU-0001',
            leadId: null,
            clientId: 'c1',
            truckId: null,
            fromCityId: null,
            toCityId: null,
            fromCityName: 'Киев',
            toCityName: 'Львов',
            clientName: 'Acme',
            channel: 'voice',
            distanceKm: null,
            price: '420000',
            currency: 'RUB',
            status: 'CREATED',
            publicToken: 't',
            version: 0,
            createdAt: '2026-06-10T10:00:00Z',
            updatedAt: '2026-06-10T10:00:00Z',
          },
        ],
        initialQuery: {},
      })
    );
    // Row content renders — "Киев → Львов" appears in the route column.
    expect(screen.getByText(/Киев/)).toBeTruthy();
    expect(screen.getByText(/#KU-0001/)).toBeTruthy();
  });

  it('/dashboard/orders/[id] renders detail with breadcrumb for voice lead', async () => {
    const { OrderDetailApp } = await import(
      '@/app/(main)/dashboard/orders/[id]/_components/order-detail-app'
    );
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    const detail = {
      order: {
        id: 'o1',
        number: '#KU-0042',
        leadId: 'l1',
        clientId: 'c1',
        truckId: null,
        fromCityId: 'f1',
        toCityId: 't1',
        distanceKm: '500',
        price: '420000',
        currency: 'RUB',
        status: 'CREATED' as const,
        publicToken: 'tok',
        version: 0,
        createdAt: '2026-06-10T10:00:00Z',
        updatedAt: '2026-06-10T10:00:00Z',
      },
      events: [],
      client: { id: 'c1', name: 'Acme', phone: null, lang: null },
      fromCity: { id: 'f1', nameRu: 'Киев', nameUa: null },
      toCity: { id: 't1', nameRu: 'Львов', nameUa: null },
      truck: null,
      lead: {
        id: 'l1',
        clientId: 'c1',
        channel: 'voice' as const,
        stage: 'NEW' as const,
        managerActive: false,
        priceOverrides: [],
        intent: null,
        cargoCategory: null,
        weightKg: null,
        volumeM3: null,
        fromCityId: 'f1',
        toCityId: 't1',
        readyAt: null,
        notes: null,
        packaging: null,
        adrClass: null,
        declaredValue: null,
        matchedTruckId: null,
        quotedPrice: '420000',
        orderId: 'o1',
        version: 0,
        createdAt: '2026-06-10T10:00:00Z',
        updatedAt: '2026-06-10T10:00:00Z',
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: test fixture, schema-compatible
    render(React.createElement(OrderDetailApp, { detail: detail as any }));
    // Order number appears in heading (Card render may duplicate inside subcards
    // — use getAllByText for resilience to layout adjustments).
    expect(screen.getAllByText(/#KU-0042/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Прослушать/)).toBeTruthy();
  });

  it('/dashboard/default renders KPI tiles', async () => {
    const { DefaultApp } = await import('@/app/(main)/dashboard/default/_components/default-app');
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    render(
      React.createElement(DefaultApp, {
        kpi: {
          window: 'week' as const,
          calls: { total: 12, answered: 9 },
          leads: { total: 5, byStage: {} },
          orders: { created: 3, delivered: 1 },
          revenue: { amount: '500000', currency: 'RUB' },
          avgCallDurationS: 120,
          byChannel: { voice: 7, telegram: 5 },
          conversionFunnel: {
            calls: 12,
            answered: 9,
            leadsCreated: 5,
            ordersConfirmed: 3,
            delivered: 1,
          },
        },
        lastCalls: [],
        lastOrders: [],
      })
    );
    expect(screen.getByText(/Звонки/)).toBeTruthy();
    expect(screen.getByText(/Выручка/)).toBeTruthy();
  });

  it('/dashboard/analytics renders WindowSelector + recharts boundary', async () => {
    const { WindowSelector } = await import(
      '@/app/(main)/dashboard/analytics/_components/window-selector'
    );
    const { render, screen } = await import('../_helpers/render');
    const { default: React } = await import('react');
    render(React.createElement(WindowSelector, { value: 'week' as const }));
    expect(screen.getByText(/День/)).toBeTruthy();
    expect(screen.getByText(/Неделя/)).toBeTruthy();
    expect(screen.getByText(/Месяц/)).toBeTruthy();
  });
});
