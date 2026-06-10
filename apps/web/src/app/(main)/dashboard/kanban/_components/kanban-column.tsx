"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { KanbanCard } from "./kanban-card";
import type { ColumnId, KanbanTask } from "./kanban-data";

interface KanbanColumnProps {
  id: ColumnId;
  title: string;
  tasks: KanbanTask[];
  onDeleteTask?: (id: string) => void;
}

export function KanbanColumn({ id, title, tasks, onDeleteTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column" } });

  return (
    <div className="flex w-[320px] min-w-[320px] flex-col rounded-xl bg-muted/50 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        <Badge variant="secondary" className="rounded-md px-2 text-[11px] tabular-nums">
          {tasks.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onDelete={onDeleteTask} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
