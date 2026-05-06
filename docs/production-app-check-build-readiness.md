# Production Environment Build + App Check Readiness

Generated: May 5, 2026

## Verdict

Orbit Ledger is **App Check prepared**, but App Check enforcement must **not** be enabled for Firestore or Storage until the web app is rebuilt and deployed with production Firebase and reCAPTCHA values.

Why: App Check enforcement rejects unverified requests. Firebase documents this behavior in the official enforcement guide: https://firebase.google.com/docs/app-check/enable-enforcement

## What Phase 4 Completed

### App Check API

Enabled for project:

```text
firebaseappcheck.googleapis.com
```

Verified enabled services now include:

```text
firebaseappcheck.googleapis.com
firebasehosting.googleapis.com
firebasestorage.googleapis.com
firestore.googleapis.com
identitytoolkit.googleapis.com
```

### Web App Check Provider

Verified through App Check REST API:

```text
projects/26507257397/apps/1:26507257397:web:0fd74ca52a0e2ac969737c/recaptchaV3Config
tokenTtl: 86400s
minValidScore: 0.5
```

This proves the Firebase web app has a reCAPTCHA v3 App Check configuration.

### Android App Check Provider

Verified through App Check REST API:

```text
projects/26507257397/apps/1:26507257397:android:0c4f604d6c59414069737c/playIntegrityConfig
tokenTtl: 3600s
```

Important: the returned `deviceIntegrity.minDeviceRecognitionLevel` is currently `NO_INTEGRITY`. That is not a strong production posture. Before mobile public release, raise this setting after testing on real release builds.

### Production Build Guard

Added:

```text
scripts/verify-web-production-env.mjs
```

Added npm commands:

```bash
npm run verify:web-production-env
npm run build:web:production
```

The guard checks that production Hosting builds have:

- `NEXT_PUBLIC_ORBIT_LEDGER_ENV=production`
- Firebase web config values
- Firebase Measurement ID
- reCAPTCHA v3 App Check site key

It also blocks:

- `NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN` in production

The guard intentionally does not print API key values.

### Production Env Example

Added:

```text
apps/web/.env.production.example
```

It documents the required variables without committing real values.

## Current Production Build State

The strict production build command currently fails because production env values are not supplied locally:

```bash
NEXT_PUBLIC_ORBIT_LEDGER_ENV=production npm run build --workspace @orbit-ledger/web
```

Observed result:

```text
NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY must be set when NEXT_PUBLIC_ORBIT_LEDGER_ENV=production.
```

This is correct. It prevents accidental public deployment with development fallback config.

## Current App Check Enforcement State

Queried services:

```text
projects/26507257397/services/firestore.googleapis.com
projects/26507257397/services/firebasestorage.googleapis.com
```

The API returned service records with no enforcement mode and `updateTime` at Unix epoch. Treat this as **not enforced yet**.

Do not enable enforcement until:

1. Production web env values are supplied.
2. Production build passes.
3. Production Hosting deploy is completed from that build.
4. A logged-in web user can read/write Firestore with App Check active.
5. A logged-in web user can upload/read Storage files with App Check active.
6. Mobile release clients are App Check ready.

## May 6 Enforcement Safety Update

Production web App Check is now proven:

- Production web env verification passes.
- Production Hosting was rebuilt and redeployed with App Check enabled.
- Signed-in live Firestore and Storage traffic carried App Check headers.

Firestore and Storage enforcement still must remain off because enforcement is project-wide and the mobile source does not initialize App Check yet. The Android App Check provider exists in Firebase Console, but provider configuration alone is not enough; the mobile app must send App Check tokens before Firestore/Storage enforcement is safe.

Current safe state:

```text
Firestore enforcement: UNENFORCED
Storage enforcement: UNENFORCED
```

Before enabling enforcement:

1. Add mobile App Check initialization.
2. Verify Android release-build Firestore and Storage requests carry App Check tokens.
3. If iOS is added, configure and verify its App Check provider too.
4. Rerun `npm run verify:app-check-readiness`.

## Production Build Procedure

1. Copy the example env file into the real deployment environment.

```bash
cp apps/web/.env.production.example apps/web/.env.production.local
```

2. Fill values in the deployment environment. Do not commit real values.

3. Ensure this remains unset:

```bash
NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN
```

4. Run:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build:web:production
```

5. Deploy Hosting only after that command passes:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npx -y firebase-tools@13.35.1 deploy --only hosting --project orbit-ledger-f41c2 --non-interactive
```

6. Verify:

```bash
curl -I -L https://orbit-ledger-f41c2.web.app/login/
```

7. Run browser QA for login, dashboard, customers, invoices, payments, settings, templates, and support.

8. After verified App Check traffic appears in Firebase Console, enable enforcement for Firestore and Storage.

## What Must Stay Blocked

Do not enable Firestore or Storage App Check enforcement today because the live Hosting build was not created with the production App Check environment.

Do not deploy a production build while:

- Firebase env values are missing.
- reCAPTCHA v3 site key is missing.
- App Check debug token is present.
- Browser QA has not confirmed Firebase reads/writes after production deploy.

## Next Step

`EXECUTE LAUNCH HARDENING PHASE 5: Production Env Injection + App Check Traffic Verification`

This should use the real production environment values, run `npm run build:web:production`, deploy Hosting from that build, verify live App Check traffic, and only then move Firestore/Storage enforcement toward production.

## Phase 5 Update

Phase 5 added a safe production env materializer:

