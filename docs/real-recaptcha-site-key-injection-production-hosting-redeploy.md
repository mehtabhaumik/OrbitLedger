# Real reCAPTCHA Site Key Injection + Production Hosting Redeploy

Generated: May 5, 2026

## Verdict

Launch Hardening Phase 10 is **blocked by missing real reCAPTCHA v3 site key**.

No production build was created and no Hosting deploy was performed. This is the correct release behavior because App Check enforcement must not be enabled until the production web app is actually sending valid App Check tokens.

## What Was Checked

Production env preparation:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run prepare:web-production-env
```

Result:

```text
Production App Check reCAPTCHA v3 site key is required.
Set ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY locally, then rerun this command.
```

Production env verification:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run verify:web-production-env
```

Result:

```text
Orbit Ledger production web environment is not ready.
NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY is required.
```

App Check readiness:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run verify:app-check-readiness
```

Result:

```text
webProviderReady: true
productionEnvReady: false
signedInAppCheckTrafficVerified: false
canBuildProductionAppCheckHosting: false
canEnableFirestoreStorageEnforcement: false
```

## Firebase API Check

The Firebase App Check REST API confirms the web provider exists:

```text
projects/26507257397/apps/1:26507257397:web:0fd74ca52a0e2ac969737c/recaptchaV3Config
tokenTtl: 86400s
minValidScore: 0.5
```

The API does not return the reCAPTCHA site key. That value must be copied from Firebase Console and supplied locally as:

```bash
export ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY="<real-site-key>"
```

Do not commit it.

## Enforcement State

Firestore and Storage App Check enforcement remain off:

```text
firestore updateTime: 1970-01-01T00:00:00Z
storage updateTime: 1970-01-01T00:00:00Z
```

That is the correct state until production App Check traffic is visible.

## Exact Next Commands After Site Key Is Available

```bash
export ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY="<real-site-key>"
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run prepare:web-production-env
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build:web:production
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npx -y firebase-tools@13.35.1 deploy --only hosting --project orbit-ledger-f41c2 --non-interactive
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run smoke:live-app-check
```

Then perform signed-in browser QA:

1. Sign in on `https://orbit-ledger-f41c2.web.app`.
2. Open dashboard.
3. Create or update a customer.
4. Open invoices.
5. Open payments.
6. Open settings.
7. Upload a logo or watermark.
8. Confirm Firestore and Storage App Check traffic appears in Firebase Console.

Only after that:

```bash
export ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED=yes
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run verify:app-check-readiness
```

## Next Phase

`EXECUTE LAUNCH HARDENING PHASE 10B: Supply Site Key And Redeploy Production App Check Build`
