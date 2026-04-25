# Phase 6 — Mobile Sync Enablement Without Regressing Offline Users

This phase keeps the current mobile app local-first while making synced workspaces usable in
practice.

## What Changed

### Setup flow

[apps/mobile/src/screens/SetupScreen.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/screens/SetupScreen.tsx)
now:

- allows opening existing full synced workspaces after sign-in
- links and immediately syncs a new synced business
- removes stale “next phase” wording

### Business settings sync center

[apps/mobile/src/screens/BusinessProfileSettingsScreen.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/screens/BusinessProfileSettingsScreen.tsx)
now:

- shows pending records and conflict counts
- exposes a manual `Sync Now` action
- syncs immediately after enabling workspace linkage
- syncs after mirrored business-profile saves

### Startup and resume behavior

[apps/mobile/src/navigation/AppNavigator.tsx](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/apps/mobile/src/navigation/AppNavigator.tsx)
now schedules deferred workspace sync on:

- startup
- app resume

This keeps the mobile app local-first while still catching up cloud state when the device is
connected and signed in.

## Exit Criteria Met

- local-only mobile users still keep full local behavior
- synced mobile users can pull and push real workspace data
- mobile startup/resume can refresh a linked workspace automatically
