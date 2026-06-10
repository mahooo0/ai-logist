import type { Metadata } from "next";

import { ButtonsSection } from "./_components/buttons-section";
import { DataDisplaySection } from "./_components/data-display-section";
import { FormSection } from "./_components/form-section";
import { InputsSection } from "./_components/inputs-section";
import { OriginUiSection } from "./_components/origin-ui-section";
import { OverlaysSection } from "./_components/overlays-section";

export const metadata: Metadata = {
  title: "Components",
  description: "Showcase of all UI primitives and Origin UI patterns.",
};

const SECTIONS = [
  { id: "buttons", label: "Buttons & Badges" },
  { id: "inputs", label: "Inputs" },
  { id: "overlays", label: "Overlays" },
  { id: "data", label: "Data display" },
  { id: "form", label: "Form" },
  { id: "origin", label: "Origin UI" },
];

export default function ComponentsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">Components</h1>
        <p className="max-w-2xl text-muted-foreground">
          Every primitive available in this template — buttons, sheets, dialogs, forms, tables — plus a curated set of
          composed patterns inspired by{" "}
          <a
            className="font-medium underline-offset-4 hover:underline"
            href="https://originui.com"
            target="_blank"
            rel="noreferrer"
          >
            Origin UI
          </a>
          . Use it as a kitchen-sink reference when building new pages.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-lg border bg-card p-3 text-sm">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <ButtonsSection />
      <InputsSection />
      <OverlaysSection />
      <DataDisplaySection />
      <FormSection />
      <OriginUiSection />
    </div>
  );
}
