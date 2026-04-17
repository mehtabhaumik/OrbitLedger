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

import { shareAccountantExport } from '../accountant';
import type { AccountantExportFormat } from '../accountant';
import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { Section } from '../components/Section';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import { getBusinessSettings, getFeatureToggles, getReportsSummary } from '../database';
import type { AppFeatureToggles, BusinessSettings, ReportTrend, ReportsSummary } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type ReportsScreenProps = NativeStackScreenProps<RootStackParamList, 'Reports'>;

export function ReportsScreen({ navigation }: ReportsScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharingAccountant, setIsSharingAccountant] = useState(false);
  const currency = business?.currency ?? 'INR';

  const loadReports = useCallback(async () => {
    const [settings, summary, toggles] = await Promise.all([
      getBusinessSettings(),
      getReportsSummary(),
      getFeatureToggles(),
    ]);

    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    setBusiness(settings);
    setReports(summary);
    setFeatureToggles(toggles);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadReports();
        } catch {
          if (isActive) {
            Alert.alert('Reports could not load', 'Please try again.');
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
    }, [loadReports])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadReports();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function chooseAccountantExportFormat() {
    Alert.alert(
      'Share with accountant',
      'Choose a structured export format. JSON is best for systems. CSV is best for spreadsheets.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'JSON', onPress: () => void shareWithAccountant('json') },
        { text: 'CSV', onPress: () => void shareWithAccountant('csv') },
      ]
    );
  }

  async function shareWithAccountant(format: AccountantExportFormat) {
    try {
      setIsSharingAccountant(true);
      const exportFile = await shareAccountantExport({ format });
      Alert.alert(
        'Export shared',
        `${exportFile.fileName} was saved locally and opened for sharing.`
      );
    } catch {
      Alert.alert('Export failed', 'Orbit Ledger could not prepare the accountant export. Please try again.');
    } finally {
      setIsSharingAccountant(false);
    }
  }

  if (isLoading && !reports) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading reports</Text>
        <View style={styles.loadingStack}>
          <SkeletonCard lines={2} />
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
          title="Reports"
          subtitle="Simple business summaries from local ledger data."
          backLabel="Dashboard"
          onBack={() => navigation.goBack()}
        />

        <View style={styles.summaryGrid}>
          {featureToggles?.invoices ?? true ? (
            <SummaryCard
              label="Total sales"
              value={formatCurrency(reports?.totalSales ?? 0, currency)}
              helper={`${reports?.invoiceCount ?? 0} invoices recorded.`}
            />
          ) : null}
          <SummaryCard
            label="Total credit"
            value={formatCurrency(reports?.totalCredit ?? 0, currency)}
            helper={`${reports?.creditEntryCount ?? 0} credit entries recorded.`}
          />
        </View>

        <Section title="Simple Trends" subtitle="Compares the last 7 days with the 7 days before that.">
          <View style={styles.trendList}>
            {featureToggles?.invoices ?? true ? (
              <TrendRow
                label="Sales"
                trend={reports?.salesTrend}
                currency={currency}
              />
            ) : null}
            <TrendRow
              label="Credit"
              trend={reports?.creditTrend}
              currency={currency}
            />
          </View>
          <Text style={styles.helperText}>
            Compares the last 7 days with the 7 days before that.
          </Text>
        </Section>

        <Section title="Top Customers" subtitle="The customers with the most business activity.">
          {!reports?.topCustomers.length ? (
            <EmptyState
              title="No report data yet"
              message={
                featureToggles?.invoices ?? true
                  ? 'Add credits or invoices to see your most active customers here.'
                  : 'Add credits to see your most active customers here.'
              }
              action={
                featureToggles?.invoices ?? true ? (
                  <PrimaryButton variant="secondary" onPress={() => navigation.navigate('InvoiceForm')}>
                    Create Invoice
                  </PrimaryButton>
                ) : undefined
              }
            />
          ) : (
            <View style={styles.customerList}>
              {reports.topCustomers.map((customer, index) => (
                <ListRow
                  key={customer.id}
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: customer.id })}
                  accent={customer.balance > 0 ? 'warning' : 'success'}
                  title={`${index + 1}. ${customer.name}`}
                  subtitle={`Sales ${formatCurrency(customer.totalSales, currency)} · Credit ${formatCurrency(customer.totalCredit, currency)}`}
                  meta={`Last activity ${formatShortDate(customer.latestActivityAt)}`}
                  right={
                    <>
                      <StatusChip
                        label={customer.balance > 0 ? 'Due' : 'Clear'}
                        tone={customer.balance > 0 ? 'warning' : 'success'}
                      />
                      <MoneyText size="sm" tone={customer.balance > 0 ? 'due' : 'payment'} align="right">
                        {formatCurrency(customer.balance, currency)}
                      </MoneyText>
                    </>
                  }
                />
              ))}
            </View>
          )}
        </Section>

        <Card accent="primary">
          <View style={styles.accountantText}>
            <Text style={styles.accountantTitle}>Share with accountant</Text>
            <Text style={styles.accountantDescription}>
              Export transactions, invoices, and compliance summaries as JSON or CSV. No direct
              integration is connected yet.
            </Text>
          </View>
          <PrimaryButton
            variant="secondary"
            loading={isSharingAccountant}
            disabled={isSharingAccountant}
            onPress={chooseAccountantExportFormat}
          >
            Share with accountant
          </PrimaryButton>
        </Card>

        <Card accent="tax">
          <View style={styles.accountantText}>
            <Text style={styles.accountantTitle}>Compliance reports</Text>
            <Text style={styles.accountantDescription}>
              Generate tax, sales, and dues summaries, review saved history, and share report files.
            </Text>
          </View>
          <PrimaryButton
            variant="secondary"
            onPress={() => navigation.navigate('ComplianceReports')}
          >
            Open Compliance Reports
          </PrimaryButton>
        </Card>

        <Card compact>
          <Text style={styles.noteText}>
            Reports are calculated fully offline from saved invoices and ledger entries.
          </Text>
        </Card>
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

