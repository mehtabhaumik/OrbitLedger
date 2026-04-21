import { File, Paths } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getBusinessSettings, getDatabase } from '../database';
import { refreshBillingEntitlements } from '../monetization';

export type RuntimeQACheckStatus = 'passed' | 'warning' | 'failed';

export type RuntimeQACheckResult = {
  id: string;
  title: string;
  status: RuntimeQACheckStatus;
  message: string;
};

type CheckDefinition = {
  id: string;
  title: string;
  run: () => Promise<RuntimeQACheckResult>;
};

export async function runNativeRuntimeReadinessChecks(): Promise<RuntimeQACheckResult[]> {
  const checks: CheckDefinition[] = [
    {
      id: 'platform',
      title: 'Runtime platform',
      run: async () =>
        makeResult(
          'platform',
          'Runtime platform',
          Platform.OS === 'android' || Platform.OS === 'ios' ? 'passed' : 'warning',
          Platform.OS === 'android' || Platform.OS === 'ios'
            ? `Running on ${Platform.OS}. Native-device QA can be exercised here.`
            : `Running on ${Platform.OS}. Use Android or iOS for native-device QA.`
        ),
    },
    {
      id: 'sqlite',
      title: 'SQLite ledger database',
      run: async () => {
        try {
          const db = await getDatabase();
          await db.getFirstAsync('SELECT 1 AS ok');
          return makeResult(
            'sqlite',
            'SQLite ledger database',
            'passed',
            'Local SQLite is available and the Orbit Ledger schema can be opened.'
          );
        } catch (error) {
          return makeResult(
            'sqlite',
            'SQLite ledger database',
            'failed',
            `SQLite could not be opened: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'business-profile',
      title: 'Business profile state',
      run: async () => {
        try {
          const settings = await getBusinessSettings();
          return makeResult(
            'business-profile',
            'Business profile state',
            settings ? 'passed' : 'warning',
            settings
              ? `Business profile is configured for ${settings.businessName}.`
              : 'No business profile is configured yet. Complete onboarding before full flow QA.'
          );
        } catch (error) {
          return makeResult(
            'business-profile',
            'Business profile state',
            'failed',
            `Business profile could not be read: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'secure-store',
      title: 'SecureStore',
      run: async () => {
        try {
          const isAvailable = await SecureStore.isAvailableAsync();
          return makeResult(
            'secure-store',
            'SecureStore',
            isAvailable ? 'passed' : 'failed',
            isAvailable
              ? 'Secure local storage is available for PIN-related device state.'
              : 'Secure local storage is not available in this runtime.'
          );
        } catch (error) {
          return makeResult(
            'secure-store',
            'SecureStore',
            'failed',
            `SecureStore check failed: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'biometrics',
      title: 'Biometric unlock capability',
      run: async () => {
        try {
          const [hasHardware, isEnrolled, types] = await Promise.all([
            LocalAuthentication.hasHardwareAsync(),
            LocalAuthentication.isEnrolledAsync(),
            LocalAuthentication.supportedAuthenticationTypesAsync(),
          ]);
          if (!hasHardware) {
            return makeResult(
              'biometrics',
              'Biometric unlock capability',
              'warning',
              'This device does not report biometric hardware. PIN unlock should still work.'
            );
          }

          return makeResult(
            'biometrics',
            'Biometric unlock capability',
            isEnrolled ? 'passed' : 'warning',
            isEnrolled
              ? `Biometric hardware is enrolled. Supported type count: ${types.length}.`
              : 'Biometric hardware exists, but no biometric identity is enrolled in device settings.'
          );
        } catch (error) {
          return makeResult(
            'biometrics',
            'Biometric unlock capability',
            'failed',
            `Biometric capability check failed: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'file-system',
      title: 'Local file storage',
      run: async () => {
        try {
          const directory = Paths.cache ?? Paths.document;
          if (!directory?.exists) {
            return makeResult(
              'file-system',
              'Local file storage',
              'failed',
              'No app cache or document directory is available.'
            );
          }

          const file = new File(directory, 'orbit-ledger-runtime-check.txt');
          if (file.exists) {
            file.delete();
          }
          file.write(new Date().toISOString());
          const exists = file.exists;
          file.delete();

          return makeResult(
            'file-system',
            'Local file storage',
            exists ? 'passed' : 'failed',
            exists
              ? 'App-local file write/read/delete works for exports and temporary documents.'
              : 'The runtime test file was not created.'
          );
        } catch (error) {
          return makeResult(
            'file-system',
            'Local file storage',
            'failed',
            `Local file storage check failed: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'print',
      title: 'PDF generation runtime',
      run: async () => {
        try {
          const result = await Print.printToFileAsync({
            html: '<html><body><h1>Orbit Ledger Runtime Check</h1></body></html>',
          });
          if (result.uri) {
            try {
              const generatedFile = new File(result.uri);
              if (generatedFile.exists) {
                generatedFile.delete();
              }
            } catch {
              // A failed cleanup should not hide whether PDF generation itself worked.
            }
          }
          return makeResult(
            'print',
            'PDF generation runtime',
            result.uri ? 'passed' : 'failed',
            result.uri
              ? 'Native PDF generation is available.'
              : 'Native PDF generation did not return a file.'
          );
        } catch (error) {
          return makeResult(
            'print',
            'PDF generation runtime',
            'failed',
            `PDF generation check failed: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'sharing',
      title: 'System share sheet',
      run: async () => {
        try {
          const isAvailable = await Sharing.isAvailableAsync();
          return makeResult(
            'sharing',
            'System share sheet',
            isAvailable ? 'passed' : 'warning',
            isAvailable
              ? 'System sharing is available for PDFs, backups, CSV, and JSON exports.'
              : 'System sharing is not available in this runtime.'
          );
        } catch (error) {
          return makeResult(
            'sharing',
            'System share sheet',
            'failed',
            `Share-sheet check failed: ${getErrorMessage(error)}`
          );
        }
      },
    },
    {
      id: 'billing',
      title: 'Store billing runtime',
      run: async () => {
        try {
          const result = await refreshBillingEntitlements();
          return makeResult(
            'billing',
            'Store billing runtime',
            result.available ? 'passed' : 'warning',
            result.message
          );
        } catch (error) {
          return makeResult(
            'billing',
            'Store billing runtime',
            'warning',
            `Billing could not be checked in this runtime: ${getErrorMessage(error)}`
          );
        }
      },
    },
  ];

  const results: RuntimeQACheckResult[] = [];
  for (const check of checks) {
    results.push(await check.run());
  }
  return results;
}

function makeResult(
  id: string,
  title: string,
  status: RuntimeQACheckStatus,
  message: string
): RuntimeQACheckResult {
  return {
    id,
    title,
    status,
    message,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected native runtime error.';
}
