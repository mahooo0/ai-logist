"use client";

import { Paperclip, Search, Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { LABEL_COLORS, type Mail } from "@/data/mail";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MailList({
  mails,
  selectedId,
  onSelect,
  onToggleStar,
  search,
  onSearchChange,
  title,
}: {
  mails: Mail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  title: string;
}) {
  return (
    <div className="flex h-full w-full flex-col border-r md:max-w-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-base capitalize">{title}</h2>
        <span className="text-muted-foreground text-xs">{mails.length} messages</span>
      </div>

      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search this folder…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {mails.length === 0 ? (
          <li className="flex h-full items-center justify-center px-6 py-12 text-center">
            <div className="space-y-1">
              <p className="font-medium text-sm">Nothing here</p>
              <p className="text-muted-foreground text-xs">No messages match the current view.</p>
            </div>
          </li>
        ) : (
          mails.map((m) => {
            const active = selectedId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className={cn(
                    "group flex w-full gap-3 border-b px-4 py-3 text-left transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/40",
                  )}
                >
                  <Avatar className="size-9 shrink-0 border">
                    <AvatarFallback className="font-medium text-[11px]">{getInitials(m.from.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          !m.read ? "font-semibold text-foreground" : "text-foreground",
                        )}
                      >
                        {m.from.name}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{m.date}</span>
                    </div>
                    <p className={cn("truncate text-sm", !m.read ? "text-foreground" : "text-muted-foreground")}>
                      {m.subject}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {m.labels.map((l) => (
                        <span
                          key={l}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize",
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", LABEL_COLORS[l])} />
                          {l}
                        </span>
                      ))}
                      {m.hasAttachment && <Paperclip className="size-3 text-muted-foreground" />}
                      <p className="ml-auto truncate text-[11px] text-muted-foreground">{m.preview}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    {!m.read && <span className="size-2 rounded-full bg-primary" role="status" aria-label="Unread" />}
                    {/* biome-ignore lint/a11y/useSemanticElements: nested inside a parent <button>; HTML disallows button-in-button */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(m.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onToggleStar(m.id);
                        }
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10"
                      aria-label={m.starred ? "Unstar" : "Star"}
                    >
                      <Star className={cn("size-3.5", m.starred && "fill-amber-400 text-amber-400")} />
                    </span>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
