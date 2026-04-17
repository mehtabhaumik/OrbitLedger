import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { recordUsageAnalyticsEvent } from '../analytics';
import { getBusinessSettings, getDatabase } from '../database';
import { refreshBillingEntitlements } from '../monetization';
import { checkOrbitHelperUpdatesSilently } from '../orbitHelper';
import { BackupRestoreScreen } from '../screens/BackupRestoreScreen';
import { BusinessProfileSettingsScreen } from '../screens/BusinessProfileSettingsScreen';
import { ComplianceReportsScreen } from '../screens/ComplianceReportsScreen';
import { CountryPackageStoreScreen } from '../screens/CountryPackageStoreScreen';
import { CustomerDetailScreen } from '../screens/CustomerDetailScreen';
import { CustomerFormScreen } from '../screens/CustomerFormScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { InvoiceFormScreen } from '../screens/InvoiceFormScreen';
import { InvoicePreviewScreen } from '../screens/InvoicePreviewScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { OrbitHelperScreen } from '../screens/OrbitHelperScreen';
import { PinManagementScreen } from '../screens/PinManagementScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { StatementPreviewScreen } from '../screens/StatementPreviewScreen';
import { TaxSetupScreen } from '../screens/TaxSetupScreen';
import { TransactionFormScreen } from '../screens/TransactionFormScreen';
import { UpgradeScreen } from '../screens/UpgradeScreen';
import { colors, spacing, typography } from '../theme/theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList | null>(null);
  const [loadError, setLoadError] = useState(false);
  const lastBillingRefreshAtRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function prepare() {
      try {
        await getDatabase();
        void checkOrbitHelperUpdatesSilently();
        lastBillingRefreshAtRef.current = Date.now();
        void refreshBillingEntitlements().catch((error) => {
          console.warn('[billing] Startup entitlement refresh skipped', error);
        });
        await recordUsageAnalyticsEvent('app_opened');
        const settings = await getBusinessSettings();
        if (isMounted) {
          setInitialRouteName(settings ? 'Dashboard' : 'Setup');
        }
      } catch {
        if (isMounted) {
          setLoadError(true);
        }
      }
    }

    prepare();

    return () => {
      isMounted = false;
    };
  }, []);

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
      void refreshBillingEntitlements().catch((error) => {
        console.warn('[billing] Resume entitlement refresh skipped', error);
      });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Orbit Ledger could not start</Text>
        <Text style={styles.message}>Close the app and try again.</Text>
      </View>
    );
  }

  if (!initialRouteName) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.message}>Preparing local ledger</Text>
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
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Invoices" component={InvoicesScreen} />
        <Stack.Screen name="Products" component={ProductsScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
        <Stack.Screen name="ComplianceReports" component={ComplianceReportsScreen} />
        <Stack.Screen name="BusinessProfileSettings" component={BusinessProfileSettingsScreen} />
        <Stack.Screen name="CountryPackageStore" component={CountryPackageStoreScreen} />
        <Stack.Screen name="OrbitHelper" component={OrbitHelperScreen} />
        <Stack.Screen name="Upgrade" component={UpgradeScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="TaxSetup" component={TaxSetupScreen} />
        <Stack.Screen name="PinManagement" component={PinManagementScreen} />
        <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
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

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
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
  },
});