function TrendRow({
  label,
  trend,
  currency,
}: {
  label: string;
  trend: ReportTrend | undefined;
  currency: string;
}) {
  const current = trend?.current ?? 0;
  const previous = trend?.previous ?? 0;
  const change = trend?.change ?? 0;
  const isUp = change > 0;
  const isDown = change < 0;

  return (
    <View style={styles.trendRow}>
      <View style={styles.trendText}>
        <Text style={styles.trendLabel}>{label}</Text>
        <Text style={styles.trendHelper}>
          Previous {formatCurrency(previous, currency)}
        </Text>
      </View>
      <View style={styles.trendValues}>
        <Text style={styles.trendCurrent}>{formatCurrency(current, currency)}</Text>
        <Text style={isUp ? styles.trendUp : isDown ? styles.trendDown : styles.trendFlat}>
          {isUp ? '+' : ''}
          {formatCurrency(change, currency)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  loadingStack: {
    alignSelf: 'stretch',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 112,
    gap: spacing.xl,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  trendList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trendRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 76,
    padding: spacing.lg,
  },
  trendText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  trendLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  trendHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  trendValues: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 150,
  },
  trendCurrent: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    textAlign: 'right',
  },
  trendUp: {
    color: colors.success,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  trendDown: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  trendFlat: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  customerList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  customerRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 92,
    padding: spacing.lg,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: 8,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rankText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  customerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  customerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  customerMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  balanceDue: {
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 112,
    textAlign: 'right',
  },
  balanceClear: {
    color: colors.success,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 112,
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
  accountantCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  complianceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  accountantText: {
    gap: spacing.xs,
  },
  accountantTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  accountantDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  note: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.lg,
  },
  noteText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
});
