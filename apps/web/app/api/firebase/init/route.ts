import type { NextRequest } from 'next/server';

const defaultDevelopmentConfig = {
  apiKey: 'AIzaSyCIXghvBKtBvt-6oQDvgKSPwe2MMPj_SXE',
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
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')
    .map((value) => value.trim())
    .find(Boolean);
  const host = forwardedHost || request.headers.get('host')?.trim() || request.nextUrl.host;
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
    authDomain: host,
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
