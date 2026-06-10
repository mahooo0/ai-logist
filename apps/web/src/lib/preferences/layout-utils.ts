export function applyContentLayout(value: "centered" | "full-width") {
  const root = document.documentElement;
  root.setAttribute("data-content-layout", value);
}

export function applyNavbarStyle(value: "sticky" | "scroll") {
  const root = document.documentElement;
  root.setAttribute("data-navbar-style", value);
}

export function applySidebarVariant(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar-variant", value);
}

export function applySidebarCollapsible(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-sidebar-collapsible", value);
}

export function applyFont(value: string) {
  const root = document.documentElement;
  root.setAttribute("data-font", value);
}

export function applyDensity(value: "compact" | "comfortable" | "spacious") {
  const root = document.documentElement;
  root.setAttribute("data-density", value);
}

export function applyLayoutMode(value: "sidebar" | "top-nav") {
  const root = document.documentElement;
  root.setAttribute("data-layout-mode", value);
}

export function applyDirection(value: "ltr" | "rtl") {
  const root = document.documentElement;
  root.setAttribute("dir", value);
  root.setAttribute("data-direction", value);
}

export function applyLanguage(value: string) {
  const root = document.documentElement;
  root.setAttribute("lang", value);
  root.setAttribute("data-language", value);
}
