'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  enableIndexedDbPersistence,
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY || 'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w',
  authDomain:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN ||
    'orbit-ledger-f41c2.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2',
  storageBucket:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET ||
    'orbit-ledger-f41c2.firebasestorage.app',
  messagingSenderId:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID || '26507257397',
  appId:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID ||
    '1:26507257397:web:0fd74ca52a0e2ac969737c',
  measurementId:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID || 'G-ZS1N48YCE4',
};

let persistenceInitialized = false;
let firestorePersistenceInitialized = false;

export function getWebFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getWebAuth() {
  const auth = getAuth(getWebFirebaseApp());
  if (!persistenceInitialized) {
    persistenceInitialized = true;
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }
  return auth;
}

export function getWebFirestore() {
  const firestore = getFirestore(getWebFirebaseApp());
  if (!firestorePersistenceInitialized && typeof window !== 'undefined') {
    firestorePersistenceInitialized = true;
    void enableIndexedDbPersistence(firestore).catch(() => undefined);
  }
  return firestore;
}

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
