"use client";

import {
  AlignJustify,
  AlignLeft,
  AlignRight,
  Globe,
  LayoutPanelLeft,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  PanelTop,
  Rows3,
  Rows4,
  Settings,
  Square,
  SquareStack,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type FontKey, fontOptions } from "@/lib/fonts/registry";
import type {
  ContentLayout,
  Density,
  Direction,
  Language,
  LayoutMode,
  NavbarStyle,
  SidebarCollapsible,
  SidebarVariant,
} from "@/lib/preferences/layout";
import {
  applyContentLayout,
  applyDensity,
  applyDirection,
  applyFont,
  applyLanguage,
  applyLayoutMode,
  applyNavbarStyle,
  applySidebarCollapsible,
  applySidebarVariant,
} from "@/lib/preferences/layout-utils";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { persistPreference } from "@/lib/preferences/preferences-storage";
import { THEME_PRESET_OPTIONS, type ThemeMode, type ThemePreset } from "@/lib/preferences/theme";
import { applyThemePreset } from "@/lib/preferences/theme-utils";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

type ThemeModeIcon = { value: ThemeMode; label: string; Icon: typeof Sun };
const THEME_MODE_VISUALS: ThemeModeIcon[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const DENSITY_VISUALS: { value: Density; label: string; Icon: typeof Rows4 }[] = [
  { value: "compact", label: "Compact", Icon: Rows4 },
  { value: "comfortable", label: "Comfortable", Icon: Rows3 },
  { value: "spacious", label: "Spacious", Icon: AlignJustify },
];

const LAYOUT_MODE_VISUALS: { value: LayoutMode; label: string; Icon: typeof LayoutPanelLeft }[] = [
  { value: "sidebar", label: "Sidebar", Icon: LayoutPanelLeft },
  { value: "top-nav", label: "Top Nav", Icon: PanelTop },
];

const CONTAINER_VISUALS: { value: ContentLayout; label: string; Icon: typeof Maximize2 }[] = [
  { value: "full-width", label: "Fluid", Icon: Maximize2 },
  { value: "centered", label: "Boxed", Icon: Minimize2 },
];

const DIRECTION_VISUALS: { value: Direction; label: string; Icon: typeof AlignLeft }[] = [
  { value: "ltr", label: "LTR", Icon: AlignLeft },
  { value: "rtl", label: "RTL", Icon: AlignRight },
];

const LANGUAGE_VISUALS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Label className="font-medium text-foreground text-sm">{children}</Label>;
}

