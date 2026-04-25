# Phase 1 — Monorepo Foundation And Shared Contracts

This phase converts Orbit Ledger from a single-app repository into a workspace foundation without breaking the current mobile product.

## What Changed

### Workspace Root

The repository root is now the workspace coordinator.

- root [package.json](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/package.json) manages workspace scripts
- root [tsconfig.base.json](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/tsconfig.base.json) holds shared TypeScript defaults

### Mobile App

The existing Expo app now lives in:

- [apps/mobile](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile)

This keeps:

- Expo config
- assets
- native folders
- app entry points
- all mobile screens and services

in one intact app workspace.

### Shared Packages

#### UI

[packages/ui](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/packages/ui)

Contains:

- brand tokens
- semantic theme tokens
- web SaaS shell tokens

Mobile now consumes the theme through thin re-export files inside:

- [apps/mobile/src/theme](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/theme)

#### Contracts

[packages/contracts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/packages/contracts)

Contains shared sync and workspace contract types such as:

- business storage mode
- sync status
- sync metadata
- workspace link
- sync entity names
- sync connection state

Mobile now uses these contracts in:

- [apps/mobile/src/database/types.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/database/types.ts)
- [apps/mobile/src/sync/types.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/sync/types.ts)

#### Core

[packages/core](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/packages/core)

Contains shared business-mode helpers for the future local-only vs synced lifecycle.

### Web Slot

[apps/web](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web) is reserved for the web/PWA application that will be built in later phases.

## Why This Matters

This foundation lets us:

- keep mobile stable
- centralize shared tokens and contracts
- prepare for a premium web app without duplicating product rules
- prepare for sync-safe business/workspace modeling

## Phase 1 Exit Criteria

- mobile app remains the primary working product
- workspace root can run mobile scripts
- shared theme is moved into a package
- shared contracts are consumed by real mobile code
- future web work has a clear app boundary
