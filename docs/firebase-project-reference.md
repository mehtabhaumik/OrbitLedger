# Firebase Project Reference

This file stores the current Firebase project details provided by the project owner so the web and mobile integration work can be completed later without requesting the values again.

## Project

- Project ID: `orbit-ledger-f41c2`
- Auth domain: `orbit-ledger-f41c2.firebaseapp.com`
- Storage bucket: `orbit-ledger-f41c2.firebasestorage.app`
- Messaging sender ID: `26507257397`
- App ID (web): `1:26507257397:web:0fd74ca52a0e2ac969737c`
- Measurement ID: `G-ZS1N48YCE4`

## Web SDK Config

```ts
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: '<redacted: use NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY from your local or hosted environment>',
  authDomain: 'orbit-ledger-f41c2.firebaseapp.com',
  projectId: 'orbit-ledger-f41c2',
  storageBucket: 'orbit-ledger-f41c2.firebasestorage.app',
  messagingSenderId: '26507257397',
  appId: '1:26507257397:web:0fd74ca52a0e2ac969737c',
  measurementId: 'G-ZS1N48YCE4',
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
```

## Mobile Android Config

- Active Android config path: [android/app/google-services.json](/Users/bhaumikmehta/Downloads/Orbit%20Ledger/android/app/google-services.json)
- `app.json` already points Expo Android config to that file through `expo.android.googleServicesFile`
- The latest file provided by the owner should remain the source of truth for Android auth and Firebase-native setup

## Future Integration Notes

- Web auth is already set up according to the owner
- Do not install or wire Firebase into the web app until the web/PWA phase starts
- When web implementation begins, use `firebase` package and wire:
  - Auth
  - Firestore
  - Storage
  - Analytics only if needed for the web build

## CLI Notes Provided By Owner

```bash
npm install firebase
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```
