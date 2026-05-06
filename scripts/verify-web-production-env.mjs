const requiredWebEnvironment = [
  'NEXT_PUBLIC_ORBIT_LEDGER_ENV',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_APP_ID',
  'NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_MEASUREMENT_ID',
  'NEXT_PUBLIC_ORBIT_LEDGER_RECAPTCHA_V3_SITE_KEY',
];

const expectedProjectId = 'orbit-ledger-f41c2';
const errors = [];

for (const key of requiredWebEnvironment) {
  if (!process.env[key]?.trim()) {
    errors.push(`${key} is required.`);
  }
}

if (process.env.NEXT_PUBLIC_ORBIT_LEDGER_ENV !== 'production') {
  errors.push('NEXT_PUBLIC_ORBIT_LEDGER_ENV must be production.');
}

if (
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID &&
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID !== expectedProjectId
) {
  errors.push(`NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_PROJECT_ID must be ${expectedProjectId}.`);
}

if (
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN &&
  !process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN.endsWith('.firebaseapp.com')
) {
  errors.push('NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_AUTH_DOMAIN must be a Firebase Auth domain.');
}

if (
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET &&
  !process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET.endsWith('.firebasestorage.app')
) {
  errors.push('NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET must be the Firebase Storage bucket.');
}

if (process.env.NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN?.trim()) {
  errors.push('NEXT_PUBLIC_ORBIT_LEDGER_APPCHECK_DEBUG_TOKEN must not be set for production builds.');
}

if (errors.length) {
  console.error('Orbit Ledger production web environment is not ready.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Orbit Ledger production web environment is ready.');
console.log(`Verified ${requiredWebEnvironment.length} required variables without printing values.`);
