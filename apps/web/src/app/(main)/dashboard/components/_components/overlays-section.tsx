"use client";

import { useEffect, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  CreditCard,
  Filter,
  MoreHorizontal,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { Section, SubBlock } from "./section";

/* ──────────────────────────────────────────────────────────────────
 * Multi-step dialog (wizard)
 * ──────────────────────────────────────────────────────────────── */
function WizardDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const total = 3;

  const reset = () => {
    setStep(0);
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(reset, 150);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline">Open wizard</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {total}
          </DialogDescription>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length progress bar; index is the stable identity
                key={`step-${i}`}
                className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-[140px] py-2 text-sm">
          {step === 0 && (
            <div className="space-y-3">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" placeholder="Acme Inc." />
              <p className="text-muted-foreground text-xs">Used in URLs and emails.</p>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <Label>Choose a plan</Label>
              <RadioGroup defaultValue="pro" className="space-y-2">
                {[
                  { v: "free", t: "Free", d: "Up to 3 members" },
                  { v: "pro", t: "Pro — $12/mo", d: "Unlimited, advanced analytics" },
                  { v: "team", t: "Team — $48/mo", d: "Roles, audit log, SSO" },
                ].map((p) => (
                  <Label
                    key={p.v}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/50"
                  >
                    <RadioGroupItem value={p.v} className="mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm leading-none">{p.t}</p>
                      <p className="text-muted-foreground text-xs">{p.d}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <Label>Invite teammates</Label>
              <Input placeholder="alice@acme.com, bob@acme.com" />
              <p className="text-muted-foreground text-xs">Comma-separated. You can skip and invite later.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft /> Back
          </Button>
          {step < total - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight />
            </Button>
          ) : (
            <Button
              onClick={() => {
                close(false);
                toast.success("Workspace created");
              }}
            >
              Finish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Sheet with filter form (right side)
 * ──────────────────────────────────────────────────────────────── */
function FilterSheet() {
  const [open, setOpen] = useState(false);
  const categories = ["Hardware", "Software", "Service", "Consulting"];
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (c: string) => setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Filter />
          Filters
          {picked.length > 0 && (
            <Badge className="ml-1 px-1.5 py-0 text-[10px]" variant="secondary">
              {picked.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine the results below.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm">
          <div className="space-y-2">
            <Label htmlFor="filter-q">Query</Label>
            <Input id="filter-q" placeholder="Search by name…" />
          </div>

          <div className="space-y-3">
            <Label>Category</Label>
            <div className="space-y-2">
              {categories.map((c) => (
                <Label key={c} className="flex items-center gap-2 font-normal">
                  <Checkbox checked={picked.includes(c)} onCheckedChange={() => toggle(c)} />
                  {c}
                </Label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" />
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setPicked([])} disabled={picked.length === 0} className="text-xs">
              Clear all
            </Button>
            <div className="flex gap-2">
              <SheetClose asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </SheetClose>
              <Button
                size="sm"
                onClick={() => {
                  setOpen(false);
                  toast.success(`Applied ${picked.length || "all"} filters`);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Command palette (⌘K)
 * ──────────────────────────────────────────────────────────────── */
function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (label: string) => {
    setOpen(false);
    toast(`Ran: ${label}`);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Command palette
        <kbd className="ml-2 hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => run("Calendar")}>
              <Calendar />
              <span>Calendar</span>
            </CommandItem>
            <CommandItem onSelect={() => run("Search docs")}>
              <ArrowUpRight />
              <span>Search docs</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => run("Profile")}>
              <User />
              <span>Profile</span>
            </CommandItem>
            <CommandItem onSelect={() => run("Billing")}>
              <CreditCard />
              <span>Billing</span>
            </CommandItem>
            <CommandItem onSelect={() => run("Settings")}>
              <Settings />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function OverlaysSection() {
  const [name, setName] = useState("Pedro Duarte");

  return (
    <Section
      id="overlays"
      title="Dialogs & Sheets"
      description="Dialog, sheet (4 sides), drawer, alert dialog, popover, dropdown, tooltip, hover card, command palette, sonner toasts, multi-step wizard."
    >
      <div className="space-y-6">
        {/* Dialog variants */}
        <SubBlock label="Dialogs">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Edit profile</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription>Make changes and click save when done.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-2">
                  <Label htmlFor="dlg-name">Name</Label>
                  <Input id="dlg-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dlg-email">Email</Label>
                  <Input id="dlg-email" type="email" defaultValue="pedro@duarte.dev" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={() => toast.success("Saved")}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <WizardDialog />
          <CommandPalette />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 /> Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account and remove your data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => toast.error("Account deleted")}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SubBlock>

        {/* Sheets — all sides */}
        <SubBlock label="Sheets — all sides">
          <FilterSheet />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Right (default)</Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Right sheet</SheetTitle>
                <SheetDescription>Standard side panel for forms and details.</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-3 text-muted-foreground text-sm">
                The Customize and Notifications panels in the header use this exact primitive.
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
                <Button>Apply</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Left</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Left sheet</SheetTitle>
                <SheetDescription>Useful for secondary navigation or filters.</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-3 text-muted-foreground text-sm">Place a nav tree or filter list here.</div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Top</Button>
            </SheetTrigger>
            <SheetContent side="top">
              <SheetHeader>
                <SheetTitle>Top sheet</SheetTitle>
                <SheetDescription>Banner-style overlay sliding from the top.</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-3 text-muted-foreground text-sm">Good for system-wide announcements.</div>
            </SheetContent>
          </Sheet>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Bottom</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Bottom sheet</SheetTitle>
                <SheetDescription>Mobile-style action panel.</SheetDescription>
              </SheetHeader>
              <div className="px-4 py-3 text-muted-foreground text-sm">Action menus, share sheets, etc.</div>
            </SheetContent>
          </Sheet>
        </SubBlock>

        {/* Drawer */}
        <SubBlock label="Drawer (mobile-friendly bottom sheet)">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">Open drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Confirm checkout</DrawerTitle>
                <DrawerDescription>Drag down or press cancel to dismiss.</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-4 text-sm">
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">$248.00</span>
                  </div>
                </div>
              </div>
              <DrawerFooter>
                <Button onClick={() => toast.success("Order placed")}>Place order</Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </SubBlock>

        {/* Floating UI primitives */}
        <SubBlock label="Dropdown / Popover / Tooltip / Hover card">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Billing</DropdownMenuItem>
              <DropdownMenuItem>Team</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More">
                <MoreHorizontal />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <p className="font-medium text-sm">Popover</p>
              <p className="text-muted-foreground text-xs">Place arbitrary content next to the trigger.</p>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Helpful tip</TooltipContent>
          </Tooltip>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link">
                @vercel <ArrowUpRight />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72">
              <div className="space-y-1">
                <p className="font-semibold text-sm">Vercel</p>
                <p className="text-muted-foreground text-xs">Frontend cloud — frameworks meet infrastructure.</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </SubBlock>

        {/* Toasts */}
        <SubBlock label="Toasts (Sonner)">
          <Button variant="outline" onClick={() => toast("Saved successfully")}>
            Default
          </Button>
          <Button variant="outline" onClick={() => toast.success("Profile updated")}>
            Success
          </Button>
          <Button variant="outline" onClick={() => toast.error("Something went wrong")}>
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast("Event scheduled", {
                description: "Friday, March 14 at 3:30pm",
                action: { label: "Undo", onClick: () => toast.info("Undone") },
              })
            }
          >
            With action
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const id = toast.loading("Uploading file…");
              setTimeout(() => toast.success("Upload complete", { id }), 1500);
            }}
          >
            Loading → success
          </Button>
        </SubBlock>
      </div>
    </Section>
  );
}
