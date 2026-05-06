# Orbit Ledger Brand And UI Style Guide

## Product Feel

Orbit Ledger should feel calm, precise, and trustworthy. The app is for daily money control, so the interface must reduce pressure instead of adding noise. Prefer quiet confidence over loud decoration.

## Visual Direction

- Use soft off-white app backgrounds, white surfaces, restrained borders, and muted shadows.
- Use blue only for primary actions and selected states.
- Use green, amber, red, and purple sparingly for status meaning only.
- Avoid large grey-on-grey cards, heavy gradients, oversized CTAs, and decorative color blobs.
- Dark panels are allowed for important overview surfaces, but content inside them must keep strong contrast and refined spacing.
- The reference direction from Command is airy, white, minimal, and quietly confident. Orbit Ledger should borrow that restraint, while keeping its own money-control identity.

## Typography

- Use the system sans stack through the global CSS source.
- Page titles may be bold, but form/card text should be quieter.
- Avoid oversized type inside compact cards and forms.
- Keep labels small, clear, and consistent.
- User-facing copy should avoid technical wording.

## Spacing

- Panels use 18-22px padding.
- Form fields use an 8px internal label/control/helper rhythm.
- Form groups use 18px gaps.
- CTAs must never touch helper text or form surfaces. Action rows need at least 18px top margin.
- Mobile panels should remain padded and readable, not edge-cramped.

## Controls

- Inputs, selects, and textareas must inherit from `.ol-input`, `.ol-select`, and `.ol-textarea`.
- Standard control height is `--control-height`.
- Standard control radius is `--control-radius`.
- Inline errors use modern pill-like error messages through `.ol-field-error`.
- Helper text should be short, muted, and visually subordinate.
- Primary CTAs are compact, not tall blocks, unless a full-width mobile action is required.

## Cards

- Cards should be white or near-white with subtle borders.
- Cards in dark panels must use intentional high-contrast surfaces.
- Metric cards should use slim status rails, not heavy color fills.
- Pricing cards should clearly separate Free vs Pro without screaming.

## Responsive Rules

- Mobile and tablet should feel app-like: generous touch targets, simple stacks, no horizontal squeezing.
- Form grids collapse to one column on narrow screens.
- Header action groups may become full-width on mobile.
- Sticky action bars should remain compact and not cover content.

## Implementation Rule

Global CSS owns the visual system. Avoid inline one-off visual styles unless they are layout-specific and tiny. New screens should reuse existing panel, field, action, table, metric, and card primitives before adding new CSS.
