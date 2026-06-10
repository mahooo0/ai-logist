import type { Metadata } from "next";

import { ChatApp } from "./_components/chat-app";

export const metadata: Metadata = {
  title: "Chat",
  description: "Multi-channel messenger CRM.",
};

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Chat</h1>
        <p className="text-muted-foreground text-sm">
          Unified inbox across WhatsApp, Telegram, Instagram, Live chat, Email and SMS.
        </p>
      </header>
      <ChatApp />
    </div>
  );
}
