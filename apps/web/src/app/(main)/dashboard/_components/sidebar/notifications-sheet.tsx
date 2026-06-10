"use client";

import { useMemo, useState } from "react";

import { AtSign, Bell, CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { notifications as initialNotifications, type Notification, type NotificationType } from "@/data/notifications";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: CircleAlert,
  mention: AtSign,
};

const TYPE_TINT: Record<NotificationType, string> = {
  info: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/10",
  success: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10",
  warning: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10",
  error: "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10",
  mention: "text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NotificationRow({ item, onMarkRead }: { item: Notification; onMarkRead: (id: string) => void }) {
  const Icon = TYPE_ICON[item.type];

  return (
    <button
      type="button"
      onClick={() => item.unread && onMarkRead(item.id)}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors",
        "hover:bg-accent/60",
        item.unread && "bg-accent/30",
      )}
    >
      {item.actor ? (
        <Avatar className="size-9 border">
          <AvatarFallback className="font-medium text-xs">{getInitials(item.actor.name)}</AvatarFallback>
        </Avatar>
      ) : (
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TYPE_TINT[item.type])}>
          <Icon className="size-4" />
        </span>
      )}

      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", item.unread ? "font-medium text-foreground" : "text-foreground")}>
            {item.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span>
        </div>
        <p className="line-clamp-2 text-muted-foreground text-xs">{item.description}</p>
      </div>

      {item.unread && (
        <span className="absolute top-3 right-3 size-2 rounded-full bg-primary" role="status" aria-label="Unread" />
      )}
    </button>
  );
}

export function NotificationsSheet() {
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const unreadCount = useMemo(() => items.filter((n) => n.unread).length, [items]);

  const filtered = useMemo(() => {
    if (tab === "unread") return items.filter((n) => n.unread);
    return items;
  }, [items, tab]);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Open notifications" className="relative">
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex size-2 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-xl">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-[11px] text-primary-foreground">
                {unreadCount} new
              </span>
            )}
          </div>
          <SheetDescription>Stay on top of what's happening across your workspace.</SheetDescription>
        </SheetHeader>

        <div className="border-b px-6 py-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Unread {unreadCount > 0 && <span className="ml-1 text-muted-foreground">({unreadCount})</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 py-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-5 text-muted-foreground" />
                </span>
                <p className="font-medium text-sm">You're all caught up</p>
                <p className="text-muted-foreground text-xs">No unread notifications right now.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <NotificationRow item={item} onMarkRead={markRead} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="border-t px-6 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0} className="text-xs">
              Mark all as read
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              Notification settings
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
