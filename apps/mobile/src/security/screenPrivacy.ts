import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

const APP_PREVIEW_PRIVACY_KEY = 'orbit-ledger-app-preview';

export function useSensitiveScreenPrivacy(key: string, enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isMounted = true;
    void preventScreenCapture(key, () => isMounted);

    return () => {
      isMounted = false;
      void allowScreenCapture(key);
    };
  }, [enabled, key]);
}

export function useAppPreviewPrivacy(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let isMounted = true;
    void enableAppPreviewPrivacy(() => isMounted);

    return () => {
      isMounted = false;
      void disableAppPreviewPrivacy();
    };
  }, [enabled]);
}

async function enableAppPreviewPrivacy(isMounted: () => boolean): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await ScreenCapture.enableAppSwitcherProtectionAsync(0.75);
      return;
    }

    if (Platform.OS === 'android') {
      await preventScreenCapture(APP_PREVIEW_PRIVACY_KEY, isMounted);
    }
  } catch (error) {
    console.warn('[screen-privacy] App preview privacy could not be enabled', error);
  }
}

async function disableAppPreviewPrivacy(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await ScreenCapture.disableAppSwitcherProtectionAsync();
      return;
    }

    if (Platform.OS === 'android') {
      await allowScreenCapture(APP_PREVIEW_PRIVACY_KEY);
    }
  } catch (error) {
    console.warn('[screen-privacy] App preview privacy could not be disabled', error);
  }
}

async function preventScreenCapture(key: string, isMounted: () => boolean): Promise<void> {
  try {
    const isAvailable = await ScreenCapture.isAvailableAsync();
    if (isMounted() && isAvailable) {
      await ScreenCapture.preventScreenCaptureAsync(key);
    }
  } catch (error) {
    console.warn('[screen-privacy] Screen capture protection could not be enabled', error);
  }
}

async function allowScreenCapture(key: string): Promise<void> {
  try {
    const isAvailable = await ScreenCapture.isAvailableAsync();
    if (isAvailable) {
      await ScreenCapture.allowScreenCaptureAsync(key);
    }
  } catch (error) {
    console.warn('[screen-privacy] Screen capture protection could not be disabled', error);
  }
}
