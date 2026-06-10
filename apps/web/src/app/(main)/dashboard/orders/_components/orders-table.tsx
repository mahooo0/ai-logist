'use client';
import type { OrderListItem } from '@ai-logist/shared-types/api/orders';
// apps/web/src/app/(main)/dashboard/orders/_components/orders-table.tsx
// 7 columns per D-32 (number / created / client / from→to / status / price / channel).
// Row click navigates to /dashboard/orders/[id] per D-34 (NOT a modal).
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatMoney } from '@/lib/format';

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
};

export function OrdersTable({
  orders,
  onRowClick,
}: {
  orders: OrderListItem[];
  onRowClick: (orderId: string) => void;
}) {
  const columns: ColumnDef<OrderListItem>[] = [
    {
      header: 'Номер',
      accessorKey: 'number',
      cell: ({ row }) => <span className="font-mono">{row.original.number}</span>,
    },
    {
      header: 'Создан',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <span className="text-sm">{formatDate(row.original.createdAt, 'ru')}</span>
      ),
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
    <div className="rounded-lg border-border border">
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
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                Нет заказов
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
