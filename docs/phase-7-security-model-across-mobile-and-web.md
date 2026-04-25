# Phase 7 — Security Model Across Mobile And Web

This phase keeps the security story truthful instead of pretending the same lock model exists
everywhere.

## What Changed

### Mobile

The existing mobile security model remains:

- local PIN
- inactivity timeout
- device-local biometric support where already implemented

### Web

Added:

- [apps/web/src/providers/web-lock-provider.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/providers/web-lock-provider.tsx)

This introduces a browser-local 4-digit PIN lock with:

- lock on launch when enabled
- inactivity relock
- browser-local secure messaging
- explicit statement that this is not the cloud password
- explicit statement that it is not included in workspace backups

### Settings integration

[apps/web/app/(workspace)/settings/page.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/app/(workspace)/settings/page.tsx)
now exposes:

- turn on browser lock
- turn off browser lock with PIN confirmation
- inactivity timeout selection

## Trust Boundaries

- web lock is browser-local
- web lock is not synced as a raw secret
- cloud login remains the account identity
- browser lock remains device/browser protection

## Exit Criteria Met

- web no longer relies on login alone for local session protection
- security messaging is explicit about what is and is not protected
