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
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import { TextField } from '../components/TextField';
import {
  buildInventoryReorderAssistantReport,
  shareInventoryReorderExport,
  type InventoryReorderAssistantReport,
  type InventoryReorderExportFormat,
  type InventoryReorderSuggestion,
  type ReorderUrgency,
} from '../inventoryAssistant';
import { normalizeDecimalInput } from '../forms/validation';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type InventoryReorderAssistantScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'InventoryReorderAssistant'
>;

export function InventoryReorderAssistantScreen({
  navigation,
}: InventoryReorderAssistantScreenProps) {
  const [report, setReport] = useState<InventoryReorderAssistantReport | null>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [coverageDays, setCoverageDays] = useState('30');
  const [salesWindowDays, setSalesWindowDays] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharing, setIsSharing] = useState<InventoryReorderExportFormat | null>(null);
  const currency = report?.business.currency ?? 'INR';

  const loadReport = useCallback(async () => {
    const nextReport = await buildInventoryReorderAssistantReport({
      lowStockThreshold: Number(lowStockThreshold || 0),
      coverageDays: Number(coverageDays || 30),
      salesWindowDays: Number(salesWindowDays || 30),
    });
    setReport(nextReport);
  }, [coverageDays, lowStockThreshold, salesWindowDays]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadReport();
        } catch (error) {
          if (isActive) {
            Alert.alert(
              'Reorder assistant could not load',
              error instanceof Error ? error.message : 'Please try again.'
            );
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
    }, [loadReport])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadReport();
    } catch (error) {
      Alert.alert(
        'Refresh failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function shareReport(format: InventoryReorderExportFormat) {
    if (!report) {
      return;
    }

    try {
      setIsSharing(format);
      const saved = await shareInventoryReorderExport({ format, report });
      Alert.alert('Reorder list shared', `${saved.fileName} was saved locally and opened for sharing.`);
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Please try again from this device.'
      );
    } finally {
      setIsSharing(null);
    }
  }

  if (isLoading && !report) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Checking stock movement</Text>
        <View style={styles.loadingStack}>
          <SkeletonCard lines={3} />
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
          title="Reorder Assistant"
          subtitle="Use recent invoice movement and current stock to prepare practical restock decisions."
          backLabel="Back"
          onBack={() => navigation.goBack()}
        />

        {!report ? (
          <EmptyState
            title="Inventory assistant is not available"
            message="Enable invoices and inventory, then add products to see reorder suggestions."
            action={
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                Open Settings
              </PrimaryButton>
            }
          />
        ) : (
          <>
            <Card accent={report.totals.reorderNowCount + report.totals.outOfStockCount > 0 ? 'warning' : 'success'} elevated glass>
              <Text style={styles.eyebrow}>Stock command center</Text>
              <Text style={styles.heroTitle}>
                {report.totals.reorderNowCount + report.totals.outOfStockCount > 0
                  ? 'Restock attention needed'
                  : 'Inventory looks steady'}
              </Text>
              <Text style={styles.heroText}>
                Based on invoices from {formatShortDate(report.window.from)} to {formatShortDate(report.window.to)}.
              </Text>
              <View style={styles.heroChips}>
                <StatusChip
                  label={`${report.window.lowStockThreshold} low-stock line`}
                  tone="warning"
                />
                <StatusChip
                  label={`${report.window.coverageDays} day cover`}
                  tone="primary"
                />
              </View>
            </Card>

            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Reorder now"
                value={`${report.totals.outOfStockCount + report.totals.reorderNowCount}`}
                helper="Out-of-stock and low-stock products."
                tone={report.totals.outOfStockCount + report.totals.reorderNowCount > 0 ? 'due' : 'payment'}
              />
              <SummaryCard
                label="Watch"
                value={`${report.totals.watchCount}`}
                helper="May run low within the coverage window."
                tone={report.totals.watchCount > 0 ? 'primary' : 'payment'}
              />
              <SummaryCard
                label="Active sellers"
                value={`${report.totals.activeSellingProducts}`}
                helper="Products sold through invoices in the window."
                tone="tax"
              />
              <SummaryCard
                label="Estimated reorder"
                value={formatCurrency(report.totals.estimatedReorderCost, currency)}
                helper="Suggested quantity multiplied by saved product price."
                tone="default"
              />
            </View>

            <Section title="Assistant settings" subtitle="Tune the suggestion without changing product records.">
              <Card compact accent="primary">
                <View style={styles.inputGrid}>
                  <View style={styles.inputColumn}>
                    <TextField
                      label="Low-stock line"
                      value={lowStockThreshold}
                      onChangeText={(value) => setLowStockThreshold(normalizeDecimalInput(value))}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      helperText="Products at or below this stock are urgent."
                    />
                  </View>
                  <View style={styles.inputColumn}>
                    <TextField
                      label="Coverage days"
                      value={coverageDays}
                      onChangeText={(value) => setCoverageDays(normalizeDecimalInput(value))}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      helperText="Target stock cover for fast movers."
                    />
                  </View>
                </View>
                <TextField
                  label="Sales window days"
                  value={salesWindowDays}
                  onChangeText={(value) => setSalesWindowDays(normalizeDecimalInput(value))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  helperText="Recent invoice history used to estimate movement."
                />
                <PrimaryButton loading={isRefreshing} onPress={refresh}>
                  Recalculate
                </PrimaryButton>
              </Card>
            </Section>

            <Section title="Practical actions" subtitle="What to do before stock starts slowing invoices.">
              <View style={styles.listShell}>
                {report.actions.map((action) => (
                  <ListRow
                    key={action.id}
                    accent={action.priority === 'high' ? 'warning' : action.priority === 'medium' ? 'primary' : 'neutral'}
                    title={action.title}
                    subtitle={action.message}
                    right={<StatusChip label={action.priority} tone={getPriorityTone(action.priority)} />}
                    onPress={() => navigation.navigate('Products')}
                  />
                ))}
              </View>
            </Section>

            <Section title="Reorder list" subtitle="Items are sorted by urgency first.">
              {report.suggestions.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  message="Add products so Orbit Ledger can watch stock movement from invoices."
                  action={
                    <PrimaryButton variant="secondary" onPress={() => navigation.navigate('Products')}>
                      Add Products
                    </PrimaryButton>
                  }
                />
              ) : (
                <View style={styles.listShell}>
                  {report.suggestions.map((item) => (
                    <ListRow
                      key={item.product.id}
                      accent={getUrgencyAccent(item.urgency)}
                      title={item.product.name}
                      subtitle={item.reason}
                      meta={buildItemMeta(item)}
                      right={
                        <View style={styles.reorderRight}>
                          <StatusChip label={item.urgencyLabel} tone={getUrgencyTone(item.urgency)} />
                          {item.suggestedReorderQuantity > 0 ? (
                            <Text style={styles.reorderQty}>
                              Buy {formatQuantity(item.suggestedReorderQuantity)} {item.unit}
                            </Text>
                          ) : (
                            <Text style={styles.reorderQty}>No buy needed</Text>
                          )}
                          <MoneyText size="sm" align="right">
                            {formatCurrency(item.estimatedReorderCost, currency)}
                          </MoneyText>
                        </View>
                      }
                      onPress={() => navigation.navigate('Products')}
                    />
                  ))}
                </View>
              )}
            </Section>

            <Card accent="success">
              <Text style={styles.exportTitle}>Export reorder list</Text>
              <Text style={styles.exportText}>
                Save this reorder assistant result locally and share it with purchasing or suppliers.
              </Text>
              <View style={styles.exportActions}>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="secondary"
                  loading={isSharing === 'csv'}
                  disabled={Boolean(isSharing)}
                  onPress={() => void shareReport('csv')}
                >
                  Share CSV
                </PrimaryButton>
                <PrimaryButton
                  style={styles.exportButton}
                  variant="ghost"
                  loading={isSharing === 'json'}
                  disabled={Boolean(isSharing)}
                  onPress={() => void shareReport('json')}
                >
                  Share JSON
                </PrimaryButton>
              </View>
            </Card>
          </>
        )}
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

