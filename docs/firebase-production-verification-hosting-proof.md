# Firebase Production Verification + Hosting Proof

Generated: May 5, 2026

## Verdict

Phase 3 verified and deployed several production Firebase pieces, but Orbit Ledger still should **not** be treated as fully production-ready until the production web environment and App Check setup are completed.

## Verified

### Firebase Project

- Project ID: `orbit-ledger-f41c2`
- Project number: `26507257397`
- Display name: `orbit-ledger`
- State: `ACTIVE`
- Firebase app display names:
  - Web: `Orbit Ledger by Rudraix`
  - Android: `Orbit Ledger by Rudraix`

### Firestore

Verified through Firebase CLI:

- Database: `(default)`
- Location: `asia-south1`
- Type: `FIRESTORE_NATIVE`
- Point-in-time recovery: `POINT_IN_TIME_RECOVERY_ENABLED`
- Delete protection: `DELETE_PROTECTION_ENABLED`
- Version retention period: `604800s`
- Realtime updates: enabled

### Firebase Storage

Verified through Google Cloud CLI:

- Main bucket exists: `orbit-ledger-f41c2.firebasestorage.app`
- Location: `ASIA-SOUTH1`
- Storage class: `STANDARD`
- Soft delete retention: `604800` seconds
- Uniform bucket-level access: enabled

### Rules Deployment

Deployed successfully:

- Firestore rules
- Firestore indexes
- Storage rules

Deploy result:

```text
storage.rules compiled successfully
firestore.rules compiled successfully
firestore.indexes.json deployed
storage.rules released to firebase.storage
firestore.rules released to cloud.firestore
```

### Firebase Hosting

Verified site:

- Site: `orbit-ledger-f41c2`
- URL: `https://orbit-ledger-f41c2.web.app`
- Web app ID: `1:26507257397:web:0fd74ca52a0e2ac969737c`
- Channel: `live`

Deployed Hosting from:

```text
apps/web/out
```

Deploy proof:

```text
found 113 files in apps/web/out
version finalized
release complete
Hosting URL: https://orbit-ledger-f41c2.web.app
```

Live URL proof after deploy:

```text
GET /login/ -> HTTP/2 200
last-modified: Tue, 05 May 2026 10:34:39 GMT
x-cache: MISS
title: Orbit Ledger
application-name: Orbit Ledger
```

Live HTML sweep found no visible matches for:

- `orbit-ledger-f41c2.firebaseapp.com`
- `dangerouslyAllowBrowser`
- `RAZORPAY`
- `RESEND`
- `SECRET`
- `API_KEY`

## Not Yet Verified / Still Blocking

### Production Web Environment

The production web build correctly refuses to build when required public Firebase environment variables are missing:

```text
NEXT_PUBLIC_ORBIT_LEDGER_ENV=production npm run build --workspace @orbit-ledger/web
```

Result:

```text
NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY must be set when NEXT_PUBLIC_ORBIT_LEDGER_ENV=production.
```

This is good defensive behavior, but it means the current Hosting deploy is not yet proven as a full production-env build with App Check.

Before public launch, build and deploy Hosting with:

- `NEXT_PUBLIC_ORBIT_LEDGER_ENV=production`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID`
- `NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY`

Do not set `NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN` for production Hosting.

### App Check

The web code is ready to initialize Firebase App Check when `NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY` exists.

Current proof gap:

- `firebaseappcheck.googleapis.com` was not listed among enabled project services.
- Firebase CLI v13.35.1 does not expose App Check list/verify commands.
- Production enforcement still needs Firebase Console verification.

Before public launch:

- Enable/configure Firebase App Check in Firebase Console.
- Add a production reCAPTCHA v3 site key.
- Remove any debug token from production Hosting.
- Enforce App Check for supported Firebase resources.
- Rebuild Hosting with `NEXT_PUBLIC_ORBIT_LEDGER_ENV=production`.

### Custom Domain

The default Firebase Hosting URL is live:

```text
https://orbit-ledger-f41c2.web.app
```

For public launch, add and verify the final branded domain before marketing traffic goes live.

## API Key / Secret Exposure Check

Phase 3 also confirmed:

- No `dangerouslyAllowBrowser` usage in production web source.
- No server-only secret names in production web source.
- No web console logging patterns for keys, secrets, tokens, credentials, passwords, Razorpay, or Resend.

The guard lives in:

```text
apps/web/src/lib/browser-secret-guard.test.ts
```

## Commands Used

```bash
npx -y firebase-tools@13.35.1 projects:list --json
npx -y firebase-tools@13.35.1 apps:list --project orbit-ledger-f41c2 --json
npx -y firebase-tools@13.35.1 firestore:databases:list --project orbit-ledger-f41c2 --json
gcloud storage buckets list --project=orbit-ledger-f41c2 --format=json
npx -y firebase-tools@13.35.1 hosting:sites:get orbit-ledger-f41c2 --project orbit-ledger-f41c2 --json
npm run build --workspace @orbit-ledger/web
npx -y firebase-tools@13.35.1 deploy --only hosting --project orbit-ledger-f41c2 --non-interactive
npx -y firebase-tools@13.35.1 deploy --only firestore:rules,firestore:indexes,storage --project orbit-ledger-f41c2 --non-interactive
curl -I -L https://orbit-ledger-f41c2.web.app/login/
```

## Next Step

`EXECUTE LAUNCH HARDENING PHASE 4: Production Environment Build + App Check Enablement`

This should create the production env checklist, verify the reCAPTCHA/App Check key path, rebuild with `NEXT_PUBLIC_ORBIT_LEDGER_ENV=production`, and redeploy Hosting only after production App Check is configured.
