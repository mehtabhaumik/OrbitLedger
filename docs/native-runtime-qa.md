# Orbit Ledger Native Runtime QA

Orbit Ledger uses native modules for local database storage, secure PIN state, biometric unlock,
PDF generation, sharing, file access, and Play Billing. Expo Go is useful for UI checks, but it is
not enough to prove every native path. Use this guide for Android/iOS simulator and device QA.

## Required Local Tooling

- Node.js and npm installed.
- Expo project dependencies installed with `npm install`.
- Android Studio with Android SDK, platform tools, and emulator installed for Android QA.
- Xcode installed for iOS simulator/device QA.
- EAS CLI installed when building internal, preview, or production artifacts:

```bash
npm install -g eas-cli
```

## Project Commands

```bash
# TypeScript check
npm run typecheck

# Expo environment check
npm run doctor

# Expo Go / quick UI smoke test on Android
npm run android:local

# Expo Go / quick UI smoke test on iOS
npm run ios:local

# Native development client server
npm run start:dev-client

# Local Android development client build
npm run android:dev-client

# Local iOS development client build
npm run ios:dev-client
```

## When To Use A Development Client

Use a development client or signed internal/closed testing build for:

- Google Play Billing with `expo-iap`
- biometric unlock validation
- SecureStore behavior under app restart/reinstall
- native PDF generation and sharing
- native file picker/restore flow
- screenshot/app-preview privacy checks

Expo Go can validate basic navigation, forms, layout, SQLite startup, and many PDF/share flows, but
it is not the production runtime for billing.

## Development Runtime QA Screen

In development builds, open:

```text
Settings -> Business Profile -> Development only -> Open Runtime QA
```

Use this screen to:

- run SQLite readiness checks
- confirm business profile state
- check SecureStore availability
- inspect biometric availability/enrollment
- verify local file write/delete support
- verify native PDF generation
- check system sharing availability
- confirm whether store billing is available in the current runtime
- seed safe demo data for simulator/device testing

The Runtime QA screen is hidden behind `__DEV__` and is not intended for production users.

## Android Emulator Baseline

Recommended minimum emulator profile:

- Android API 35 or newer for Play readiness checks
- at least 4 GB internal storage
- Play Store image when testing Play Billing
- 2 GB RAM or higher

Before launching Android QA:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
adb version
emulator -list-avds
```

If Expo Go is blocked by emulator storage, prefer a development client or create a clean AVD with
more internal storage instead of continuing on a degraded emulator.

## Android Runtime Flow Checklist

Run these on an Android emulator/device:

- onboarding and business setup with logo/signature
- dashboard load and refresh
- customer create/edit
- transaction add/edit
- statement preview/export/share/view PDF
- full backup export, preview, restore, and post-restore app use
- PIN enable/unlock/timeout/disable confirmation
- biometric unlock if hardware/enrollment exists
- invoice create/edit
- invoice preview/export/share/view PDF
- product inventory changes through invoice create/edit
- tax update check/apply
- country package store unlock/install/activate/update
- compliance report generate/review/export
- accountant export
- Pro upgrade and country pack billing through Play test setup
- Phase 14 screens: Monthly Business Review, Statement Batch, Inventory Reorder Assistant

## iOS Runtime Flow Checklist

Run these on iPhone and iPad simulator/device:

- startup and onboarding
- iPhone small-screen layout checks
- iPad centered layout/frame checks
- date pickers and numeric keyboards
- PDF preview/share/save
- file picker backup restore
- PIN and biometric unlock where available
- all Phase 14 screens

Use a development client or EAS preview build for complete native-module testing.

## Current Known Runtime Caveats

- Play Billing cannot be proven in Expo Go; use a development client or signed Play testing build.
- iOS App Store purchase validation is not part of the current Android Play Billing readiness pass.
- Remote tax/package updates require reachable hosted manifests and payload files for production QA.
