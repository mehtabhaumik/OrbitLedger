# Orbit Ledger Design System

Supersedes `ORBIT_LEDGER_BRAND_STYLE_GUIDE.md`.

Implementation lives in `apps/web/app/tokens.css`. This document explains the
reasoning; the CSS is the source of truth for values.

---

## 1. Position

Orbit Ledger is a **serious instrument that does not look like accounting
software**. Those two halves are both load-bearing.

Finance tools split into two failed camps. Legacy suites (Zoho Books, Tally)
are dense, grey, and toolbar-heavy — they look capable and feel exhausting.
Modern fintech is airy and pastel — it looks pleasant and feels like it cannot
hold a real ledger. Orbit Ledger takes the precision of the first and the
clarity of the second.

The test for any screen: **an owner should be able to glance at it and know what
needs action, and a chartered accountant should trust it with a filing.** A
design that satisfies only one of those has failed.

### What we are correcting

The previous skin was competent and generic. Diagnosis, with evidence:

| Symptom | Evidence in the old codebase |
|---|---|
| Reads as generic SaaS | Primary was `#356dd6` — default-issue SaaS blue |
| No enforced system | 1,874 hardcoded colour literals vs 527 token references (~78% untokenized) |
| Palette drift | 237 distinct hex values; five near-identical navies, five near-identical greys |
| Broken token layer | A second `:root` at line 15886 silently shadowed ~20 tokens |
| Live bugs | 6 tokens referenced but never defined, resolving to nothing |
| Unintended typography | `Inter` named in the stack but never loaded — users saw system fallbacks |

The old guide told authors to be "calm, restrained, quiet" and to "avoid heavy
gradients." That advice produced a product its own owner calls plain. It is
withdrawn.

---

## 2. Principles

**1. Density is a hierarchy problem, not a spacing problem.**
The fix for a crowded screen is rarely more padding — it is making the important
thing obviously more important. Increase contrast between levels before
increasing space between them.

**2. Motion must never gate information.**
Anything standing between a user and a number is capped at 200ms. Longer
durations are reserved for things that are already complete — a chart drawing in
after its data has landed. A ledger that makes you wait to feel premium is
broken.

**3. Colour carries meaning or it is absent.**
Violet is brand and interaction. Green/amber/rose are financial state. Cyan is
live data. Nothing is coloured for decoration — in a money product, an
unexplained colour reads as a warning.

**4. Numbers are the interface.**
Every figure uses tabular numerals and aligns on the decimal. A column that
does not align is a correctness bug.

**5. Semantic tokens only.**
Component CSS never references a primitive (`--ol-violet-600`) or a raw hex.
This is what makes light and dark a single implementation.

---

## 3. Colour

### Brand — violet

`--primary: #4f3dd9` (light) / `#8b7dff` (dark)

Blue was the problem, not the execution. Every ledger product is blue; it is why
the app disappeared into the category. Violet reads technical and considered
without the playfulness of teal or the aggression of Zoho's red-orange. It is
also unclaimed in Indian SMB finance.

### Financial state — reserved

| Token | Meaning | Never used for |
|---|---|---|
| `--success` | paid, reconciled, healthy | brand accent, chart series |
| `--warning` | due soon, needs attention | general emphasis |
| `--danger` | overdue, failed, destructive | decoration |
| `--tax` | tax-related surfaces | anything untaxed |
| `--premium` | Pro tier | upsell decoration |
| `--signal` | **live** realtime data only | static content |

Status colour always ships with an icon and a label. Colour alone is never the
carrier of state — it fails for colourblind users and in print.

### Contrast — verified, not assumed

Every ink and status token passes **WCAG AA (≥4.5:1)** on its own surface in
both modes. Verified by computation, not judgement. Re-run the check before
changing any value.

Worth knowing: several of these pass only with room to spare in one mode. Do not
"nudge" a token for looks without re-verifying.

---

## 4. Data visualization

Governed by the project's `dataviz` skill. Non-negotiables:

- **Fixed slot order, never cycled.** A 9th series folds into "Other", facets,
  or gets direct-labeled — it never gets an invented hue.
- **One axis.** Never dual-axis. Two measures of different scale become two
  charts or an indexed comparison.
- **Sequential = one hue light→dark. Diverging = two hues with a neutral grey
  midpoint.** Never a rainbow, never a hue at the midpoint.
