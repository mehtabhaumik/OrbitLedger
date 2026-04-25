# Phase 4 — Sync Engine And Conflict Safety

This phase turns sync into real code instead of status copy.

## What Changed

### Mobile remote workspace data layer

Added:

- [apps/mobile/src/cloud/workspaceData.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/cloud/workspaceData.ts)

This file provides:

- workspace dataset fetch
- workspace data-state reads/writes
- per-entity remote upsert with revision checks

### Mobile sync engine

[apps/mobile/src/sync/service.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/sync/service.ts)
now supports:

- ordered push for:
  - business settings
  - customers
  - products
  - invoices
  - invoice items
  - transactions
- pull of the same workspace dataset back into SQLite
- unresolved conflict recording when a remote revision does not match
- last-sync persistence
- workspace data-state promotion to `full_dataset`

### Real mobile user flow wiring

[apps/mobile/src/screens/SetupScreen.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/screens/SetupScreen.tsx)
now runs workspace sync after linking or creating a synced business.

[apps/mobile/src/screens/BusinessProfileSettingsScreen.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/screens/BusinessProfileSettingsScreen.tsx)
now exposes:

- `Sync Now`
- pending record count
- conflict count
- truthful sync-enabled messaging

## Conflict Policy

- revision-protected records fail visibly when server revision changes
- append-safe records are still tracked with sync metadata
- current data is preserved when sync fails
- conflicts are recorded instead of silently overwritten

## Exit Criteria Met

- sync is no longer a UI shell
- an existing synced workspace can now be pulled to a device
- local pending changes can be pushed to the linked workspace
- conflict records are stored when revision protection trips
