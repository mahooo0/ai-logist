"use client";

import { useState } from "react";

import { format } from "date-fns";
import { Calendar as CalendarIcon, Eye, EyeOff, Mail, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { Section, SubBlock } from "./section";

export function InputsSection() {
  const [pwd, setPwd] = useState("hunter2");
  const [showPwd, setShowPwd] = useState(false);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [progress, setProgress] = useState(64);

  return (
    <Section
      id="inputs"
      title="Inputs, selects & toggles"
      description="Text fields, password, search, date, slider, switches."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@company.com" className="pl-9" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pwd">Password (Origin-style toggle)</Label>
          <div className="relative">
            <Input
              id="pwd"
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="search">Search (with clear)</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search"
              type="search"
              placeholder="Search anything…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Clear"
              >
                <X className="size-4" />
              </button>
            )}
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 select-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Country (Select)</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="az">Azerbaijan</SelectItem>
                <SelectItem value="tr">Türkiye</SelectItem>
                <SelectItem value="de">Germany</SelectItem>
                <SelectItem value="fr">France</SelectItem>
                <SelectItem value="us">United States</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={3} placeholder="Tell us a bit about yourself…" />
        </div>

        <div className="space-y-2">
          <Label>Pick a date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon />
                {date ? format(date, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-3">
          <Label>Volume</Label>
          <Slider defaultValue={[40]} max={100} step={1} />
        </div>

        <div className="space-y-3">
          <Label>Upload progress</Label>
          <Progress value={progress} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setProgress((p) => Math.max(0, p - 10))}>
              −10
            </Button>
            <Button size="sm" variant="outline" onClick={() => setProgress((p) => Math.min(100, p + 10))}>
              +10
            </Button>
          </div>
        </div>

        <SubBlock label="Toggles" className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Switch id="notif" defaultChecked />
            <Label htmlFor="notif">Email notifications</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="terms" />
            <Label htmlFor="terms">I agree to the terms</Label>
          </div>
          <RadioGroup defaultValue="card" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="card" id="r-card" />
              <Label htmlFor="r-card">Card</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="bank" id="r-bank" />
              <Label htmlFor="r-bank">Bank</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="paypal" id="r-paypal" />
              <Label htmlFor="r-paypal">PayPal</Label>
            </div>
          </RadioGroup>
        </SubBlock>
      </div>
    </Section>
  );
}
