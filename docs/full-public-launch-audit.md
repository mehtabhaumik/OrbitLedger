# Orbit Ledger Full Public Launch Audit

Generated: May 5, 2026
Last updated: May 6, 2026, web-only public readiness pass

## Verdict

Orbit Ledger web is **ready for controlled public beta exposure** with free services only.

This verdict applies to the web app only. The mobile app is intentionally excluded from the first public pass.

The codebase is much stronger than before: typecheck passes, the full test suite passes, the web production build passes, Expo Doctor passes, CI exists, Firebase rules exist, Storage rules exist, and the product has launch-readiness checks for settings, monetization, support, differentiation, and parity.

The blockers are now clear and actionable:

- The default local shell still resolves to Node 18.16.0, even though Orbit Ledger requires Node 24.14.0 or newer.
- Firebase Firestore and Storage rule tests now pass when Java 11+ is active.
- The default local Java runtime is still Java 8, so the launch machine must set Java 11+ as the active default before release work.
- Firestore region, point-in-time recovery, delete protection, Storage bucket, rules deployment, and Firebase Hosting deployment are now verified.
- App Check API, web provider config, production web build, Hosting deploy, signed-in web App Check traffic, and Firestore/Storage enforcement are now verified for the web-only launch path.
- Paid checkout is intentionally closed. The web app now shows beta copy that free services are available and monetization/Razorpay checkout are coming soon.
- Mobile and browser launch QA still need real-device and responsive-screen verification.
- Mobile/web feature parity still has launch-critical gaps tracked by the app.
- Razorpay is intentionally not connected yet, so paid checkout must stay provider-pending/manual until Razorpay credentials, webhooks, price mapping, and payment recovery are verified.

## Evidence From This Audit Run

| Gate | Result | Evidence |
| --- | --- | --- |
| Required Node through explicit launch path | Pass | `v24.14.0`; `.nvmrc` is `24.14.0`; package engines require `>=24.14.0`. |
| Default shell Node | Blocker | Raw `node -v` returns `v18.16.0`. Launch/deploy commands must not use the default shell Node. |
| Typecheck | Pass | `npm run typecheck` completed across contracts, core, UI, sync, mobile, web, and functions. |
| Focused launch audit tests | Pass | `launchHardeningAudit`, differentiation QA, and founder-safe support tests passed. |
| Full unit suite | Pass | `65` test files passed, `292` tests passed. |
| Web production build | Pass | `npm run build --workspace @orbit-ledger/web` completed and exported static pages. |
| Expo Doctor | Pass | `17/17` checks passed. |
| npm audit high gate | Pass with monitor note | `npm run audit:ci` passed the high-severity gate; moderate advisories remain and should be watched. |
| Direct Firestore/Storage rules test | Expected fail without emulator | `npm run test:rules` now returns a clear message when emulators are not running. |
| CI-style Firestore + Storage rules test | Pass with Java 18 active | `npm run test:rules:emulators` passed: 2 files, 7 tests. |
| Storage rules tests | Pass | Owner access, cross-workspace denial, signed-out denial, file type limits, size limits, backups, imports, attachments, and unknown paths are covered. |
| Browser secret guard | Pass | No `dangerouslyAllowBrowser`, no server-only secret names in production web source, and no key/secret/token console printing patterns. |
| Firestore production safety | Pass | `(default)` database is in `asia-south1`, PITR is enabled, and delete protection is enabled. |
| Firebase Storage bucket | Pass | `orbit-ledger-f41c2.firebasestorage.app` exists in `ASIA-SOUTH1`. |
| Firestore/Storage rules deploy | Pass | Firestore rules, Firestore indexes, and Storage rules deployed successfully. |
| Firebase Hosting deploy | Pass with environment caveat | `apps/web/out` deployed to `https://orbit-ledger-f41c2.web.app`; live `/login/` returns HTTP 200 and `Orbit Ledger` metadata. |
| Production web env build | Pass | Production env values and App Check site key are present locally in ignored env, and `npm run build:web:production` passed. |
| Production env injection | Pass | Production env materialization/build path is working without committing or printing key values. |
| Live web smoke | Pass | `npm run smoke:live-app-check` passed for the live login URL without printing API keys or secrets. |
| Browser responsive QA | Pass for public login | Local and live login screenshots passed mobile, tablet, and desktop checks. Local/live screenshot hashes matched for all three viewports. |
| Signed-in local browser route | Pass | The in-app browser had an active local session; local `/` redirected to `/dashboard/` and showed the workspace preparation flow with no console errors. |
| Signed-in live Firebase proof | Pass | Production QA accounts proved live Auth, workspace onboarding, Firestore writes, protected routes, customer creation, invoice creation, PDF/CSV actions, recurring screens, and Storage uploads. |
| Storage cross-service rules role | Pass after fix | Added `roles/firebaserules.firestoreServiceAgent` to the Firebase Storage service agent so Storage rules can check Firestore workspace ownership. |
| Watermark Storage rules | Pass after fix | Added `workspaces/{workspaceId}/watermarks/{fileName}` and emulator coverage, then redeployed Storage rules. |
| Production App Check build | Pass | Production build and Hosting deploy completed with App Check enabled. |
| App Check enforcement readiness checker | Pass with mobile blocker | It now verifies web provider, Android provider, signed-in traffic proof, and mobile client App Check initialization before allowing enforcement. |
| Real reCAPTCHA site key injection | Pass | Production Hosting was rebuilt and redeployed with the real App Check site key from ignored local env. |
| Firebase App Check API | Pass | `firebaseappcheck.googleapis.com` is enabled. |
| Firebase App Check web provider | Pass | Web app has reCAPTCHA v3 config with token TTL `86400s` and min valid score `0.5`. |
| Firebase App Check Android provider | Warn | Android Play Integrity config exists, but current minimum recognition level is `NO_INTEGRITY`. |
| Firebase App Check signed-in traffic proof | Pass | Signed-in live browser traffic carried App Check headers on Firestore and Storage requests without printing token values. |
| Firebase App Check enforcement | Pass for web-only launch | Firestore and Storage are `ENFORCED`. This is acceptable because mobile is not part of the first public pass. |

