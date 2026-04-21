import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusChip } from '../components/StatusChip';
import { seedDevelopmentData, seedPerformanceData } from '../database';
import type { PerformanceSeedSize } from '../database';
import type { RootStackParamList } from '../navigation/types';
import {
  buildPerformanceReport,
  clearPerformanceMeasurements,
  sharePerformanceReport,
} from '../performance';
import type { PerformanceOperationSummary, PerformanceReport } from '../performance';
import { runNativeRuntimeReadinessChecks } from '../runtimeQA';
import type { RuntimeQACheckResult, RuntimeQACheckStatus } from '../runtimeQA';
import { colors, spacing, typography } from '../theme/theme';

type RuntimeQAScreenProps = NativeStackScreenProps<RootStackParamList, 'RuntimeQA'>;

export function RuntimeQAScreen({ navigation }: RuntimeQAScreenProps) {
  const [checks, setChecks] = useState<RuntimeQACheckResult[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);
  const [isSeedingPerformanceData, setIsSeedingPerformanceData] = useState(false);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [isSharingPerformanceReport, setIsSharingPerformanceReport] = useState(false);
  const summary = useMemo(() => buildSummary(checks), [checks]);
  const performanceSummary = useMemo(
    () => buildPerformanceSummary(performanceReport),
    [performanceReport]
  );

  async function runChecks() {
    if (!__DEV__ || isRunningChecks) {
      return;
    }

    setIsRunningChecks(true);
    try {
      setChecks(await runNativeRuntimeReadinessChecks());
      refreshPerformanceReport();
    } finally {
      setIsRunningChecks(false);
    }
  }

  function refreshPerformanceReport() {
    if (!__DEV__) {
      return;
    }

    setPerformanceReport(buildPerformanceReport());
  }

  function clearPerformanceReport() {
    if (!__DEV__) {
      return;
    }

    clearPerformanceMeasurements();
    setPerformanceReport(buildPerformanceReport());
  }

  async function exportPerformanceReport() {
    if (!__DEV__ || isSharingPerformanceReport) {
      return;
    }

    setIsSharingPerformanceReport(true);
    try {
      const savedReport = await sharePerformanceReport();
      setPerformanceReport(savedReport.report);
      Alert.alert(
        'Performance report saved',
        `${savedReport.fileName} is saved locally on this device.`
      );
    } catch (error) {
      console.warn('[performance] Performance report could not be exported', error);
      Alert.alert('Performance report could not be exported', 'Check the development logs and try again.');
    } finally {
      setIsSharingPerformanceReport(false);
    }
  }

  function confirmSeedDemoData() {
    if (!__DEV__) {
      return;
    }

    Alert.alert(
      'Seed demo data?',
      'This development-only action adds sample customers, ledger entries, a business profile, and a local tax profile where missing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Demo Data',
          onPress: () => {
            void seedDemoData();
          },
        },
      ]
    );
  }

  async function seedDemoData() {
    if (!__DEV__ || isSeedingData) {
      return;
    }

    setIsSeedingData(true);
    try {
      await seedDevelopmentData();
      Alert.alert('Demo data ready', 'Development seed data is available on this device.');
    } catch (error) {
      console.warn('[runtime-qa] Demo data could not be seeded', error);
      Alert.alert('Demo data could not be seeded', 'Check the development logs and try again.');
    } finally {
      setIsSeedingData(false);
    }
  }

  function confirmSeedPerformanceData(size: PerformanceSeedSize) {
    if (!__DEV__) {
      return;
    }

    const isHeavy = size === 'heavy';
    Alert.alert(
      isHeavy ? 'Seed heavy performance dataset?' : 'Seed standard performance dataset?',
      isHeavy
        ? 'This development-only action prepares about 1,000 customers and 20,000 ledger entries for heavy local performance testing. Existing records are preserved.'
        : 'This development-only action prepares about 100 customers and 1,000 ledger entries for local performance testing. Existing records are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isHeavy ? 'Seed Heavy Data' : 'Seed Standard Data',
          onPress: () => {
            void seedLargePerformanceData(size);
          },
        },
      ]
    );
  }

  async function seedLargePerformanceData(size: PerformanceSeedSize) {
    if (!__DEV__ || isSeedingPerformanceData) {
      return;
    }

    setIsSeedingPerformanceData(true);
    try {
      await seedPerformanceData(size);
      Alert.alert(
        'Performance data ready',
        size === 'heavy'
          ? 'Heavy local seed data is available for release-style performance checks.'
          : 'Standard local seed data is available for list, ledger, invoice, and product performance checks.'
      );
    } catch (error) {
      console.warn('[runtime-qa] Performance data could not be seeded', error);
      Alert.alert('Performance data could not be seeded', 'Check the development logs and try again.');
    } finally {
      setIsSeedingPerformanceData(false);
    }
  }

  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.unavailable}>
          <Text style={styles.title}>Runtime QA is not available</Text>
          <Text style={styles.body}>This screen is hidden in production builds.</Text>
          <PrimaryButton onPress={() => navigation.goBack()}>Go Back</PrimaryButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Runtime QA"
          subtitle="Development-only checks for native app verification."
          backLabel="Settings"
          onBack={() => navigation.goBack()}
        />

        <Card accent={summary.tone}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryText}>
              <Text style={styles.cardTitle}>Native readiness</Text>
              <Text style={styles.body}>{summary.message}</Text>
            </View>
            <StatusChip label={summary.label} tone={summary.tone} />
          </View>
          <Text style={styles.meta}>
            Run this on an Android/iOS development build for the most meaningful result. Expo Go
            can validate most UI flows, but native billing and some plugin paths need a dev client
            or release-style build.
          </Text>
          <PrimaryButton loading={isRunningChecks} onPress={() => void runChecks()}>
            Run Native Checks
          </PrimaryButton>
        </Card>

        <Card accent="primary">
          <Text style={styles.cardTitle}>QA data setup</Text>
          <Text style={styles.body}>
            Add safe demo records for simulator testing. Existing customer data is preserved; this
            seed only fills missing demo basics.
          </Text>
          <PrimaryButton
            variant="secondary"
            loading={isSeedingData}
            disabled={isRunningChecks}
            onPress={confirmSeedDemoData}
          >
            Seed Demo Data
          </PrimaryButton>
          <Text style={styles.meta}>
            Need load testing? Add standard data first. Use heavy data only on a stable emulator or
            device because it creates a much larger local SQLite dataset.
          </Text>
          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <PrimaryButton
                variant="ghost"
                loading={isSeedingPerformanceData}
                disabled={isRunningChecks || isSeedingData}
                onPress={() => confirmSeedPerformanceData('standard')}
              >
                Seed 100 / 1,000
              </PrimaryButton>
            </View>
            <View style={styles.actionButton}>
              <PrimaryButton
                variant="secondary"
                loading={isSeedingPerformanceData}
                disabled={isRunningChecks || isSeedingData}
                onPress={() => confirmSeedPerformanceData('heavy')}
              >
                Seed 1,000 / 20,000
              </PrimaryButton>
            </View>
          </View>
        </Card>

        <Card accent={performanceSummary.tone}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryText}>
              <Text style={styles.cardTitle}>Performance baseline</Text>
              <Text style={styles.body}>{performanceSummary.message}</Text>
            </View>
            <StatusChip label={performanceSummary.label} tone={performanceSummary.tone} />
          </View>
          <Text style={styles.meta}>
            Development-only timings are captured for startup, SQLite, dashboard, customer search,
            ledgers, transaction saves, invoice saves, PDFs, backups, and restores. Production
            builds do not keep this instrumentation active.
          </Text>
          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <PrimaryButton variant="secondary" onPress={refreshPerformanceReport}>
                Refresh Report
              </PrimaryButton>
            </View>
            <View style={styles.actionButton}>
              <PrimaryButton variant="ghost" onPress={clearPerformanceReport}>
                Clear Samples
              </PrimaryButton>
            </View>
          </View>
          <PrimaryButton
            loading={isSharingPerformanceReport}
            disabled={!performanceReport || performanceReport.measurements.length === 0}
            onPress={() => void exportPerformanceReport()}
          >
            Export Performance Report
          </PrimaryButton>
        </Card>

        {performanceReport ? (
          <View style={styles.checkList}>
            <Text style={styles.sectionTitle}>Performance targets</Text>
            {performanceReport.summaries.map((item) => (
              <Card key={item.operationId} compact accent={performanceStatusToAccent(item.status)}>
                <View style={styles.checkHeader}>
                  <Text style={styles.checkTitle}>{item.label}</Text>
                  <StatusChip
                    label={performanceStatusToLabel(item.status)}
                    tone={performanceStatusToAccent(item.status)}
                  />
                </View>
                <Text style={styles.body}>{formatPerformanceSummary(item)}</Text>
                <Text style={styles.meta}>
                  Target {item.targetMs}ms · caution after {item.cautionMs}ms · samples{' '}
                  {item.sampleCount}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}

        {checks.length > 0 ? (
          <View style={styles.checkList}>
            <Text style={styles.sectionTitle}>Latest check results</Text>
            {checks.map((check) => (
              <Card key={check.id} compact accent={statusToAccent(check.status)}>
                <View style={styles.checkHeader}>
                  <Text style={styles.checkTitle}>{check.title}</Text>
                  <StatusChip label={statusToLabel(check.status)} tone={statusToAccent(check.status)} />
                </View>
                <Text style={styles.body}>{check.message}</Text>
              </Card>
            ))}
          </View>
        ) : (
          <Card compact>
            <Text style={styles.cardTitle}>No checks run yet</Text>
            <Text style={styles.body}>
              Run native checks after the app opens on the target simulator or device.
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function buildSummary(checks: RuntimeQACheckResult[]): {
  label: string;
  message: string;
  tone: 'success' | 'warning' | 'danger' | 'primary';
} {
  if (checks.length === 0) {
    return {
      label: 'Not run',
      message: 'Native runtime checks have not been run in this session.',
      tone: 'primary',
    };
  }

  const failed = checks.filter((check) => check.status === 'failed').length;
  const warnings = checks.filter((check) => check.status === 'warning').length;
  if (failed > 0) {
    return {
      label: `${failed} failed`,
      message: `${failed} required check${failed === 1 ? '' : 's'} failed. Fix before relying on this runtime for release QA.`,
      tone: 'danger',
    };
  }
  if (warnings > 0) {
    return {
      label: `${warnings} warning${warnings === 1 ? '' : 's'}`,
      message: 'Core checks passed, but some native capabilities need attention in this runtime.',
      tone: 'warning',
    };
  }

  return {
    label: 'Ready',
    message: 'All native readiness checks passed in this runtime.',
    tone: 'success',
  };
}

function statusToAccent(status: RuntimeQACheckStatus): 'success' | 'warning' | 'danger' {
  if (status === 'passed') {
    return 'success';
  }
  if (status === 'warning') {
    return 'warning';
  }
  return 'danger';
}

function statusToLabel(status: RuntimeQACheckStatus): string {
  if (status === 'passed') {
    return 'Passed';
  }
  if (status === 'warning') {
    return 'Warning';
  }
  return 'Failed';
}

function buildPerformanceSummary(report: PerformanceReport | null): {
  label: string;
  message: string;
  tone: 'success' | 'warning' | 'danger' | 'primary';
} {
  if (!report || report.measurements.length === 0) {
    return {
      label: 'No samples',
      message: 'Open key flows, then refresh this report to capture a baseline.',
      tone: 'primary',
    };
  }

  const slow = report.summaries.filter((item) => item.status === 'slow').length;
  const caution = report.summaries.filter((item) => item.status === 'caution').length;
  const failed = report.summaries.filter((item) => item.status === 'failed').length;

  if (failed > 0) {
    return {
      label: `${failed} failed`,
      message: 'Some measured flows failed. Fix those before comparing performance.',
      tone: 'danger',
    };
  }
  if (slow > 0) {
    return {
      label: `${slow} slow`,
      message: 'Some measured flows exceeded the slow threshold and need optimization.',
      tone: 'warning',
    };
  }
  if (caution > 0) {
    return {
      label: `${caution} caution`,
      message: 'The baseline is usable, with a few flows close to the caution range.',
      tone: 'warning',
    };
  }

  return {
    label: 'Healthy',
    message: 'Measured flows are currently within baseline targets.',
    tone: 'success',
  };
}

function performanceStatusToAccent(
  status: PerformanceOperationSummary['status']
): 'success' | 'warning' | 'danger' | 'primary' {
  if (status === 'good') {
    return 'success';
  }
  if (status === 'caution' || status === 'slow') {
    return 'warning';
  }
  if (status === 'failed') {
    return 'danger';
  }
  return 'primary';
}

function performanceStatusToLabel(status: PerformanceOperationSummary['status']): string {
  if (status === 'not_measured') {
    return 'Not measured';
  }
  if (status === 'good') {
    return 'Good';
  }
  if (status === 'caution') {
    return 'Caution';
  }
  if (status === 'slow') {
    return 'Slow';
  }
  return 'Failed';
}

function formatPerformanceSummary(item: PerformanceOperationSummary): string {
  if (item.latestMs === null) {
    return 'No sample captured yet.';
  }

  const average = item.averageMs === null ? 'n/a' : `${item.averageMs}ms`;
  const slowest = item.slowestMs === null ? 'n/a' : `${item.slowestMs}ms`;
  return `Latest ${item.latestMs}ms · average ${average} · slowest ${slowest}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  unavailable: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.cardTitle,
    fontWeight: '900',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  checkList: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  checkHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  checkTitle: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 19,
  },
});
