# Phase 5 — Web/PWA Product Build

This phase creates the real web product shell instead of treating web as an Expo afterthought.

## What Changed

### Web app workspace

[apps/web](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web) is now a working Next.js app with:

- login route
- workspace guard
- SaaS shell
- dashboard
- customers
- transactions
- invoices
- reports
- backup
- settings
- PWA manifest
- service worker registration

### Firebase-backed web workspace

Added:

- [apps/web/src/lib/firebase.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/lib/firebase.ts)
- [apps/web/src/lib/workspaces.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/lib/workspaces.ts)
- [apps/web/src/lib/workspace-data.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/lib/workspace-data.ts)

These now provide:

- signed-in workspace loading
- workspace profile create/update
- customer CRUD foundation
- transaction CRUD foundation
- invoice draft foundation
- real dashboard snapshot calculations

### SaaS shell

[apps/web/src/components/app-shell.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/src/components/app-shell.tsx)
implements:

- left navigation
- top glass bar
- workspace switcher
- signed-in owner badge
- online/offline workspace status
- the transparent Orbit Ledger wordmark at `1.6rem`

### PWA readiness

Added:

- [apps/web/app/manifest.ts](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/app/manifest.ts)
- [apps/web/public/sw.js](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/web/public/sw.js)

## Verification

- repo typecheck passes
- web production build passes with `next build`

## Exit Criteria Met

- web is a real app workspace
- web uses login-required synced workspaces
- web has installable PWA basics
- web is no longer a placeholder directory
