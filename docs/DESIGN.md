# Design System

How Aplio's UI should look and behave. Read this before building or changing any UI. The single most important rule:

> **IMPORTANT: never hardcode colors, radii, or font families.** Always use the semantic Tailwind tokens / CSS variables defined in `app/globals.css`. A literal hex, `rgb()`, or raw `oklch()` in a component is a bug. If you need a value that doesn't exist as a token, add a token to `globals.css` first.
>
> **Exception: `app/manifest.ts`.** A web app manifest is static JSON and can't read CSS custom properties, so `theme_color`/`background_color` are the one sanctioned place for a literal hex.

Stack: shadcn/ui **new-york** style, **zinc** base color, **OKLCH** colors with light + `.dark` themes, **lucide** icons, RSC enabled. Config in `components.json`; tokens in `app/globals.css`.

Platform icons (`app/apple-icon.png`, `public/icon-*.png`) are committed PNG rasters exported by hand from `public/logo-dark.svg` — re-export them if the logo changes.

## 1. Theme & atmosphere

Clean, neutral, content-first administrative UI. Near-white/near-black neutral surfaces (zinc, zero chroma) with a single saturated **red** brand accent (hue ~27). Generous radius (`--radius: 0.75rem`) gives a soft, modern feel. Light and dark are first-class — every surface must read correctly in both.

## 2. Color tokens & their roles

Use the Tailwind utility that maps to each variable (e.g. `bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`). Pair each background with its `-foreground`.

| Token (utility)                                  | Role                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `background` / `foreground`                      | Page base surface and primary text                                                    |
| `card` / `card-foreground`                       | Cards, raised panels                                                                  |
| `popover` / `popover-foreground`                 | Popovers, dropdowns, menus                                                            |
| `primary` / `primary-foreground`                 | Brand red — primary buttons, key emphasis, active states                              |
| `secondary` / `secondary-foreground`             | Low-emphasis buttons / chips                                                          |
| `accent` / `accent-foreground`                   | Hover/active fills on neutral controls                                                |
| `muted` / `muted-foreground`                     | Subtle backgrounds; secondary/help text (`muted-foreground`)                          |
| `destructive`                                    | Errors, destructive actions (red, higher chroma)                                      |
| `border` / `input` / `ring`                      | Borders, input borders, focus rings                                                   |
| `success` / `warning` / `info` (+ `-foreground`) | **Project-specific** status colors — use these for status, never raw green/amber/blue |
| `sidebar*`                                       | Sidebar surface, text, primary, accent, border, ring                                  |
| `nav-hover`                                      | Hover fill for nav items                                                              |
| `header-bg` / `header-border`                    | App header surface and divider                                                        |
| `chart-1`…`chart-5`                              | Data-viz series (in order)                                                            |

Status mapping: success = positive/complete, warning = needs attention, info = neutral notice, destructive = error/danger. Don't invent new status colors.

Any change to a brand/status token must keep ≥4.5:1 contrast against its paired `-foreground` in **both** themes, verified in-browser.

## 3. Typography

- Font family comes from `--font-sans` (set in the root layout) — use the `font-sans` utility; never name a font in a component.
- Hierarchy with Tailwind scale: page title `text-2xl font-semibold`, section `text-lg font-semibold`, body `text-sm`, helper/caption `text-xs text-muted-foreground`. Keep headings hierarchical (`h1`→`h2`, no skips).

## 4. Radius, spacing, layout

- **Radius:** `--radius: 0.75rem`. Use `rounded-md`/`rounded-lg`/`rounded-xl` (derived from the scale); don't use arbitrary radii. Inputs/buttons/cards inherit the shadcn defaults.
- **Spacing:** Tailwind 4-point scale. Card padding `p-6` (compact `p-4`); stack gaps `gap-4`/`gap-6`; form field gap `gap-2`. Be consistent rather than pixel-tuning.
- **Page width tiers:** every route inside the app shell picks exactly one tier for its top-level container. `app-shell.tsx` supplies only `p-6`, so the page owns the width.

  | Tier           | Container classes   | Use for                                                                                                                                      |
  | -------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Full-bleed** | none (no `max-w`)   | list, table and dashboard pages — `/`, `/positions`, `/manage/positions`, `/users`, `/applications`, `/my-applications`, `/global-questions` |
  | **Wide**       | `mx-auto max-w-5xl` | two-column review/detail pages — `/applications/[id]`, `/my-applications/[id]`                                                               |
  | **Narrow**     | `mx-auto max-w-2xl` | single-column forms and reading views — `/profile`, `/positions/[id]/apply`, `/manage/positions/[id]/edit`                                   |

  There is no fourth tier: `max-w-6xl`/`4xl`/`3xl` on a page container is a bug. Inside a full-bleed page, constraining an individual prose block (`max-w-2xl` on a description) is correct and not a tier violation — see `/positions/[id]`. A route's `loading.tsx` must use the same tier as its `page.tsx`, or the skeleton shifts on resolve. Routes outside the app shell (`(legal)`, `login`) set their own width.

## 5. Components

