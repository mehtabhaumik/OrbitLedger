'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  }
}

const defaultDevelopmentConfig = {
  apiKey: 'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w',
  authDomain: 'orbit-ledger-f41c2.firebaseapp.com',
  projectId: 'orbit-ledger-f41c2',
  storageBucket: 'orbit-ledger-f41c2.firebasestorage.app',
  messagingSenderId: '26507257397',
  appId: '1:26507257397:web:0fd74ca52a0e2ac969737c',
  measurementId: 'G-ZS1N48YCE4',
};

const appEnvironment = process.env.NEXT_PUBLIC_ORBIT_LEDGER_ENV || 'development';
const isProductionEnvironment = appEnvironment === 'production';

const firebaseConfig = {
  apiKey: getFirebaseEnv('NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY', defaultDevelopmentConfig.apiKey),
  authDomain: getFirebaseEnv(
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN',
    defaultDevelopmentConfig.authDomain
  ),
  projectId: getFirebaseEnv('NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID', defaultDevelopmentConfig.projectId),
  storageBucket: getFirebaseEnv(
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET',
    defaultDevelopmentConfig.storageBucket
  ),
  messagingSenderId: getFirebaseEnv(
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID',
    defaultDevelopmentConfig.messagingSenderId
  ),
  appId: getFirebaseEnv('NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID', defaultDevelopmentConfig.appId),
  measurementId: process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID || defaultDevelopmentConfig.measurementId,
};

let persistenceInitialized = false;
let firestorePersistenceInitialized = false;
let firestoreInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;

function getFirebaseEnv(key: string, developmentFallback: string) {
  const value = process.env[key]?.trim();
  if (value) {
    return value;
  }

  if (isProductionEnvironment) {
    throw new Error(`${key} must be set when NEXT_PUBLIC_ORBIT_LEDGER_ENV=production.`);
  }

  return developmentFallback;
}

export function getWebFirebaseApp() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  initializeWebAppCheck(app);
  return app;
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
  if (!firestoreInstance) {
    firestoreInstance = initializeFirestore(getWebFirebaseApp(), {
      // Auto-detect long polling when WebChannel handshake is slow/blocked on some networks.
      experimentalAutoDetectLongPolling: true,
    });
  }
  const firestore = firestoreInstance;
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

function initializeWebAppCheck(app: ReturnType<typeof initializeApp>) {
  if (typeof window === 'undefined' || appCheckInstance) {
    return;
  }

  const siteKey = process.env.NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY?.trim();
  const debugToken = process.env.NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN?.trim();
  if (!siteKey) {
    if (isProductionEnvironment) {
      throw new Error('NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY must be set in production.');
    }
    return;
  }

  if (debugToken) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
