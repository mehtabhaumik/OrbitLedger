import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordStatementGeneratedForBackupNudge } from '../backup';
import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { DateInput } from '../components/DateInput';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { getBusinessSettings, searchCustomerSummaries } from '../database';
import type { BusinessSettings, CustomerSummary } from '../database';
import { getGeneratedDocumentHistory, shareGeneratedPdf } from '../documents';
import type { DocumentDateRange, GeneratedDocumentHistoryEntry } from '../documents';
import { normalizeDecimalInput } from '../forms/validation';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  buildStatementBatchPreview,
  buildStatementBatchRange,
  generateStatementBatch,
  type StatementBatchGenerationResult,
  type StatementBatchPreview,
  type StatementBatchRangeKey,
  type StatementBatchSelectionMode,
} from '../statementBatch';
import { colors, spacing, touch, typography } from '../theme/theme';

type StatementBatchScreenProps = NativeStackScreenProps<RootStackParamList, 'StatementBatch'>;

const selectionModes: Array<{
  key: StatementBatchSelectionMode;
  label: string;
  description: string;
}> = [
  {
    key: 'all_outstanding',
    label: 'Outstanding',
    description: 'Customers with positive balances.',
  },
  {
    key: 'activity_in_range',
    label: 'Activity',
    description: 'Customers with entries in the range.',
  },
  {
    key: 'balance_above_threshold',
    label: 'Threshold',
    description: 'Customers above a balance amount.',
  },
  {
    key: 'selected_customers',
    label: 'Selected',
    description: 'Choose customers manually.',
  },
];

