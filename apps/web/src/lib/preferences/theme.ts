export const THEME_MODE_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
] as const;

export const THEME_MODE_VALUES = THEME_MODE_OPTIONS.map((o) => o.value);
export type ThemeMode = (typeof THEME_MODE_VALUES)[number];
export type ResolvedThemeMode = "light" | "dark";

// --- generated:themePresets:start ---

export const THEME_PRESET_OPTIONS = [
  {
    label: "Default",
    value: "default",
    primary: {
      light: "oklch(0.205 0 0)",
      dark: "oklch(0.922 0 0)",
    },
  },
  {
    label: "Blue",
    value: "blue",
    primary: {
      light: "oklch(0.72 0.11 245)",
      dark: "oklch(0.78 0.1 245)",
    },
  },
  {
    label: "Orange",
    value: "orange",
    primary: {
      light: "oklch(0.78 0.12 55)",
      dark: "oklch(0.82 0.11 55)",
    },
  },
  {
    label: "Rose",
    value: "rose",
    primary: {
      light: "oklch(0.76 0.12 15)",
      dark: "oklch(0.81 0.11 15)",
    },
  },
  {
    label: "Violet",
    value: "violet",
    primary: {
      light: "oklch(0.74 0.12 300)",
      dark: "oklch(0.79 0.11 300)",
    },
  },
  {
    label: "Zinc",
    value: "zinc",
    primary: {
      light: "oklch(0.21 0.006 285.885)",
      dark: "oklch(0.92 0.004 286.32)",
    },
  },
] as const;

export const THEME_PRESET_VALUES = THEME_PRESET_OPTIONS.map((p) => p.value);

export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number]["value"];

// --- generated:themePresets:end ---