## New Launch Audit Module

This phase added a reusable public launch audit model in:

- `packages/core/src/launchHardeningAudit.ts`
- `packages/core/src/launchHardeningAudit.test.ts`

It checks these launch areas:

- Environment
- CI
- Security
- Firebase
- Web
- Mobile
- Payments
- Data privacy
- UI/UX
- Operations

It separates two gates:

- `readyForPublicLaunch`: strict full launch, including live Razorpay readiness.
- `readyForPublicLaunchMinusPayments`: launch posture excluding Razorpay live checkout, since Razorpay is intentionally not connected yet.

Important: the audit keeps known mobile/web parity gaps launch-blocking. This is intentional. We should not hide feature mismatches behind a green launch badge.

## Current Hard Blockers

### 1. Fix Local Launch Runtime

The repository is pinned correctly:

- `.nvmrc`: `24.14.0`
- package engines: Node `>=24.14.0`

But the local shell still resolves:

```text
node -v -> v18.16.0
```

Before deploy or release work, run with Node 24 explicitly or fix the shell startup configuration so `node -v` returns `v24.14.0`.

### 2. Make Java 11+ The Active Default For Firebase Emulators

The CI workflow installs Java 21, which is good.

The local machine has Java 18 available and the emulator tests passed when `JAVA_HOME` was pointed at it. The active default `java -version` is still Java 8:

```text
java version "1.8.0_331"
```

Firebase emulator tests require Java 11 or newer. Set `JAVA_HOME` to the OpenJDK 18 install or install/use Java 21 locally before release and deploy work.

### 3. Storage Rules Tests

Storage rules protect important public-launch assets:

- Logos
- Signatures
- Watermarks
- Payment proof images
- Invoice PDFs
- Backup files
- Import files

Phase 2 added emulator tests for:

- Owner can upload allowed file types inside owned workspace.
- Owner cannot upload disallowed file types.
- Owner cannot upload oversized files.
- Cross-workspace read/write is denied.
- Signed-out access is denied.

The CI wrapper now starts both Firestore and Storage emulators:

```text
npm run test:rules:emulators
```

### 4. Complete Firebase Console Verification

These have now been proven through CLI:

- Firestore database is in `asia-south1`.
- Firestore delete protection is enabled.
- Firestore point-in-time recovery is enabled.
- Firebase Storage bucket exists and rules are deployed.
- Firebase Hosting is deployed from `apps/web/out`.

These still need production setup:

- App Check production enforcement for Firestore and Storage.
- Production Hosting build with `NEXT_PUBLIC_ORBIT_LEDGER_ENV=production`.
- OAuth and Google consent branding must be verified after the final custom domain/app branding setup.

Phase 4 added:

- `scripts/verify-web-production-env.mjs`
- `npm run verify:web-production-env`
- `npm run build:web:production`
- `apps/web/.env.production.example`

The production build guard rejects missing Firebase values and rejects `NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN` in production without printing any API key values.

Phase 5 added:

- `scripts/prepare-web-production-env.mjs`
- `npm run prepare:web-production-env`

It safely materializes `apps/web/.env.production.local` from Firebase SDK config and a locally supplied App Check reCAPTCHA site key. It refuses to run when the site key is missing and does not print API key values.

Phase 6 added:

- `scripts/smoke-live-app-check.mjs`
- `npm run smoke:live-app-check`

The live smoke test passes for the current Hosting URL. The production site key is present in ignored local env, the production build has been deployed, and signed-in Firestore/Storage App Check traffic has been verified for the web-only launch path.

