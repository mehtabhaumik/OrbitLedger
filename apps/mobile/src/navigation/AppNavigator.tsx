import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ComponentType } from 'react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { getBusinessSettings, getDatabase } from '../database';
import { measurePerformance } from '../performance';
import { colors, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const SetupScreen = lazyScreen(() =>
  import('../screens/SetupScreen').then((module) => ({ default: module.SetupScreen }))
);
const CloudAuthScreen = lazyScreen(() =>
  import('../screens/CloudAuthScreen').then((module) => ({ default: module.CloudAuthScreen }))
);
const DashboardScreen = lazyScreen(() =>
  import('../screens/DashboardScreen').then((module) => ({ default: module.DashboardScreen }))
);
const GetPaidScreen = lazyScreen(() =>
  import('../screens/GetPaidScreen').then((module) => ({ default: module.GetPaidScreen }))
);
const InvoicesScreen = lazyScreen(() =>
  import('../screens/InvoicesScreen').then((module) => ({ default: module.InvoicesScreen }))
);
const ProductsScreen = lazyScreen(() =>
  import('../screens/ProductsScreen').then((module) => ({ default: module.ProductsScreen }))
);
const ReportsScreen = lazyScreen(() =>
  import('../screens/ReportsScreen').then((module) => ({ default: module.ReportsScreen }))
);
const RuntimeQAScreen = lazyScreen(() =>
  import('../screens/RuntimeQAScreen').then((module) => ({ default: module.RuntimeQAScreen }))
);
const BusinessHealthSnapshotScreen = lazyScreen(() =>
  import('../screens/BusinessHealthSnapshotScreen').then((module) => ({
    default: module.BusinessHealthSnapshotScreen,
  }))
);
const MonthlyBusinessReviewScreen = lazyScreen(() =>
  import('../screens/MonthlyBusinessReviewScreen').then((module) => ({
    default: module.MonthlyBusinessReviewScreen,
  }))
);
const StatementBatchScreen = lazyScreen(() =>
  import('../screens/StatementBatchScreen').then((module) => ({ default: module.StatementBatchScreen }))
);
const InventoryReorderAssistantScreen = lazyScreen(() =>
  import('../screens/InventoryReorderAssistantScreen').then((module) => ({
    default: module.InventoryReorderAssistantScreen,
  }))
);
const DailyClosingReportScreen = lazyScreen(() =>
  import('../screens/DailyClosingReportScreen').then((module) => ({
    default: module.DailyClosingReportScreen,
  }))
);
const ComplianceReportsScreen = lazyScreen(() =>
  import('../screens/ComplianceReportsScreen').then((module) => ({
    default: module.ComplianceReportsScreen,
  }))
);
const BusinessProfileSettingsScreen = lazyScreen(() =>
  import('../screens/BusinessProfileSettingsScreen').then((module) => ({
    default: module.BusinessProfileSettingsScreen,
  }))
);
const CountryPackageStoreScreen = lazyScreen(() =>
  import('../screens/CountryPackageStoreScreen').then((module) => ({
    default: module.CountryPackageStoreScreen,
  }))
);
const OrbitHelperScreen = lazyScreen(() =>
  import('../screens/OrbitHelperScreen').then((module) => ({ default: module.OrbitHelperScreen }))
);
const UpgradeScreen = lazyScreen(() =>
  import('../screens/UpgradeScreen').then((module) => ({ default: module.UpgradeScreen }))
);
const FeedbackScreen = lazyScreen(() =>
  import('../screens/FeedbackScreen').then((module) => ({ default: module.FeedbackScreen }))
);
const TaxSetupScreen = lazyScreen(() =>
  import('../screens/TaxSetupScreen').then((module) => ({ default: module.TaxSetupScreen }))
);
const PinManagementScreen = lazyScreen(() =>
  import('../screens/PinManagementScreen').then((module) => ({ default: module.PinManagementScreen }))
);
const BackupRestoreScreen = lazyScreen(() =>
  import('../screens/BackupRestoreScreen').then((module) => ({ default: module.BackupRestoreScreen }))
);
const FounderNoteScreen = lazyScreen(() =>
  import('../screens/FounderNoteScreen').then((module) => ({ default: module.FounderNoteScreen }))
);
const CustomersScreen = lazyScreen(() =>
  import('../screens/CustomersScreen').then((module) => ({ default: module.CustomersScreen }))
);
const CustomerFormScreen = lazyScreen(() =>
  import('../screens/CustomerFormScreen').then((module) => ({ default: module.CustomerFormScreen }))
);
const CustomerDetailScreen = lazyScreen(() =>
  import('../screens/CustomerDetailScreen').then((module) => ({ default: module.CustomerDetailScreen }))
);
const TransactionFormScreen = lazyScreen(() =>
  import('../screens/TransactionFormScreen').then((module) => ({ default: module.TransactionFormScreen }))
);
const InvoiceFormScreen = lazyScreen(() =>
  import('../screens/InvoiceFormScreen').then((module) => ({ default: module.InvoiceFormScreen }))
);
const InvoicePreviewScreen = lazyScreen(() =>
  import('../screens/InvoicePreviewScreen').then((module) => ({ default: module.InvoicePreviewScreen }))
);
const StatementPreviewScreen = lazyScreen(() =>
  import('../screens/StatementPreviewScreen').then((module) => ({
    default: module.StatementPreviewScreen,
  }))
);

const splashBrand = require('../../assets/branding/orbit-ledger-logo-transparent.png');

function lazyScreen(
  loader: () => Promise<{ default: ComponentType<any> }>
): ComponentType<any> {
  const LazyComponent = lazy(loader);
  return function LazyScreen(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function AppNavigator() {
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [startupSlow, setStartupSlow] = useState(false);
  const lastBillingRefreshAtRef = useRef(0);
  const phase16RuntimeQaStartedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    setInitialRouteName(null);
    setLoadError(false);
    setLoadErrorMessage(null);
    setStartupSlow(false);

    const slowStartupTimer = setTimeout(() => {
      if (isMounted) {
        setStartupSlow(true);
      }
    }, 12000);

    async function prepare() {
      try {
        await measurePerformance('app_startup_readiness', 'App startup readiness', async () => {
          await getDatabase();
          lastBillingRefreshAtRef.current = Date.now();
          const settings = await measurePerformance(
            'business_profile_load',
            'Business profile load',
            () => getBusinessSettings(),
            { source: 'startup' }
          );
          if (isMounted) {
            setInitialRouteName(settings ? 'Dashboard' : 'Setup');
          }
          scheduleDeferredStartupWork();
        });
      } catch (error) {
        console.warn('[startup] Orbit Ledger startup failed', error);
        if (isMounted) {
          setLoadError(true);
          setLoadErrorMessage(error instanceof Error ? error.message : 'Unexpected startup error.');
        }
      } finally {
        clearTimeout(slowStartupTimer);
      }
    }

    prepare();

    return () => {
      isMounted = false;
      clearTimeout(slowStartupTimer);
    };
  }, [startupAttempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }

      const now = Date.now();
      if (now - lastBillingRefreshAtRef.current < 15000) {
        return;
      }

      lastBillingRefreshAtRef.current = now;
      void refreshBillingEntitlementsDeferred('resume');
      void syncWorkspaceDeferred('resume');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!__DEV__ || phase16RuntimeQaStartedRef.current || !initialRouteName) {
      return;
    }

    if (process.env.EXPO_PUBLIC_ORBIT_LEDGER_PHASE16_AUTORUN !== '1') {
      return;
    }

    phase16RuntimeQaStartedRef.current = true;
    const runtimeQaTimer = setTimeout(() => {
      void import('../runtimeQA')
        .then(({ runPhase16RuntimeVerification }) => runPhase16RuntimeVerification())
        .catch((error) => {
          console.warn('[phase16-runtime-qa] Unhandled runtime verification failure', error);
        });
    }, 12000);

    return () => {
      clearTimeout(runtimeQaTimer);
    };
  }, [initialRouteName]);

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Orbit Ledger could not start</Text>
        <Text style={styles.message}>
          Your local data was not changed. Try again, and check the development logs if this keeps
          happening.
        </Text>
        {loadErrorMessage ? <Text style={styles.detail}>{loadErrorMessage}</Text> : null}
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setStartupAttempt((attempt) => attempt + 1)}
          style={({ pressed }) => [styles.retryButton, pressed ? styles.retryButtonPressed : null]}
        >
          <Text style={styles.retryButtonText}>Retry Startup</Text>
        </Pressable>
      </View>
    );
  }

  if (!initialRouteName) {
    return (
      <View style={styles.centered}>
        <Image source={splashBrand} style={styles.splashBrand} resizeMode="contain" />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.message}>Preparing local ledger</Text>
        {startupSlow ? (
          <Text style={styles.detail}>
            This is taking longer than usual. Orbit Ledger is still opening the local database and
            checking device services.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="CloudAuth" component={CloudAuthScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="GetPaid" component={GetPaidScreen} />
        <Stack.Screen name="Invoices" component={InvoicesScreen} />
        <Stack.Screen name="Products" component={ProductsScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        {__DEV__ ? <Stack.Screen name="RuntimeQA" component={RuntimeQAScreen} /> : null}
        <Stack.Screen name="BusinessHealthSnapshot" component={BusinessHealthSnapshotScreen} />
        <Stack.Screen name="MonthlyBusinessReview" component={MonthlyBusinessReviewScreen} />
        <Stack.Screen name="StatementBatch" component={StatementBatchScreen} />
        <Stack.Screen name="InventoryReorderAssistant" component={InventoryReorderAssistantScreen} />
        <Stack.Screen name="DailyClosingReport" component={DailyClosingReportScreen} />
        <Stack.Screen name="ComplianceReports" component={ComplianceReportsScreen} />
        <Stack.Screen name="BusinessProfileSettings" component={BusinessProfileSettingsScreen} />
        <Stack.Screen name="CountryPackageStore" component={CountryPackageStoreScreen} />
        <Stack.Screen name="OrbitHelper" component={OrbitHelperScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="TaxSetup" component={TaxSetupScreen} />
        <Stack.Screen name="PinManagement" component={PinManagementScreen} />
        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
        <Stack.Screen name="FounderNote" component={FounderNoteScreen} />
        <Stack.Screen name="Customers" component={CustomersScreen} />
        <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} />
        <Stack.Screen
          name="TransactionForm"
          component={TransactionFormScreen}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="InvoiceForm" component={InvoiceFormScreen} />
        <Stack.Screen name="InvoicePreview" component={InvoicePreviewScreen} />
        <Stack.Screen name="StatementPreview" component={StatementPreviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function RouteLoadingFallback() {
  return (
    <View style={styles.centered}>
      <Image source={splashBrand} style={styles.routeBrand} resizeMode="contain" />
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.message}>Opening screen</Text>
    </View>
  );
}

function scheduleDeferredStartupWork() {
  setTimeout(() => {
    void import('../analytics')
      .then(({ recordUsageAnalyticsEvent }) => recordUsageAnalyticsEvent('app_opened'))
      .catch((error) => {
        console.warn('[analytics] Startup app-open event skipped', error);
      });
  }, 0);

  setTimeout(() => {
    void refreshBillingEntitlementsDeferred('startup');
  }, 700);

  setTimeout(() => {
    void import('../orbitHelper')
      .then(({ checkOrbitHelperUpdatesSilently }) => checkOrbitHelperUpdatesSilently())
      .catch((error) => {
        console.warn('[orbit-helper] Silent update check skipped', error);
      });
  }, 1500);

  setTimeout(() => {
    void syncWorkspaceDeferred('startup');
  }, 2600);
}

async function refreshBillingEntitlementsDeferred(source: 'startup' | 'resume') {
  try {
    const { refreshBillingEntitlements } = await import('../monetization');
    await refreshBillingEntitlements();
  } catch (error) {
    console.warn(`[billing] ${source} entitlement refresh skipped`, error);
  }
}

async function syncWorkspaceDeferred(source: 'startup' | 'resume') {
  try {
    const { runWorkspaceSync } = await import('../sync');
    await runWorkspaceSync();
  } catch (error) {
    console.warn(`[workspace-sync] ${source} sync skipped`, error);
  }
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  splashBrand: {
    width: 260,
    height: 81,
    marginBottom: spacing.sm,
  },
  routeBrand: {
    width: 200,
    height: 62,
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
    lineHeight: 23,
  },
  detail: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
    maxWidth: 340,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonPressed: {
    opacity: 0.82,
  },
  retryButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
