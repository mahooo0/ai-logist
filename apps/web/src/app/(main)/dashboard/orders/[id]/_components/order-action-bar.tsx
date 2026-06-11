'use client';
// Phase 6 D-22 — Admin action bar on /dashboard/orders/[id].
//
// Three controls:
//   1. Status dropdown — calls PATCH /api/orders/:id/status with confirm-prompt reason.
//   2. Pause / Resume toggle — calls POST /api/orders/:id/ticker.
//   3. Reset progress — calls PATCH /api/orders/:id/progress (Phase 5 endpoint reuse).
//
// All actions invalidate SWR via mutate(`/api/orders/${orderId}`).

import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUSES = [
  'CREATED', 'DRIVER_ASSIGNED', 'AT_LOADING', 'IN_TRANSIT',
  'AT_BORDER', 'DELIVERED', 'CLOSED',
  'DELIVERED_PENDING', 'AWAITING_PAYMENT', 'CANCELED',
] as const;

export interface OrderActionBarProps {
  orderId: string;
  currentStatus: string;
  autoProgressPaused: boolean;
}

export function OrderActionBar({ orderId, currentStatus, autoProgressPaused }: OrderActionBarProps) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const refresh = () => mutate(`/api/orders/${orderId}`);

  async function changeStatus(newStatus: string) {
    if (newStatus === currentStatus) return;
    const reason = window.prompt(`Reason for forcing status → ${newStatus}?`, 'manual override');
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      if (!res.ok) throw new Error(`PATCH /status ${res.status}`);
      toast.success(`Status → ${newStatus}`);
      await refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/ticker`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paused: !autoProgressPaused }),
      });
      if (!res.ok) throw new Error(`POST /ticker ${res.status}`);
      toast.success(autoProgressPaused ? 'Resumed' : 'Paused');
      await refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetProgress() {
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/progress`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ progressPercent: 0 }),
      });
      if (!res.ok) throw new Error(`PATCH /progress ${res.status}`);
      toast.success('Progress reset');
      await refresh();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3" data-testid="order-action-bar">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status:</span>
        <select
          data-testid="status-dropdown"
          className="rounded border bg-background px-2 py-1"
          value={currentStatus}
          onChange={(e) => changeStatus(e.target.value)}
          disabled={busy}
        >
          {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </label>
      <Button data-testid="pause-toggle" variant={autoProgressPaused ? 'default' : 'outline'} onClick={togglePause} disabled={busy}>
        {autoProgressPaused ? 'Возобновить' : 'Пауза'}
      </Button>
      <Button data-testid="reset-progress" variant="ghost" onClick={resetProgress} disabled={busy}>
        Сброс прогресса
      </Button>
    </div>
  );
}
