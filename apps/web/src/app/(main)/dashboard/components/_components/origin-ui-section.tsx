"use client";

import { useId, useMemo, useState } from "react";

import { isValidPhoneNumber } from "libphonenumber-js";
import { Check, ChevronsUpDown, CircleCheck, Eye, EyeOff, Minus, Plus, Search, Star, Tag, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { Section, SubBlock } from "./section";

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Password input with strength meter
 * ──────────────────────────────────────────────────────────────── */
function PasswordStrengthInput() {
  const id = useId();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  const checks = useMemo(() => {
    return [
      { label: "8+ characters", ok: value.length >= 8 },
      { label: "Number", ok: /\d/.test(value) },
      { label: "Symbol", ok: /[^A-Za-z0-9]/.test(value) },
      { label: "Upper & lower", ok: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    ];
  }, [value]);

  const score = checks.filter((c) => c.ok).length;
  const tone =
    score === 0
      ? "bg-muted"
      : score <= 1
        ? "bg-rose-500"
        : score === 2
          ? "bg-amber-500"
          : score === 3
            ? "bg-sky-500"
            : "bg-emerald-500";

  return (
    <div className="w-full max-w-sm space-y-2">
      <Label htmlFor={id}>Password</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Create a strong password"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn("h-1 flex-1 rounded-full", i < score ? tone : "bg-muted")} />
        ))}
      </div>

      <ul className="space-y-1 text-xs">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cn(
              "flex items-center gap-1.5",
              c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            <CircleCheck className={cn("size-3.5", c.ok ? "fill-emerald-500/20" : "opacity-50")} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Tag input (chips)
 * ──────────────────────────────────────────────────────────────── */
function TagInput() {
  const [tags, setTags] = useState<string[]>(["design", "frontend", "ui"]);
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v || tags.includes(v)) return;
    setTags((t) => [...t, v]);
    setInput("");
  };

  const remove = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  return (
    <div className="w-full max-w-md space-y-2">
      <Label>Tags</Label>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5",
          "focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 px-2 py-0.5">
            <Tag className="size-3" />
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="ml-0.5 rounded p-0.5 hover:bg-foreground/10"
              aria-label={`Remove ${t}`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
            if (e.key === "Backspace" && !input && tags.length) {
              setTags((prev) => prev.slice(0, -1));
            }
          }}
          placeholder={tags.length ? "" : "Add tag and press Enter"}
          className="min-w-[80px] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Searchable combobox (single select)
 * ──────────────────────────────────────────────────────────────── */
const FRAMEWORKS = [
  { value: "next", label: "Next.js" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt", label: "Nuxt" },
  { value: "solidstart", label: "SolidStart" },
];

function Combobox() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const selected = FRAMEWORKS.find((f) => f.value === value);

  return (
    <div className="w-full max-w-sm space-y-2">
      <Label>Framework</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selected ? selected.label : <span className="text-muted-foreground">Select framework…</span>}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search framework…" />
            <CommandList>
              <CommandEmpty>No framework found.</CommandEmpty>
              <CommandGroup>
                {FRAMEWORKS.map((f) => (
                  <CommandItem
                    key={f.value}
                    value={f.value}
                    onSelect={(v) => {
                      setValue(v === value ? "" : v);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === f.value ? "opacity-100" : "opacity-0")} />
                    {f.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Multi-select (chips + popover)
 * ──────────────────────────────────────────────────────────────── */
const SKILLS = ["TypeScript", "React", "Next.js", "Tailwind", "GraphQL", "Postgres", "Prisma", "Docker", "AWS"];

function MultiSelect() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(["TypeScript", "React"]);
  const [query, setQuery] = useState("");

  const toggle = (s: string) => setPicked((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const filtered = SKILLS.filter((s) => s.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="w-full max-w-md space-y-2">
      <Label>Skills</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-auto min-h-9 w-full justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1">
              {picked.length === 0 && <span className="text-muted-foreground">Select skills…</span>}
              {picked.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 px-1.5 py-0.5">
                  {s}
                  {/* biome-ignore lint/a11y/useSemanticElements: nested inside the outer Button trigger; HTML disallows button-in-button */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(s);
                      }
                    }}
                    className="ml-0.5 rounded p-0.5 hover:bg-foreground/10"
                    aria-label={`Remove ${s}`}
                  >
                    <X className="size-3" />
                  </span>
                </Badge>
              ))}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-muted-foreground text-sm">No matches</p>
            ) : (
              filtered.map((s) => {
                const active = picked.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggle(s)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <Check className={cn("size-4", active ? "opacity-100" : "opacity-0")} />
                    {s}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Number stepper
 * ──────────────────────────────────────────────────────────────── */
function NumberStepper() {
  const [n, setN] = useState(1);
  return (
    <div className="space-y-2">
      <Label>Quantity</Label>
      <div className="inline-flex items-stretch rounded-md border">
        <button
          type="button"
          onClick={() => setN((x) => Math.max(0, x - 1))}
          className="grid size-9 place-items-center rounded-l-md hover:bg-accent disabled:opacity-50"
          disabled={n <= 0}
          aria-label="Decrease"
        >
          <Minus className="size-4" />
        </button>
        <input
          value={n}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) setN(v);
          }}
          className="w-12 border-x bg-transparent text-center text-sm tabular-nums outline-none focus:ring-0"
          inputMode="numeric"
        />
        <button
          type="button"
          onClick={() => setN((x) => x + 1)}
          className="grid size-9 place-items-center rounded-r-md hover:bg-accent"
          aria-label="Increase"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Star rating
 * ──────────────────────────────────────────────────────────────── */
function Rating() {
  const [rating, setRating] = useState(4);
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-2">
      <Label>Rating</Label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= (hover || rating);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              className="rounded p-0.5 hover:bg-accent"
              aria-label={`${i} stars`}
            >
              <Star
                className={cn(
                  "size-5 transition-colors",
                  filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                )}
              />
            </button>
          );
        })}
        <span className="ml-2 text-muted-foreground text-xs">{rating}/5</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Phone input with country selector + live validation
 * ──────────────────────────────────────────────────────────────── */
function PhoneField() {
  const [value, setValue] = useState("");
  const touched = value.length > 0;
  const valid = touched && isValidPhoneNumber(value);
  const invalid = touched && !valid;

  return (
    <div className="w-full max-w-md space-y-2">
      <Label htmlFor="origin-phone">Phone number</Label>
      <PhoneInput id="origin-phone" value={value} onChange={setValue} defaultCountry="AZ" aria-invalid={invalid} />
      <p
        className={cn(
          "text-xs",
          !touched && "text-muted-foreground",
          valid && "text-emerald-600 dark:text-emerald-400",
          invalid && "text-destructive",
        )}
      >
        {!touched && "Format: +<country> <number>. We'll auto-format and validate as you type."}
        {valid && "✓ Looks like a valid phone number."}
        {invalid && "Doesn't look like a valid number for that country."}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — OTP code input
 * ──────────────────────────────────────────────────────────────── */
function OtpField() {
  const [val, setVal] = useState("");
  return (
    <div className="space-y-2">
      <Label>2FA code</Label>
      <InputOTP maxLength={6} value={val} onChange={setVal}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
      <p className="text-muted-foreground text-xs">Enter the 6-digit code from your authenticator app.</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Origin UI — Toggle pill group
 * ──────────────────────────────────────────────────────────────── */
function PlanToggle() {
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  return (
    <div className="space-y-2">
      <Label>Billing</Label>
      <div className="inline-flex rounded-full border bg-muted/30 p-1">
        {(["monthly", "yearly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlan(p)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium text-xs capitalize transition-colors",
              plan === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p}
            {p === "yearly" && plan === p && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                Save 20%
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OriginUiSection() {
  return (
    <Section
      id="origin"
      title="Origin UI"
      description="Composed patterns from originui.com — password strength, tag input, combobox, multi-select, stepper, rating, OTP, billing toggle."
    >
      <div className="grid gap-8 md:grid-cols-2">
        <PasswordStrengthInput />
        <PhoneField />
        <TagInput />
        <Combobox />
        <MultiSelect />
        <SubBlock label="Misc" className="md:col-span-2">
          <NumberStepper />
          <Rating />
          <PlanToggle />
        </SubBlock>
        <div className="md:col-span-2">
          <OtpField />
        </div>
      </div>
    </Section>
  );
}