- **Status colours are never chart series.**
- **Text wears text tokens, never the series colour.**

### Validated categorical palette

Slots 1–8, `--chart-1` … `--chart-8`. Both modes validated for lightness band,
chroma floor, CVD separation, and normal-vision separation on the adjacent
pairlist:

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | violet (brand) | `#5b4be8` | `#9085e9` |
| 2 | green | `#008300` | `#008300` |
| 3 | magenta | `#e87ba4` | `#d55181` |
| 4 | amber | `#eda100` | `#c98500` |
| 5 | aqua | `#1baf7a` | `#199e70` |
| 6 | orange | `#eb6834` | `#d95926` |
| 7 | blue | `#2a78d6` | `#3987e5` |
| 8 | red | `#e34948` | `#e66767` |

Two constraints carried from validation:

- **Scatter/bubble/small-multiple forms cap at 4 series.** Only slots 1–4 clear
  the all-pairs gate. In dark mode those land in the 6–8 CVD floor band, so they
  additionally require secondary encoding (direct labels, gaps, or texture).
- **Light-mode slots 3, 4, and 5 sit below 3:1 on the light surface.** The
  relief rule applies: visible direct labels or a table view. This is not
  dismissable.

---

## 5. Typography

| Role | Family | Use |
|---|---|---|
| Display | Space Grotesk | Page and section titles, hero metrics |
| UI | Inter | All body, labels, controls, tables |
| Mono | JetBrains Mono | Invoice numbers, IDs, codes, audit hashes |

**All three must be loaded via `next/font`.** The old skin named Inter without
loading it, so typography varied per machine. Self-hosting through `next/font`
also removes a third-party request and prevents layout shift.

Verify the **₹ glyph** renders in Space Grotesk before shipping display text
containing currency. If it does not, money stays in Inter — which is the default
anyway, since `.ol-amount` inherits the UI stack.

Scale is a 1.200 minor third from a 16px base (`--text-2xs` … `--text-5xl`).
Fewer steps with bigger jumps than the old file, because hierarchy needs visible
difference.

---

## 6. Spacing and layout

4px base (`--space-1` … `--space-24`). Every gap and pad resolves to a step —
no arbitrary pixel values.

- Panels: `--space-6` (24px)
- Form field internal rhythm: `--space-2` (8px)
- Form groups: `--space-5` (20px)
- Section stacks: `--section-stack-gap`
- Action rows: minimum `--space-5` above, never touching helper text

Controls standardize at `--control-height` 44px (down from 48px — reclaims
vertical space on dense list screens without dropping below the 44px touch
minimum).

---

## 7. Motion

| Token | Duration | Use |
|---|---|---|
| `--duration-instant` | 80ms | hover, focus rings |
| `--duration-fast` | 140ms | buttons, toggles, chips |
| `--duration-normal` | 200ms | panels, drawers, menus — **ceiling for anything gating content** |
| `--duration-slow` | 320ms | page/route transitions |
| `--duration-deliberate` | 520ms | chart draw-in on already-loaded data only |

`prefers-reduced-motion` is enforced globally in `tokens.css`, not per
component, so no future animation can opt out by forgetting.

---

## 8. Rules for authors

1. Reference semantic tokens only. Never a primitive, never a raw hex.
2. Reuse existing `.ol-*` primitives before adding a selector.
3. Any new colour must pass contrast verification before it is committed.
4. Status is colour **plus** icon **plus** label. Always all three.
5. Money uses tabular numerals. No exceptions.
6. Every interactive element has a visible focus state.
7. Both themes are shipped together. A change tested in one mode is not done.
8. Visual baselines (`npm run visual`) must be green, or the diff explicitly
   reviewed and re-approved with `npm run visual:update`.

---

## 9. Open decisions

These are deliberately unresolved and need a product call:

- **Default theme.** The system ships both. Light is currently default. Dark-first
  would read more "futuristic" but is a worse default for all-day ledger work in
  bright Indian office and shop environments. Recommend light default with a
  prominent toggle.
- **Chart library.** Tokens are library-agnostic. Selection happens in the
  charts phase.
- **Landing vs app.** The marketing pages do not consume the token system —
  changing `--primary` provably does not affect them. They need either migration
  onto tokens or an explicit decision to keep a separate marketing palette.
