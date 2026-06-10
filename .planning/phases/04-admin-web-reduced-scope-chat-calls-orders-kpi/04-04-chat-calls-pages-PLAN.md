---
phase: 04-admin-web-reduced-scope-chat-calls-orders-kpi
plan: 04
type: execute
wave: 3
depends_on: [04-02, 04-03]
files_modified:
  - apps/web/src/app/(main)/dashboard/chat/page.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/thread-list.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/thread-view.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx
  - apps/web/src/app/(main)/dashboard/chat/_components/manager-input.tsx
  - apps/web/src/app/(main)/dashboard/calls/page.tsx
  - apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx
  - apps/web/src/app/(main)/dashboard/calls/_components/calls-table.tsx
  - apps/web/src/app/(main)/dashboard/calls/_components/calls-filters.tsx
  - apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx
  - apps/web/tests/unit/pages-smoke.test.ts
  - apps/api/tests/unit/phase-4-stubs.test.ts
autonomous: true
requirements:
  - ADMIN-03
  - ADMIN-NEW-08

must_haves:
  truths:
    - "`apps/web/src/app/(main)/dashboard/chat/page.tsx` is a Server Component (NO 'use client') that fetches initial thread list + active thread messages via apiGet from /api/clients + /api/clients/:id/messages — Pitfall #13 trip-wire (D-12 + D-59)."
    - "`_components/chat-app.tsx` is the SOLE 'use client' boundary; uses SWR with refreshInterval=5000 on active thread + 15000 on thread list per D-56."
    - "Voice transcript turns render via `<VoiceTurn>` showing channel='Voice' purple badge + transcript text + inline Play button that seeks `<audio ref>.currentTime = timestampMs/1000` (D-25 + D-26 + Pitfall #8 — autoplay catch)."
    - "Telegram messages render via `<TelegramMessage>` with green 'TG' badge + text bubble (D-20)."
    - "Manager intercept button visible only when lead.channel !== 'voice' AND lead.managerActive === false (D-47); calls POST /api/leads/:id/intercept; SWR revalidates on success."
    - "Manager-active mode shows manager-message input (placeholder via dict.* + useT()); submit calls POST /api/leads/:id/manager-message; `Вернуть боту` button calls POST /api/leads/:id/release."
    - "`apps/web/src/app/(main)/dashboard/calls/page.tsx` Server Component fetches initial list via apiGet('/calls', z.array(CallSchema))."
    - "`_components/calls-app.tsx` Client Component renders @tanstack/react-table with columns matching D-28 (timestamp, phone-masked-last-4, lang badge, duration mm:ss, outcome color badge, linked_order)."
    - "Filters bar (`calls-filters.tsx`) controls outcome + lang + date-range; updates URL search params (router.push); SWR re-keys on params (D-29)."
    - "Row click opens `<CallDetailModal>` (shadcn Dialog) showing audio player + scrollable transcript + linked lead/order quick info + Open buttons (D-30)."
    - "All visible UI strings flow through useT() — page renders both RU and UA correctly."
    - "Pitfall #13 grep guards from Wave 0 still PASS on new pages (no 'use cache', no bare border, no 'use client' on page.tsx)."
    - "pages-smoke.test.ts flips 2 todos to it() for chat + calls page render smoke tests."
    - "Marker count: 5 → 3 (ADMIN-03 + ADMIN-NEW-08 flipped)."
  artifacts:
    - path: "apps/web/src/app/(main)/dashboard/chat/page.tsx"
      provides: "Server Component fetching initial chat data via apiGet"
      contains: "apiGet,UnifiedMessageSchema,async function,searchParams"
    - path: "apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx"
      provides: "'use client' SWR + state + manager intercept controls"
      contains: "'use client',useSWR,refreshInterval: 5000,intercept,manager-message,release"
      min_lines: 80
    - path: "apps/web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx"
      provides: "Voice transcript turn with Play seek + purple badge"
      contains: "audio.currentTime,timestampMs"
    - path: "apps/web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx"
      provides: "Telegram message bubble with green TG badge"
      contains: "TG,channel"
    - path: "apps/web/src/app/(main)/dashboard/calls/page.tsx"
      provides: "Server Component fetching initial /api/calls list"
      contains: "apiGet,CallSchema,CallListQuerySchema,async function,searchParams"
    - path: "apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx"
      provides: "'use client' SWR + filters + table + modal orchestration"
      contains: "'use client',useSWR,refreshInterval: 30000,CallDetailModal"
    - path: "apps/web/src/app/(main)/dashboard/calls/_components/calls-table.tsx"
      provides: "@tanstack/react-table with D-28 columns"
      contains: "useReactTable,columns,timestamp,phone,lang,duration,outcome"
    - path: "apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx"
      provides: "shadcn Dialog with audio + transcript + linked lead/order"
      contains: "Dialog,audio,transcript,linkedLead,linkedOrder"
  key_links:
    - from: "chat-app.tsx intercept button"
      to: "POST /api/leads/:id/intercept (Phase 3 endpoint)"
      via: "fetch('/api/leads/...', { method: 'POST' })"
      pattern: "intercept"
    - from: "chat-app.tsx manager-message input"
      to: "POST /api/leads/:id/manager-message (Phase 3 endpoint)"
      via: "fetch with JSON body { text }"
      pattern: "manager-message"
    - from: "calls-app.tsx + chat voice turns"
      to: "apps/api/src/routes/calls.ts + clients.ts (Plan 04-03 routes)"
      via: "apiGet + SWR consume new backend routes"
      pattern: "/api/calls,/api/clients"
    - from: "VoiceTurn play button"
      to: "audio.currentTime = timestampMs/1000"
      via: "Single <audio ref> per call; D-26"
      pattern: "audio.currentTime"
