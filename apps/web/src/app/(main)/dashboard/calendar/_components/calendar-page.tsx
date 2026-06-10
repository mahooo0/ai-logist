"use client";

import * as React from "react";

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { cn } from "@/lib/utils";

import { EventDialog } from "./event-dialog";
import { type CalendarEvent, eventColorClasses, eventColorDotClasses } from "./event-types";
import { buildSeedEvents } from "./seed-events";

const STORAGE_KEY = "dashboard:calendar:events:v1";
const WEEK_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function readStoredEvents(): CalendarEvent[] | null {
  const raw = getLocalStorageValue(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CalendarEvent[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getMonthDays(reference: Date) {
  const start = startOfWeek(startOfMonth(reference), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(reference), { weekStartsOn: 0 });
  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function CalendarPage() {
  const [hydrated, setHydrated] = React.useState(false);
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = React.useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CalendarEvent | null>(null);
  const [dialogInitialDate, setDialogInitialDate] = React.useState<string | undefined>();

  React.useEffect(() => {
    const stored = readStoredEvents();
    setEvents(stored ?? buildSeedEvents(new Date()));
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    setLocalStorageValue(STORAGE_KEY, JSON.stringify(events));
  }, [events, hydrated]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  const monthDays = React.useMemo(() => getMonthDays(currentMonth), [currentMonth]);

  const upcoming = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter((ev) => {
        const d = parseISO(ev.date);
        return isSameDay(d, today) || isAfter(d, today);
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [events]);

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const selectedEvents = selectedKey ? (eventsByDate.get(selectedKey) ?? []) : [];

  const handleSave = (event: CalendarEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = event;
        return next;
      }
      return [...prev, event];
    });
  };

  const handleDelete = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const openCreate = (date?: Date) => {
    setEditing(null);
    setDialogInitialDate(date ? format(date, "yyyy-MM-dd") : undefined);
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditing(event);
    setDialogInitialDate(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-bold text-2xl text-foreground tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm">Schedule and manage events</p>
        </div>
        <Button onClick={() => openCreate()} className="sm:self-auto">
          <Plus />
          Add Event
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b p-3 sm:p-4">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight />
              </Button>
              <h2 className="ml-2 font-semibold text-base sm:text-lg">{format(currentMonth, "MMMM yyyy")}</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                setCurrentMonth(now);
                setSelectedDate(now);
              }}
            >
              Today
            </Button>
          </div>

          <div className="grid grid-cols-7 border-b text-center text-muted-foreground text-xs">
            {WEEK_HEADERS.map((label) => (
              <div key={label} className="px-2 py-2">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthDays.map((day, idx) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate.get(key) ?? [];
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const selected = selectedDate ? isSameDay(day, selectedDate) : false;
              const lastCol = (idx + 1) % 7 === 0;
              const lastRow = idx >= monthDays.length - 7;

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  onDoubleClick={() => openCreate(day)}
                  className={cn(
                    "group relative flex min-h-[110px] flex-col gap-1 p-2 text-left transition-colors",
                    !lastCol && "border-r",
                    !lastRow && "border-b",
                    !inMonth && "bg-muted/30 text-muted-foreground",
                    inMonth && "hover:bg-muted/40",
                    selected && "bg-primary/5 ring-1 ring-primary ring-inset",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center text-xs tabular-nums",
                      today && "rounded-full bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      // biome-ignore lint/a11y/useSemanticElements: span is nested inside a parent button (day cell); HTML disallows button-in-button
                      <span
                        key={ev.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(ev);
                          }
                        }}
                        className={cn(
                          "block truncate rounded-sm px-1.5 py-0.5 text-[11px] leading-tight",
                          eventColorClasses[ev.color],
                        )}
                      >
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            {selectedDate ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-base">{format(selectedDate, "EEEE, d MMMM")}</p>
                    <p className="text-muted-foreground text-xs">
                      {selectedEvents.length === 0
                        ? "No events scheduled"
                        : `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openCreate(selectedDate)}>
                    <Plus />
                    Add
                  </Button>
                </div>

                {selectedEvents.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {selectedEvents.map((ev) => (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(ev)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-opacity hover:opacity-90",
                            eventColorClasses[ev.color],
                          )}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", eventColorDotClasses[ev.color])} />
                          <span className="flex-1 truncate">{ev.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Clock className="size-5 text-muted-foreground" />
                </div>
                <p className="font-medium text-sm">No date selected</p>
                <p className="text-muted-foreground text-xs">Click a day on the calendar to view its events</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <h3 className="font-semibold text-sm">Upcoming Events</h3>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-center text-muted-foreground text-xs">No upcoming events</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {upcoming.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const d = parseISO(ev.date);
                        setCurrentMonth(d);
                        setSelectedDate(d);
                        openEdit(ev);
                      }}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", eventColorDotClasses[ev.color])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{ev.title}</p>
                        <p className="text-muted-foreground text-xs">{format(parseISO(ev.date), "EEE, d MMM")}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={dialogInitialDate}
        editing={editing}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
