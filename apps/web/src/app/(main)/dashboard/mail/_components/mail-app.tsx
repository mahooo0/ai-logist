"use client";

import { useMemo, useState } from "react";

import { toast } from "sonner";

import { mails as initial, type Mail, type MailFolder } from "@/data/mail";

import { MailFolders } from "./folders";
import { MailList } from "./mail-list";
import { MailViewer } from "./mail-viewer";

export function MailApp() {
  const [items, setItems] = useState<Mail[]>(initial);
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    let pool = items;
    if (folder === "starred") {
      pool = pool.filter((m) => m.starred && m.folder !== "trash");
    } else {
      pool = pool.filter((m) => m.folder === folder);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (m) =>
          m.from.name.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q),
      );
    }
    return pool;
  }, [items, folder, search]);

  const selected = items.find((m) => m.id === selectedId) ?? null;
  const visibleSelected = visible.find((m) => m.id === selectedId) ? selected : null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
  };

  const toggleStar = (id: string) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));
  };

  const archive = (id: string) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, folder: "archive" as MailFolder } : m)));
    setSelectedId(null);
    toast.success("Conversation archived");
  };

  const remove = (id: string) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, folder: "trash" as MailFolder } : m)));
    setSelectedId(null);
    toast("Moved to trash");
  };

  const compose = () => {
    toast("Compose dialog would open here", { description: "Wire it to your editor of choice." });
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-lg border bg-card">
      <MailFolders current={folder} onSelect={setFolder} mails={items} onCompose={compose} />
      <MailList
        title={folder}
        mails={visible}
        selectedId={selectedId}
        onSelect={handleSelect}
        onToggleStar={toggleStar}
        search={search}
        onSearchChange={setSearch}
      />
      <MailViewer mail={visibleSelected} onArchive={archive} onDelete={remove} onToggleStar={toggleStar} />
    </div>
  );
}
