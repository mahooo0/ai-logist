"use client";

import { forwardRef, useMemo, useState } from "react";

import type { CountryCode } from "libphonenumber-js";
import { AsYouType, getCountries, getCountryCallingCode } from "libphonenumber-js";
import { Check, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FEATURED_COUNTRIES: CountryCode[] = ["AZ", "TR", "US", "GB", "DE", "FR", "RU", "UA", "AE"];

const COUNTRY_NAMES: Partial<Record<CountryCode, string>> = {
  AZ: "Azerbaijan",
  TR: "Türkiye",
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  RU: "Russia",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  PL: "Poland",
  CA: "Canada",
  AU: "Australia",
  IN: "India",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  BR: "Brazil",
  MX: "Mexico",
};

function countryToFlag(code: CountryCode) {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

export type PhoneInputProps = {
  value: string;
  onChange: (next: string) => void;
  defaultCountry?: CountryCode;
  placeholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
  className?: string;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, defaultCountry = "AZ", placeholder = "Phone number", id, className, ...rest },
  ref,
) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allCountries = useMemo<CountryCode[]>(() => {
    const seen = new Set<CountryCode>();
    const order: CountryCode[] = [];
    for (const c of FEATURED_COUNTRIES) {
      if (!seen.has(c)) {
        order.push(c);
        seen.add(c);
      }
    }
    for (const c of getCountries()) {
      if (!seen.has(c)) {
        order.push(c);
        seen.add(c);
      }
    }
    return order;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCountries;
    return allCountries.filter((c) => {
      const name = (COUNTRY_NAMES[c] ?? c).toLowerCase();
      const dial = `+${getCountryCallingCode(c)}`;
      return name.includes(q) || c.toLowerCase().includes(q) || dial.includes(q);
    });
  }, [allCountries, query]);

  const handleChange = (raw: string) => {
    const digitsOnly = raw.replace(/[^\d+\s()-]/g, "");
    const formatter = new AsYouType(country);
    const formatted = formatter.input(digitsOnly);
    onChange(formatted);
  };

  const dial = `+${getCountryCallingCode(country)}`;

  return (
    <div className={cn("flex w-full items-stretch rounded-md border focus-within:ring-1 focus-within:ring-ring", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-9 gap-1 rounded-r-none border-r px-2 text-sm font-normal hover:bg-accent"
          >
            <span className="text-base leading-none">{countryToFlag(country)}</span>
            <span className="tabular-nums text-muted-foreground">{dial}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country…"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <ul className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No country found</li>
            ) : (
              filtered.map((c) => {
                const active = c === country;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => {
                        setCountry(c);
                        setQuery("");
                        setOpen(false);
                        // Re-format current value with new country
                        const formatter = new AsYouType(c);
                        onChange(formatter.input(value));
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
                        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                      )}
                    >
                      <span className="text-base leading-none">{countryToFlag(c)}</span>
                      <span className="flex-1 truncate text-left">{COUNTRY_NAMES[c] ?? c}</span>
                      <span className="tabular-nums text-muted-foreground">+{getCountryCallingCode(c)}</span>
                      <Check className={cn("size-4", active ? "opacity-100" : "opacity-0")} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverContent>
      </Popover>

      <Input
        ref={ref}
        id={id}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={value}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 rounded-l-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        {...rest}
      />
    </div>
  );
});

export type { CountryCode };
