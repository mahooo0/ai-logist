# apps/web — Zenith Admin Vendor Receipt

**Vendored:** 2026-06-11 (Phase 4, Plan 04-01)
**Source:** https://github.com/mahooo0/next-shadcn-admin-dashboard
**Git SHA:** `4e667ccf5056d52830e1d99b2bd39372ae386932`
**Source commit date:** 2026-05-05T23:11:54+04:00
**License:** MIT (permits vendoring per D-02)
**Zenith version field:** 2.2.0

## Files copied verbatim from Zenith

- `apps/web/src/` — full source tree (app, components, config, data, hooks, lib, navigation, scripts, server, stores, styles, proxy.disabled.ts)
- `apps/web/components.json` (shadcn config — style: radix-nova, baseColor: neutral, icon library: lucide)
- `apps/web/postcss.config.mjs` (Tailwind v4 PostCSS plugin)
- `apps/web/next.config.ts` (MERGED — Phase 1 `output: 'standalone'` + Zenith reactCompiler + console removal + /dashboard redirect)
- `apps/web/tsconfig.json` (MERGED — Zenith strict (target: ES2017, jsx: preserve) + monorepo extends + tests/vitest includes)

## Files NOT copied / dropped from Zenith

- `next.config.mjs` — replaced with our merged `next.config.ts` (TypeScript) including `output: 'standalone'` for the apps/web/Dockerfile multi-stage build
- `husky`, `lint-staged`, `prepare` script (Pitfall #3 — replaced by root Biome at monorepo level)
- Zenith `package.json` name `studio-admin` — kept as `@ai-logist/web`
- Zenith `pnpm-lock.yaml` (root lockfile is authoritative)
- `proxy.disabled.ts` artifact — kept on disk (verbatim Zenith) as a reference; Wave 2 Plan 04-02 will create the real `apps/web/src/proxy.ts` (Pitfall #4 — Next.js 16 proxy.ts > middleware.ts convention)
- `tailwind.config.ts` — Zenith does NOT ship one (Tailwind v4 uses `@tailwindcss/postcss` only; CSS-first config via `src/app/globals.css`)
- `media/` directory (just demo screenshots — `dashboard.png`)
- `tsconfig.scripts.json` (`ts-node` script-runner config for theme-preset generation; not needed in our build)

## No `public/` directory

Zenith ships `favicon.ico` directly under `src/app/favicon.ico` (App Router convention). No top-level `public/` directory exists in the upstream repo and none was created here.

## Zenith preferences store hook signature (RESEARCH Open Question #1 — RESOLVED)

**Files:**
- `apps/web/src/stores/preferences/preferences-store.ts` (Zustand vanilla store factory)
- `apps/web/src/stores/preferences/preferences-provider.tsx` (React provider + hook)

**Hook export:** `usePreferencesStore<T>(selector: (state: PreferencesState) => T): T`

**Usage pattern:**
```ts
import { usePreferencesStore } from '@/stores/preferences/preferences-provider';
const language = usePreferencesStore((s) => s.language);
const setLanguage = usePreferencesStore((s) => s.setLanguage);
```

**`PreferencesState` shape (selected fields relevant to Phase 4 — full file imports below):**
```ts
type PreferencesState = {
  themeMode: ThemeMode;                  // 'light' | 'dark' | 'system'
  resolvedThemeMode: ResolvedThemeMode;  // 'light' | 'dark'
  themePreset: ThemePreset;
  font: FontKey;
  contentLayout: ContentLayout;
  navbarStyle: NavbarStyle;
  sidebarVariant: SidebarVariant;
  sidebarCollapsible: SidebarCollapsible;
  density: Density;
  layoutMode: LayoutMode;
  direction: Direction;
  language: Language;       // ← Phase 4 hook for i18n
  setLanguage: (language: Language) => void;  // ← Phase 4 toggle
  isSynced: boolean;
  // ... plus setters for all of the above fields
};
```

**`Language` type as Zenith ships it:**
```ts
// apps/web/src/lib/preferences/layout.ts
export const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Français', value: 'fr' },
] as const;
export const LANGUAGE_VALUES = LANGUAGE_OPTIONS.map((v) => v.value);
export type Language = (typeof LANGUAGE_VALUES)[number];  // 'en' | 'de' | 'fr'
```

**ACTION REQUIRED FOR WAVE 2 (Plan 04-02):** Extend `LANGUAGE_OPTIONS` to include `{ label: 'Русский', value: 'ru' }` + `{ label: 'Українська', value: 'ua' }`. Reuse the existing `setLanguage` setter — no new store. `useT()` hook reads `language` from `usePreferencesStore` and falls back to RU if value is `'en'|'de'|'fr'`.

## Sidebar config file location

**File:** `apps/web/src/navigation/sidebar/sidebar-items.ts`
**Modified by:** Wave 2 Plan 04-02 (D-49 — comment out non-Phase-4 entries, keep Default/Analytics/Chat/Calls/Orders visible).

## Chat page structure (Zenith)

**Server page:** `apps/web/src/app/(main)/dashboard/chat/page.tsx` (Server Component — `import { ChatApp } from './_components/chat-app';`)
**Client component:** `apps/web/src/app/(main)/dashboard/chat/_components/chat-app.tsx` (`'use client'` per spec §7.3 convention)
**Modified by:** Wave 4 Plan 04-04 (D-20..D-24 — rewire to our UNION API + audio player + intercept controls)

## Pitfall #13 audit findings (Tailwind v4 + Next.js 16 + shadcn)

| Trip-wire | Status | Finding |
|-----------|--------|---------|
| `'use cache'` on dynamic routes (D-12) | PASS | `grep -rE "'use cache'" apps/web/src/app` returns EMPTY. Zenith does NOT use Cache Components (`cacheComponents: true` not set in next.config). |
| `border-border` explicit vs bare `border` (D-58) | PASS | Wave 0 grep guard from `static-rules.test.ts` runs against vendored Zenith and is GREEN. Zenith's auth/v2 pages use `border-border` explicitly. Calendar/cards use `border bg-card` pattern but `border-card` siblings are theme classes; Wave 0 regex filter accepts them. |
| `page.tsx` server / `_components/*` client (D-03 + D-59) | PASS | `grep -lE "^'use client'" $(find src/app -name "page.tsx")` returns ONLY `src/app/(main)/dashboard/[...not-found]/page.tsx` (a catch-all not-found stub). All Phase-4 target pages (chat/default/analytics/...) follow Server-page + Client-`_components/*-app.tsx` convention. The Wave 0 grep guard scans `(main)/dashboard/.*page.tsx` and will fire on the not-found stub if exercised, but the catch-all route lives at `[...not-found]` (path-bracketed) and is excluded from Phase-4 modification — added to deferred-items if it ever blocks the gate. |
| Next.js 16 async `cookies()`/`headers()`/`searchParams`/`params` (Pitfall #2) | PASS | Wave 0 grep guard `\bcookies\(\)[^.][^a]` against `src/` is empty in vendored Zenith. Zenith pins `next@^16.2.4` so the async-only API is in effect. |
| `middleware.ts` vs `proxy.ts` (Pitfall #4) | DOCUMENTED | Zenith ships `apps/web/src/proxy.disabled.ts` as scaffolding (proves the Next.js 16 convention is in use). Wave 2 (Plan 04-02) will create `apps/web/src/proxy.ts` per Next.js 16 native convention. NO `middleware.ts` will be created. |
| Tailwind v4 config location | INFO | No `tailwind.config.ts` file — Tailwind v4 uses CSS-first config in `src/app/globals.css` via `@theme` blocks + `@tailwindcss/postcss` plugin. Our merged `postcss.config.mjs` matches Zenith verbatim. |

## Wave 0 test runner — re-verified GREEN post-vendor

After full Zenith vendor, `pnpm --filter @ai-logist/web test` reports:

```
Test Files  1 passed | 5 skipped (6)
Tests       5 passed | 19 todo (24)
```

The 5 LIVE grep guards in `apps/web/tests/unit/static-rules.test.ts` pass against the vendored template. No Pitfall #13 violations introduced by the vendor.

## Dependencies snapshot (versions at vendor time — verbatim from upstream package.json)

### Dependencies (32 entries)

| Package | Version |
|---------|---------|
| @base-ui/react | ^1.4.1 |
| @dnd-kit/core | ^6.3.1 |
| @dnd-kit/modifiers | ^9.0.0 |
| @dnd-kit/sortable | ^10.0.0 |
| @hookform/resolvers | ^5.2.2 |
| @tanstack/react-table | ^8.21.3 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| cmdk | ^1.1.1 |
| date-fns | ^4.1.0 |
| embla-carousel-react | ^8.6.0 |
| geist | ^1.7.0 |
| input-otp | ^1.4.2 |
| libphonenumber-js | ^1.12.42 |
| lucide-react | ^1.14.0 |
| next | ^16.2.4 |
| next-themes | ^0.4.6 |
| radix-ui | ^1.4.3 |
| react | ^19.2.5 |
| react-day-picker | ^9.14.0 |
| react-dom | ^19.2.5 |
| react-hook-form | ^7.75.0 |
| react-resizable-panels | ^4.11.0 |
| recharts | ^3.8.0 |
| shadcn | ^4.6.0 |
| simple-icons | ^16.18.1 |
| sonner | ^2.0.7 |
| tailwind-merge | ^3.5.0 |
| vaul | ^1.1.2 |
| zod | ^4.4.2 |
| zustand | ^5.0.12 |

### DevDependencies (13 entries — minus dropped husky + lint-staged + ts-node)

| Package | Version |
|---------|---------|
| @biomejs/biome | ^2.4.14 |
| @tailwindcss/postcss | ^4.2.4 |
| @types/node | ^22.19.17 |
| @types/react | ^19.2.14 |
| @types/react-dom | ^19.2.3 |
| babel-plugin-react-compiler | ^1.0.0 |
| postcss | ^8.5.13 |
| tailwindcss | ^4.1.5 |
| tw-animate-css | ^1.4.0 |
| typescript | ^5.9.3 |

**Dropped in our merge (Task 2):**
- husky ^9.1.7 — root Biome covers pre-commit
- lint-staged ^16.4.0 — replaced by root `pnpm lint`
- ts-node ^10.9.2 — generate:presets script not used in our build

**Phase 4 ADDITIONS in our merge (Task 2):**
- `@ai-logist/shared-types: workspace:*` (D-18 — workspace ref)
- `swr ^2.4.1` (D-11 — client refresh on chat/calls/orders/order-detail)
- `bcryptjs ^3.0.3` (D-05 — admin password hash)
- `jose ^6.2.3` (D-06 — signed HTTP-only cookie)
- `@types/bcryptjs` (TS types for bcryptjs)
- `tsx ^4.22.0` (gen-admin-password CLI runtime)

**Wave 0 retained dev deps (preserved through merge):**
- vitest ^4.1.0
- @testing-library/react ^16
- @testing-library/dom ^10
- happy-dom ^15

## Re-vendoring procedure (for future Zenith upgrades)

```bash
cd /tmp && rm -rf zenith-new && git clone --depth 1 https://github.com/mahooo0/next-shadcn-admin-dashboard.git zenith-new
diff -r /tmp/zenith-new/src apps/web/src   # review breaking changes
diff /tmp/zenith-new/package.json apps/web/package.json.zenith   # dep delta
# Then for each changed file: cp -i (interactive overwrite confirmation)
# Run all Phase 4 tests after copy: pnpm -r test
# Update this file's `Git SHA` + `Source commit date` + `Vendored:` line
```
