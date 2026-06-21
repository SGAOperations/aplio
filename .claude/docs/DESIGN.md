# Design System

How Aplio's UI should look and behave. Read this before building or changing any UI. The single most important rule:

> **IMPORTANT: never hardcode colors, radii, or font families.** Always use the semantic Tailwind tokens / CSS variables defined in `app/globals.css`. A literal hex, `rgb()`, or raw `oklch()` in a component is a bug. If you need a value that doesn't exist as a token, add a token to `globals.css` first.

Stack: shadcn/ui **new-york** style, **zinc** base color, **OKLCH** colors with light + `.dark` themes, **lucide** icons, RSC enabled. Config in `components.json`; tokens in `app/globals.css`.

## 1. Theme & atmosphere

Clean, neutral, content-first administrative UI. Near-white/near-black neutral surfaces (zinc, zero chroma) with a single saturated **red** brand accent (hue ~27). Generous radius (`--radius: 0.75rem`) gives a soft, modern feel. Light and dark are first-class — every surface must read correctly in both.

## 2. Color tokens & their roles

Use the Tailwind utility that maps to each variable (e.g. `bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`). Pair each background with its `-foreground`.

| Token (utility)                    | Role                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `background` / `foreground`        | Page base surface and primary text                          |
| `card` / `card-foreground`         | Cards, raised panels                                        |
| `popover` / `popover-foreground`   | Popovers, dropdowns, menus                                  |
| `primary` / `primary-foreground`   | Brand red — primary buttons, key emphasis, active states    |
| `secondary` / `secondary-foreground` | Low-emphasis buttons / chips                              |
| `accent` / `accent-foreground`     | Hover/active fills on neutral controls                      |
| `muted` / `muted-foreground`       | Subtle backgrounds; secondary/help text (`muted-foreground`) |
| `destructive`                      | Errors, destructive actions (red, higher chroma)            |
| `border` / `input` / `ring`        | Borders, input borders, focus rings                         |
| `success` / `warning` / `info` (+ `-foreground`) | **Project-specific** status colors — use these for status, never raw green/amber/blue |
| `sidebar*`                         | Sidebar surface, text, primary, accent, border, ring        |
| `nav-hover`                        | Hover fill for nav items                                    |
| `header-bg` / `header-border`      | App header surface and divider                              |
| `icon-secondary` / `icon-tertiary` | Secondary/tertiary icon tints (lucide)                      |
| `chart-1`…`chart-5`                | Data-viz series (in order)                                  |

Status mapping: success = positive/complete, warning = needs attention, info = neutral notice, destructive = error/danger. Don't invent new status colors.

## 3. Typography

- Font family comes from `--font-sans` (set in the root layout) — use the `font-sans` utility; never name a font in a component.
- Hierarchy with Tailwind scale: page title `text-2xl font-semibold`, section `text-lg font-semibold`, body `text-sm`, helper/caption `text-xs text-muted-foreground`. Keep headings hierarchical (`h1`→`h2`, no skips).

## 4. Radius, spacing, layout

- **Radius:** `--radius: 0.75rem`. Use `rounded-md`/`rounded-lg`/`rounded-xl` (derived from the scale); don't use arbitrary radii. Inputs/buttons/cards inherit the shadcn defaults.
- **Spacing:** Tailwind 4-point scale. Card padding `p-6` (compact `p-4`); stack gaps `gap-4`/`gap-6`; form field gap `gap-2`. Be consistent rather than pixel-tuning.
- **Containers:** constrain reading width (`max-w-*`), center with `mx-auto`; full-bleed only for tables/dashboards.

## 5. Components

- **Compose shadcn primitives from `@/components/ui`** — don't rebuild buttons, inputs, dialogs, etc. Add new ones with the shadcn CLI so they pick up the configured tokens. Icons from `lucide-react`.
- **Buttons:** primary = `primary`; secondary/cancel = `secondary` or `variant="outline"`; destructive = `variant="destructive"`. One primary action per view.
- **Forms:** use the shadcn `Form`/`FieldGroup` primitives with `FormLabel`; every input has an associated label; surface validation with `data-invalid` / inline `FormMessage`, not ad-hoc text. (Form wiring rules: `.claude/docs/ENGINEERING.md` §4.)
- **State surfaces:** all three required (`.claude/docs/ENGINEERING.md` §4) — `<Suspense>` + skeleton for loading, `error.tsx`/inline error for failure, a designed empty state (icon + one line + primary action) for zero items.
- **Focus & overlays:** never `outline-none` without a visible replacement; rely on Radix focus trapping in dialogs/sheets — don't break it with custom wrappers.

## 6. Do / Don't

- ✅ `className="bg-card text-card-foreground border-border rounded-lg"`  ❌ `style={{ background: '#fff' }}` / `bg-[#fff]` / `rounded-[12px]`
- ✅ `text-muted-foreground` for secondary text  ❌ `text-gray-500`
- ✅ `text-success` / `bg-warning`  ❌ `text-green-600` / `bg-amber-500`
- ✅ icons via `lucide-react`  ❌ inline SVG paths for standard icons
- ✅ verify both themes  ❌ values that only work in light mode

## 7. Responsive

Mobile-first (per `CLAUDE.md`): base styles target mobile, layer `md:`/`lg:` upward. Sidebars collapse to a Sheet/drawer with a hamburger trigger below `md`. Touch targets ≥ ~44px. No fixed pixel widths that break narrow viewports. Test at 375px, 768px, 1280px.

## 8. Agent quick reference

Surfaces → `bg-background` (page), `bg-card` (panels), `bg-popover` (menus). Text → `text-foreground` (primary), `text-muted-foreground` (secondary). Brand → `primary`. Status → `success`/`warning`/`info`/`destructive`. Lines → `border-border`, focus → `ring-ring`. Radius → `rounded-lg`. Never hardcode any of these.
