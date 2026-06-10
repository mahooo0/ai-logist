"use client";

import { useState } from "react";

import { Archive, ChevronDown, Forward, Inbox, Paperclip, Reply, ReplyAll, Send, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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

export function MailViewer({
  mail,
  onArchive,
  onDelete,
  onToggleStar,
}: {
  mail: Mail | null;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStar: (id: string) => void;
}) {
  const [reply, setReply] = useState("");

  if (!mail) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-background">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="size-5 text-muted-foreground" />
          </span>
          <p className="font-medium text-sm">No message selected</p>
          <p className="text-muted-foreground text-xs">Pick a conversation from the list to read it here.</p>
        </div>
      </div>
    );
  }

  const sendReply = () => {
    if (!reply.trim()) return;
    toast.success("Reply sent", { description: `To ${mail.from.name}` });
    setReply("");
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <Button size="icon" variant="ghost" aria-label="Archive" onClick={() => onArchive(mail.id)}>
          <Archive />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => onDelete(mail.id)}>
          <Trash2 />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button size="icon" variant="ghost" aria-label="Reply" onClick={() => setReply((r) => r || "")}>
          <Reply />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Reply all">
          <ReplyAll />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Forward">
          <Forward />
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={mail.starred ? "Unstar" : "Star"}
            onClick={() => onToggleStar(mail.id)}
          >
            <Star className={cn("size-4", mail.starred && "fill-amber-400 text-amber-400")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="text-xs">
                More <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Mark as unread</DropdownMenuItem>
              <DropdownMenuItem>Snooze</DropdownMenuItem>
              <DropdownMenuItem>Add label</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Block sender</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Headers */}
      <div className="space-y-3 border-b px-6 py-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-10 border">
            <AvatarFallback className="font-medium text-xs">{getInitials(mail.from.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-lg leading-tight">{mail.subject}</h2>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="font-medium">{mail.from.name}</span>
              <span className="text-muted-foreground">&lt;{mail.from.email}&gt;</span>
              <span className="text-muted-foreground text-xs">to {mail.to}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {mail.labels.map((l) => (
                <span
                  key={l}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize"
                >
                  <span className={cn("size-1.5 rounded-full", LABEL_COLORS[l])} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <span className="shrink-0 text-muted-foreground text-xs">{mail.date}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <pre className="whitespace-pre-wrap font-sans text-foreground text-sm leading-relaxed">{mail.body}</pre>

        {mail.hasAttachment && (
          <div className="mt-6">
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Attachments</p>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <Paperclip className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">forecast-q3-v2.pdf</span>
              <span className="text-muted-foreground text-xs">238 KB</span>
              <Button size="sm" variant="outline">
                Download
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reply box */}
      <div className="border-t px-6 py-3">
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder={`Reply to ${mail.from.name}…`}
          className="resize-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-xs">
            <Paperclip className="size-3.5" /> Attach
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReply("")} disabled={!reply}>
              Discard
            </Button>
            <Button size="sm" onClick={sendReply} disabled={!reply.trim()}>
              <Send /> Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