Phase 7 added:

- `scripts/browser-responsive-qa.mjs`
- `npm run qa:browser-responsive`
- `docs/browser-responsive-signed-in-flow-proof.md`

Responsive screenshots were captured for local and live login at mobile, tablet, and desktop sizes. Local and live output matched by SHA-256 on all three viewports. The in-app browser also confirmed local signed-in route behavior by redirecting `/` to `/dashboard/`.

Live signed-in Firebase proof is now complete through production QA accounts. Auth, Firestore, protected routes, customer creation, and Storage uploads were proven.

Phase 8 added:

- `docs/production-test-account-authenticated-live-firebase-qa.md`
- Storage rules coverage for watermark images.
- Production IAM binding for Storage rules Firestore ownership checks.

The older App Check caveat is now resolved for web-only launch: live requests use the production build, and signed-in Firestore/Storage traffic has App Check proof.

Phase 9 added:

- `scripts/verify-app-check-readiness.mjs`
- `npm run verify:app-check-readiness`
- `docs/production-app-check-build-deploy-enforcement-readiness.md`

This phase originally stopped at the safety gate. The later May 6 pass supplied ignored local production env, rebuilt Hosting, proved signed-in App Check traffic, and enabled Firestore/Storage enforcement for web-only launch.

Phase 10 added:

- `docs/real-recaptcha-site-key-injection-production-hosting-redeploy.md`

This phase originally confirmed the provider while the real site key was still unavailable. The later May 6 pass unblocked the production build using ignored local env.

Phase 10B added:

- `docs/site-key-redeploy-attempt-10b.md`

This phase originally reran the production key-injection gate. The later May 6 pass supplied the real site key through ignored local env, rebuilt, and redeployed Hosting.

May 6 public readiness pass updated this status:

- Production env values and the real App Check site key are now available only in ignored local env.
- The web Firebase env resolver was changed so Next.js can inline production Firebase values safely.
- The web App Check provider was aligned with the configured reCAPTCHA Enterprise provider.
- Production web build passed and Hosting was redeployed.
- Signed-in live QA proved Auth, workspace creation, customer creation, invoice creation, PDF/CSV actions, recurring screens, and Storage upload.
- Signed-in live Firestore and Storage requests carried App Check headers. Token values were not printed.
- The root route was changed from a static server redirect to a real client page so Firebase Hosting no longer serves a raw `NEXT_REDIRECT` payload at `/`.
- The web beta banner was added globally and the Market page keeps all paid plan CTAs in a coming-soon state.
- Firestore and Storage App Check enforcement were enabled for the web-only launch path.
- `npm run verify:app-check-readiness` now supports `ORBIT_LEDGER_WEB_ONLY_LAUNCH=yes` so enforcement can be approved when mobile is intentionally out of scope.

### 5. Finish Responsive And Device QA

The web build is green, but visual launch quality needs screenshot and interaction passes on:

- Desktop
- Tablet
- Mobile web
- Login
- Dashboard
- Customers
- Invoices
- Invoice preview/print/download
- Payments
- Transactions
- Products
- Reports
- Settings
- Templates
- Support

Mobile needs production-like device QA for:

- Login/session behavior
- Invoice generation
- PDF/CSV output
- Payment proof image flow
- Backup/restore
- Recurring invoices
- Customer profile parity
- Monetization gates

## Green Areas

- CI exists and includes install, typecheck, tests, Firestore rules tests, audit, web build, and Expo Doctor.
- Web production build passes.
- Expo Doctor passes.
- Full unit suite passes.
- Firestore rules and Storage rules exist.
- Node 24 is available when explicitly invoked.
- Subscription and Razorpay readiness are structured so checkout can remain disabled until provider setup is real.
- Support, feedback, diagnostics, recurring email safety, invoice versioning, payment states, settings, and differentiation features are represented in code and tests.

## Launch Decision

Do not open a broad public launch beyond web beta until these are complete:

1. Make Node 24 the active default runtime.
2. Make Java 11+ the active default runtime.
3. Keep the current web-only launch scope explicit until mobile App Check is implemented.
4. Close or intentionally defer launch-critical mobile/web parity gaps before mobile release.
5. Complete mobile device QA before any mobile public release.
6. Keep Razorpay disabled until credentials, price IDs, webhooks, controlled test payment, and recovery flow are proven.

## Next Recommended Phase

`Web Beta Operations: Monitor App Check, Auth, Firestore, Storage, and Hosting after public exposure`

This should:

- Keep Firestore and Storage App Check enforcement on for the web launch.
- Watch Firebase Auth, Firestore, Storage, Hosting, and App Check dashboards after public exposure.
- Keep paid checkout in coming-soon/free-beta mode until Razorpay is real.
- Clean up production QA accounts when they are no longer needed.