export function StatementBatchScreen({ navigation }: StatementBatchScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [rangeKey, setRangeKey] = useState<StatementBatchRangeKey>('this_month');
  const [dateRange, setDateRange] = useState<DocumentDateRange>(() =>
    buildStatementBatchRange('this_month')
  );
  const [selectionMode, setSelectionMode] = useState<StatementBatchSelectionMode>('all_outstanding');
  const [balanceThreshold, setBalanceThreshold] = useState('1000');
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<StatementBatchPreview | null>(null);
  const [results, setResults] = useState<StatementBatchGenerationResult[]>([]);
  const [history, setHistory] = useState<GeneratedDocumentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharingCustomerId, setSharingCustomerId] = useState<string | null>(null);
  const currency = business?.currency ?? 'INR';
  const selectedCustomerSet = useMemo(() => new Set(selectedCustomerIds), [selectedCustomerIds]);

  const load = useCallback(async () => {
    const [settings, customerRows] = await Promise.all([
      getBusinessSettings(),
      searchCustomerSummaries({ limit: 200 }),
    ]);

    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    setBusiness(settings);
    setCustomers(customerRows);
    setHistory(
      getGeneratedDocumentHistory().filter((entry) => entry.documentKind === 'customer_statement')
    );
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadScreen() {
        try {
          setIsLoading(true);
          await load();
        } catch {
          if (isActive) {
            Alert.alert('Statement batch could not load', 'Please try again.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void loadScreen();

      return () => {
        isActive = false;
      };
    }, [load])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await load();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function applyRange(key: StatementBatchRangeKey) {
    setRangeKey(key);
    setPreview(null);
    setResults([]);
    if (key !== 'custom') {
      setDateRange(buildStatementBatchRange(key));
    }
  }

  async function buildPreview() {
    try {
      setIsPreviewing(true);
      setResults([]);
      const nextPreview = await buildStatementBatchPreview({
        dateRange,
        selectionMode,
        selectedCustomerIds,
        balanceThreshold: selectionMode === 'balance_above_threshold' ? Number(balanceThreshold || 0) : undefined,
      });
      setPreview(nextPreview);
    } catch {
      Alert.alert('Preview could not be prepared', 'Please check the range and selection details.');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function generateBatch() {
    if (!preview || preview.readyCount === 0) {
      return;
    }

    try {
      setIsGenerating(true);
      setResults(
        preview.candidates.map((candidate) => ({
          customerId: candidate.customer.id,
          customerName: candidate.customer.name,
          status: candidate.status === 'ready' ? 'pending' : 'skipped',
          message: candidate.skipReason ?? 'Ready to generate.',
        }))
      );
      const summary = await generateStatementBatch(preview, (result) => {
        setResults((current) => upsertResult(current, result));
      });
      await recordStatementGeneratedForBackupNudge();
      setResults(summary.results);
      setHistory(
        getGeneratedDocumentHistory().filter((entry) => entry.documentKind === 'customer_statement')
      );
      Alert.alert(
        'Batch complete',
        `${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed.`
      );
    } catch {
      Alert.alert('Batch could not run', 'Please try again from this device.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function shareGenerated(result: StatementBatchGenerationResult) {
    if (!result.savedPdf) {
      return;
    }

    try {
      setSharingCustomerId(result.customerId);
      await shareGeneratedPdf(result.savedPdf, result.savedPdf.fileName);
    } catch {
      Alert.alert('Statement could not be shared', 'Please try again.');
    } finally {
      setSharingCustomerId(null);
    }
  }

  function toggleCustomer(customerId: string) {
    setPreview(null);
    setResults([]);
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    );
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing statement batch</Text>
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
          title="Statement Batch"
          subtitle="Generate month-end or custom range statements for multiple customers."
          backLabel="Reports"
          onBack={() => navigation.goBack()}
        />

        <Card accent="primary" elevated glass>
          <Text style={styles.eyebrow}>Batch range</Text>
          <Text style={styles.heroTitle}>
            {formatShortDate(dateRange.from)} to {formatShortDate(dateRange.to)}
          </Text>
          <View style={styles.filterRow}>
            <FilterButton label="This month" selected={rangeKey === 'this_month'} onPress={() => applyRange('this_month')} />
            <FilterButton label="Last month" selected={rangeKey === 'last_month'} onPress={() => applyRange('last_month')} />
            <FilterButton label="Custom" selected={rangeKey === 'custom'} onPress={() => applyRange('custom')} />
          </View>
          {rangeKey === 'custom' ? (
            <View style={styles.dateGrid}>
              <DateInput
                label="From"
                value={dateRange.from}
                onChange={(value) => {
                  setPreview(null);
                  setResults([]);
                  setDateRange((current) => ({ ...current, from: value }));
                }}
                maximumDate={new Date()}
              />
              <DateInput
                label="To"
                value={dateRange.to}
                onChange={(value) => {
                  setPreview(null);
                  setResults([]);
                  setDateRange((current) => ({ ...current, to: value }));
                }}
                maximumDate={new Date()}
              />
            </View>
          ) : null}
        </Card>

        <Section title="Customer selection" subtitle="Choose who should receive statements.">
          <View style={styles.modeGrid}>
            {selectionModes.map((mode) => (
              <Pressable
                accessibilityRole="button"
                hitSlop={touch.hitSlop}
                key={mode.key}
                onPress={() => {
                  setSelectionMode(mode.key);
                  setPreview(null);
                  setResults([]);
                }}
                pressRetentionOffset={touch.pressRetentionOffset}
                style={[
                  styles.modeCard,
                  selectionMode === mode.key ? styles.modeCardSelected : null,
                ]}
              >
                <Text style={[styles.modeTitle, selectionMode === mode.key ? styles.modeTitleSelected : null]}>
                  {mode.label}
                </Text>
                <Text style={styles.modeDescription}>{mode.description}</Text>
              </Pressable>
            ))}
          </View>

          {selectionMode === 'balance_above_threshold' ? (
            <TextField
              label="Minimum balance"
              value={balanceThreshold}
              onChangeText={(value) => {
                setPreview(null);
                setResults([]);
                setBalanceThreshold(normalizeDecimalInput(value));
              }}
              keyboardType="decimal-pad"
              inputMode="decimal"
              helperText="Only customers with balances at or above this amount are included."
            />
          ) : null}

          {selectionMode === 'selected_customers' ? (
            <View style={styles.listShell}>
              {customers.slice(0, 60).map((customer) => {
                const selected = selectedCustomerSet.has(customer.id);
                return (
                  <ListRow
                    key={customer.id}
                    accent={selected ? 'primary' : customer.balance > 0 ? 'warning' : 'neutral'}
                    selected={selected}
                    title={customer.name}
                    subtitle={customer.phone ?? 'No phone saved'}
                    meta={`Balance ${formatCurrency(customer.balance, currency)}`}
                    right={<StatusChip label={selected ? 'Selected' : 'Tap'} tone={selected ? 'primary' : 'neutral'} />}
                    onPress={() => toggleCustomer(customer.id)}
                  />
                );
              })}
            </View>
          ) : null}
        </Section>

        <Card accent="primary">
          <Text style={styles.previewTitle}>Batch preview</Text>
          <Text style={styles.previewText}>
            Review the customer count and included receivable before generating PDFs.
          </Text>
          <PrimaryButton loading={isPreviewing} disabled={isGenerating} onPress={buildPreview}>
            Preview Batch
          </PrimaryButton>
        </Card>

        {preview ? (
          <>
            <View style={styles.summaryGrid}>
              <SummaryPill label="Customers" value={`${preview.candidates.length}`} tone="neutral" />
              <SummaryPill label="Ready" value={`${preview.readyCount}`} tone="success" />
              <SummaryPill label="Skipped" value={`${preview.skippedCount}`} tone="neutral" />
              <SummaryPill
                label="Receivable"
                value={formatCurrency(preview.totalReceivableIncluded, currency)}
                tone="warning"
              />
            </View>

            <Section title="Preview customers" subtitle="Only ready customers will generate PDFs.">
              <View style={styles.listShell}>
                {preview.candidates.length === 0 ? (
                  <EmptyState
                    title="No customers found"
                    message="Change the selection mode or range to include customers."
                  />
                ) : (
                  preview.candidates.map((candidate) => (
                    <ListRow
                      key={candidate.customer.id}
                      accent={candidate.status === 'ready' ? 'primary' : 'neutral'}
                      title={candidate.customer.name}
                      subtitle={candidate.reason}
                      meta={candidate.skipReason ?? `${candidate.transactionCountInRange} entries in range`}
                      right={
                        <StatusChip
                          label={candidate.status === 'ready' ? 'Ready' : 'Skipped'}
                          tone={candidate.status === 'ready' ? 'success' : 'neutral'}
                        />
                      }
                      onPress={() => navigation.navigate('CustomerDetail', { customerId: candidate.customer.id })}
                    />
                  ))
                )}
              </View>
            </Section>

            <Card accent="success">
              <Text style={styles.previewTitle}>Generate PDFs</Text>
              <Text style={styles.previewText}>
                Statement PDFs are saved locally one customer at a time. Failed customers stay visible.
              </Text>
              <PrimaryButton
                loading={isGenerating}
                disabled={isPreviewing || preview.readyCount === 0}
                onPress={generateBatch}
              >
                Generate {preview.readyCount} Statements
              </PrimaryButton>
            </Card>
          </>
        ) : null}

        {results.length > 0 ? (
          <Section title="Generation status" subtitle="Share generated statements individually.">
            <View style={styles.listShell}>
              {results.map((result) => (
                <ListRow
                  key={result.customerId}
                  accent={getResultAccent(result.status)}
                  title={result.customerName}
                  subtitle={result.message}
                  meta={result.fileName}
                  right={
                    result.status === 'generated' && result.savedPdf ? (
                      <PrimaryButton
                        variant="secondary"
                        loading={sharingCustomerId === result.customerId}
                        disabled={Boolean(sharingCustomerId)}
                        onPress={() => void shareGenerated(result)}
                      >
                        Share
                      </PrimaryButton>
                    ) : (
                      <StatusChip label={result.status} tone={getResultAccent(result.status)} />
                    )
                  }
                  onPress={() => navigation.navigate('CustomerDetail', { customerId: result.customerId })}
                />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Recent statement files" subtitle="Recent saved customer statement PDFs on this device.">
          {history.length === 0 ? (
            <EmptyState
              title="No statement batches yet"
              message="Generated statement files will appear here after you save or batch-generate PDFs."
            />
          ) : (
            <View style={styles.listShell}>
              {history.slice(0, 8).map((entry) => (
                <ListRow
                  key={entry.id}
                  accent="primary"
                  title={entry.customerName}
                  subtitle={entry.fileName}
                  meta={`Saved ${formatShortDate(entry.createdAt)} · ${entry.numberOfPages} pages`}
                />
              ))}
            </View>
          )}
        </Section>
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

function FilterButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={({ pressed }) => [
        styles.filterButton,
        selected ? styles.filterButtonSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <StatusChip label={value} tone={tone} />
    </View>
  );
}

function upsertResult(
  current: StatementBatchGenerationResult[],
  result: StatementBatchGenerationResult
): StatementBatchGenerationResult[] {
  const existingIndex = current.findIndex((item) => item.customerId === result.customerId);
  if (existingIndex === -1) {
    return [...current, result];
  }

  return current.map((item, index) => (index === existingIndex ? result : item));
}

function getResultAccent(
  status: StatementBatchGenerationResult['status']
): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'generated') {
    return 'success';
  }

  if (status === 'failed') {
    return 'danger';
  }

  if (status === 'generating') {
    return 'primary';
  }

  if (status === 'pending') {
    return 'warning';
  }

  return 'neutral';
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
    padding: spacing.lg,
    paddingBottom: 112,
    gap: spacing.xl,
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filterButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  pressed: {
    opacity: 0.82,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '900',
  },
  filterTextSelected: {
    color: colors.primary,
  },
  dateGrid: {
    gap: spacing.md,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  modeCard: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 88,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  modeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  modeTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  modeTitleSelected: {
    color: colors.primary,
  },
  modeDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  listShell: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  previewTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  previewText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryPill: {
    flexGrow: 1,
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
});
