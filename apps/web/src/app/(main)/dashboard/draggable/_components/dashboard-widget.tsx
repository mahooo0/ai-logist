"use client";

import * as React from "react";

import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

export const GRID_COLUMNS = 12;
export const ROW_HEIGHT = 120;
export const GRID_GAP = 16;
export const MIN_COL_SPAN = 3;
export const MIN_ROW_SPAN = 1;
export const MAX_ROW_SPAN = 6;

interface DashboardWidgetProps {
  id: string;
  colSpan: number;
  rowSpan: number;
  editing: boolean;
  onResize: (id: string, colSpan: number, rowSpan: number) => void;
  children: React.ReactNode;
}

export function DashboardWidget({ id, colSpan, rowSpan, editing, onResize, children }: DashboardWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editing,
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [resizing, setResizing] = React.useState(false);

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    gridColumn: `span ${Math.min(colSpan, GRID_COLUMNS)} / span ${Math.min(colSpan, GRID_COLUMNS)}`,
    gridRow: `span ${rowSpan} / span ${rowSpan}`,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();

    const node = containerRef.current?.parentElement;
    if (!node) return;

    const gridEl = node.parentElement;
    if (!gridEl) return;

    const gridRect = gridEl.getBoundingClientRect();
    const colWidth = (gridRect.width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    const startX = event.clientX;
    const startY = event.clientY;
    const startCol = colSpan;
    const startRow = rowSpan;

    setResizing(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    let nextCol = startCol;
    let nextRow = startRow;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const colDelta = Math.round(dx / (colWidth + GRID_GAP));
      const rowDelta = Math.round(dy / (ROW_HEIGHT + GRID_GAP));

      nextCol = Math.max(MIN_COL_SPAN, Math.min(GRID_COLUMNS, startCol + colDelta));
      nextRow = Math.max(MIN_ROW_SPAN, Math.min(MAX_ROW_SPAN, startRow + rowDelta));

      onResize(id, nextCol, nextRow);
    };

    const onEnd = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  return (
    <div ref={setNodeRef} style={style} className="relative min-w-0">
      <div
        ref={containerRef}
        className={cn(
          "@container/widget relative h-full min-h-0 w-full overflow-hidden rounded-xl transition-shadow",
          editing && "ring-1 ring-primary/30 ring-offset-2 ring-offset-background",
          (isDragging || resizing) && "shadow-lg ring-2 ring-primary",
        )}
      >
        {editing && (
          <button
            type="button"
            aria-label={`Drag ${id}`}
            className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <div className={cn("h-full w-full", editing && "pointer-events-none select-none")}>{children}</div>

        {editing && (
          <button
            type="button"
            aria-label={`Resize ${id}`}
            onPointerDown={handleResizeStart}
            className="absolute right-1 bottom-1 z-10 h-4 w-4 cursor-se-resize touch-none"
          >
            <span
              aria-hidden
              className="block h-full w-full rounded-sm border-primary/70 border-r-2 border-b-2 transition-colors hover:border-primary"
            />
          </button>
        )}
      </div>
    </div>
  );
}
