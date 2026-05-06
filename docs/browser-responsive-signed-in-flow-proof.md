# Browser Responsive QA + Signed-In Firebase Flow Proof

Generated: May 5, 2026

## Verdict

Launch Hardening Phase 7 is **partially proven**.

The public login surface passed responsive browser QA on local and live Hosting for mobile, tablet, and desktop. The in-app browser also proved that the local browser has an active signed-in session because `/` redirected to `/dashboard/`.

Full live signed-in Firebase proof is still blocked until we have either:

- a dedicated production test account, or
- a real signed-in browser session on `https://orbit-ledger-f41c2.web.app`.

Do not enable Firestore or Storage App Check enforcement until live signed-in Firestore and Storage traffic is observed in Firebase Console.

## Public Responsive QA

Command used:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run qa:browser-responsive
```

The command captures screenshots for:

- `http://localhost:3000/login/`
- `https://orbit-ledger-f41c2.web.app/login/`

Viewports:

- Mobile: `390 x 844`
- Tablet: `820 x 1180`
- Desktop: `1440 x 900`

Observed during this phase:

| Surface | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Local login | Pass | Pass | Pass |
| Live login | Pass | Pass | Pass |
| Local/live visual hash match | Pass | Pass | Pass |

The local and live screenshots matched by SHA-256 for all three viewports during this run.

## In-App Browser Proof

The in-app browser was opened at:

```text
http://localhost:3000/login/
```

Observed:

- The login page rendered with Orbit Ledger branding.
- No console errors were reported on the login surface.
- Navigating the same browser session to local `/` redirected to:

```text
http://localhost:3000/dashboard/
```

That redirect proves the local in-app browser had an active authenticated session.

The dashboard route entered the workspace preparation flow:

```text
Preparing your workspace
Checking your business
Restoring the latest business profile
Preparing invoices, customers, and reports
Getting the workspace ready
```

No console errors were reported during that route check.

## Live Signed-In Firebase Proof

Live Hosting public smoke remains green:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run smoke:live-app-check
```

But live signed-in proof was not completed in this phase because the available authenticated browser session was local-only. Firebase Auth sessions are origin-scoped, so being signed in on `http://localhost:3000` does not prove a signed-in session on `https://orbit-ledger-f41c2.web.app`.

Required proof before App Check enforcement:

1. Sign in on `https://orbit-ledger-f41c2.web.app`.
2. Open dashboard.
3. Open customers.
4. Open invoices.
5. Open payments.
6. Open settings.
7. Upload or read a Storage-backed asset such as logo, signature, watermark, payment proof, invoice PDF, or backup.
8. Confirm Firestore and Storage App Check traffic appears in Firebase Console.

## Safety Notes

- The responsive QA command does not print API keys or secrets.
- The current production Hosting build is still the pre-production-env build.
- `npm run build:web:production` must stay blocked until real production Firebase values and the reCAPTCHA v3 App Check site key are injected.
- App Check enforcement must stay off until signed-in live traffic is verified.

## Phase 8 Follow-Up

Phase 8 completed authenticated live Hosting proof using isolated production QA accounts.

Live Auth, Firestore workspace onboarding, protected route access, customer creation, and Storage uploads were proven. Storage uploads required one production IAM fix because Storage rules use Firestore ownership checks.
