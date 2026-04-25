# Phase 0 — Brand System And Web SaaS UX Foundation

This phase defines the shared Orbit Ledger brand language and the web product expression before monorepo and sync engineering begin.

## Phase Goal

Create a universal design foundation so:

- mobile remains fast, touch-first, and operational
- web becomes a serious SaaS workspace instead of a stretched mobile app
- both platforms feel like one product family
- color, status, trust cues, and document language stay consistent

## Brand Direction

Orbit Ledger should feel:

- trustworthy
- modern
- serious
- clear
- lightly futuristic
- operational, not decorative

The logo colors are used as **brand ancestry**, not as literal UI paint.

### Color Meaning

- Blue: primary action, active navigation, selected state, links
- Teal: payment received, success, healthy sync, healthy backup
- Amber: dues, stale follow-up, attention, overdue
- Violet: tax, country packages, intelligence, advanced systems
- Plum: premium / Pro only
- Red: destructive action only

### Surfaces

- background and shell stay neutral
- panels and cards stay mostly white
- color should appear in chips, accents, numbers, table states, and focus areas

## Platform Expression

### Mobile

- compact
- touch-first
- stronger action visibility
- fewer columns, clearer stacking
- bottom actions where appropriate

### Web

- premium SaaS workspace
- sidebar + topbar shell
- better density
- stronger tables
- document review and reporting become first-class experiences
- calmer presentation with more structure and less action clustering

## Web Information Architecture

Primary web sections:

1. Home
2. Customers
3. Transactions
4. Invoices
5. Reports
6. Documents
7. Backup
8. Settings

The web shell should not mimic the mobile bottom navigation.

## Web Shell Rules

- use a left sidebar for primary navigation
- use a top context bar for business/workspace context, sync state, and user actions
- use a neutral shell background with restrained glass in the topbar and overlays only
- keep the main workspace clean and table-friendly

## Web Component Rules

### Cards

- subtle border
- restrained shadow
- no decorative nesting
- accent stripe or chip instead of loud backgrounds

### Tables

- sortable and filter-friendly
- right-align all currency columns
- use tabular number styling later in implementation
- use row states for due, paid, active, archived, syncing, and conflict cases

### Panels

- use side panels for customer detail, invoice summary, filters, and document metadata
- do not use panels as decorative chrome

### Document Preview

- centered document canvas
- metadata and actions outside the document body
- print/share/download grouped cleanly

## Status And Trust Language

The web app must surface:

- offline
- syncing
- synced
- sync failed
- local changes pending
- backup recommended
- security/app lock state when applicable

These states must be visible, calm, and unambiguous.

## SaaS Quality Bar

Web must feel like:

- a business command center
- a trusted collections and record system
- a stronger place for reviewing ledgers, invoices, and reports

Web must not feel like:

- Expo web default output
- a mobile clone
- a marketing-heavy template
- a bright fintech toy

## No-Go List

- pink-first UI hierarchy
- full-screen gradients behind operational data
- generic dashboard template styling
- oversized hero sections inside the product shell
- mobile cards simply widened for desktop
- random color usage with no semantic meaning

## Phase 0 Artifacts In Code

This phase adds:

- universal brand tokens in [brand.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/src/theme/brand.ts)
- expanded semantic tokens in [theme.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/src/theme/theme.ts)
- web SaaS shell, IA, and component foundation tokens in [web.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/src/theme/web.ts)

## Exit Criteria

Phase 0 is complete when:

- the product has one clear brand system
- web has a defined SaaS shell model
- mobile and web design differences are intentional
- future implementation phases can build without re-deciding brand and layout rules
