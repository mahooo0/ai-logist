// Phase 6 Plan 06-04 Wave 4 — OrderActionBar RTL tests.
// Decision: D-22
// Covers 5 behaviors: render, pause-click, status-change, reset-progress, paused label.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from './_helpers/render';
import { OrderActionBar } from '../src/app/(main)/dashboard/orders/[id]/_components/order-action-bar';

vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('order-action-bar', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as never;
    vi.stubGlobal('prompt', () => 'demo reason');
  });

  it('D-22 renders status dropdown + pause toggle + reset progress button', () => {
    render(
      <OrderActionBar orderId="test-id" currentStatus="CREATED" autoProgressPaused={false} />
    );
    expect(screen.getByTestId('status-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('pause-toggle')).toHaveTextContent('Пауза');
    expect(screen.getByTestId('reset-progress')).toBeInTheDocument();
  });

  it('D-22 pause click hits /ticker with paused:true', async () => {
    render(
      <OrderActionBar orderId="order-x" currentStatus="CREATED" autoProgressPaused={false} />
    );
    fireEvent.click(screen.getByTestId('pause-toggle'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/orders/order-x/ticker',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ paused: true }),
      })
    ));
  });

  it('D-22 status change prompts reason and PATCHes /status', async () => {
    render(
      <OrderActionBar orderId="order-x" currentStatus="CREATED" autoProgressPaused={false} />
    );
    fireEvent.change(screen.getByTestId('status-dropdown'), { target: { value: 'CANCELED' } });
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/orders/order-x/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELED', reason: 'demo reason' }),
      })
    ));
  });

  it('D-22 reset progress hits /progress with progressPercent:0', async () => {
    render(
      <OrderActionBar orderId="order-x" currentStatus="CREATED" autoProgressPaused={false} />
    );
    fireEvent.click(screen.getByTestId('reset-progress'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/orders/order-x/progress',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ progressPercent: 0 }),
      })
    ));
  });

  it('D-22 shows "Возобновить" label when autoProgressPaused=true', () => {
    render(
      <OrderActionBar orderId="order-x" currentStatus="CREATED" autoProgressPaused={true} />
    );
    expect(screen.getByTestId('pause-toggle')).toHaveTextContent('Возобновить');
  });
});