---

<objective>
Land the two voice-focused frontend pages: `/dashboard/chat` (multi-channel — Telegram + voice transcripts) and `/dashboard/calls` (table + detail modal). Together they close ADMIN-03 and ADMIN-NEW-08 — the two requirements that justify Phase 4's existence ("show what voice + Telegram produced").

Purpose:
- Rewire Zenith's chat page to consume our UNION API (Plan 04-03's GET /api/clients/:id/messages) — mixed-timeline thread view with Telegram + voice transcript turns chronologically interleaved (D-20).
- Implement audio playback with transcript-turn seek (D-25 + D-26): single `<audio>` element per call, click any turn → audio.currentTime jumps.
- Wire manager intercept controls (D-45/D-46) — POST endpoints already exist from Phase 3 Plan 03-05.
- Create the new /dashboard/calls page from scratch — table + filters + modal (D-28..D-30).
- Use SWR polling intervals per D-56 (chat-active=5s, chat-list=15s, calls-list=30s) + tab-visibility pause (D-57).
- All UI strings flow through useT() — both RU + UA correctness.
- Flip 2 stub markers (ADMIN-03 + ADMIN-NEW-08). Marker count 5 → 3.
- Flip 2 pages-smoke todos to it() blocks.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-CONTEXT.md
@.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
@apps/web/VENDOR.md
@apps/web/src/app/\(main\)/dashboard/chat/page.tsx
@apps/web/src/lib/api.ts
@apps/web/src/lib/format.ts
@apps/web/src/lib/i18n/dict.ts
@apps/web/src/lib/i18n/use-t.ts
@apps/api/src/routes/clients.ts
@apps/api/src/routes/calls.ts
@apps/api/src/routes/leads.ts
@packages/shared-types/src/api/calls.ts
@packages/shared-types/src/api/clients.ts

<interfaces>
<!-- Backend endpoints consumed by this plan (all live after Plan 04-03): -->
<!--   GET /api/clients/:id/messages → UnifiedMessage[]  (telegram + voice union) -->
<!--   GET /api/clients/:id → ClientRef                                            -->
<!--   GET /api/leads?clientId=... → Lead[] (filter by client to find active thread) -->
<!--   GET /api/calls?outcome=&lang=&from=&to= → Call[]                             -->
<!--   GET /api/calls/:id → CallDetail (call + linkedLead + linkedOrder)             -->
<!--   POST /api/leads/:id/intercept → { lead_id, manager_active: true }  (Phase 3) -->
<!--   POST /api/leads/:id/manager-message { text } → { ok }  (Phase 3)             -->
<!--   POST /api/leads/:id/release → { lead_id, manager_active: false } (Phase 3)   -->

