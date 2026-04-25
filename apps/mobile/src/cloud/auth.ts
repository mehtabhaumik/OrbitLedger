import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OrbitCloudUser } from '@orbit-ledger/contracts';
import { getFirebaseApp } from './firebase';
import { Platform } from 'react-native';
import type { User } from 'firebase/auth';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

let authInstance: ReturnType<typeof getAuth> | null = null;
const nativeAuthPersistenceModule =
  Platform.OS === 'web'
    ? null
    : (require('@firebase/auth/dist/rn/index.js') as {
        getReactNativePersistence?: (storage: typeof AsyncStorage) => unknown;
      });

export type CloudAuthCredentials = {
  email: string;
  password: string;
};

export type CloudRegistrationInput = CloudAuthCredentials & {
  displayName?: string | null;
};

export function getCloudAuth() {
  if (authInstance) {
    return authInstance;
  }

  const app = getFirebaseApp();

  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
    void authInstance.setPersistence(browserLocalPersistence).catch(() => undefined);
    return authInstance;
  }

  try {
    authInstance = initializeAuth(app, {
      persistence: nativeAuthPersistenceModule?.getReactNativePersistence?.(AsyncStorage) as any,
    });
  } catch {
    authInstance = getAuth(app);
  }

  return authInstance;
}

export function mapCloudUser(user: User | null): OrbitCloudUser | null {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

export function getCurrentCloudUser(): OrbitCloudUser | null {
  return mapCloudUser(getCloudAuth().currentUser);
}

export function subscribeToCloudAuth(
  listener: (user: OrbitCloudUser | null) => void
): () => void {
  return onAuthStateChanged(getCloudAuth(), (user) => listener(mapCloudUser(user)));
}

export async function signInToCloud(credentials: CloudAuthCredentials): Promise<OrbitCloudUser> {
  const result = await signInWithEmailAndPassword(
    getCloudAuth(),
    credentials.email.trim(),
    credentials.password
  );
  const user = mapCloudUser(result.user);
  if (!user) {
    throw new Error('Cloud sign-in did not return a user session.');
  }

  return user;
}

export async function registerForCloud(input: CloudRegistrationInput): Promise<OrbitCloudUser> {
  const result = await createUserWithEmailAndPassword(
    getCloudAuth(),
    input.email.trim(),
    input.password
  );

  if (input.displayName?.trim()) {
    await updateProfile(result.user, { displayName: input.displayName.trim() });
  }

  const user = mapCloudUser(result.user);
  if (!user) {
    throw new Error('Cloud registration did not return a user session.');
  }

  return {
    ...user,
    displayName: input.displayName?.trim() || user.displayName,
  };
}

export async function signOutFromCloud(): Promise<void> {
  await signOut(getCloudAuth());
}
