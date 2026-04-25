# Phase 8 — Backup, Recovery, And Trust Layer

This phase makes the web workspace recoverable instead of relying only on cloud optimism.

## What Changed

### Web workspace backup

Added:

- [apps/web/src/lib/workspace-backup.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/lib/workspace-backup.ts)
- [apps/web/app/(workspace)/backup/page.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/app/(workspace)/backup/page.tsx)

This now supports:

- JSON export of the signed-in workspace
- backup preview counts before restore
- full replace restore into the current workspace
- truthful note that browser-local lock is not included

### Mobile trust alignment

The existing mobile backup/restore system remains the local-first recovery path. The new sync and
web flows do not replace that.

## Important trust rule

For web:

- cloud workspace data is backed up/exported
- browser-local PIN state is not
- restore is explicit full replace

## Exit Criteria Met

- web now has a reachable export/import recovery flow
- backup copy matches actual scope
- restore is not a placeholder action