- **Compose shadcn primitives from `@/components/ui`** — don't rebuild buttons, inputs, dialogs, etc. Add new ones with the shadcn CLI so they pick up the configured tokens. Icons from `lucide-react`.
- **Buttons:** primary = `primary`; secondary/cancel = `secondary` or `variant="outline"`; destructive = `variant="destructive"`. One primary action per view.
- **Forms:** use the shadcn `Form`/`FieldGroup` primitives with `FormLabel`; every input has an associated label; surface validation with `data-invalid` / inline `FormMessage`, not ad-hoc text. (Form wiring rules: `ENGINEERING.md` §4.)
- **State surfaces:** all three required (`ENGINEERING.md` §4) — `<Suspense>` + skeleton for loading, `error.tsx`/inline error for failure, a designed empty state (icon + one line + primary action) for zero items.
- **Focus & overlays:** never `outline-none` without a visible replacement; rely on Radix focus trapping in dialogs/sheets — don't break it with custom wrappers.

## 6. Iconography

The vocabulary lives in `lib/icons.ts` as five separately-exported `Record<Enum, LucideIcon>` maps — `CONCEPT_ICONS`, `APPLICATION_STATUS_ICONS`, `POSITION_AVAILABILITY_ICONS` / `POSITION_STATUS_ICONS`, `ACTION_ICONS`, `STATE_ICONS`, `FILE_TYPE_ICONS`. Five exports, not one object, so a consumer importing `ACTION_ICONS` doesn't pull the status icons into its bundle.

- **The vocabulary is the allow-list.** Import icons from `@/lib/icons`, never `lucide-react`, outside `lib/icons.ts` and shadcn-generated `components/ui/*`. No meaning in a map → no icon.
- **One concept, one icon, everywhere.** A concept's icon is identical in nav, empty state, section heading and button.
- **Look the icon up inside the component that renders it.** A `LucideIcon` is a function and is **not serializable**, so it must never be a prop crossing a server → client boundary; derive it from the enum value or the concept key locally. (`EmptyState` / `SectionCardEmpty` / `WarningCallout`'s `icon` props are safe only because both sides sit in the same environment — keep it that way.)
- **Never set a size class on an icon inside a shadcn primitive.** `components/ui/button.tsx` and `DropdownMenuItem` already carry `[&_svg:not([class*='size-'])]:size-4`; a `className="size-4"` there is dead weight. Elsewhere: `size-4` inline with text, `size-5` for a banner/trigger, `size-10` in a card-section empty state, `size-12` in a full `EmptyState`, `size-3` in a badge, `size-3.5` for a table-header sort affordance. Always `size-N`, never `h-N w-N`.
- **Never write `aria-hidden` on a lucide icon.** lucide-react emits `aria-hidden="true"` itself unless an a11y prop is present. An icon-only control gets `aria-label` **on the control**, not on the icon, and never both an `aria-label` and an `sr-only` span.
- **Tint:** `text-muted-foreground` by default; `text-destructive` / `text-warning` / `text-success` / `text-info` only where the icon carries that semantic. Never a hardcoded colour. Inside a coloured `Badge` the icon inherits the paired `-foreground` — set no tint.
- **Icons never carry meaning alone.** Every icon sits beside a text label or an `aria-label`; colour + shape is a redundancy for WCAG 1.4.1, never the only channel.
- **Icon-free by rule:** page titles (`PageHeader` h1), form labels and `FormMessage`, table body cells, data/value chips, role badges (`Admin` / `Manager`), and the `(legal)` prose pages plus `markdown.tsx` (user-authored content).
- **shadcn CLI output is exempt.** `checkbox` `dialog` `dropdown-menu` `input-otp` `pagination` `radio-group` `select` `sheet` keep the CLI's emitted names (`XIcon`, `CheckIcon`, `MoreHorizontalIcon`, …) so re-running `shadcn add` produces no diff. Every other `components/ui/*` file is hand-written and bound by these rules.

## 7. Do / Don't

- ✅ `className="bg-card text-card-foreground border-border rounded-lg"` ❌ `style={{ background: '#fff' }}` / `bg-[#fff]` / `rounded-[12px]`
- ✅ `text-muted-foreground` for secondary text ❌ `text-gray-500`
- ✅ `text-success` / `bg-warning` ❌ `text-green-600` / `bg-amber-500`
- ✅ icons via `@/lib/icons` ❌ importing `lucide-react` directly outside `lib/icons.ts` / shadcn output
- ✅ verify both themes ❌ values that only work in light mode

## 8. Responsive

Mobile-first (per `CLAUDE.md`): base styles target mobile, layer `md:`/`lg:` upward. Sidebars collapse to a Sheet/drawer with a hamburger trigger below `md`. Touch targets ≥ ~44px. No fixed pixel widths that break narrow viewports. Test at 375px, 768px, 1280px.

## 9. Agent quick reference

Surfaces → `bg-background` (page), `bg-card` (panels), `bg-popover` (menus). Text → `text-foreground` (primary), `text-muted-foreground` (secondary). Brand → `primary`. Status → `success`/`warning`/`info`/`destructive`. Lines → `border-border`, focus → `ring-ring`. Radius → `rounded-lg`. Icons → `@/lib/icons`, never `lucide-react` directly. Never hardcode any of these.
