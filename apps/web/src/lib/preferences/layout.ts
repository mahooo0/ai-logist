// Sidebar Variant
export const SIDEBAR_VARIANT_OPTIONS = [
  { label: "Sidebar", value: "sidebar" },
  { label: "Inset", value: "inset" },
  { label: "Floating", value: "floating" },
] as const;
export const SIDEBAR_VARIANT_VALUES = SIDEBAR_VARIANT_OPTIONS.map((v) => v.value);
export type SidebarVariant = (typeof SIDEBAR_VARIANT_VALUES)[number];

// Sidebar Collapsible
export const SIDEBAR_COLLAPSIBLE_OPTIONS = [
  { label: "Icon", value: "icon" },
  { label: "Offcanvas", value: "offcanvas" },
] as const;
export const SIDEBAR_COLLAPSIBLE_VALUES = SIDEBAR_COLLAPSIBLE_OPTIONS.map((v) => v.value);
export type SidebarCollapsible = (typeof SIDEBAR_COLLAPSIBLE_VALUES)[number];

// Content Layout
export const CONTENT_LAYOUT_OPTIONS = [
  { label: "Centered", value: "centered" },
  { label: "Full Width", value: "full-width" },
] as const;
export const CONTENT_LAYOUT_VALUES = CONTENT_LAYOUT_OPTIONS.map((v) => v.value);
export type ContentLayout = (typeof CONTENT_LAYOUT_VALUES)[number];

// Navbar Style
export const NAVBAR_STYLE_OPTIONS = [
  { label: "Sticky", value: "sticky" },
  { label: "Scroll", value: "scroll" },
] as const;
export const NAVBAR_STYLE_VALUES = NAVBAR_STYLE_OPTIONS.map((v) => v.value);
export type NavbarStyle = (typeof NAVBAR_STYLE_VALUES)[number];

// Density
export const DENSITY_OPTIONS = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
  { label: "Spacious", value: "spacious" },
] as const;
export const DENSITY_VALUES = DENSITY_OPTIONS.map((v) => v.value);
export type Density = (typeof DENSITY_VALUES)[number];

// Layout Mode (sidebar vs top-nav)
export const LAYOUT_MODE_OPTIONS = [
  { label: "Sidebar", value: "sidebar" },
  { label: "Top Nav", value: "top-nav" },
] as const;
export const LAYOUT_MODE_VALUES = LAYOUT_MODE_OPTIONS.map((v) => v.value);
export type LayoutMode = (typeof LAYOUT_MODE_VALUES)[number];

// Direction
export const DIRECTION_OPTIONS = [
  { label: "LTR", value: "ltr" },
  { label: "RTL", value: "rtl" },
] as const;
export const DIRECTION_VALUES = DIRECTION_OPTIONS.map((v) => v.value);
export type Direction = (typeof DIRECTION_VALUES)[number];

// Language
export const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Deutsch", value: "de" },
  { label: "Français", value: "fr" },
] as const;
export const LANGUAGE_VALUES = LANGUAGE_OPTIONS.map((v) => v.value);
export type Language = (typeof LANGUAGE_VALUES)[number];
