"use client";

import { useSortable } from "@dnd-kit/sortable";
import { Calendar, GripVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { type KanbanTask, type Priority, tagColorClasses } from "./kanban-data";

const priorityVariants: Record<Priority, { variant: "default" | "secondary"; className: string }> = {
  High: { variant: "default", className: "bg-destructive text-white hover:bg-destructive/90" },
  Medium: { variant: "default", className: "bg-amber-500 text-white hover:bg-amber-500/90" },
  Low: { variant: "secondary", className: "" },
};

interface KanbanCardProps {
  task: KanbanTask;
  onDelete?: (id: string) => void;
}

export function KanbanCard({ task, onDelete }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = priorityVariants[task.priority];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab gap-0 rounded-xl p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <button
        type="button"
        aria-label="Drag handle"
        className="absolute top-3 right-2 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.label}
              className={cn("inline-block rounded px-1.5 py-0.5 font-medium text-[10px]", tagColorClasses[tag.color])}
            >
              {tag.label}
            </span>
          ))}
        </div>
      )}

      <p className="pr-6 font-medium text-foreground text-sm leading-snug">{task.title}</p>
      <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">{task.description}</p>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant={priority.variant} className={cn("h-5 rounded-md px-1.5 text-[10px]", priority.className)}>
          {task.priority}
        </Badge>

        {task.dueDate && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {task.dueDate}
          </span>
        )}

        <span className="flex-1" />

        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete task: ${task.title}`}
            className="rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {task.assignee && (
          <div
            title={task.assignee.name}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-[10px] text-primary"
          >
            {task.assignee.initials}
          </div>
        )}
      </div>
    </Card>
  );
}
