"use client";

import * as React from "react";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Check, Pencil, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { cn } from "@/lib/utils";

import { DashboardWidget, GRID_COLUMNS, GRID_GAP, ROW_HEIGHT } from "./dashboard-widget";
import { defaultLayout, type LayoutItem, type WidgetId, widgetRegistry } from "./widgets";

const STORAGE_KEY = "dashboard:draggable:layout:v2";

function readLayout(): LayoutItem[] {
  const raw = getLocalStorageValue(STORAGE_KEY);
  if (!raw) return defaultLayout;
  try {
    const parsed = JSON.parse(raw) as LayoutItem[];
    if (!Array.isArray(parsed)) return defaultLayout;
    const valid = parsed.filter((item) => item && item.id in widgetRegistry);
    if (valid.length !== Object.keys(widgetRegistry).length) {
      const missing = (Object.keys(widgetRegistry) as WidgetId[])
        .filter((id) => !valid.some((v) => v.id === id))
        .map((id) => ({
          id,
          colSpan: widgetRegistry[id].defaultColSpan,
          rowSpan: widgetRegistry[id].defaultRowSpan,
        }));
      return [...valid, ...missing];
    }
    return valid;
  } catch {
    return defaultLayout;
  }
}

export function DraggableDashboard() {
  const [layout, setLayout] = React.useState<LayoutItem[]>(defaultLayout);
  const [editing, setEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setLayout(readLayout());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setLocalStorageValue(STORAGE_KEY, JSON.stringify(layout));
  }, [layout, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleResize = React.useCallback((id: string, colSpan: number, rowSpan: number) => {
    setLayout((items) => items.map((item) => (item.id === id ? { ...item, colSpan, rowSpan } : item)));
  }, []);

  const handleReset = () => setLayout(defaultLayout);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 px-4 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium text-sm">{editing ? "Editing layout" : "Layout"}</span>
          <span className="text-muted-foreground text-xs">
            {editing
              ? "Drag the grip to reorder, or pull the bottom-right handle to resize."
              : "Click Edit to rearrange and resize widgets."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw />
              Reset
            </Button>
          )}
          <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((v) => !v)}>
            {editing ? <Check /> : <Pencil />}
            {editing ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToParentElement]}
      >
        <SortableContext items={layout.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div
            className={cn("grid w-full auto-rows-[var(--row-h)]", "grid-cols-1 sm:grid-cols-6 xl:grid-cols-12")}
            style={
              {
                gap: `${GRID_GAP}px`,
                "--row-h": `${ROW_HEIGHT}px`,
              } as React.CSSProperties
            }
          >
            {layout.map((item) => {
              const widget = widgetRegistry[item.id];
              if (!widget) return null;
              return (
                <DashboardWidget
                  key={item.id}
                  id={item.id}
                  colSpan={Math.min(item.colSpan, GRID_COLUMNS)}
                  rowSpan={item.rowSpan}
                  editing={editing}
                  onResize={handleResize}
                >
                  {widget.render()}
                </DashboardWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {activeId && <span className="sr-only">Moving widget {activeId}</span>}
    </div>
  );
}
