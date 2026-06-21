---
name: responsive-pass
description: Apply the mobile-first responsive rules to a component or page — base styles for mobile, layered md:/lg: breakpoints, sidebars collapsing to a Sheet/drawer, no fixed widths. Use when building or fixing layout for small screens.
allowed-tools: Read, Grep, Glob, Edit
---

# Responsive pass

Apply the mobile-first rules from `CLAUDE.md` and `.claude/docs/DESIGN.md` §7.

## What to enforce

- **Mobile-first** — base (unprefixed) classes target mobile; add `md:`/`lg:` to scale up. Don't write desktop-first and patch down.
- **No fixed pixel widths** that break narrow viewports — prefer fluid widths, `max-w-*`, and grid/flex that wraps.
- **Sidebars collapse** below `md` into a Sheet/drawer triggered by a hamburger button; the persistent sidebar is `hidden md:block`.
- **Touch targets** ≥ ~44px; spacing/typography remain legible at 375px.
- **Tables/wide content** scroll or reflow on small screens rather than overflow.

## How

Read the target component, identify desktop-only assumptions (fixed widths, always-visible sidebar, no breakpoints), and refactor to mobile-first. Use `.claude/docs/DESIGN.md` semantic tokens. Verify mentally at 375 / 768 / 1280px; note anything needing a real device/browser check.
