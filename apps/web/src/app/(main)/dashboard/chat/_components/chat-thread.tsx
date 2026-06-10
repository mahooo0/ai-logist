"use client";

import { useState } from "react";

import { CheckCheck, ChevronDown, MessageSquare, Paperclip, Send, Smile, UserCog, Zap } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANNEL_LABEL,
  type Conversation,
  type ConversationStatus,
  type Message,
  QUICK_REPLIES,
  STATUS_TINT,
} from "@/data/chat";
import { cn } from "@/lib/utils";

import { ChannelChip } from "./channel-icon";

const STATUS_OPTIONS: { id: ConversationStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "resolved", label: "Resolved" },
];

const TEAM = [
  { name: "You", initials: "YU" },
  { name: "Jamik", initials: "JT" },
  { name: "Aigars", initials: "AS" },
  { name: "Sevinc", initials: "SA" },
];

function MessageBubble({ msg }: { msg: Message }) {
  const isAgent = msg.sender === "agent";
  const isBot = msg.sender === "bot";
  return (
    <div className={cn("flex w-full gap-2", isAgent ? "justify-end" : "justify-start")}>
      {!isAgent && (
        <Avatar className="size-7 border">
          <AvatarFallback className="text-[10px]">{isBot ? "🤖" : (msg.authorName?.[0] ?? "?")}</AvatarFallback>
        </Avatar>
      )}
      <div className={cn("max-w-[70%] space-y-1", isAgent && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            isAgent
              ? "rounded-br-md bg-primary text-primary-foreground"
              : isBot
                ? "border border-dashed bg-background"
                : "rounded-bl-md bg-muted text-foreground",
          )}
        >
          {msg.text}
        </div>
        <div className={cn("flex items-center gap-1 text-[10px] text-muted-foreground", isAgent && "justify-end")}>
          <span>{msg.time}</span>
          {isAgent && <CheckCheck className="size-3" />}
        </div>
      </div>
    </div>
  );
}

export function ChatThread({
  conversation,
  onStatusChange,
  onAssign,
  onSendMessage,
}: {
  conversation: Conversation | null;
  onStatusChange: (id: string, s: ConversationStatus) => void;
  onAssign: (id: string, assignee: { name: string; initials: string } | undefined) => void;
  onSendMessage: (id: string, text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");

  if (!conversation) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-background">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-5 text-muted-foreground" />
          </span>
          <p className="font-medium text-sm">Pick a conversation</p>
          <p className="text-muted-foreground text-xs">Select one from the list to start chatting.</p>
        </div>
      </div>
    );
  }

  const send = () => {
    if (!draft.trim()) return;
    if (mode === "note") {
      toast("Internal note saved", { description: "Visible to team only." });
    } else {
      onSendMessage(conversation.id, draft.trim());
    }
    setDraft("");
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <Avatar className="size-9 border">
              <AvatarFallback className="font-medium text-[11px]">
                {conversation.customer.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || "·"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -right-1 -bottom-0.5">
              <ChannelChip channel={conversation.channel} className="size-5" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-sm">{conversation.customer.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              via {CHANNEL_LABEL[conversation.channel]} · {conversation.customer.handle}
              {conversation.customer.lastSeen && <> · {conversation.customer.lastSeen}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <Badge
                  variant="secondary"
                  className={cn("mr-1 h-4 px-1.5 text-[10px] capitalize", STATUS_TINT[conversation.status])}
                >
                  {conversation.status}
                </Badge>
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Set status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => onStatusChange(conversation.id, s.id)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <UserCog className="size-3.5" />
                {conversation.assignee?.name ?? "Unassigned"}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Assign to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAssign(conversation.id, undefined)}>Unassigned</DropdownMenuItem>
              {TEAM.map((m) => (
                <DropdownMenuItem key={m.name} onClick={() => onAssign(conversation.id, m)}>
                  <Avatar className="size-5 border">
                    <AvatarFallback className="text-[9px]">{m.initials}</AvatarFallback>
                  </Avatar>
                  {m.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {conversation.messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t px-5 py-3">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "reply" | "note")}>
          <TabsList className="h-8">
            <TabsTrigger value="reply" className="text-xs">
              Reply
            </TabsTrigger>
            <TabsTrigger value="note" className="text-xs">
              Internal note
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          className={cn(
            "mt-2 rounded-md border bg-background",
            mode === "note" && "border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/5",
          )}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={
              mode === "note"
                ? "Add an internal note (only visible to your team)…"
                : `Reply to ${conversation.customer.name} on ${CHANNEL_LABEL[conversation.channel]}…`
            }
            className="resize-none border-0 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7" aria-label="Attach">
                <Paperclip className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Emoji">
                <Smile className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs">
                    <Zap className="size-3.5" /> Quick reply
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  {QUICK_REPLIES.map((q) => (
                    <DropdownMenuItem
                      key={q.label}
                      onClick={() => setDraft(q.text)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="font-medium text-xs">{q.label}</span>
                      <span className="line-clamp-2 text-[11px] text-muted-foreground">{q.text}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-muted-foreground sm:inline">⌘ + Enter to send</span>
              <Button size="sm" onClick={send} disabled={!draft.trim()}>
                <Send /> {mode === "note" ? "Save note" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
