import type { NextRequest } from 'next/server';

import { resolveOrbitLedgerAuthDomain } from '@/lib/auth-domain';

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

export async function GET(request: NextRequest) {
  const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const normalizedHost = requestHost?.split(',')[0]?.trim().split(':')[0]?.trim() ?? null;
  const configuredAuthDomain = resolveFirebaseEnv(
    process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN,
    'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN',
    defaultDevelopmentConfig.authDomain
  );
  const payload = {
    apiKey: resolveFirebaseEnv(
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY,
      'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY',
      defaultDevelopmentConfig.apiKey
    ),
    appId: resolveFirebaseEnv(
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID,
      'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID',
      defaultDevelopmentConfig.appId
    ),
    authDomain: resolveOrbitLedgerAuthDomain(configuredAuthDomain, normalizedHost),
    databaseURL: '',
    measurementId:
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID || defaultDevelopmentConfig.measurementId,
    messagingSenderId: resolveFirebaseEnv(
      process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID,
      'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID',
      defaultDevelopmentConfig.messagingSenderId
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
  };

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