<!-- D-23 — UNION response sorted ASC by created_at, paginated 100/0 default. -->
<!-- D-56 polling intervals: chat active 5s, list 15s, calls 30s. -->
<!-- D-57 tab-visibility-aware: SWR isPaused: () => document.visibilityState !== 'visible'. -->
<!-- D-25 — native <audio controls preload="metadata" src={call.audio_url}>; no waveform/3rd-party. -->
<!-- D-26 — single audio ref per call; transcript turn click: audio.currentTime = turn.timestampMs/1000; audio.play().catch(()=>{}) -->
<!--        (Pitfall #8 — autoplay restriction; click handler counts as user gesture). -->

<!-- RESEARCH Pattern 1 — Server fetch → Client SWR with fallbackData (NOT initialData). -->
<!-- RESEARCH Pattern 9 — Zenith's existing chat-app may use its own state. Rewrite is the answer (not wire-up). -->

<!-- Zenith's existing chat page lives at apps/web/src/app/(main)/dashboard/chat/page.tsx + _components/chat-app.tsx. -->
<!-- Per VENDOR.md, audit what it ships first, then near-rewrite to use our SWR + UNION API. -->

<!-- @tanstack/react-table is in Zenith deps — use for /calls table (D-32 + D-28). -->
<!-- shadcn Dialog from src/components/ui/dialog.tsx — use for CallDetailModal. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: /dashboard/chat rewire — mixed-timeline + audio playback + manager intercept (ADMIN-03)</name>
  <files>
    apps/web/src/app/(main)/dashboard/chat/page.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/thread-list.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/thread-view.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/voice-turn.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/telegram-message.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/manager-input.tsx
  </files>
  <read_first>
    apps/web/src/app/(main)/dashboard/chat/page.tsx,
    apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx,
    apps/web/src/components/ui/dialog.tsx,
    apps/web/src/components/ui/badge.tsx,
    apps/web/src/components/ui/button.tsx,
    apps/web/src/components/ui/input.tsx,
    apps/web/src/lib/api.ts,
    apps/web/src/lib/i18n/dict.ts,
    apps/api/src/routes/leads.ts,
    apps/api/src/routes/clients.ts,
    .planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-RESEARCH.md
  </read_first>
  <behavior>
    - page.tsx (Server): reads ?clientId from async searchParams; fetches `/api/clients/:id/messages` (UnifiedMessage[]) for active thread + initial thread list; passes both as props.
    - chat-app.tsx (Client): renders thread list (left rail, 1/3 width) + active thread view (right, 2/3 width); SWR refreshInterval=5000 on active thread, 15000 on thread list; tab-visibility pause.
    - Thread list: sorted by MAX(last_message_at, last_call_at) DESC. Each row: client name, last activity preview, channel icons (last 24h activity), unread badge from localStorage.
    - Thread view: chronological list of UnifiedMessage; each row uses <TelegramMessage> or <VoiceTurn> based on channel. Single <audio> per voice call (key by callId); click turn → seek.
    - Intercept button: visible only when `lead.channel !== 'voice'` AND `lead.managerActive === false`. Click → POST /api/leads/:id/intercept; SWR mutate to refresh.
    - Manager-active mode: replaces normal input with <ManagerInput> (placeholder: useT('chat.managerMessagePlaceholder')). Submit → POST /api/leads/:id/manager-message; show "Вернуть боту" button → POST /api/leads/:id/release.
    - Voice channel threads (lead.channel === 'voice') NEVER show intercept controls (D-47).
    - All visible strings via useT().
  </behavior>
  <action>
Step 1 — Audit Zenith's existing chat page. Read both:
- `apps/web/src/app/(main)/dashboard/chat/page.tsx`
- `apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx`

Document in commit message what Zenith ships (e.g. "Zenith chat-app uses Zustand store with mock messages; we replace with our SWR+UNION pattern entirely per Pitfall #9").

Step 2 — Rewrite `apps/web/src/app/(main)/dashboard/chat/page.tsx` as a pure Server Component:

```tsx
// apps/web/src/app/(main)/dashboard/chat/page.tsx
// SERVER COMPONENT — no 'use client', no 'use cache' (D-12).
// Phase 4 ADMIN-03. Source: RESEARCH Pattern 1.
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { apiGet } from '@/lib/api';
import { UnifiedMessageSchema } from '@ai-logist/shared-types/api/clients';
import { ChatApp } from './_components/chat-app';

export const metadata: Metadata = { title: 'Чат' };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const params = await searchParams;
  const clientId = params.clientId ?? null;

  // Initial active-thread fetch (only when ?clientId= is set).
  let initialMessages: import('@ai-logist/shared-types/api/clients').UnifiedMessage[] = [];
  if (clientId) {
    try {
      initialMessages = await apiGet(
        `/clients/${clientId}/messages?limit=100&offset=0`,
        z.array(UnifiedMessageSchema),
      );
    } catch {
      initialMessages = [];
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="border-border border-b px-4 py-3">
        <h1 className="font-semibold text-xl tracking-tight">Чат</h1>
      </header>
      <ChatApp initialClientId={clientId} initialMessages={initialMessages} />
    </div>
  );
}
```

Step 3 — Create `apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx`:

```tsx
'use client';
// Phase 4 ADMIN-03 — Pitfall #9 mitigation: near-total rewrite of Zenith chat-app.
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
import { ThreadList } from './thread-list';
import { ThreadView } from './thread-view';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function ChatApp({
  initialClientId,
  initialMessages,
}: {
  initialClientId: string | null;
  initialMessages: UnifiedMessage[];
}) {
  const [activeClientId, setActiveClientId] = useState<string | null>(initialClientId);

  // Active-thread messages (5s refresh — D-56)
  const { data: messages = initialMessages, mutate: mutateMessages } = useSWR<UnifiedMessage[]>(
    activeClientId ? `/api/clients/${activeClientId}/messages?limit=100&offset=0` : null,
    fetcher,
    {
      fallbackData: initialMessages,
      refreshInterval: 5000,
      revalidateOnFocus: true,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    },
  );

  // Active lead — for intercept controls (D-45/D-46)
  // We fetch /api/leads?clientId=... and use the most recent lead row.
  const { data: leads, mutate: mutateLeads } = useSWR<unknown[]>(
    activeClientId ? `/api/leads?clientId=${activeClientId}&limit=1` : null,
    fetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    },
  );
  const activeLead = (leads?.[0] ?? null) as
    | { id: string; channel: 'telegram' | 'voice'; manager_active: boolean }
    | null;

  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_2fr] overflow-hidden">
      <ThreadList
        activeClientId={activeClientId}
        onSelect={(id) => setActiveClientId(id)}
      />
      {activeClientId ? (
        <ThreadView
          clientId={activeClientId}
          messages={messages}
          activeLead={activeLead}
          onLeadAction={async () => {
            await mutateLeads();
            await mutateMessages();
          }}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center text-muted-foreground">
      Выберите диалог
    </div>
  );
}
```

Step 4 — Create `_components/thread-list.tsx`. Fetches `/api/leads?limit=50` periodically (15s — D-56) for the left rail. Each row: client name + last-activity preview + channel icons + unread badge. localStorage `al:chat:lastViewed:<clientId>` tracks per-client lastViewed timestamp (D-21). Use `useT()` for headers.

(Implementation: pseudo-code — render a list of leads with `key={lead.client_id}` deduped to one row per client; click sets activeClientId via callback prop. Use `formatPhone` for phone display, masked.)

Step 5 — Create `_components/thread-view.tsx`. Renders the message stream:

```tsx
'use client';
import { useMemo, useRef } from 'react';
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
import { TelegramMessage } from './telegram-message';
import { VoiceTurn } from './voice-turn';
import { ManagerInput } from './manager-input';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';

export function ThreadView({
  clientId,
  messages,
  activeLead,
  onLeadAction,
}: {
  clientId: string;
  messages: UnifiedMessage[];
  activeLead: { id: string; channel: 'telegram' | 'voice'; manager_active: boolean } | null;
  onLeadAction: () => Promise<void>;
}) {
  const t = useT();
  // Single <audio> element per callId — keyed map maintained across renders
  const audioRefs = useRef<Map<string, HTMLAudioElement | null>>(new Map());

  // Group messages by call (voice turns share a callId, want one <audio> per call)
  const callIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) if (m.callId) set.add(m.callId);
    return Array.from(set);
  }, [messages]);

  async function intercept() {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/intercept`, { method: 'POST' });
    await onLeadAction();
  }
  async function release() {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/release`, { method: 'POST' });
    await onLeadAction();
  }
  async function sendManagerMessage(text: string) {
    if (!activeLead) return;
    await fetch(`/api/leads/${activeLead.id}/manager-message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    await onLeadAction();
  }

  // D-47 — voice channel threads NEVER show intercept controls
  const canIntercept = activeLead && activeLead.channel !== 'voice';
  const showManagerInput = canIntercept && activeLead.manager_active === true;
  const showInterceptButton = canIntercept && activeLead.manager_active === false;

  return (
    <div className="flex flex-col overflow-hidden border-border border-l">
      <header className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="text-sm text-muted-foreground">Клиент: {clientId.slice(0, 8)}…</div>
        <div className="flex gap-2">
          {showInterceptButton && (
            <Button size="sm" onClick={intercept} data-testid="intercept-button">
              {t('chat.intercept')}
            </Button>
          )}
          {showManagerInput && (
            <Button size="sm" variant="outline" onClick={release} data-testid="release-button">
              {t('chat.release')}
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) =>
          m.channel === 'telegram' ? (
            <TelegramMessage key={m.id} msg={m} />
          ) : (
            <VoiceTurn
              key={m.id}
              msg={m}
              audioRef={(el) => {
                if (m.callId) audioRefs.current.set(m.callId, el);
              }}
              getAudio={() => (m.callId ? audioRefs.current.get(m.callId) ?? null : null)}
            />
          ),
        )}
      </div>

      {showManagerInput && <ManagerInput onSubmit={sendManagerMessage} />}
    </div>
  );
}
```

Step 6 — Create `_components/voice-turn.tsx`:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Track which calls already have their <audio> mounted (one per call, not per turn).
const renderedCalls = new Set<string>();

export function VoiceTurn({
  msg,
  audioRef,
  getAudio,
}: {
  msg: UnifiedMessage;
  audioRef: (el: HTMLAudioElement | null) => void;
  getAudio: () => HTMLAudioElement | null;
}) {
  // Mount <audio> only for the FIRST turn of each call.
  const mountAudio = msg.callId != null && !renderedCalls.has(msg.callId);
  useEffect(() => {
    if (mountAudio && msg.callId) renderedCalls.add(msg.callId);
  }, [mountAudio, msg.callId]);

  function play() {
    const audio = getAudio();
    if (!audio) return;
    audio.currentTime = (msg.timestampMs ?? 0) / 1000;
    // Pitfall #8 — Chrome autoplay restriction; user-gesture (click) covers this
    audio.play().catch(() => {});
  }

  return (
    <div className={`rounded-lg p-3 border-border border ${msg.role === 'ai' ? 'bg-accent' : 'bg-muted'}`}>
      <div className="mb-1 flex items-center gap-2">
        <Badge className="bg-purple-600 text-white" data-testid="voice-badge">
          Voice
        </Badge>
        <span className="text-xs text-muted-foreground">{msg.role === 'ai' ? 'Агент' : 'Клиент'}</span>
        <Button size="sm" variant="ghost" onClick={play} data-testid="voice-play">
          ▶ Play
        </Button>
      </div>
      <p className="font-mono text-sm">{msg.text}</p>
      {mountAudio && msg.audioUrl && (
        <audio
          ref={audioRef}
          src={msg.audioUrl}
          preload="metadata"
          controls
          className="mt-2 w-full"
          data-testid="voice-audio"
        />
      )}
    </div>
  );
}
```