```text
scripts/prepare-web-production-env.mjs
```

Added npm command:

```bash
npm run prepare:web-production-env
```

Behavior:

- Fetches Firebase web SDK config for the Orbit Ledger web app.
- Writes only to ignored local file `apps/web/.env.production.local`.
- Refuses to print API key values.
- Refuses to continue unless `ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY` or `NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY` is supplied.
- Confirms the Firebase project ID matches `orbit-ledger-f41c2`.

Observed result today:

```text
Production App Check reCAPTCHA v3 site key is required.
Set ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY locally, then rerun this command.
```

That is the correct result. We should not create a production web build without the real App Check site key.

Current status:

- Firebase SDK config can be retrieved.
- App Check provider config exists.
- Production env injection is blocked until the real reCAPTCHA v3 site key is supplied locally.
- Production build remains blocked by `npm run verify:web-production-env`.
- Live App Check traffic verification cannot be completed until the production build is deployed.

Next operator commands after the real site key is available:

```bash
export ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY="<real-site-key>"
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run prepare:web-production-env
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build:web:production
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npx -y firebase-tools@13.35.1 deploy --only hosting --project orbit-ledger-f41c2 --non-interactive
```

After deploy:

1. Sign in on the live Hosting URL.
2. Open dashboard, customers, invoices, payments, settings, and Storage upload flows.
3. Confirm App Check request traffic appears in Firebase Console.
4. Only then enable enforcement for Firestore and Storage.

## Phase 6 Update

Phase 6 added a live web smoke test:

```text
scripts/smoke-live-app-check.mjs
```

Added npm command:

```bash
npm run smoke:live-app-check
```

What it checks:

- Live login URL returns HTTP success.
- Live HTML includes Orbit Ledger title and app metadata.
- Live HTML does not include `dangerouslyAllowBrowser`.
- Live HTML does not include App Check debug token markers.
- Live HTML does not include server-only secret names.
- The command does not print API key or secret values.

Current result:

```text
Orbit Ledger live web smoke passed.
Checked https://orbit-ledger-f41c2.web.app/login/ without printing API keys or secrets.
Manual App Check traffic proof is still required in Firebase Console after signed-in Firestore and Storage activity.
```

What still blocked Phase 6:

- `apps/web/.env.production.local` does not exist.
- `npm run prepare:web-production-env` is blocked because the real reCAPTCHA v3 site key is not supplied locally.
- `npm run build:web:production` is blocked because required production env values are not present.
- Firestore and Storage App Check service records still show no enforcement update.

Current verified App Check state:

```text
Web reCAPTCHA v3 config exists.
Firestore App Check service has no enforcement update.
Storage App Check service has no enforcement update.
```

This is the correct safety posture. We should not enable Firestore/Storage enforcement until the production build is deployed with the real site key and live signed-in traffic appears in Firebase Console.

## Phase 7 Update

Phase 7 added repeatable browser responsive QA:

```text
scripts/browser-responsive-qa.mjs
```

Added npm command:

```bash
npm run qa:browser-responsive
```

What it checks:

- Local login responsive screenshots.
- Live Hosting login responsive screenshots.
- Mobile, tablet, and desktop viewports.
- Local/live visual hash match for the public login surface.
- Screenshot artifacts are written only to ignored `artifacts/`.

Observed result today:

```text
mobile: local/live match yes
tablet: local/live match yes
desktop: local/live match yes
```

The in-app browser also proved the local authenticated route behavior: local `/` redirected to `/dashboard/` in the existing signed-in session and showed the workspace preparation flow with no console errors.

Live signed-in Firebase proof is still blocked until a production test account or signed-in live browser session is available.

## Phase 8 Update

Phase 8 created isolated production QA accounts through the live Hosting UI and verified authenticated Firebase flows:

- Firebase Auth account creation.
- Workspace onboarding.
- Firestore workspace write.
- Customer creation.
- Protected dashboard, customers, invoices, payments, settings, templates, and support routes.
- Firebase Storage logo upload.
- Firebase Storage watermark upload.

Storage initially returned `403 Permission denied` because Storage rules call Firestore for workspace ownership checks. The Firebase Storage service agent was missing the cross-service Rules role.

Applied:

```bash
gcloud projects add-iam-policy-binding orbit-ledger-f41c2 \
  --member="serviceAccount:service-26507257397@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/firebaserules.firestoreServiceAgent" \
  --condition=None
```

After the IAM fix, live signed-in Storage uploads returned HTTP `200`.

Phase 8 also added `watermarks` to Storage rules because the web app supports uploaded watermark images. Rules tests passed and Storage rules were redeployed.

App Check traffic proof is still blocked until the real reCAPTCHA v3 site key is injected into a production build and deployed.

## Phase 9 Update

Phase 9 intentionally stopped at the production safety gate because the real reCAPTCHA v3 site key is not available locally.

Verified:

- `npm run verify:web-production-env` fails until production env values are present.
- `npm run prepare:web-production-env` refuses to write `apps/web/.env.production.local` until `ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY` is set.
- Firestore App Check enforcement remains off.
- Storage App Check enforcement remains off.

Added:

```text
scripts/verify-app-check-readiness.mjs
```

Added npm command:

```bash
npm run verify:app-check-readiness
```

This command confirms production env readiness, web provider readiness, Firestore/Storage service records, and a manual signed-in traffic acknowledgement before enforcement is considered ready.

No production App Check build was created and no Hosting deploy was performed in Phase 9.
