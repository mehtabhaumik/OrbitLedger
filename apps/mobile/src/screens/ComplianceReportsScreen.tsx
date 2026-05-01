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

import {
  generateComplianceReport,
  parseComplianceReportData,
  shareComplianceReportExport,
  type ComplianceReportData,
  type ComplianceReportExportFormat,
  type ComplianceSalesSummaryData,
  type ComplianceTaxSummaryData,
} from '../compliance';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FounderFooterLink } from '../components/FounderFooterLink';
import { ListRow } from '../components/ListRow';
import { PrimaryButton } from '../components/PrimaryButton';
import { Section } from '../components/Section';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusChip } from '../components/StatusChip';
import { SummaryCard } from '../components/SummaryCard';
import { getBusinessSettings, listComplianceReports } from '../database';
import type { BusinessSettings, ComplianceReport, ComplianceReportType } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type ComplianceReportsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ComplianceReports'
>;

type ParsedComplianceReport = {
  report: ComplianceReport;
  data: ComplianceReportData;
};

const reportActions: Array<{
  type: ComplianceReportType;
  title: string;
  description: string;
}> = [
  {
    type: 'tax_summary',
    title: 'Tax summary',
    description: 'Summarize taxable sales, tax amount, and tax rate rows from invoices.',
  },
  {
    type: 'sales_summary',
    title: 'Sales summary',
    description: 'Summarize invoice sales by total and invoice status.',
  },
  {
    type: 'dues_summary',
    title: 'Dues summary',
    description: 'Summarize current receivables, advances, and top outstanding customers.',
  },
];

