"use client";

import { useMemo, useState } from "react";

import { type Channel, type Conversation, type ConversationStatus, conversations as initial } from "@/data/chat";

import { ChatThread } from "./chat-thread";
import { ConversationList } from "./conversation-list";
import { ConversationsRail, type View } from "./conversations-rail";
import { CustomerPanel } from "./customer-panel";

export function ChatApp() {
  const [items, setItems] = useState<Conversation[]>(initial);
  const [view, setView] = useState<View>("all");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [status, setStatus] = useState<ConversationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    let pool = items;
    if (view === "mine") pool = pool.filter((c) => c.assignee?.name === "You");
    if (view === "unassigned") pool = pool.filter((c) => !c.assignee);
    if (channel !== "all") pool = pool.filter((c) => c.channel === channel);
    if (status !== "all") pool = pool.filter((c) => c.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (c) =>
          c.customer.name.toLowerCase().includes(q) ||
          c.customer.handle.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q),
      );
    }
    return pool.slice().sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false));
  }, [items, view, channel, status, search]);

  const selected = items.find((c) => c.id === selectedId) ?? null;
  const visibleSelected = visible.find((c) => c.id === selectedId) ? selected : null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  };

  const setStatusFor = (id: string, s: ConversationStatus) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status: s } : c)));
  };

  const assign = (id: string, assignee: { name: string; initials: string } | undefined) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, assignee } : c)));
  };

  const sendMessage = (id: string, text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              lastMessage: text,
              lastTime: "now",
              messages: [
                ...c.messages,
                {
                  id: `agent-${Date.now()}`,
                  sender: "agent",
                  authorName: "You",
                  text,
                  time,
                },
              ],
            }
          : c,
      ),
    );
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[560px] overflow-hidden rounded-lg border bg-card">
      <ConversationsRail
        conversations={items}
        view={view}
        onView={setView}
        channel={channel}
        onChannel={setChannel}
        status={status}
        onStatus={setStatus}
      />
      <ConversationList
        conversations={visible}
        selectedId={selectedId}
        onSelect={handleSelect}
        search={search}
        onSearchChange={setSearch}
      />
      <ChatThread
        conversation={visibleSelected}
        onStatusChange={setStatusFor}
        onAssign={assign}
        onSendMessage={sendMessage}
      />
      <CustomerPanel conversation={visibleSelected} />
    </div>
  );
}
