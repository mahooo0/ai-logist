"use client";

import * as React from "react";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { KanbanCard } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";
import {
  type ColumnId,
  initialColumns,
  initialTasks,
  type KanbanColumn as KanbanColumnType,
  type KanbanTask,
} from "./kanban-data";

export function KanbanBoard() {
  const [tasks, setTasks] = React.useState<Record<string, KanbanTask>>(initialTasks);
  const [columns, setColumns] = React.useState<KanbanColumnType[]>(initialColumns);
  const [activeTask, setActiveTask] = React.useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnForTask = React.useCallback(
    (taskId: string) => columns.find((c) => c.taskIds.includes(taskId)),
    [columns],
  );

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    if (tasks[id]) setActiveTask(tasks[id]);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const sourceCol = findColumnForTask(activeId);
    if (!sourceCol) return;

    const overIsColumn = columns.some((c) => c.id === overId);
    const targetCol = overIsColumn ? columns.find((c) => c.id === overId) : findColumnForTask(overId);
    if (!targetCol) return;

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, taskIds: [...c.taskIds] }));
      const source = next.find((c) => c.id === sourceCol.id);
      const target = next.find((c) => c.id === targetCol.id);
      if (!source || !target) return prev;

      if (source.id === target.id) {
        const oldIndex = source.taskIds.indexOf(activeId);
        const newIndex = overIsColumn ? source.taskIds.length - 1 : source.taskIds.indexOf(overId);
        source.taskIds = arrayMove(source.taskIds, oldIndex, newIndex);
      } else {
        source.taskIds = source.taskIds.filter((id) => id !== activeId);
        const insertAt = overIsColumn ? target.taskIds.length : target.taskIds.indexOf(overId);
        target.taskIds.splice(insertAt < 0 ? target.taskIds.length : insertAt, 0, activeId);
      }

      return next;
    });
  }

  function handleDeleteTask(id: string) {
    setColumns((prev) => prev.map((c) => ({ ...c, taskIds: c.taskIds.filter((t) => t !== id) })));
    setTasks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id as ColumnId}
            title={column.title}
            tasks={column.taskIds.map((id) => tasks[id]).filter(Boolean)}
            onDeleteTask={handleDeleteTask}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <KanbanCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
