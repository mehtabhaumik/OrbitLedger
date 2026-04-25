# Phase 3 — Local Storage And Sync Data Model

This phase adds the real sync metadata and local modeling needed for a local-first mobile app and
an offline-capable signed-in web app to share one workspace safely.

## What Changed

### Shared contracts

[packages/contracts/src/index.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/packages/contracts/src/index.ts)
now carries:

- `serverRevision`
- `OrbitWorkspaceDataState`
- sync conflict record types

### Shared sync package

[packages/sync](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/packages/sync) now defines:

- append-safe vs revision-protected entity strategy
- sync overview types
- pending record types
- conflict input types

### Mobile SQLite schema

[apps/mobile/src/database/schema.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/database/schema.ts)
now persists `server_revision` on sync-capable tables and includes a dedicated
`sync_conflicts` table.

### Mobile row/types mapping

[apps/mobile/src/database/types.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/database/types.ts)
and [apps/mobile/src/database/mappers.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/database/mappers.ts)
now expose server revision through the real app models.

## Why This Matters

This is the line between “we have cloud ideas” and “we have sync-safe data.”

The app now has:

- local record identity
- remote/server revision identity
- explicit conflict storage
- explicit workspace dataset state

## Exit Criteria Met

- sync-capable entities persist server revision locally
- unresolved conflicts can be stored and surfaced
- mobile and web share the same workspace data-state language
- the repo compiles with the shared sync package