Step 7 — Create `_components/telegram-message.tsx`:

```tsx
import type { UnifiedMessage } from '@ai-logist/shared-types/api/clients';
import { Badge } from '@/components/ui/badge';

export function TelegramMessage({ msg }: { msg: UnifiedMessage }) {
  return (
    <div className={`rounded-lg p-3 border-border border ${msg.role === 'ai' ? 'bg-accent' : 'bg-muted'}`}>
      <div className="mb-1 flex items-center gap-2">
        <Badge className="bg-green-600 text-white" data-testid="telegram-badge">
          TG
        </Badge>
        <span className="text-xs text-muted-foreground">
          {msg.role === 'ai' ? 'Бот' : msg.role === 'manager' ? 'Менеджер' : 'Клиент'}
        </span>
      </div>
      <p className="text-sm">{msg.text}</p>
    </div>
  );
}
```

Step 8 — Create `_components/manager-input.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/use-t';

export function ManagerInput({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
  const t = useT();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex gap-2 border-border border-t p-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('chat.managerMessagePlaceholder')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        data-testid="manager-input"
      />
      <Button onClick={submit} disabled={sending || !text.trim()}>
        Отправить
      </Button>
    </div>
  );
}
```

Step 9 — Verify Wave 0 grep guards still pass against new pages:
```bash
cd apps/web && pnpm test -t "static-rules" 2>&1
```
All 5 guards must remain green. If a guard fires (e.g. a new file accidentally uses bare `border`), fix it before committing.

