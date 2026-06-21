---
name: a11y-audit
description: Run an accessibility pass on changed UI — semantic HTML, labels, focus management, keyboard operability, contrast, and touch targets — and report or fix issues. Use after building or changing components, per .claude/docs/ENGINEERING.md §5.
allowed-tools: Read, Grep, Glob, Edit
---

# Accessibility audit

Check changed components against `.claude/docs/ENGINEERING.md` §5.

## Checklist

- **Semantic HTML** — buttons are `<button>`, nav is `<nav>`, headings hierarchical (`h1`→`h2`, no skips). ARIA only where no semantic element exists.
- **Labels** — every input has an associated `<label>`/`FormLabel`; icon-only buttons have `aria-label`; images have meaningful `alt` (or `alt=""` if decorative).
- **Keyboard** — every interaction works without a mouse; visible focus rings (never `outline-none` without a replacement — use `ring-ring`); logical tab order; Escape closes overlays.
- **Focus management** — dialogs/sheets trap focus and return it to the trigger on close; don't break Radix's built-in handling with custom wrappers.
- **Contrast & targets** — text meets WCAG AA against its actual background (both themes); touch targets ≥ ~44px on mobile.

## How

Scan the changed components, report findings as `path:line — issue → fix` grouped by severity, and apply unambiguous fixes (add `aria-label`, swap `<div onClick>` for `<button>`, restore focus ring). Flag contrast issues that need a token/design decision rather than guessing.
