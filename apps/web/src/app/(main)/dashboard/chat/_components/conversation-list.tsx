"use client";

import { Pin, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type Conversation, STATUS_TINT } from "@/data/chat";
import { cn } from "@/lib/utils";

import { ChannelChip } from "./channel-icon";

function getInitials(name: string) {
  if (!name || name.startsWith("+") || /^[0-9]/.test(name)) return "·";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
}) {
  return (
    <div className="flex h-full w-full flex-col border-r md:max-w-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-base">Conversations</h2>
        <span className="text-muted-foreground text-xs">{conversations.length}</span>
      </div>
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <li className="flex h-full items-center justify-center px-6 py-12 text-center">
            <div className="space-y-1">
              <p className="font-medium text-sm">No conversations</p>
              <p className="text-muted-foreground text-xs">Try a different filter or search.</p>
            </div>
          </li>
        ) : (
          conversations.map((c) => {
            const active = selectedId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "group flex w-full gap-3 border-b px-4 py-3 text-left transition-colors",
                    active ? "bg-accent" : "hover:bg-accent/40",
                  )}
                >
                  <div className="relative">
                    <Avatar className="size-10 border">
                      <AvatarFallback className="font-medium text-[11px]">
                        {getInitials(c.customer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -right-1 -bottom-0.5">
                      <ChannelChip channel={c.channel} className="size-5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          c.unread > 0 ? "font-semibold text-foreground" : "text-foreground",
                        )}
                      >
                        {c.pinned && <Pin className="-mt-0.5 mr-1 inline size-3 text-muted-foreground" />}
                        {c.customer.name}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{c.lastTime}</span>
                    </div>
                    <p
                      className={cn("line-clamp-1 text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}
                    >
                      {c.lastMessage}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className={cn("h-4 px-1.5 text-[10px] capitalize", STATUS_TINT[c.status])}
                      >
                        {c.status}
                      </Badge>
                      {c.assignee && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Avatar className="size-3.5 border">
                            <AvatarFallback className="text-[7px]">{c.assignee.initials}</AvatarFallback>
                          </Avatar>
                          {c.assignee.name}
                        </span>
                      )}
                      {c.unread > 0 && (
                        <Badge className="ml-auto h-4 min-w-4 rounded-full px-1.5 text-[10px]">{c.unread}</Badge>
                      )}
                    </div>
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