function IconTile({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-3 text-xs transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active ? "border-foreground ring-1 ring-foreground/20" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function LayoutControls() {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const resolvedThemeMode = usePreferencesStore((s) => s.resolvedThemeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const themePreset = usePreferencesStore((s) => s.themePreset);
  const setThemePreset = usePreferencesStore((s) => s.setThemePreset);
  const contentLayout = usePreferencesStore((s) => s.contentLayout);
  const setContentLayout = usePreferencesStore((s) => s.setContentLayout);
  const navbarStyle = usePreferencesStore((s) => s.navbarStyle);
  const setNavbarStyle = usePreferencesStore((s) => s.setNavbarStyle);
  const variant = usePreferencesStore((s) => s.sidebarVariant);
  const setSidebarVariant = usePreferencesStore((s) => s.setSidebarVariant);
  const collapsible = usePreferencesStore((s) => s.sidebarCollapsible);
  const setSidebarCollapsible = usePreferencesStore((s) => s.setSidebarCollapsible);
  const font = usePreferencesStore((s) => s.font);
  const setFont = usePreferencesStore((s) => s.setFont);
  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const layoutMode = usePreferencesStore((s) => s.layoutMode);
  const setLayoutMode = usePreferencesStore((s) => s.setLayoutMode);
  const direction = usePreferencesStore((s) => s.direction);
  const setDirection = usePreferencesStore((s) => s.setDirection);
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  const onThemePresetChange = (preset: ThemePreset) => {
    applyThemePreset(preset);
    setThemePreset(preset);
    void persistPreference("theme_preset", preset);
  };

  const onThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    void persistPreference("theme_mode", mode);
  };

  const onContentLayoutChange = (layout: ContentLayout | "") => {
    if (!layout) return;
    applyContentLayout(layout);
    setContentLayout(layout);
    void persistPreference("content_layout", layout);
  };

  const onNavbarStyleChange = (style: NavbarStyle | "") => {
    if (!style) return;
    applyNavbarStyle(style);
    setNavbarStyle(style);
    void persistPreference("navbar_style", style);
  };

  const onSidebarStyleChange = (value: SidebarVariant | "") => {
    if (!value) return;
    setSidebarVariant(value);
    applySidebarVariant(value);
    void persistPreference("sidebar_variant", value);
  };

  const onSidebarCollapseModeChange = (value: SidebarCollapsible | "") => {
    if (!value) return;
    setSidebarCollapsible(value);
    applySidebarCollapsible(value);
    void persistPreference("sidebar_collapsible", value);
  };

  const onFontChange = (value: FontKey | "") => {
    if (!value) return;
    applyFont(value);
    setFont(value);
    void persistPreference("font", value);
  };

  const onDensityChange = (value: Density) => {
    applyDensity(value);
    setDensity(value);
    void persistPreference("density", value);
  };

  const onLayoutModeChange = (value: LayoutMode) => {
    applyLayoutMode(value);
    setLayoutMode(value);
    void persistPreference("layout_mode", value);
  };

  const onContainerChange = (value: ContentLayout) => {
    onContentLayoutChange(value);
  };

  const onDirectionChange = (value: Direction) => {
    applyDirection(value);
    setDirection(value);
    void persistPreference("direction", value);
  };

  const onLanguageChange = (value: Language) => {
    applyLanguage(value);
    setLanguage(value);
    void persistPreference("language", value);
  };

  const handleRestore = () => {
    onThemePresetChange(PREFERENCE_DEFAULTS.theme_preset);
    onThemeModeChange(PREFERENCE_DEFAULTS.theme_mode);
    onContentLayoutChange(PREFERENCE_DEFAULTS.content_layout);
    onNavbarStyleChange(PREFERENCE_DEFAULTS.navbar_style);
    onSidebarStyleChange(PREFERENCE_DEFAULTS.sidebar_variant);
    onSidebarCollapseModeChange(PREFERENCE_DEFAULTS.sidebar_collapsible);
    onFontChange(PREFERENCE_DEFAULTS.font);
    onDensityChange(PREFERENCE_DEFAULTS.density);
    onLayoutModeChange(PREFERENCE_DEFAULTS.layout_mode);
    onDirectionChange(PREFERENCE_DEFAULTS.direction);
    onLanguageChange(PREFERENCE_DEFAULTS.language);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Open customization panel">
          <Settings />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="text-xl">Customize</SheetTitle>
          <SheetDescription>Personalize your dashboard experience.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {/* Theme */}
            <section className="space-y-2.5">
              <SectionLabel>Theme</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {THEME_MODE_VISUALS.map(({ value, label, Icon }) => (
                  <IconTile
                    key={value}
                    active={themeMode === value}
                    ariaLabel={label}
                    onClick={() => onThemeModeChange(value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Color (theme presets) */}
            <section className="space-y-2.5">
              <SectionLabel>Color</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESET_OPTIONS.map((preset) => {
                  const active = themePreset === preset.value;
                  const swatch = (resolvedThemeMode ?? "light") === "dark" ? preset.primary.dark : preset.primary.light;
                  return (
                    <IconTile
                      key={preset.value}
                      active={active}
                      ariaLabel={preset.label}
                      onClick={() => onThemePresetChange(preset.value)}
                    >
                      <span
                        className="size-5 rounded-full border border-border/40 shadow-sm"
                        style={{ backgroundColor: swatch }}
                      />
                      <span className="text-foreground">{preset.label}</span>
                    </IconTile>
                  );
                })}
              </div>
            </section>

            {/* Density */}
            <section className="space-y-2.5">
              <SectionLabel>Density</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {DENSITY_VISUALS.map(({ value, label, Icon }) => (
                  <IconTile
                    key={value}
                    active={density === value}
                    ariaLabel={label}
                    onClick={() => onDensityChange(value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Layout */}
            <section className="space-y-2.5">
              <SectionLabel>Layout</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUT_MODE_VISUALS.map(({ value, label, Icon }) => (
                  <IconTile
                    key={value}
                    active={layoutMode === value}
                    ariaLabel={label}
                    onClick={() => onLayoutModeChange(value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Container */}
            <section className="space-y-2.5">
              <SectionLabel>Container</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {CONTAINER_VISUALS.map(({ value, label, Icon }) => (
                  <IconTile
                    key={value}
                    active={contentLayout === value}
                    ariaLabel={label}
                    onClick={() => onContainerChange(value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Direction */}
            <section className="space-y-2.5">
              <SectionLabel>Direction</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {DIRECTION_VISUALS.map(({ value, label, Icon }) => (
                  <IconTile
                    key={value}
                    active={direction === value}
                    ariaLabel={label}
                    onClick={() => onDirectionChange(value)}
                  >
                    <Icon className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Language */}
            <section className="space-y-2.5">
              <SectionLabel>Language</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGE_VISUALS.map(({ value, label }) => (
                  <IconTile
                    key={value}
                    active={language === value}
                    ariaLabel={label}
                    onClick={() => onLanguageChange(value)}
                  >
                    <Globe className="size-4" />
                    <span className="text-foreground">{label}</span>
                  </IconTile>
                ))}
              </div>
            </section>

            {/* Advanced (existing controls preserved) */}
            <section className="space-y-3 border-t pt-5">
              <SectionLabel>Advanced</SectionLabel>

              <div className="space-y-1.5 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
                <Label className="font-medium text-muted-foreground text-xs">Font</Label>
                <Select value={font} onValueChange={(v) => onFontChange(v as FontKey)}>
                  <SelectTrigger size="sm" className="w-full text-xs">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {fontOptions.map((f) => (
                        <SelectItem key={f.key} className="text-xs" value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
                <Label className="font-medium text-muted-foreground text-xs">Navbar Behavior</Label>
                <ToggleGroup
                  size="sm"
                  variant="outline"
                  type="single"
                  value={navbarStyle}
                  onValueChange={onNavbarStyleChange}
                >
                  <ToggleGroupItem value="sticky" aria-label="Sticky">
                    Sticky
                  </ToggleGroupItem>
                  <ToggleGroupItem value="scroll" aria-label="Scroll">
                    Scroll
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-1.5 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
                <Label className="font-medium text-muted-foreground text-xs">Sidebar Style</Label>
                <ToggleGroup
                  size="sm"
                  variant="outline"
                  type="single"
                  value={variant}
                  onValueChange={onSidebarStyleChange}
                >
                  <ToggleGroupItem value="inset" aria-label="Inset">
                    Inset
                  </ToggleGroupItem>
                  <ToggleGroupItem value="sidebar" aria-label="Sidebar">
                    Sidebar
                  </ToggleGroupItem>
                  <ToggleGroupItem value="floating" aria-label="Floating">
                    Floating
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-1.5 **:data-[slot=toggle-group]:w-full **:data-[slot=toggle-group-item]:flex-1 **:data-[slot=toggle-group-item]:text-xs">
                <Label className="font-medium text-muted-foreground text-xs">Sidebar Collapse Mode</Label>
                <ToggleGroup
                  size="sm"
                  variant="outline"
                  type="single"
                  value={collapsible}
                  onValueChange={onSidebarCollapseModeChange}
                >
                  <ToggleGroupItem value="icon" aria-label="Icon">
                    <Square className="size-3.5" />
                    Icon
                  </ToggleGroupItem>
                  <ToggleGroupItem value="offcanvas" aria-label="Offcanvas">
                    <SquareStack className="size-3.5" />
                    Offcanvas
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </section>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" className="w-full" onClick={handleRestore}>
            Reset to Defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
