import type { Metadata } from "next";

import { MailApp } from "./_components/mail-app";

export const metadata: Metadata = {
  title: "Mail",
  description: "Read and compose messages.",
};

export default function MailPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Mail</h1>
        <p className="text-muted-foreground text-sm">Read, search, and compose messages.</p>
      </header>
      <MailApp />
    </div>
  );
}
