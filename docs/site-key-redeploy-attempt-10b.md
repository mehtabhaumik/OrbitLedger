# Supply Site Key And Redeploy Production App Check Build

Generated: May 5, 2026

## Verdict

Launch Hardening Phase 10B is **complete**.

A production reCAPTCHA score key was created for Orbit Ledger, connected to Firebase App Check, injected into the ignored production web env file, built into the production Hosting bundle, and deployed to Firebase Hosting.

No reCAPTCHA site key, Firebase API key, provider secret, payment secret, email secret, or debug token is printed in this document.

## Scope Completed

- Enabled the reCAPTCHA API for project `orbit-ledger-f41c2`.
- Confirmed there were no existing Orbit Ledger reCAPTCHA keys to reuse.
- Created a domain-restricted production web score key for:
  - `orbit-ledger-f41c2.web.app`
  - `orbit-ledger-f41c2.firebaseapp.com`
- Retrieved the compatible legacy secret without printing it.
- Updated the Firebase App Check web `recaptchaV3Config`.
- Generated `apps/web/.env.production.local`.
- Verified production web env readiness.
- Built the web app with production env and App Check site key injection.
- Deployed Firebase Hosting.
- Ran live smoke checks against the production site.

## Verification

Production env verification:

```text
Orbit Ledger production web environment is ready.
Verified 9 required variables without printing values.
```

Production build:

```text
Next.js production build completed successfully.
Static export completed successfully.
```

Firebase Hosting deploy:

```text
Deploy complete.
Hosting URL: https://orbit-ledger-f41c2.web.app
```

Live smoke:

```text
Orbit Ledger live web smoke passed.
Checked https://orbit-ledger-f41c2.web.app/login/ without printing API keys or secrets.
```

Forbidden live HTML patterns:

```text
dangerouslyAllowBrowser: not found
FIREBASE_APPCHECK_DEBUG_TOKEN: not found
RAZORPAY_KEY_SECRET: not found
RAZORPAY_WEBHOOK_SECRET: not found
RESEND_API_KEY: not found
OPENAI_API_KEY: not found
ANTHROPIC_API_KEY: not found
```

App Check readiness:

```text
webProviderReady: true
productionEnvReady: true
signedInAppCheckTrafficVerified: false
canBuildProductionAppCheckHosting: true
canEnableFirestoreStorageEnforcement: false
```

## Enforcement Decision

Firestore and Storage App Check enforcement remain **off**.

This is intentional. Enforcement should only be enabled after signed-in production Firestore and Storage traffic is visible in Firebase Console as valid App Check traffic.

## Next Step

Run a signed-in production smoke test on:

```text
https://orbit-ledger-f41c2.web.app
```

Then verify in Firebase Console that Firestore and Storage show valid App Check traffic before enabling enforcement.
