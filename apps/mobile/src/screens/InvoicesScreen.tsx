import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FounderFooterLink } from '../components/FounderFooterLink';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { getBusinessSettings, getFeatureToggles, listInvoices } from '../database';
import type { AppFeatureToggles, BusinessSettings, Invoice } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type InvoicesScreenProps = NativeStackScreenProps<RootStackParamList, 'Invoices'>;

export function InvoicesScreen({ navigation }: InvoicesScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const invoicesEnabled = featureToggles?.invoices ?? true;
  const currency = business?.currency ?? 'INR';

  const loadInvoices = useCallback(async () => {
    const [settings, toggles] = await Promise.all([
      getBusinessSettings(),
      getFeatureToggles(),
    ]);

    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    const savedInvoices = toggles.invoices ? await listInvoices({ limit: 60 }) : [];
    setBusiness(settings);
    setFeatureToggles(toggles);
    setInvoices(savedInvoices);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadInvoices();
        } catch {
          if (isActive) {
            Alert.alert('Invoices could not load', 'Please try again.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void load();

      return () => {
        isActive = false;
      };
    }, [loadInvoices])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadInvoices();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading invoices</Text>
        <View style={styles.loadingSkeleton}>
          <SkeletonCard lines={2} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <ScreenHeader
          title="Invoices"
          subtitle="Simple invoices ready to review, edit, and share."
          backLabel="Dashboard"
          onBack={() => navigation.goBack()}
        />

        {!invoicesEnabled ? (
          <EmptyState
            title="Invoices are turned off"
            message="Enable invoices in business profile settings when you want to use this module."
            action={
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                Open Settings
              </PrimaryButton>
            }
          />
        ) : (
          <>
            <Card glass elevated accent="tax">
              <View style={styles.actionCopy}>
                <Text style={styles.sectionTitle}>Invoice Work</Text>
                <Text style={styles.emptyText}>Create invoices without changing customer ledger balances.</Text>
              </View>
              <PrimaryButton onPress={() => navigation.navigate('InvoiceForm')}>
                Create Invoice
              </PrimaryButton>
            </Card>

            {invoices.length === 0 ? (
              <EmptyState
                title="No invoices yet"
                message="Create your first invoice when you need a sales record."
                action={
                  <PrimaryButton variant="secondary" onPress={() => navigation.navigate('InvoiceForm')}>
                    Create Invoice
                  </PrimaryButton>
                }
              />
            ) : (
              <View style={styles.list}>
                {invoices.map((invoice) => (
                  <ListRow
                    key={invoice.id}
                    accent={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'warning' : 'tax'}
                    onPress={() => navigation.navigate('InvoicePreview', { invoiceId: invoice.id })}
                    title={invoice.invoiceNumber}
                    subtitle={`${formatShortDate(invoice.issueDate)} · Open preview and PDF export`}
                    meta="Tap to review, share, or edit from preview"
                    right={
                      <>
                        <StatusChip
                          label={formatInvoiceStatus(invoice.status)}
                          tone={invoice.status === 'paid' ? 'success' : invoice.status === 'overdue' ? 'warning' : 'tax'}
                        />
                        <MoneyText size="sm" align="right">
                          {formatCurrency(invoice.totalAmount, currency)}
                        </MoneyText>
                        <PrimaryButton
                          variant="ghost"
                          onPress={() => navigation.navigate('InvoiceForm', { invoiceId: invoice.id })}
                        >
                          Edit
                        </PrimaryButton>
                      </>
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}
        <FounderFooterLink />
      </ScrollView>
      <BottomNavigation
        active="dashboard"
        onCustomers={() => navigation.navigate('Customers')}
        onDashboard={() => navigation.navigate('Dashboard')}
        onSettings={() => navigation.navigate('BusinessProfileSettings')}
      />
    </SafeAreaView>
  );
}

function formatInvoiceStatus(status: Invoice['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  loadingSkeleton: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 144,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  actionCopy: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  invoiceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 76,
    padding: spacing.lg,
  },
  invoicePreviewAction: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  invoiceRowPressed: {
    opacity: 0.78,
  },
  invoiceRowActions: {
    alignItems: 'flex-end',
  },
  editButton: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editButtonPressed: {
    opacity: 0.78,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  previewHint: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  amount: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 128,
    textAlign: 'right',
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
});
