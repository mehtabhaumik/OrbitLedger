# Production App Check Build Deploy + Enforcement Readiness

Generated: May 5, 2026

## Verdict

Launch Hardening Phase 9 is **blocked by missing production App Check site key**.

This is the correct safety result. Orbit Ledger should not build, deploy, or enforce App Check until the real production reCAPTCHA v3 site key is supplied.

## What Was Checked

Production environment verification:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run verify:web-production-env
```

Observed result:

```text
Orbit Ledger production web environment is not ready.
NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY is required.
```

Production env materialization:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run prepare:web-production-env
```

Observed result:

```text
Production App Check reCAPTCHA v3 site key is required.
Set ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY locally, then rerun this command.
```

Because the site key is missing, no production env file was created, no production build was run, and no Hosting deployment was performed.

## App Check Enforcement State

Checked through Firebase App Check REST API:

```text
projects/26507257397/services/firestore.googleapis.com
projects/26507257397/services/firebasestorage.googleapis.com
```

Observed:

```text
updateTime: 1970-01-01T00:00:00Z
```

That means Firestore and Storage App Check enforcement remains off.

This is correct. Do not enforce App Check until a production build sends valid App Check tokens and Firebase Console shows signed-in Firestore and Storage App Check traffic.

## New Readiness Checker

Added:

```text
scripts/verify-app-check-readiness.mjs
```

Added npm command:

```bash
npm run verify:app-check-readiness
```

The command verifies:

- Production web env readiness.
- Firebase web App Check provider readiness.
- Firestore App Check service record.
- Storage App Check service record.
- Whether signed-in App Check traffic has been manually confirmed.

It intentionally does **not** print:

- Firebase API keys.
- reCAPTCHA site key.
- App Check debug tokens.
- User credentials.

The command only allows enforcement readiness when:

1. Production env is ready.
2. Web App Check provider exists.
3. Signed-in App Check traffic has been verified and explicitly acknowledged with:

```bash
export ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED=yes
```

Only set that variable after Firebase Console shows real signed-in Firestore and Storage App Check traffic from the production build.

## Production Build + Deploy Procedure

When the real reCAPTCHA v3 site key is available:

```bash
export ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY="<real-site-key>"
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run prepare:web-production-env
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run build:web:production
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npx -y firebase-tools@13.35.1 deploy --only hosting --project orbit-ledger-f41c2 --non-interactive
```

Then repeat:

1. Create or sign in with a production QA account.
2. Open dashboard.
3. Create or update a customer.
4. Open invoices.
5. Open payments.
6. Open settings.
7. Upload a logo or watermark.
8. Confirm Firestore and Storage App Check traffic appears in Firebase Console.

Only after this:

```bash
export ORBIT_LEDGER_SIGNED_IN_APPCHECK_TRAFFIC_VERIFIED=yes
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run verify:app-check-readiness
```

## Enforcement Rule

Do not enable Firestore or Storage App Check enforcement while:

- Production env is missing.
- reCAPTCHA v3 site key is missing.
- App Check debug token is present.
- Production Hosting has not been rebuilt from production env.
- Signed-in Firestore and Storage App Check traffic is not visible in Firebase Console.

## Next Phase

`EXECUTE LAUNCH HARDENING PHASE 10: Real reCAPTCHA Site Key Injection + Production Hosting Redeploy`

## Phase 10 Update

Phase 10 attempted the production site-key injection gate and stopped safely because the real reCAPTCHA v3 site key is not available locally.

Verified:

- Firebase App Check web provider exists.
- Firebase App Check REST config does not return the site key.
- Production env verification remains blocked.
- Production Hosting was not redeployed.
- Firestore and Storage App Check enforcement remain off.

Use:

```bash
export ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY="<real-site-key>"
```

before rerunning the production build and deploy flow.
