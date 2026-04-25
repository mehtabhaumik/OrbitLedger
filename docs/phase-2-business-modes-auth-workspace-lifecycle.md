# Phase 2 — Business Modes, Auth, And Workspace Lifecycle

This phase establishes the safe lifecycle boundary between:

- local-only mobile businesses
- signed-in synced workspaces

## What is implemented

### Mobile business modes

`business_settings` now stores:

- `storage_mode`
- `workspace_id`
- `sync_enabled`
- `last_synced_at`

This makes the business mode explicit instead of inferred.

### Mobile onboarding

The setup flow now supports:

- `Start offline`
- `Sign in to sync`

If the user selects sync:

- they must sign in first
- they can create a new cloud workspace
- they can open an existing `profile_only` workspace on a fresh device

### Cloud auth foundation

Mobile now has a real Firebase email/password auth path.

The app includes:

- sign in
- account creation
- sign out
- persisted session handling through Firebase Auth on React Native

### Workspace lifecycle

Mobile now supports:

- creating a cloud workspace from setup
- promoting a local-only business to a synced workspace from business settings
- refreshing the signed-in workspace list from settings

### Safe limitation at the time

This phase originally stopped at profile-only workspace linking.

That limitation was later removed by the sync phases, which now allow existing full workspaces to
be pulled onto a device after sign-in.

## Rules introduced

- local-only businesses have no `workspace_id`
- synced businesses have `workspace_id`
- web/synced lifecycle depends on real sign-in
- no implicit workspace matching by business name, phone, GST, or email
- local-only to synced conversion creates a new linked workspace from the current local business profile

## Files added for this phase

- `apps/mobile/src/cloud/firebase.ts`
- `apps/mobile/src/cloud/auth.ts`
- `apps/mobile/src/cloud/workspaces.ts`
- `apps/mobile/src/cloud/index.ts`
- `apps/mobile/src/screens/CloudAuthScreen.tsx`

## Files updated for this phase

- `apps/mobile/src/screens/SetupScreen.tsx`
- `apps/mobile/src/screens/BusinessProfileSettingsScreen.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/database/schema.ts`
- `apps/mobile/src/database/types.ts`
- `apps/mobile/src/database/mappers.ts`
- `apps/mobile/src/database/repository.ts`
- `apps/mobile/src/backup/service.ts`
- `packages/contracts/src/index.ts`
- `packages/core/src/index.ts`

## Verification

- workspace typecheck passes
- business mode state is persisted in SQLite
- backup upsert path includes new business mode fields
- synced workspace creation and conversion paths are wired from reachable UI
