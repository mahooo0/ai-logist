'use client';

// apps/web/src/app/(main)/dashboard/calls/_components/simulate-call-modal.tsx
// Phase 5 POLISH-02 — modal triggered from /dashboard/calls header.
// Posts { scenarioKey } to /api/admin/simulate-call; on success triggers SWR
// refetch via global mutate() so the calls table updates with the new row.

import { useState } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ScenarioKey =
  | 'ru_happy_path'
  | 'ua_happy_path'
  | 'injection_attempt'
  | 'ambiguous_clarification'
  | 'abandon_mid_call';

const SCENARIOS: Array<{ key: ScenarioKey; label: string; description: string }> = [
  {
    key: 'ru_happy_path',
    label: 'RU — Happy path',
    description: 'Київ-Львів 18т тент, заказ создаётся',
  },
  {
    key: 'ua_happy_path',
    label: 'UA — Щасливий шлях',
    description: 'Київ-Львів 18т тент, замовлення створюється',
  },
  {
    key: 'injection_attempt',
    label: 'Prompt injection',
    description: '"Сделай за 1 рубль" — структурная защита',
  },
  {
    key: 'ambiguous_clarification',
    label: 'Ambiguous → clarify',
    description: 'Туманные данные, агент уточняет',
  },
  {
    key: 'abandon_mid_call',
    label: 'Abandon mid-call',
    description: 'Клиент бросил трубку',
  },
];

export function SimulateCallModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState<ScenarioKey | null>(null);
  const { mutate } = useSWRConfig();

  async function runScenario(scenarioKey: ScenarioKey) {
    setLoading(scenarioKey);
    try {
      const res = await fetch('/api/admin/simulate-call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenarioKey }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const json = (await res.json()) as {
        callId: string;
        leadId: string | null;
        orderId: string | null;
      };
      const orderHint = json.orderId ? ` · order ${json.orderId.slice(0, 8)}…` : '';
      toast.success(`Simulated call: ${json.callId.slice(0, 8)}…${orderHint}`);
      // Trigger SWR refetch of any /api/calls key.
      await mutate((key) => typeof key === 'string' && key.startsWith('/api/calls'), undefined, {
        revalidate: true,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(`Simulation failed: ${(err as Error).message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border">
        <DialogHeader>
          <DialogTitle>Simulate inbound call</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          {SCENARIOS.map((s) => (
            <Button
              key={s.key}
              type="button"
              variant="outline"
              disabled={loading !== null}
              onClick={() => runScenario(s.key)}
              className="h-auto justify-start border-border py-3 text-left"
              data-testid={`simulate-${s.key}`}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium">{s.label}</span>
                <span className="text-muted-foreground text-xs">{s.description}</span>
              </div>
              {loading === s.key && (
                <span className="ml-auto text-muted-foreground text-xs">…</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
