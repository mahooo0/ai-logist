"use client";

import { CircleCheck, CircleDot, Clock, Inbox, type LucideIcon, Tag, UserPlus, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABEL, type Channel, type Conversation, type ConversationStatus } from "@/data/chat";
import { cn } from "@/lib/utils";

import { ChannelIcon } from "./channel-icon";

const VIEWS = [
  { id: "all", label: "All conversations", Icon: Inbox },
  { id: "mine", label: "Mine", Icon: UserPlus },
  { id: "unassigned", label: "Unassigned", Icon: Users },
] as const;

const STATUSES: { id: ConversationStatus; label: string; Icon: LucideIcon }[] = [
  { id: "open", label: "Open", Icon: CircleDot },
  { id: "pending", label: "Pending", Icon: Clock },
  { id: "resolved", label: "Resolved", Icon: CircleCheck },
];

const CHANNELS: Channel[] = ["whatsapp", "telegram", "instagram", "messenger", "email", "livechat", "sms"];

export type View = (typeof VIEWS)[number]["id"];

function countWhere(items: Conversation[], pred: (c: Conversation) => boolean) {
  return items.filter(pred).length;
}

function unreadWhere(items: Conversation[], pred: (c: Conversation) => boolean) {
  return items.filter(pred).reduce((sum, c) => sum + (c.unread > 0 ? 1 : 0), 0);
}

export function ConversationsRail({
  conversations,
  view,
  onView,
  channel,
  onChannel,
  status,
  onStatus,
}: {
  conversations: Conversation[];
  view: View;
  onView: (v: View) => void;
  channel: Channel | "all";
  onChannel: (c: Channel | "all") => void;
  status: ConversationStatus | "all";
  onStatus: (s: ConversationStatus | "all") => void;
}) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-sm">Inbox</h2>
        <p className="text-[11px] text-muted-foreground">Multi-channel CRM</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 text-sm">
        <ul className="space-y-0.5">
          {VIEWS.map(({ id, label, Icon }) => {
            const active = view === id;
            const total =
              id === "all"
                ? conversations.length
                : id === "mine"
                  ? countWhere(conversations, (c) => c.assignee?.name === "You")
                  : countWhere(conversations, (c) => !c.assignee);
            const unread =
              id === "all"
                ? unreadWhere(conversations, () => true)
                : id === "mine"
                  ? unreadWhere(conversations, (c) => c.assignee?.name === "You")
                  : unreadWhere(conversations, (c) => !c.assignee);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onView(id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{label}</span>
                  {unread > 0 ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {unread}
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{total}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 px-2.5 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          Status
        </p>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onStatus("all")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5",
                status === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Tag className="size-4 opacity-50" />
              <span className="flex-1 text-left">Any status</span>
            </button>
          </li>
          {STATUSES.map(({ id, label, Icon }) => {
            const active = status === id;
            const count = countWhere(conversations, (c) => c.status === id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onStatus(id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{label}</span>
                  <span className="text-[11px] text-muted-foreground">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 px-2.5 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          Channels
        </p>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              onClick={() => onChannel("all")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5",
                channel === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <span className="size-4 opacity-50">·</span>
              <span className="flex-1 text-left">All channels</span>
            </button>
          </li>
          {CHANNELS.map((c) => {
            const active = channel === c;
            const count = countWhere(conversations, (x) => x.channel === c);
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onChannel(c)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <ChannelIcon channel={c} className="size-4 opacity-80" />
                  <span className="flex-1 text-left">{CHANNEL_LABEL[c]}</span>
                  <span className="text-[11px] text-muted-foreground">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
