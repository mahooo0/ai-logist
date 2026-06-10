"use client";

import { Archive, FileEdit, Inbox, MailWarning, Send, Star, Tag, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LABEL_COLORS, type Mail, type MailFolder, type MailLabel } from "@/data/mail";
import { cn } from "@/lib/utils";

const FOLDERS: { id: MailFolder; label: string; Icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "starred", label: "Starred", Icon: Star },
  { id: "sent", label: "Sent", Icon: Send },
  { id: "drafts", label: "Drafts", Icon: FileEdit },
  { id: "spam", label: "Spam", Icon: MailWarning },
  { id: "archive", label: "Archive", Icon: Archive },
  { id: "trash", label: "Trash", Icon: Trash2 },
];

const LABELS: MailLabel[] = ["work", "personal", "team", "billing", "social"];

function folderCount(mails: Mail[], folder: MailFolder) {
  if (folder === "starred") return mails.filter((m) => m.starred && m.folder !== "trash").length;
  return mails.filter((m) => m.folder === folder).length;
}

function folderUnread(mails: Mail[], folder: MailFolder) {
  if (folder === "starred") return mails.filter((m) => m.starred && !m.read && m.folder !== "trash").length;
  return mails.filter((m) => m.folder === folder && !m.read).length;
}

export function MailFolders({
  current,
  onSelect,
  mails,
  onCompose,
}: {
  current: MailFolder;
  onSelect: (f: MailFolder) => void;
  mails: Mail[];
  onCompose: () => void;
}) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-card">
      <div className="px-3 pt-3">
        <Button className="w-full" onClick={onCompose}>
          <FileEdit /> Compose
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {FOLDERS.map(({ id, label, Icon }) => {
            const total = folderCount(mails, id);
            const unread = folderUnread(mails, id);
            const active = current === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 text-left">{label}</span>
                  {unread > 0 ? (
                    <Badge className="h-5 px-1.5 text-[10px]" variant="secondary">
                      {unread}
                    </Badge>
                  ) : total > 0 && active ? (
                    <span className="text-[11px] text-muted-foreground">{total}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 px-2.5 pt-3 pb-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
          Labels
        </div>
        <ul className="space-y-0.5">
          {LABELS.map((l) => (
            <li key={l}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-muted-foreground text-sm hover:bg-accent/50 hover:text-foreground"
              >
                <span className={cn("size-2 rounded-full", LABEL_COLORS[l])} />
                <span className="flex-1 text-left capitalize">{l}</span>
                <Tag className="size-3 opacity-0 group-hover:opacity-50" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
