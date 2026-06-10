'use client';

import type { Call } from '@ai-logist/shared-types/api/calls';
// apps/web/src/app/(main)/dashboard/calls/_components/calls-table.tsx
// D-28 — 6 columns: timestamp, phone (masked last 4), lang badge, duration mm:ss,
// outcome color-coded badge, linked_order. Click row → opens modal.
// @tanstack/react-table covers sorting + column rendering.
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
import { formatDate, formatDuration } from '@/lib/format';
import type { DictKey } from '@/lib/i18n/dict';
import { useT } from '@/lib/i18n/use-t';

const outcomeStyles: Record<string, string> = {
  completed: 'bg-green-600',
  abandoned: 'bg-yellow-600',
  escalated: 'bg-blue-600',
  error: 'bg-red-600',
};

export function CallsTable({
  calls,
  onRowClick,
}: {
  calls: Call[];
  onRowClick: (id: string) => void;
}) {
  const t = useT();

  const columns: ColumnDef<Call>[] = [
    {
      header: 'Время',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <span className="text-sm">{formatDate(row.original.createdAt, 'ru')}</span>
      ),
    },
    {
      header: 'Телефон',
      accessorKey: 'twilioCallSid',
      // D-28 — masked last 4. We don't store phone separately in the call row
      // (lives on the linked client); use twilio_call_sid tail as a stand-in
      // for the demo. v2 hardening will join clients + libphonenumber-js mask.
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          *** {row.original.twilioCallSid?.slice(-4) ?? '----'}
        </span>
      ),
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
      cell: ({ row }) => (
        <span className="font-mono">{formatDuration(row.original.durationS)}</span>
      ),
    },
    {
      header: t('calls.filter.outcome'),
      accessorKey: 'outcome',
      cell: ({ row }) => {
        const o = row.original.outcome;
        if (!o) return <span>—</span>;
        const dictKey = `calls.filter.outcome.${o}` as DictKey;
        return (
          <Badge className={`${outcomeStyles[o] ?? ''} text-white`} data-outcome={o}>
            {t(dictKey)}
          </Badge>
        );
      },
    },
    {
      header: 'Заказ',
      accessorKey: 'linkedLeadId',
      cell: ({ row }) =>
        row.original.linkedLeadId ? (
          <span className="text-muted-foreground">→</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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
              <TableHead key={h.id}>
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
              Звонков не найдено
            </TableCell>
          </TableRow>
        )}
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid="call-row"
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
