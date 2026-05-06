# Production Test Account + Authenticated Live Firebase QA

Generated: May 5, 2026

## Verdict

Launch Hardening Phase 8 is **complete with one remaining production-environment caveat**.

Authenticated live Hosting was proven with isolated QA accounts created through the real Orbit Ledger web UI. The test covered Firebase Auth, workspace onboarding, Firestore reads/writes, protected workspace routes, and Firebase Storage uploads.

The remaining caveat is App Check: the live build still does not send App Check headers because the production reCAPTCHA v3 site key has not been injected into a production build. Firestore and Storage App Check enforcement must stay off until that is done.

## What Was Proven

Live URL:

```text
https://orbit-ledger-f41c2.web.app
```

Production QA accounts were created with this prefix:

```text
orbit-ledger-prod-qa-
```

Passwords were generated for the browser run and were not printed or committed.

Authenticated flow proof:

| Area | Result |
| --- | --- |
| Firebase Auth create account | Pass |
| Workspace onboarding | Pass |
| Firestore workspace write | Pass |
| Protected dashboard route | Pass |
| Protected customers route | Pass |
| Protected invoices route | Pass |
| Protected payments route | Pass |
| Protected settings route | Pass |
| Protected templates route | Pass |
| Protected support route | Pass |
| Customer creation | Pass after using a validation-safe name |
| Logo upload to Firebase Storage | Pass after IAM role fix |
| Watermark upload to Firebase Storage | Pass after Storage rules update |

## Important Finding: Storage Cross-Service Rules Role

The first signed-in Storage upload failed with:

```text
403 Permission denied
```

App Check was checked and was not enforced:

```text
projects/26507257397/services/firebasestorage.googleapis.com
updateTime: 1970-01-01T00:00:00Z
```

The real issue was that Storage rules call Firestore to verify workspace ownership. The Firebase Storage service agent needed the Firestore Rules service-agent role.

Applied:

```bash
gcloud projects add-iam-policy-binding orbit-ledger-f41c2 \
  --member="serviceAccount:service-26507257397@gcp-sa-firebasestorage.iam.gserviceaccount.com" \
  --role="roles/firebaserules.firestoreServiceAgent" \
  --condition=None
```

After that, a signed-in live logo upload returned HTTP `200`.

## Storage Rules Gap Closed

The web app supports logo, signature, and watermark uploads. Storage rules already allowed:

- `workspaces/{workspaceId}/logos/{fileName}`
- `workspaces/{workspaceId}/signatures/{fileName}`

Phase 8 added:

- `workspaces/{workspaceId}/watermarks/{fileName}`

The emulator rules test now covers watermark upload and download.

Deployed:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npx -y firebase-tools@13.35.1 deploy --only storage --project orbit-ledger-f41c2 --non-interactive
```

Live watermark upload then returned HTTP `200`.

## Verification Commands

Rules:

```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 18)"
export PATH="$JAVA_HOME/bin:$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
npm run test:rules:emulators
```

Result:

```text
2 files passed
7 tests passed
```

Live smoke:

```bash
PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" npm run smoke:live-app-check
```

Result:

```text
Orbit Ledger live web smoke passed.
Signed-in Firestore and Storage App Check traffic proof has been acknowledged for the web launch path.
```

## Evidence Artifacts

Browser screenshots and JSON reports are stored locally under ignored artifact folders:

```text
artifacts/live-auth-qa/
```

These artifacts are not committed because they include production QA traces and screenshots.

## May 6 App Check Update

Live signed-in Firebase Auth, Firestore, and Storage are now proven.

Live signed-in web App Check traffic is also proven. A production browser run created authenticated Firestore and Storage traffic with App Check headers present. Token values were not printed.

Firestore and Storage App Check enforcement is now enabled for the web-only launch path. Keep mobile out of public release until the mobile client initializes App Check and passes device QA.

## Next Phase

`Web Beta Operations: Monitor signed-in Auth, Firestore, Storage, Hosting, and App Check traffic`
