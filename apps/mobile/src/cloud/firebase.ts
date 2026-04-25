import { initializeApp, getApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY || 'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w',
  authDomain:
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN ||
    'orbit-ledger-f41c2.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2',
  storageBucket:
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET ||
    'orbit-ledger-f41c2.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID || '26507257397',
  appId:
    process.env.EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID ||
    '1:26507257397:web:0fd74ca52a0e2ac969737c',
};

export function getFirebaseApp() {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }

  return getApp();
}
