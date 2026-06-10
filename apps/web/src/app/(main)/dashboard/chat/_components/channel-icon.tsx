"use client";

import { Globe, Mail, MessageSquare, Phone } from "lucide-react";
import { siInstagram, siMessenger, siTelegram, siWhatsapp } from "simple-icons";

import { SimpleIcon } from "@/components/simple-icon";
import { CHANNEL_TINT, type Channel } from "@/data/chat";
import { cn } from "@/lib/utils";

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  if (channel === "whatsapp") return <SimpleIcon icon={siWhatsapp} className={cn("size-4 fill-current", className)} />;
  if (channel === "telegram") return <SimpleIcon icon={siTelegram} className={cn("size-4 fill-current", className)} />;
  if (channel === "instagram")
    return <SimpleIcon icon={siInstagram} className={cn("size-4 fill-current", className)} />;
  if (channel === "messenger")
    return <SimpleIcon icon={siMessenger} className={cn("size-4 fill-current", className)} />;
  if (channel === "email") return <Mail className={cn("size-4", className)} />;
  if (channel === "livechat") return <Globe className={cn("size-4", className)} />;
  if (channel === "sms") return <Phone className={cn("size-4", className)} />;
  return <MessageSquare className={cn("size-4", className)} />;
}

export function ChannelChip({ channel, className }: { channel: Channel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-white",
        CHANNEL_TINT[channel],
        className,
      )}
    >
      <ChannelIcon channel={channel} className="size-3.5 fill-current text-white" />
    </span>
  );
}
