"use client";

import { ArrowRight, Heart, Loader2, Mail, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Section, SubBlock } from "./section";

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons & Badges"
      description="Variants, sizes, icons, loading states, and badge styles."
    >
      <div className="space-y-6">
        <SubBlock label="Variants">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </SubBlock>

        <SubBlock label="Sizes">
          <Button size="sm">Small</Button>
          <Button>Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Icon button">
            <Plus />
          </Button>
        </SubBlock>

        <SubBlock label="With icons">
          <Button>
            <Mail /> Email me
          </Button>
          <Button variant="outline">
            Continue <ArrowRight />
          </Button>
          <Button variant="destructive">
            <Trash2 /> Delete
          </Button>
          <Button variant="secondary">
            <Heart /> Like
          </Button>
        </SubBlock>

        <SubBlock label="States">
          <Button disabled>Disabled</Button>
          <Button disabled>
            <Loader2 className="animate-spin" /> Loading…
          </Button>
        </SubBlock>

        <SubBlock label="Badges">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge className="rounded-full">Pill</Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
            Success
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">Pending</Badge>
        </SubBlock>
      </div>
    </Section>
  );
}
