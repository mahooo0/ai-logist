import { createStore } from "zustand/vanilla";

import type { FontKey } from "@/lib/fonts/registry";
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
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import type { ResolvedThemeMode, ThemeMode, ThemePreset } from "@/lib/preferences/theme";

export type PreferencesState = {
  themeMode: ThemeMode;
  resolvedThemeMode: ResolvedThemeMode;
  themePreset: ThemePreset;
  font: FontKey;
  contentLayout: ContentLayout;
  navbarStyle: NavbarStyle;
  sidebarVariant: SidebarVariant;
  sidebarCollapsible: SidebarCollapsible;
  density: Density;
  layoutMode: LayoutMode;
  direction: Direction;
  language: Language;
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedThemeMode: (mode: ResolvedThemeMode) => void;
  setThemePreset: (preset: ThemePreset) => void;
  setFont: (font: FontKey) => void;
  setContentLayout: (layout: ContentLayout) => void;
  setNavbarStyle: (style: NavbarStyle) => void;
  setSidebarVariant: (variant: SidebarVariant) => void;
  setSidebarCollapsible: (mode: SidebarCollapsible) => void;
  setDensity: (density: Density) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setDirection: (direction: Direction) => void;
  setLanguage: (language: Language) => void;
  isSynced: boolean;
  setIsSynced: (val: boolean) => void;
};

export const createPreferencesStore = (init?: Partial<PreferencesState>) =>
  createStore<PreferencesState>()((set) => ({
    themeMode: init?.themeMode ?? PREFERENCE_DEFAULTS.theme_mode,
    resolvedThemeMode: init?.resolvedThemeMode ?? "light",
    themePreset: init?.themePreset ?? PREFERENCE_DEFAULTS.theme_preset,
    font: init?.font ?? PREFERENCE_DEFAULTS.font,
    contentLayout: init?.contentLayout ?? PREFERENCE_DEFAULTS.content_layout,
    navbarStyle: init?.navbarStyle ?? PREFERENCE_DEFAULTS.navbar_style,
    sidebarVariant: init?.sidebarVariant ?? PREFERENCE_DEFAULTS.sidebar_variant,
    sidebarCollapsible: init?.sidebarCollapsible ?? PREFERENCE_DEFAULTS.sidebar_collapsible,
    density: init?.density ?? PREFERENCE_DEFAULTS.density,
    layoutMode: init?.layoutMode ?? PREFERENCE_DEFAULTS.layout_mode,
    direction: init?.direction ?? PREFERENCE_DEFAULTS.direction,
    language: init?.language ?? PREFERENCE_DEFAULTS.language,
    setThemeMode: (mode) => set({ themeMode: mode }),
    setResolvedThemeMode: (mode) => set({ resolvedThemeMode: mode }),
    setThemePreset: (preset) => set({ themePreset: preset }),
    setFont: (font) => set({ font }),
    setContentLayout: (layout) => set({ contentLayout: layout }),
    setNavbarStyle: (style) => set({ navbarStyle: style }),
    setSidebarVariant: (variant) => set({ sidebarVariant: variant }),
    setSidebarCollapsible: (mode) => set({ sidebarCollapsible: mode }),
    setDensity: (density) => set({ density }),
    setLayoutMode: (mode) => set({ layoutMode: mode }),
    setDirection: (direction) => set({ direction }),
    setLanguage: (language) => set({ language }),
    isSynced: init?.isSynced ?? false,
    setIsSynced: (val) => set({ isSynced: val }),
  }));
