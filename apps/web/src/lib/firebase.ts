'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import {
  type Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  enableIndexedDbPersistence,
  type Firestore,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { resolveOrbitLedgerAuthDomain } from './auth-domain';

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

/**
 * Local emulator mode, used by the visual-baseline suite so signed-in screens
 * can be captured without touching the live project.
 *
 * Hard-gated off in production: a build that talked to localhost would fail
 * silently and confusingly, so the flag is ignored rather than trusted there.
 */
const useEmulators =
  !isProductionEnvironment &&
  /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_ORBIT_LEDGER_USE_EMULATORS?.trim() || '');
const emulatorHost = process.env.NEXT_PUBLIC_ORBIT_LEDGER_EMULATOR_HOST?.trim() || '127.0.0.1';
const emulatorPorts = {
  auth: Number(process.env.NEXT_PUBLIC_ORBIT_LEDGER_AUTH_EMULATOR_PORT || 9099),
  firestore: Number(process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIRESTORE_EMULATOR_PORT || 8085),
  storage: Number(process.env.NEXT_PUBLIC_ORBIT_LEDGER_STORAGE_EMULATOR_PORT || 9199),
};

let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;
let storageEmulatorConnected = false;

const configuredAuthDomain = resolveFirebaseEnv(
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN,
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN',
  defaultDevelopmentConfig.authDomain
);

const firebaseConfig = {
  apiKey: resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY',
    defaultDevelopmentConfig.apiKey
  ),
  authDomain: resolveOrbitLedgerAuthDomain(
    configuredAuthDomain,
    typeof window === 'undefined' ? undefined : window.location.hostname
  ),
  projectId: resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID',
    defaultDevelopmentConfig.projectId
  ),
  storageBucket: resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET',
    defaultDevelopmentConfig.storageBucket
  ),
  messagingSenderId: resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID',
    defaultDevelopmentConfig.messagingSenderId
  ),
  appId: resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID',
    defaultDevelopmentConfig.appId
  ),
  measurementId:
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID || defaultDevelopmentConfig.measurementId,
};

let persistenceInitialized = false;
let authPersistencePromise: Promise<void> | null = null;
let firestorePersistenceInitialized = false;
let firestoreInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let appCheckInstance: AppCheck | null = null;

function resolveFirebaseEnv(value: string | undefined, key: string, developmentFallback: string) {
  const trimmedValue = value?.trim();
  if (trimmedValue) {
    return trimmedValue;
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
  if (useEmulators && !authEmulatorConnected) {
    authEmulatorConnected = true;
    // warnings:false suppresses the emulator's fixed-position banner, which
    // would otherwise appear in every visual baseline screenshot.
    connectAuthEmulator(auth, `http://${emulatorHost}:${emulatorPorts.auth}`, { disableWarnings: true });
  }
  if (!persistenceInitialized) {
    persistenceInitialized = true;
    authPersistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }
  return auth;
}

export async function getWebAuthReady(): Promise<Auth> {
  const auth = getWebAuth();
  await authPersistencePromise;
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
  if (useEmulators && !firestoreEmulatorConnected) {
    firestoreEmulatorConnected = true;
    connectFirestoreEmulator(firestore, emulatorHost, emulatorPorts.firestore);
  }
  // IndexedDB persistence is skipped against the emulator: a cached copy of a
  // previous seed would survive a re-seed and quietly serve stale data.
  if (!useEmulators && !firestorePersistenceInitialized && typeof window !== 'undefined') {
    firestorePersistenceInitialized = true;
    void enableIndexedDbPersistence(firestore).catch(() => undefined);
  }
  return firestore;
}

export function getWebStorage() {
  if (!storageInstance) {
    storageInstance = getStorage(getWebFirebaseApp());
  }
  if (useEmulators && !storageEmulatorConnected) {
    storageEmulatorConnected = true;
    connectStorageEmulator(storageInstance, emulatorHost, emulatorPorts.storage);
  }

  return storageInstance;
}

export function getWebFirebaseProjectId() {
  return firebaseConfig.projectId;
}

const FUNCTIONS_REGION = 'asia-south1';

/**
 * Resolves the callable-endpoint URL for a deployed function.
 *
 * Previously each caller built this string itself, which meant emulator support
 * would have had to be repeated in ~37 places (and the region was pinned in all
 * of them). Routing through here keeps that single-sourced.
 */
export function getWebFunctionUrl(functionName: string) {
  const projectId = getWebFirebaseProjectId();
  if (useEmulators) {
    const port = Number(process.env.NEXT_PUBLIC_ORBIT_LEDGER_FUNCTIONS_EMULATOR_PORT || 5001);
    return `http://${emulatorHost}:${port}/${projectId}/${FUNCTIONS_REGION}/${functionName}`;
  }
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/${functionName}`;
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

  // The emulators do not enforce App Check, and loading the reCAPTCHA
  // Enterprise provider against them only adds a third-party request that can
  // fail offline and stall the visual-baseline run.
  if (useEmulators) {
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
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