Commit message: `feat(04-04): rewire /dashboard/chat — mixed-timeline + audio seek + manager intercept (ADMIN-03)`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/app/\(main\)/dashboard/chat/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/chat/_components/chat-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/chat/_components/voice-turn.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/chat/_components/telegram-message.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/chat/_components/manager-input.tsx && \
! grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/chat/page.tsx && \
! grep -q "'use cache'" apps/web/src/app/\(main\)/dashboard/chat/page.tsx && \
grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/chat/_components/chat-app.tsx && \
grep -q "refreshInterval: 5000" apps/web/src/app/\(main\)/dashboard/chat/_components/chat-app.tsx && \
grep -q "audio.currentTime" apps/web/src/app/\(main\)/dashboard/chat/_components/voice-turn.tsx && \
grep -q "intercept" apps/web/src/app/\(main\)/dashboard/chat/_components/thread-view.tsx && \
grep -q "manager-message" apps/web/src/app/\(main\)/dashboard/chat/_components/thread-view.tsx && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test -t "static-rules" 2>&1 | grep -E "5 passed"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/(main)/dashboard/chat/page.tsx` is a Server Component (NO `'use client'`) — Pitfall #13 + D-59 grep guard verifies
    - File contains: `import { apiGet }` AND `import { UnifiedMessageSchema }` AND `await searchParams`
    - `_components/chat-app.tsx` contains: `'use client'` AND `useSWR` AND `refreshInterval: 5000` AND `revalidateOnFocus` AND `isPaused`
    - `_components/voice-turn.tsx` contains literal: `audio.currentTime = (msg.timestampMs ?? 0) / 1000` (or equivalent) AND `<audio` AND `preload="metadata"`
    - `_components/telegram-message.tsx` contains literal: `TG` badge (D-20)
    - `_components/thread-view.tsx` contains POST handlers for `/intercept`, `/manager-message`, `/release`
    - `_components/thread-view.tsx` has logic: voice-channel threads NEVER show intercept button (D-47) — verify via grep `channel !== 'voice'` AND `channel === 'voice'`
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - All 5 static-rules grep guards remain green after this task: `pnpm --filter @ai-logist/web test -t "static-rules"` shows 5 passing
    - All visible UI strings flow through `useT()` (manager input placeholder + intercept/release button labels)
  </acceptance_criteria>
  <done>
/dashboard/chat is fully rewired: server fetch + client SWR + voice transcript with audio seek + telegram bubbles + manager intercept controls. Voice channel threads never expose intercept (D-47). All Wave 0 guards green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: /dashboard/calls page (NEW) + CallDetailModal + 2 stub flips + pages-smoke flip</name>
  <files>
    apps/web/src/app/(main)/dashboard/calls/page.tsx,
    apps/web/src/app/(main)/dashboard/calls/_components/calls-app.tsx,
    apps/web/src/app/(main)/dashboard/calls/_components/calls-table.tsx,
    apps/web/src/app/(main)/dashboard/calls/_components/calls-filters.tsx,
    apps/web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx,
    apps/web/tests/unit/pages-smoke.test.ts,
    apps/api/tests/unit/phase-4-stubs.test.ts
  </files>
  <read_first>
    apps/web/src/components/ui/dialog.tsx,
    apps/web/src/components/ui/table.tsx,
    apps/web/src/components/ui/select.tsx,
    apps/web/src/components/ui/badge.tsx,
    apps/web/src/components/ui/button.tsx,
    apps/web/src/lib/api.ts,
    apps/web/src/lib/format.ts,
    apps/web/src/lib/i18n/dict.ts,
    apps/web/tests/_helpers/render.ts,
    apps/web/tests/_helpers/mock-api.ts,
    packages/shared-types/src/api/calls.ts
  </read_first>
  <behavior>
    - page.tsx (Server) parses CallListQuerySchema from async searchParams; fetches `/api/calls?...` (initial list).
    - calls-app.tsx (Client): SWR with refreshInterval=30000; renders <CallsFilters> + <CallsTable> + <CallDetailModal> conditionally.
    - Filters: outcome multi-select, lang select, date range (last24h / last7d / last30d / custom). Changes update URL search params via router.push (preserves bookmarkability per D-29).
    - Table: 6 columns per D-28 — timestamp (Intl), phone (formatPhone masked), lang (Badge ru/ua), duration (formatDuration), outcome (color-coded Badge: green/yellow/blue/red), linked_order (link if present, em-dash otherwise).
    - Row click sets selectedCallId; <CallDetailModal> opens with shadcn Dialog showing audio + transcript + linked lead/order.
    - <CallDetailModal>: top = large <audio controls> + linked-lead/order quick info; below = scrollable transcript (each turn shows speaker + text + timestamp); buttons "Открыть лид" / "Открыть заказ" link to /dashboard/orders/[id].
    - Transcript turn click in modal → audio.currentTime = turn.timestamp_ms / 1000 + play (D-26).
    - All UI strings via useT().
    - 2 pages-smoke todos flip to it() blocks for chat + calls render smoke.
    - Stub markers ADMIN-03 + ADMIN-NEW-08 flip. Marker count 5 → 3.
  </behavior>
  <action>
Step 1 — Create `apps/web/src/app/(main)/dashboard/calls/page.tsx` (Server Component, NO 'use client', NO 'use cache' — D-12 + D-59):

```tsx
// apps/web/src/app/(main)/dashboard/calls/page.tsx — Phase 4 ADMIN-NEW-08
import type { Metadata } from 'next';
import { z } from 'zod/v4';
import { CallSchema, CallListQuerySchema } from '@ai-logist/shared-types/api/calls';
import { apiGet } from '@/lib/api';
import { CallsApp } from './_components/calls-app';

