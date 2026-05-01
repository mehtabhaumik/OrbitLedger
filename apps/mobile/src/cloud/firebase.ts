import { initializeApp, getApp, getApps } from 'firebase/app';

const defaultDevelopmentConfig = {
  apiKey: 'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w',
  authDomain: 'orbit-ledger-f41c2.firebaseapp.com',
  projectId: 'orbit-ledger-f41c2',
  storageBucket: 'orbit-ledger-f41c2.firebasestorage.app',
  messagingSenderId: '26507257397',
  appId: '1:26507257397:web:0fd74ca52a0e2ac969737c',
};

const appEnvironment = process.env.EXPO_PUBLIC_ORBIT_LEDGER_ENV || 'development';
const isProductionEnvironment = appEnvironment === 'production';

const firebaseConfig = {
  apiKey: getFirebaseEnv('EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY', defaultDevelopmentConfig.apiKey),
  authDomain: getFirebaseEnv(
    'EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN',
    defaultDevelopmentConfig.authDomain
  ),
  projectId: getFirebaseEnv('EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID', defaultDevelopmentConfig.projectId),
  storageBucket: getFirebaseEnv(
    'EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET',
    defaultDevelopmentConfig.storageBucket
  ),
  messagingSenderId: getFirebaseEnv(
    'EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID',
    defaultDevelopmentConfig.messagingSenderId
  ),
  appId: getFirebaseEnv('EXPO_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID', defaultDevelopmentConfig.appId),
};

function getFirebaseEnv(key: string, developmentFallback: string) {
  const value = process.env[key]?.trim();
  if (value) {
    return value;
  }

  if (isProductionEnvironment) {
    throw new Error(`${key} must be set when EXPO_PUBLIC_ORBIT_LEDGER_ENV=production.`);
  }

  return developmentFallback;
}

export function getFirebaseApp() {
  if (!getApps().length) {
    return initializeApp(firebaseConfig);
  }

  return getApp();
}
