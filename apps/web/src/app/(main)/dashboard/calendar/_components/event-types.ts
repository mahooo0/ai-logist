export type EventColor = "green" | "amber" | "rose" | "slate";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color: EventColor;
}

export const eventColorClasses: Record<EventColor, string> = {
  green:
    "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  amber:
    "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  rose: "bg-rose-100 text-rose-900 ring-1 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
  slate: "bg-muted text-foreground ring-1 ring-border",
};

export const eventColorDotClasses: Record<EventColor, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-muted-foreground",
};

export const eventColorLabels: Record<EventColor, string> = {
  green: "Default",
  amber: "Important",
  rose: "Urgent",
  slate: "Routine",
};