function getUrgencyAccent(
  urgency: ReorderUrgency
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (urgency === 'out_of_stock') {
    return 'danger';
  }

  if (urgency === 'reorder_now') {
    return 'warning';
  }

  if (urgency === 'watch') {
    return 'primary';
  }

  return 'success';
}

function getUrgencyTone(
  urgency: ReorderUrgency
): 'success' | 'warning' | 'danger' | 'primary' | 'neutral' {
  return getUrgencyAccent(urgency);
}

function getPriorityTone(priority: 'high' | 'medium' | 'low'): 'warning' | 'primary' | 'neutral' {
  if (priority === 'high') {
    return 'warning';
  }

  if (priority === 'medium') {
    return 'primary';
  }

  return 'neutral';
}

function buildItemMeta(item: InventoryReorderSuggestion): string {
  const sold = `Sold ${formatQuantity(item.quantitySoldInWindow)} ${item.unit}`;
  const stock = `Stock ${formatQuantity(item.currentStock)} ${item.unit}`;
  const daysLeft =
    item.projectedDaysLeft === null ? 'days left unknown' : `${item.projectedDaysLeft} days left`;
  const lastSold = item.lastSoldAt ? `last sold ${formatShortDate(item.lastSoldAt)}` : 'no recent sale';

  return `${stock} · ${sold} · ${daysLeft} · ${lastSold}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
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
    padding: spacing.xl,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '800',
  },
  loadingStack: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: 112,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  inputColumn: {
    flexBasis: 150,
    flexGrow: 1,
  },
  listShell: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  reorderRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  reorderQty: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '900',
    textAlign: 'right',
  },
  exportTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  exportText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  exportActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exportButton: {
    flexBasis: 150,
    flexGrow: 1,
  },
});
