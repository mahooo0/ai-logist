"use client";

import { Building2, Globe, History, Mail, Phone, Tag } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CHANNEL_LABEL, type Conversation } from "@/data/chat";

import { ChannelIcon } from "./channel-icon";

export function CustomerPanel({ conversation }: { conversation: Conversation | null }) {
  if (!conversation) return null;
  const c = conversation.customer;

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-l bg-card xl:flex">
      <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
        <Avatar className="size-16 border">
          <AvatarFallback className="text-base">
            {c.name
              .split(/\s+/)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase() || "·"}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-0.5">
          <p className="font-semibold text-sm">{c.name}</p>
          <p className="text-muted-foreground text-xs">{c.handle}</p>
        </div>
        {c.tags && c.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {c.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 text-[10px]">
                <Tag className="size-2.5" />
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4 px-5 py-4 text-xs">
        <Detail label="Channel" icon={<ChannelIcon channel={conversation.channel} className="size-3.5" />}>
          {CHANNEL_LABEL[conversation.channel]}
        </Detail>
        {c.email && (
          <Detail label="Email" icon={<Mail className="size-3.5" />}>
            <a href={`mailto:${c.email}`} className="hover:underline">
              {c.email}
            </a>
          </Detail>
        )}
        {c.phone && (
          <Detail label="Phone" icon={<Phone className="size-3.5" />}>
            <a href={`tel:${c.phone}`} className="hover:underline">
              {c.phone}
            </a>
          </Detail>
        )}
        {c.company && (
          <Detail label="Company" icon={<Building2 className="size-3.5" />}>
            {c.company}
          </Detail>
        )}
        {c.location && (
          <Detail label="Location" icon={<Globe className="size-3.5" />}>
            {c.location}
          </Detail>
        )}
        {c.lastSeen && (
          <Detail label="Last seen" icon={<History className="size-3.5" />}>
            {c.lastSeen}
          </Detail>
        )}
      </div>

      <Separator />

      <div className="px-5 py-4 text-xs">
        <p className="mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">Recent activity</p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex justify-between gap-2">
            <span>Order #4421</span>
            <span className="tabular-nums">$248.00</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Subscription</span>
            <span>Pro · annual</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Open tickets</span>
            <span>2</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Lifetime value</span>
            <span className="tabular-nums">$3,420.00</span>
          </li>
        </ul>
      </div>
    </aside>
  );
}

function Detail({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}