export const metadata: Metadata = { title: 'Звонки' };

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const parsed = CallListQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : { limit: 50, offset: 0 };
  const qs = new URLSearchParams(query as Record<string, string>).toString();

  let initial: import('@ai-logist/shared-types/api/calls').Call[] = [];
  try {
    initial = await apiGet(`/calls?${qs}`, z.array(CallSchema));
  } catch {
    initial = [];
  }

  return (
    <div className="space-y-4 border-border p-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Звонки</h1>
        <p className="text-muted-foreground text-sm">
          Голосовые звонки через ElevenLabs + Twilio
        </p>
      </header>
      <CallsApp initialCalls={initial} initialQuery={query as Record<string, string>} />
    </div>
  );
}
```

Step 2 — Create `_components/calls-app.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import type { Call } from '@ai-logist/shared-types/api/calls';
import { CallsFilters } from './calls-filters';
import { CallsTable } from './calls-table';
import { CallDetailModal } from './call-detail-modal';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function CallsApp({
  initialCalls,
  initialQuery,
}: {
  initialCalls: Call[];
  initialQuery: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qs = searchParams.toString() || new URLSearchParams(initialQuery).toString();

  const { data: calls = initialCalls } = useSWR<Call[]>(
    `/api/calls?${qs}`,
    fetcher,
    {
      fallbackData: initialCalls,
      refreshInterval: 30_000, // D-56
      revalidateOnFocus: true,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState !== 'visible',
    },
  );

  function onFilterChange(next: Record<string, string>) {
    const p = new URLSearchParams(next);
    router.push(`/dashboard/calls?${p.toString()}`);
  }

  return (
    <div className="space-y-4">
      <CallsFilters value={Object.fromEntries(searchParams.entries())} onChange={onFilterChange} />
      <CallsTable calls={calls} onRowClick={setSelectedId} />
      {selectedId && (
        <CallDetailModal callId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
```

Step 3 — Create `_components/calls-table.tsx` using @tanstack/react-table:

```tsx
'use client';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { Call } from '@ai-logist/shared-types/api/calls';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatDuration, formatPhone } from '@/lib/format';
import { useT } from '@/lib/i18n/use-t';

const outcomeStyles: Record<string, string> = {
  completed: 'bg-green-600',
  abandoned: 'bg-yellow-600',
  escalated: 'bg-blue-600',
  error: 'bg-red-600',
};

export function CallsTable({ calls, onRowClick }: { calls: Call[]; onRowClick: (id: string) => void }) {
  const t = useT();

  const columns: ColumnDef<Call>[] = [
    {
      header: 'Время',
      accessorKey: 'createdAt',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt, 'ru')}</span>,
    },
    {
      header: 'Телефон',
      accessorKey: 'twilioCallSid',
      cell: ({ row }) => {
        // Phase 4 D-28 — masked last 4. We don't store phone separately; use twilio_call_sid placeholder.
        return <span className="font-mono text-xs">{row.original.twilioCallSid?.slice(-4) ?? '—'}</span>;
      },
    },
    {
      header: 'Язык',
      accessorKey: 'lang',
      cell: ({ row }) => (
        <Badge variant="outline" className="border-border">
          {row.original.lang?.toUpperCase() ?? '—'}
        </Badge>
      ),
    },
    {
      header: 'Длительность',
      accessorKey: 'durationS',
      cell: ({ row }) => <span className="font-mono">{formatDuration(row.original.durationS)}</span>,
    },
    {
      header: t('calls.filter.outcome'),
      accessorKey: 'outcome',
      cell: ({ row }) => {
        const o = row.original.outcome;
        if (!o) return <span>—</span>;
        return (
          <Badge className={`${outcomeStyles[o] ?? ''} text-white`}>
            {t(`calls.filter.outcome.${o}` as never) ?? o}
          </Badge>
        );
      },
    },
    {
      header: 'Заказ',
      accessorKey: 'linkedLeadId',
      cell: ({ row }) => (row.original.linkedLeadId ? <span>→</span> : <span>—</span>),
    },
  ];

  const table = useReactTable({
    data: calls,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid="call-row"
            className="cursor-pointer hover:bg-accent"
            onClick={() => onRowClick(row.original.id)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Step 4 — Create `_components/calls-filters.tsx`. Renders outcome multi-select, lang select, date range presets. On change calls `onChange(newSearchParams)`. Use `useT()` for filter labels. Reference shadcn `<Select>` from `@/components/ui/select`.

Step 5 — Create `_components/call-detail-modal.tsx`:

```tsx
'use client';
import useSWR from 'swr';
import { useRef } from 'react';
import type { CallDetail, TranscriptTurn } from '@ai-logist/shared-types/api/calls';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDate, formatDuration } from '@/lib/format';

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json() as Promise<T>;
};

export function CallDetailModal({ callId, onClose }: { callId: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data } = useSWR<CallDetail>(`/api/calls/${callId}`, fetcher);

  function seek(turn: TranscriptTurn) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = (turn.timestamp_ms ?? 0) / 1000;
    audio.play().catch(() => {});
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden border-border">
        <DialogHeader>
          <DialogTitle>Звонок · {data?.call.id.slice(0, 8)}…</DialogTitle>
        </DialogHeader>
        {data && (
          <div className="space-y-4 overflow-y-auto">
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>Время: {formatDate(data.call.createdAt, 'ru')}</div>
              <div>Длительность: {formatDuration(data.call.durationS)}</div>
              <div>Исход: {data.call.outcome ?? '—'}</div>
              <div>Язык: {data.call.lang ?? '—'}</div>
            </div>
            {data.call.audioUrl && (
              <audio
                ref={audioRef}
                src={data.call.audioUrl}
                controls
                preload="metadata"
                className="w-full"
                data-testid="modal-audio"
              />
            )}
            <div className="space-y-2 rounded-lg border-border border p-3">
              {data.call.transcript.map((turn, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => seek(turn)}
                  className="block w-full text-left hover:bg-accent"
                  data-testid="transcript-turn"
                >
                  <span className="text-xs text-muted-foreground">
                    [{((turn.timestamp_ms ?? idx * 1000) / 1000).toFixed(1)}s] {turn.speaker}
                  </span>
                  <span className="ml-2 font-mono text-sm">{turn.text}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {data.linkedLead && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/dashboard/chat?clientId=${data.linkedLead.clientId}`}>Открыть диалог</a>
                </Button>
              )}
              {data.linkedOrder && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/dashboard/orders/${data.linkedOrder.id}`}>Открыть заказ</a>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

Step 6 — Flip 2 todos in `apps/web/tests/unit/pages-smoke.test.ts`. Implement smoke tests for chat + calls pages — render the page module, assert key elements appear given mocked fetch. Use `installMockFetch` + `mockFetch` helpers from `tests/_helpers/mock-api.ts`.

Example for calls:
```ts
it('/dashboard/calls renders table + filter bar + opens modal on row click', async () => {
  const { installMockFetch, mockFetch } = await import('../_helpers/mock-api');
  installMockFetch();
  mockFetch('/api/calls?limit=50&offset=0', {
    body: [
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', leadId: null, linkedLeadId: null, direction: 'inbound', durationS: 90, outcome: 'completed', lang: 'ru', audioUrl: 'https://example.com/a.mp3', recordingUrl: null, quotedPriceAtConfirmation: null, elevenlabsConversationId: null, twilioCallSid: 'CA1234', transcript: [], createdAt: '2026-06-10T10:00:00Z' },
    ],
  });

  // Simulate the same data flow as the Server Component → Client.
  const { CallsApp } = await import('@/app/(main)/dashboard/calls/_components/calls-app');
  const { render, screen } = await import('../_helpers/render');

  const initial = JSON.parse('[{"id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","leadId":null,"linkedLeadId":null,"direction":"inbound","durationS":90,"outcome":"completed","lang":"ru","audioUrl":"https://example.com/a.mp3","recordingUrl":null,"quotedPriceAtConfirmation":null,"elevenlabsConversationId":null,"twilioCallSid":"CA1234","transcript":[],"createdAt":"2026-06-10T10:00:00Z"}]');
  render(<CallsApp initialCalls={initial} initialQuery={{}} />);
  expect(screen.getByText(/Время|Длительность|completed/i)).toBeTruthy();
});
```

Similarly for chat — mock `/api/clients/<id>/messages` and `/api/leads?clientId=...`.

Step 7 — Flip 2 stub markers in `apps/api/tests/unit/phase-4-stubs.test.ts`:

```ts
it('ADMIN-03: /dashboard/chat unifies Telegram + voice transcript turns with audio playback + intercept controls (TG-only)', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  const pagePath = `${cwd}/../web/src/app/(main)/dashboard/chat/page.tsx`;
  expect(existsSync(pagePath)).toBe(true);
  const page = readFileSync(pagePath, 'utf8');
  expect(page).not.toMatch(/^'use client'/m);
  expect(page).toMatch(/apiGet/);
  expect(page).toMatch(/UnifiedMessage/);
  const chatApp = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/chat/_components/chat-app.tsx`, 'utf8');
  expect(chatApp).toMatch(/'use client'/);
  expect(chatApp).toMatch(/refreshInterval:\s*5000/);
  const threadView = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/chat/_components/thread-view.tsx`, 'utf8');
  expect(threadView).toMatch(/intercept/);
  expect(threadView).toMatch(/manager-message/);
  expect(threadView).toMatch(/release/);
  expect(threadView).toMatch(/channel\s*[!=]==\s*'voice'/);
});

it('ADMIN-NEW-08: /dashboard/calls table + filters + modal with audio player + transcript turn seek', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const cwd = process.cwd();
  const pagePath = `${cwd}/../web/src/app/(main)/dashboard/calls/page.tsx`;
  expect(existsSync(pagePath)).toBe(true);
  const page = readFileSync(pagePath, 'utf8');
  expect(page).not.toMatch(/^'use client'/m);
  expect(page).toMatch(/CallSchema/);
  const modal = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/calls/_components/call-detail-modal.tsx`, 'utf8');
  expect(modal).toMatch(/audio\.currentTime/);
  expect(modal).toMatch(/transcript/);
  const table = readFileSync(`${cwd}/../web/src/app/(main)/dashboard/calls/_components/calls-table.tsx`, 'utf8');
  expect(table).toMatch(/useReactTable|getCoreRowModel/);
});
```

Marker count: 5 → 3.

Commit message: `feat(04-04): /dashboard/calls page + CallDetailModal + 2 stub flips (ADMIN-03 + ADMIN-NEW-08)`.
  </action>
  <verify>
    <automated>
test -f apps/web/src/app/\(main\)/dashboard/calls/page.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/calls/_components/calls-app.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/calls/_components/calls-table.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/calls/_components/calls-filters.tsx && \
test -f apps/web/src/app/\(main\)/dashboard/calls/_components/call-detail-modal.tsx && \
! grep -q "'use client'" apps/web/src/app/\(main\)/dashboard/calls/page.tsx && \
grep -q "refreshInterval: 30" apps/web/src/app/\(main\)/dashboard/calls/_components/calls-app.tsx && \
grep -q "useReactTable\|getCoreRowModel" apps/web/src/app/\(main\)/dashboard/calls/_components/calls-table.tsx && \
grep -q "audio.currentTime" apps/web/src/app/\(main\)/dashboard/calls/_components/call-detail-modal.tsx && \
cd apps/web && pnpm exec tsc --noEmit && pnpm test 2>&1 | grep -E "passed" | tail -2 && \
cd /Users/muhemmedibrahimov/Documents/holy-water/ai-logist/apps/api && pnpm test:unit -t "Phase 4" 2>&1 | grep -E "10 passed|3 todo"
    </automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/(main)/dashboard/calls/page.tsx` is a Server Component (NO `'use client'`); imports `CallSchema` + `apiGet`; uses `await searchParams`
    - `_components/calls-app.tsx` contains `'use client'`, `useSWR`, `refreshInterval: 30_000`, `useRouter` + URL search params update
    - `_components/calls-table.tsx` uses `useReactTable` + `getCoreRowModel`; columns include timestamp + lang + duration + outcome (D-28)
    - `_components/calls-filters.tsx` exists with outcome/lang/date filters
    - `_components/call-detail-modal.tsx` contains `<audio` + `audio.currentTime` + transcript turn click handler + "Открыть лид" / "Открыть заказ" buttons
    - All UI strings use `useT()` (or render-time formatters from `lib/format.ts`)
    - `apps/web/tests/unit/pages-smoke.test.ts` has 2 todos flipped to it() (chat smoke + calls smoke) — 4 todos remain (orders + order-detail + default + analytics for Plan 04-05)
    - `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
    - `pnpm --filter @ai-logist/web test` exits 0 with at least 2 newly added smoke tests passing
    - `pnpm --filter @ai-logist/api test:unit -t "Phase 4"` shows 10 passing + 3 todo (ADMIN-03 + ADMIN-NEW-08 flipped)
    - Static-rules Wave 0 grep guards still all PASS on new files
  </acceptance_criteria>
  <done>
/dashboard/calls fully implemented with table + filters + modal + audio seek. /dashboard/chat fully rewired. 2 ADMIN-* stubs flipped. Marker count 5 → 3.
  </done>
</task>

</tasks>

<verification>
- `pnpm --filter @ai-logist/web exec tsc --noEmit` exits 0
- `pnpm --filter @ai-logist/web test` shows ALL Wave 0 + Wave 2 + this wave tests passing + 4 todos remaining (pages-smoke for orders/order-detail/default/analytics → Plan 04-05)
- `cd apps/api && pnpm test:unit -t "Phase 4"` shows 10 passing + 3 todo (ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 remain)
- All Wave 0 static-rules grep guards green
- `pnpm --filter @ai-logist/web build` exits 0 (Next.js compiles new pages)
</verification>

<success_criteria>
- ADMIN-03 closed — `/dashboard/chat` unifies Telegram + voice with audio playback + manager intercept (TG-only per D-47)
- ADMIN-NEW-08 closed — `/dashboard/calls` table + filters + modal with transcript-turn seek
- Pitfall #13 + D-12/D-58/D-59 all green (no 'use cache', no bare border, page.tsx is server)
- Marker count 5 → 3 (only ADMIN-05 + ADMIN-NEW-02 + ADMIN-NEW-03 remain for Plan 04-05)
</success_criteria>

<output>
After completion, create `.planning/phases/04-admin-web-reduced-scope-chat-calls-orders-kpi/04-04-SUMMARY.md` summarizing:
- /dashboard/chat near-rewrite vs Zenith's existing chat-app
- /dashboard/calls new pages + 4 sub-components
- D-26 audio.currentTime seek implementation per call (single audio per call, not per turn)
- D-47 voice-channel-no-intercept enforcement
- Marker count: 5 → 3
- Notes for Wave 4 (Plan 04-05, orders + default + analytics — runs in PARALLEL with this plan but order-of-execution shows this plan first)
</output>
