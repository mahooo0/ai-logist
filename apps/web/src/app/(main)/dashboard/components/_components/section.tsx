import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 space-y-4", className)}>
      <header className="space-y-1">
        <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </header>
      <div className="rounded-lg border bg-card p-6">{children}</div>
    </section>
  );
}

export function SubBlock({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
