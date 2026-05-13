# Web QA Smoke Tests

Orbit Ledger has two browser smoke paths for the public web app.

## Anonymous Smoke

Run this when you only need to verify the public login and protected route behavior:

```sh
npm run qa:web-browser-smoke
```

This checks:

- login page renders,
- invalid email/password shows a friendly error,
- `/dashboard/` redirects signed-out users to login,
- `/office-operations/` redirects signed-out users to login,
- browser console has no blocking runtime errors.

## Seeded Authenticated Smoke

Use a dedicated QA account. Do not use a personal account.

```sh
ORBIT_LEDGER_QA_EMAIL="qa-owner@example.com" \
ORBIT_LEDGER_QA_PASSWORD="use-a-strong-password" \
npm run qa:web-browser-smoke:seeded
```

Optional viewer coverage:

```sh
ORBIT_LEDGER_QA_VIEWER_EMAIL="qa-viewer@example.com" \
ORBIT_LEDGER_QA_VIEWER_PASSWORD="use-a-strong-password"
```

The seeded smoke creates or updates a deterministic QA workspace for the QA owner UID:

```text
qa_web_smoke_workspace_<owner-uid-prefix>
```

You can override that id with `ORBIT_LEDGER_QA_WORKSPACE_ID`, but do not reuse a workspace id owned by another account. Firestore rules should block that.

To refresh seed data and then run the browser smoke:

```sh
ORBIT_LEDGER_QA_EMAIL="qa-owner@example.com" \
ORBIT_LEDGER_QA_PASSWORD="use-a-strong-password" \
ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN="<trusted-admin-token>" \
ORBIT_LEDGER_STORAGE_ADMIN_ACCESS_TOKEN="<trusted-admin-token>" \
npm run qa:web-browser-smoke:seeded:refresh
```

It seeds:

- workspace profile and payment settings,
- Office owner membership,
- optional Office viewer membership,
- customers,
- product/service,
- invoice with a saved version,
- payment and invoice allocation,
- recurring invoice/email rule,
- email queue preview,
- payment proof image,
- workspace logo image.

Authenticated checks cover:

- dashboard redirect after sign-in,
- seeded invoice list,
- invoice view/print surface,
- payment allocation panel,
- payment timeline,
- customer detail,
- Office operations access for owner,
- Office access locks for viewer when viewer secrets are present.

## CI Behavior

CI always runs anonymous browser smoke after the web build.

CI runs seeded authenticated browser smoke only when these repository secrets exist:

- `ORBIT_LEDGER_ENABLE_SEEDED_CI_SMOKE` set to `yes`
- `ORBIT_LEDGER_QA_EMAIL`
- `ORBIT_LEDGER_QA_PASSWORD`
- `ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY`
- `ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN`

Optional:

- `ORBIT_LEDGER_QA_VIEWER_EMAIL`
- `ORBIT_LEDGER_QA_VIEWER_PASSWORD`
- `ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN`
- `ORBIT_LEDGER_STORAGE_ADMIN_ACCESS_TOKEN`

Keep `ORBIT_LEDGER_ENABLE_SEEDED_CI_SMOKE` unset until the production seed path is trusted for CI. Local seeded smoke remains the release gate for authenticated browser coverage.

## App Check Note

The seeded smoke uses Firebase Auth plus Firestore/Storage client REST calls. If Firebase App Check enforcement is enabled for the target project, seed creation needs a trusted admin token or service-account seed path. The browser smoke can still run against an already-seeded QA workspace.