export function ComplianceReportsScreen({ navigation }: ComplianceReportsScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [reports, setReports] = useState<ParsedComplianceReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generatingType, setGeneratingType] = useState<ComplianceReportType | null>(null);
  const [sharingFormat, setSharingFormat] = useState<ComplianceReportExportFormat | null>(null);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);

  const selectedReport = useMemo(() => {
    if (!reports.length) {
      return null;
    }

    return reports.find((item) => item.report.id === selectedReportId) ?? reports[0];
  }, [reports, selectedReportId]);

  const loadReports = useCallback(async () => {
    const settings = await getBusinessSettings();
    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    const savedReports = await listComplianceReports({
      countryCode: settings.countryCode,
      limit: 50,
    });
    const parsedReports: ParsedComplianceReport[] = [];

    for (const report of savedReports) {
      try {
        parsedReports.push({
          report,
          data: parseComplianceReportData(report),
        });
      } catch {
        setLoadWarning('Some older compliance reports could not be opened and were skipped.');
      }
    }

    setBusiness(settings);
    setReports(parsedReports);
    setSelectedReportId((currentId) => {
      if (currentId && parsedReports.some((item) => item.report.id === currentId)) {
        return currentId;
      }

      return parsedReports[0]?.report.id ?? null;
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          setLoadWarning(null);
          await loadReports();
        } catch {
          if (isActive) {
            Alert.alert('Compliance reports could not load', 'Please try again.');
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
      setLoadWarning(null);
      await loadReports();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function generateReport(reportType: ComplianceReportType) {
    try {
      setGeneratingType(reportType);
      const generated = await generateComplianceReport({ reportType });
      await loadReports();

      if (generated.savedReport) {
        setSelectedReportId(generated.savedReport.id);
      }

      Alert.alert('Compliance report generated', 'The report was saved for review.');
    } catch {
      Alert.alert('Report could not be generated', 'Please check your saved data and try again.');
    } finally {
      setGeneratingType(null);
    }
  }

  async function shareSelectedReport(format: ComplianceReportExportFormat) {
    if (!business || !selectedReport) {
      return;
    }

    try {
      setSharingFormat(format);
      const exported = await shareComplianceReportExport({
        business,
        format,
        report: selectedReport.report,
      });
      Alert.alert('Report shared', `${exported.fileName} was saved and opened for sharing.`);
    } catch {
      Alert.alert(
        'Report could not be shared',
        'Orbit Ledger could not prepare this compliance report export. Please try again.'
      );
    } finally {
      setSharingFormat(null);
    }
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading compliance reports</Text>
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
          title="Compliance Reports"
          subtitle="Generate and share structured summaries from your business data."
          backLabel="Reports"
          onBack={() => navigation.goBack()}
        />

        <Card glass elevated accent="tax">
          <Text style={styles.contextTitle}>Country-aware setup</Text>
          <Text style={styles.contextText}>
            {business
              ? `${business.countryCode} / ${business.stateCode || 'All regions'} - ${business.currency}`
              : 'Business profile not loaded'}
          </Text>
          <Text style={styles.contextHelper}>
            Reports use the active country package when one is installed. These summaries are for
            review and export preparation, not legal filing.
          </Text>
        </Card>

        {loadWarning ? (
          <Card compact accent="warning">
            <Text style={styles.warningText}>{loadWarning}</Text>
          </Card>
        ) : null}

        <Section title="Generate Report" subtitle="Create structured summaries for review or accountant export.">
          {reportActions.map((action) => (
            <Card key={action.type} compact accent={action.type === 'tax_summary' ? 'tax' : action.type === 'sales_summary' ? 'success' : 'warning'}>
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
              <PrimaryButton
                loading={generatingType === action.type}
                disabled={Boolean(generatingType)}
                onPress={() => void generateReport(action.type)}
                variant="secondary"
              >
                Generate
              </PrimaryButton>
            </Card>
          ))}
        </Section>

        <Section title="Review Selected Report" subtitle="Check the country context before sharing.">
          {selectedReport ? (
            <ReportReviewCard
              business={business}
              parsedReport={selectedReport}
              sharingFormat={sharingFormat}
              onShare={shareSelectedReport}
            />
          ) : (
            <EmptyState
              title="No compliance reports yet"
              message="Generate a tax, sales, or dues summary to review and export it here."
            />
          )}
        </Section>

        <Section title="Report History" subtitle="Recently saved summaries.">
          {!reports.length ? (
            <EmptyState
              title="No saved report history"
              message="Your generated review summaries will appear here."
            />
          ) : (
            <View style={styles.historyList}>
              {reports.map((item) => (
                <ListRow
                  key={item.report.id}
                  onPress={() => setSelectedReportId(item.report.id)}
                  selected={selectedReport?.report.id === item.report.id}
                  accent={item.report.reportType === 'tax_summary' ? 'tax' : item.report.reportType === 'sales_summary' ? 'success' : 'warning'}
                  title={formatReportType(item.report.reportType)}
                  subtitle={`${formatLongDate(item.report.generatedAt)} - ${item.report.countryCode}`}
                  right={<StatusChip label="Open" tone={selectedReport?.report.id === item.report.id ? 'primary' : 'neutral'} />}
                />
              ))}
            </View>
          )}
        </Section>

        <FounderFooterLink />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportReviewCard({
  business,
  onShare,
  parsedReport,
  sharingFormat,
}: {
  business: BusinessSettings | null;
  onShare: (format: ComplianceReportExportFormat) => Promise<void>;
  parsedReport: ParsedComplianceReport;
  sharingFormat: ComplianceReportExportFormat | null;
}) {
  const { data, report } = parsedReport;
  const currency = data.metadata.currency || business?.currency || 'INR';
  const locale = data.metadata.numberFormat.locale ?? undefined;
  const currencyDisplay = data.metadata.numberFormat.currencyDisplay;

  return (
    <Card accent="tax" style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewHeaderCopy}>
          <Text style={styles.reviewLabel}>{formatReportType(report.reportType)}</Text>
          <Text style={styles.reviewTitle}>{formatLongDate(report.generatedAt)}</Text>
        </View>
        <StatusChip label={report.countryCode} tone="tax" />
      </View>

      <View style={styles.detailList}>
        <DetailRow label="Country / region" value={`${data.metadata.countryCode} / ${data.metadata.regionCode || 'All regions'}`} />
        <DetailRow
          label="Tax setup"
          value={
            data.metadata.taxPack
              ? `${data.metadata.taxPack.taxType} v${data.metadata.taxPack.version}`
              : 'Default setup'
          }
        />
        <DetailRow
          label="Compliance config"
          value={
            data.metadata.complianceConfig
              ? `v${data.metadata.complianceConfig.version}`
              : 'Default rules'
          }
        />
      </View>

      <View style={styles.totalsGrid}>
        {renderTotals(data, currency, locale, currencyDisplay)}
      </View>

      {renderBreakdown(data, currency, locale, currencyDisplay)}

      <Text style={styles.scopeNote}>{data.metadata.scopeNote}</Text>

      <View style={styles.exportActions}>
        <PrimaryButton
          loading={sharingFormat === 'json'}
          disabled={Boolean(sharingFormat)}
          onPress={() => void onShare('json')}
        >
          Share JSON
        </PrimaryButton>
        <PrimaryButton
          loading={sharingFormat === 'csv'}
          disabled={Boolean(sharingFormat)}
          onPress={() => void onShare('csv')}
          variant="secondary"
        >
          Share CSV
        </PrimaryButton>
      </View>
    </Card>
  );
}

function renderTotals(
  data: ComplianceReportData,
  currency: string,
  locale: string | undefined,
  currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name'
) {
  if (isTaxSummary(data)) {
    return (
      <>
        <MetricCard label="Invoices" value={`${data.totals.invoiceCount}`} />
        <MetricCard label={data.metadata.labels.taxableSales} value={formatCurrency(data.totals.taxableSales, currency, { locale, currencyDisplay })} />
        <MetricCard label={data.metadata.labels.taxAmount} value={formatCurrency(data.totals.taxAmount, currency, { locale, currencyDisplay })} />
        <MetricCard label={data.metadata.labels.totalAmount} value={formatCurrency(data.totals.totalAmount, currency, { locale, currencyDisplay })} />
      </>
    );
  }

  if (isSalesSummary(data)) {
    return (
      <>
        <MetricCard label="Invoices" value={`${data.totals.invoiceCount}`} />
        <MetricCard label="Subtotal" value={formatCurrency(data.totals.subtotal, currency, { locale, currencyDisplay })} />
        <MetricCard label={data.metadata.labels.taxAmount} value={formatCurrency(data.totals.taxAmount, currency, { locale, currencyDisplay })} />
        <MetricCard label={data.metadata.labels.totalAmount} value={formatCurrency(data.totals.totalAmount, currency, { locale, currencyDisplay })} />
      </>
    );
  }

  return (
    <>
      <MetricCard label="Active customers" value={`${data.totals.activeCustomers}`} />
      <MetricCard label="Customers with dues" value={`${data.totals.customersWithDues}`} />
      <MetricCard label="Receivable" value={formatCurrency(data.totals.totalReceivable, currency, { locale, currencyDisplay })} />
      <MetricCard label="Net balance" value={formatCurrency(data.totals.netBalance, currency, { locale, currencyDisplay })} />
    </>
  );
}

function renderBreakdown(
  data: ComplianceReportData,
  currency: string,
  locale: string | undefined,
  currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name'
) {
  if (isTaxSummary(data)) {
    return (
      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>Tax by rate</Text>
        {!data.taxByRate.length ? (
          <Text style={styles.emptyText}>No invoice tax rows in this report.</Text>
        ) : (
          data.taxByRate.map((row) => (
            <DetailRow
              key={`${row.taxRate}-${row.itemCount}`}
              label={`${row.taxRate}% - ${row.itemCount} items`}
              value={formatCurrency(row.taxAmount, currency, { locale, currencyDisplay })}
            />
          ))
        )}
      </View>
    );
  }

  if (isSalesSummary(data)) {
    return (
      <View style={styles.breakdown}>
        <Text style={styles.breakdownTitle}>Sales by status</Text>
        {!data.byStatus.length ? (
          <Text style={styles.emptyText}>No invoice status rows in this report.</Text>
        ) : (
          data.byStatus.map((row) => (
            <DetailRow
              key={row.status}
              label={`${row.status} - ${row.invoiceCount} invoices`}
              value={formatCurrency(row.totalAmount, currency, { locale, currencyDisplay })}
            />
          ))
        )}
      </View>
    );
  }

  return (
    <View style={styles.breakdown}>
      <Text style={styles.breakdownTitle}>Top outstanding customers</Text>
      {!data.topOutstandingCustomers.length ? (
        <Text style={styles.emptyText}>No outstanding customers in this report.</Text>
      ) : (
        data.topOutstandingCustomers.map((row) => (
          <DetailRow
            key={row.customerId}
            label={`${row.name} - ${formatShortDate(row.latestActivityAt)}`}
            value={formatCurrency(row.balance, currency, { locale, currencyDisplay })}
          />
        ))
      )}
    </View>
  );
}

function isTaxSummary(data: ComplianceReportData): data is ComplianceTaxSummaryData {
  return data.metadata.reportType === 'tax_summary';
}

function isSalesSummary(data: ComplianceReportData): data is ComplianceSalesSummaryData {
  return data.metadata.reportType === 'sales_summary';
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <SummaryCard label={label} value={value} tone="tax" />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatReportType(reportType: ComplianceReportType): string {
  if (reportType === 'tax_summary') {
    return 'Tax summary';
  }

  if (reportType === 'sales_summary') {
    return 'Sales summary';
  }

  return 'Dues summary';
}

function formatLongDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  contextCard: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  contextTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  contextText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  contextHelper: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  warningText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
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
  actionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  actionDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
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
  reviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  reviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  reviewHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  reviewLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  reviewTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  reportPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reportPillText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  detailList: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 86,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  breakdown: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  breakdownTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scopeNote: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  exportActions: {
    gap: spacing.md,
  },
  historyList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.lg,
  },
  historyRowSelected: {
    backgroundColor: colors.primarySurface,
  },
  historyRowPressed: {
    opacity: 0.82,
  },
  historyCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  historyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  historyAction: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
});
