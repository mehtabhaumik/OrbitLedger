# Orbit Ledger Cross-Platform Program Phases

This is the refined execution order for mobile + web/PWA expansion.

## Phase 0 — Brand System And Web SaaS UX Foundation

- define universal brand tokens
- define semantic color usage
- define web SaaS shell and IA
- define mobile vs web expression rules

## Phase 1 — Monorepo Foundation And Shared Contracts

- create app/package boundaries
- centralize shared domain logic, contracts, and UI tokens
- keep mobile stable during extraction

## Phase 2 — Business Modes, Auth, And Workspace Lifecycle

- mobile: local-only or synced
- web: synced only
- explicit linking and conversion rules

## Phase 3 — Local Storage And Sync Data Model

- mobile SQLite remains primary working store
- web gets offline-capable local layer
- Firebase becomes sync backend
- all records gain sync-safe metadata

## Phase 4 — Sync Engine And Conflict Safety

- outbound queue
- inbound processor
- append-safe entity handling
- revision-protected master records
- no silent overwrite

## Phase 5 — Web/PWA Product Build

- build the premium web SaaS application
- login-required synced workspaces
- installable PWA
- print/share/download/document workflows

## Phase 6 — Mobile Sync Enablement Without Regressing Offline Users

- optional sign-in on mobile
- local-only to synced conversion
- synced workspace bootstrap to SQLite
- sync status and recovery UX

## Phase 7 — Security Model Across Mobile And Web

- keep mobile local security local
- web uses login + local app protection + WebAuthn where supported
- no synced raw secrets

## Phase 8 — Backup, Recovery, And Trust Layer

- maintain backup as first-class safety path
- export/import across modes
- browser/device/storage scope messaging

## Phase 9 — Cross-Platform Runtime QA And Release Hardening

- runtime verification on mobile, web, PWA install flow
- sync consistency
- conflict handling
- backup/restore truthfulness
- final audit

## Execution Rule

Each phase must end with:

- implementation complete
- typecheck passing
- copy consistency check
- regression sweep on core ledger, invoice, statement, backup, and security flows
