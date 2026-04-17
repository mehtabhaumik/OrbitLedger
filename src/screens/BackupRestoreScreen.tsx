import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordUsageAnalyticsEvent } from '../analytics';
import {
  BackupFileReadError,
  BackupRestoreError,
  BackupValidationError,
  createAndSaveOrbitLedgerBackup,
  pickAndValidateOrbitLedgerBackupFile,
  recordLedgerBackupCompletedForNudge,
  restoreOrbitLedgerBackup,
  shareOrbitLedgerBackupFile,
  type BackupRecordCounts,
  type SelectedBackupForRestore,
  type SavedBackupFile,
} from '../backup';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PinConfirmationModal } from '../components/PinConfirmationModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SummaryCard } from '../components/SummaryCard';
import { showSuccessFeedback } from '../lib/feedback';
import type { RootStackParamList } from '../navigation/types';
import { useAppLock } from '../security/AppLockContext';
import { colors, spacing, typography } from '../theme/theme';
import {
  dismissRatingPrompt,
  getRatingPrompt,
  markRatingCompleted,
  markRatingPromptActioned,
  markRatingPromptShown,
  openPlayStoreRating,
  recordRatingPositiveMoment,
} from '../engagement';

type BackupRestoreScreenProps = NativeStackScreenProps<RootStackParamList, 'BackupRestore'>;

type ExportStatus = {
  tone: 'success' | 'error';
  title: string;
  message: string;
};

export function BackupRestoreScreen({ navigation }: BackupRestoreScreenProps) {
  const { pinEnabled, refreshPinLockState } = useAppLock();
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isPickingRestoreFile, setIsPickingRestoreFile] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestorePinConfirmationVisible, setIsRestorePinConfirmationVisible] = useState(false);
  const [lastBackup, setLastBackup] = useState<SavedBackupFile | null>(null);
  const [selectedRestoreBackup, setSelectedRestoreBackup] =
    useState<SelectedBackupForRestore | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<ExportStatus | null>(null);

  async function exportBackup() {
    try {
      setIsExporting(true);
      setExportStatus(null);

      const backupFile = await createAndSaveOrbitLedgerBackup();
      try {
        await recordLedgerBackupCompletedForNudge();
      } catch (nudgeError) {
        console.warn('[backup-export] Backup reminder state could not be updated', nudgeError);
      }
      setLastBackup(backupFile);
      setExportStatus({
        tone: 'success',
        title: 'Backup copy saved',
        message: `${backupFile.fileName} is saved on this device.`,
      });
      showSuccessFeedback(`${backupFile.fileName} is saved on this device.`, 'Backup copy saved');
      await recordRatingPositiveMoment('backup_success');
      await recordUsageAnalyticsEvent('backup_created');
      await maybePromptForRating();
    } catch (error) {
      console.warn('[backup-export] Backup export failed', error);
      setExportStatus({
        tone: 'error',
        title: 'Backup could not be saved',
        message: 'Orbit Ledger could not export a copy of your ledger. Please try again.',
      });
      Alert.alert(
        'Backup could not be saved',
        'Orbit Ledger could not export a copy of your ledger. Please try again.'
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function shareBackup() {
    if (!lastBackup) {
      return;
    }

    try {
      setIsSharing(true);
      await shareOrbitLedgerBackupFile(lastBackup);
    } catch (error) {
      console.warn('[backup-share] Backup sharing failed', error);
      setExportStatus({
        tone: 'error',
        title: 'Sharing failed',
        message: 'Your backup copy is saved, but sharing is not available right now.',
      });
      Alert.alert(
        'Sharing failed',
        'Your backup copy is saved, but sharing is not available right now.'
      );
    } finally {
      setIsSharing(false);
    }
  }

  async function maybePromptForRating() {
    const prompt = await getRatingPrompt();
    if (!prompt) {
      return;
    }

    await markRatingPromptShown();
    Alert.alert(prompt.title, prompt.message, [
      {
        text: 'Rate Orbit Ledger',
        onPress: () => {
          void rateOrbitLedger();
        },
      },
      {
        text: 'Send Feedback',
        onPress: () => {
          void markRatingPromptActioned();
          navigation.navigate('Feedback');
        },
      },
      {
        text: 'Not now',
        style: 'cancel',
        onPress: () => {
          void dismissRatingPrompt();
        },
      },
    ]);
  }

  async function rateOrbitLedger() {
    try {
      await openPlayStoreRating();
      await markRatingCompleted();
    } catch {
      Alert.alert('Play Store unavailable', 'Please try again later from your device.');
    }
  }

  async function chooseRestoreFile() {
    try {
      setIsPickingRestoreFile(true);
      setRestoreStatus(null);

      const selectedBackup = await pickAndValidateOrbitLedgerBackupFile();
      if (!selectedBackup) {
        return;
      }

      setSelectedRestoreBackup(selectedBackup);
      setRestoreStatus({
        tone: 'success',
        title: 'Backup ready to review',
        message: 'Please review this backup before restoring.',
      });
    } catch (error) {
      setSelectedRestoreBackup(null);
      logBackupRestoreError(error);
      const title =
        error instanceof BackupFileReadError ? 'Backup file could not be opened' : 'Backup not ready';
      const message =
        error instanceof BackupFileReadError || error instanceof BackupValidationError
          ? error.message
          : 'Orbit Ledger could not read this backup. Please choose another file.';
      setRestoreStatus({
        tone: 'error',
        title,
        message,
      });
      Alert.alert(title, message);
    } finally {
      setIsPickingRestoreFile(false);
    }
  }

  function confirmRestoreBackup() {
    if (!selectedRestoreBackup) {
      return;
    }

    Alert.alert(
      'Restore this backup?',
      'This will replace your current local Orbit Ledger data with the selected backup. Please review before continuing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Now',
          style: 'destructive',
          onPress: () => {
            if (pinEnabled) {
              setIsRestorePinConfirmationVisible(true);
              return;
            }

            void restoreSelectedBackup();
          },
        },
      ]
    );
  }

  function cancelRestorePreview() {
    setSelectedRestoreBackup(null);
    setRestoreStatus(null);
  }

  async function restoreSelectedBackup() {
    if (!selectedRestoreBackup) {
      return;
    }

    try {
      setIsRestoring(true);
      const summary = await restoreOrbitLedgerBackup(selectedRestoreBackup.backup);
      try {
        await recordLedgerBackupCompletedForNudge();
      } catch (nudgeError) {
        console.warn('[backup-restore] Backup reminder state could not be updated', nudgeError);
      }
      await refreshPinLockState({ lockIfEnabled: false });
      setRestoreStatus({
        tone: 'success',
        title: 'Backup restored',
        message: `${summary.customersRestored} customers, ${summary.transactionsRestored} ledger entries, ${summary.invoicesRestored} invoices, ${summary.productsRestored} products, ${summary.taxPacksRestored} tax packs, ${summary.countryPackagesRestored} country packages, and ${summary.appPreferencesRestored} app preferences were restored.`,
      });
      setSelectedRestoreBackup(null);
      Alert.alert('Backup restored', 'Your local Orbit Ledger data was restored from the selected backup.');
    } catch (error) {
      console.warn('[backup-restore] Restore failed', error);
      const message = getRestoreFailureMessage(error);
      setRestoreStatus({
        tone: 'error',
        title: 'Restore failed',
        message,
      });
      Alert.alert('Restore failed', message);
    } finally {
      setIsRestoring(false);
    }
  }

  const exportedCounts = lastBackup
    ? {
        ...getBackupRecordCounts(lastBackup),
        hasBusinessSettings: lastBackup.backup.data.businessSettings !== null,
        hasSecurity: lastBackup.backup.data.appSecurity !== null,
      }
    : null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Backup & Restore"
          subtitle="Export a copy of your ledger data for safekeeping, or restore a saved copy when needed."
          onBack={() => navigation.goBack()}
        />

        <Card glass elevated accent="success">
          <Text style={styles.eyebrow}>Backup overview</Text>
          <Text style={styles.heroTitle}>Keep a private copy of your ledger.</Text>
          <Text style={styles.heroText}>
            A backup exports your business records into a file you can keep somewhere safe, such
            as phone storage, email, or a trusted drive you control.
          </Text>
          <View style={styles.includedList}>
            <IncludedRow
              title="Business profile"
              detail="Business details, region, logo, and signature."
            />
            <IncludedRow
              title="Customers and ledger"
              detail="Customers, credit entries, payment entries, balances, and saved status."
            />
            <IncludedRow
              title="Documents and stock"
              detail="Invoices, invoice items, products, document history, and generated document settings."
            />
            <IncludedRow
              title="Country, tax, and compliance setup"
              detail="Tax profiles, tax packs, document templates, compliance configs, and country packages."
            />
            <IncludedRow
              title="App preferences"
              detail="Feature toggles, subscription status, analytics counters, backup nudges, and other local app preferences."
            />
            <IncludedRow
              title="PIN protection"
              detail="PIN on/off status can be included. The PIN, biometric preference, and device-only unlock credentials are not exported or restored."
            />
          </View>
        </Card>

        <Card accent="primary">
          <Text style={styles.eyebrow}>Export backup</Text>
          <Text style={styles.sectionTitle}>Create a safe copy</Text>
          <Text style={styles.muted}>
            Export a copy of your ledger data for safekeeping. You can share it after it is saved.
          </Text>
          {isExporting ? (
            <View style={styles.progressRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.progressText}>Saving backup copy</Text>
            </View>
          ) : null}

          <PrimaryButton loading={isExporting} disabled={isSharing} onPress={exportBackup}>
            Export Backup
          </PrimaryButton>
        </Card>

        {exportStatus ? (
          <Card compact accent={exportStatus.tone === 'success' ? 'success' : 'danger'}>
            <Text
              style={[
                styles.statusTitle,
                exportStatus.tone === 'success' ? styles.statusSuccessText : styles.statusErrorText,
              ]}
            >
              {exportStatus.title}
            </Text>
            <Text style={styles.statusMessage}>{exportStatus.message}</Text>
            {exportStatus.tone === 'success' && lastBackup ? (
              <PrimaryButton
                variant="secondary"
                loading={isSharing}
                disabled={isExporting}
                onPress={shareBackup}
              >
                Share Backup File
              </PrimaryButton>
            ) : null}
          </Card>
        ) : null}

        <Card accent="warning">
          <Text style={styles.eyebrow}>Restore from backup</Text>
          <Text style={styles.sectionTitle}>Restore a saved copy</Text>
          <Text style={styles.muted}>
            Choose a previously exported backup file. You can review it before anything changes.
          </Text>
          <PrimaryButton
            variant="secondary"
            loading={isPickingRestoreFile}
            disabled={isExporting || isSharing || isRestoring}
            onPress={chooseRestoreFile}
          >
            Choose Backup File
          </PrimaryButton>
        </Card>

        {restoreStatus ? (
          <Card compact accent={restoreStatus.tone === 'success' ? 'success' : 'danger'}>
            <Text
              style={[
                styles.statusTitle,
                restoreStatus.tone === 'success' ? styles.statusSuccessText : styles.statusErrorText,
              ]}
            >
              {restoreStatus.title}
            </Text>
            <Text style={styles.statusMessage}>{restoreStatus.message}</Text>
            {restoreStatus.tone === 'success' && !selectedRestoreBackup ? (
              <PrimaryButton variant="secondary" onPress={() => navigation.navigate('Dashboard')}>
                Go to Dashboard
              </PrimaryButton>
            ) : null}
          </Card>
        ) : null}

        {selectedRestoreBackup ? (
          <Card accent="danger">
            <Text style={styles.eyebrow}>Backup ready</Text>
            <Text style={styles.sectionTitle}>Restore preview</Text>
            <Text style={styles.muted}>
              Please review this backup before restoring. Your current data remains unchanged
              unless you confirm.
            </Text>
            <PreviewLine
              label="Business name"
              value={selectedRestoreBackup.preview.businessName ?? 'Business name not set'}
            />
            <PreviewLine
              label="Backup date"
              value={formatTimestamp(selectedRestoreBackup.preview.exportedAt)}
            />
            <PreviewLine
              label="Backup version"
              value={`${selectedRestoreBackup.preview.backupFormatVersion}`}
            />
            <PreviewLine
              label="Customer count"
              value={`${selectedRestoreBackup.preview.customers}`}
            />
            <PreviewLine
              label="Transaction count"
              value={`${selectedRestoreBackup.preview.transactions}`}
            />
            <PreviewLine
              label="Invoices"
              value={`${selectedRestoreBackup.preview.invoices}`}
            />
            <PreviewLine
              label="Invoice items"
              value={`${selectedRestoreBackup.preview.invoiceItems}`}
            />
            <PreviewLine
              label="Products"
              value={`${selectedRestoreBackup.preview.products}`}
            />
            <PreviewLine
              label="Tax profiles"
              value={`${selectedRestoreBackup.preview.taxProfiles}`}
            />
            <PreviewLine
              label="Tax packs"
              value={`${selectedRestoreBackup.preview.taxPacks}`}
            />
            <PreviewLine
              label="Document templates"
              value={`${selectedRestoreBackup.preview.documentTemplates}`}
            />
            <PreviewLine
              label="Compliance configs"
              value={`${selectedRestoreBackup.preview.complianceConfigs}`}
            />
            <PreviewLine
              label="Country packages"
              value={`${selectedRestoreBackup.preview.countryPackages}`}
            />
            <PreviewLine
              label="Country package templates"
              value={`${selectedRestoreBackup.preview.countryPackageTemplates}`}
            />
            <PreviewLine
              label="Compliance reports"
              value={`${selectedRestoreBackup.preview.complianceReports}`}
            />
            <PreviewLine
              label="App preferences"
              value={`${selectedRestoreBackup.preview.appPreferences}`}
            />
            <PreviewLine
              label="Document history"
              value={`${selectedRestoreBackup.preview.documentHistory}`}
            />
            <PreviewLine
              label="PIN protection"
              value={
                selectedRestoreBackup.preview.includesSecurity
                  ? 'Status included; PIN must be set up again if needed'
                  : 'Not included'
              }
            />
            <PreviewLine label="Restore type" value="Replace current app data" />
            <PreviewLine label="File" value={selectedRestoreBackup.preview.fileName} />
            <PreviewLine
              label="Size"
              value={formatFileSize(selectedRestoreBackup.preview.fileSize)}
            />
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Restoring this backup will replace your current local Orbit Ledger data.
              </Text>
            </View>
            <View style={styles.restoreActions}>
              <PrimaryButton
                variant="secondary"
                disabled={isRestoring}
                onPress={cancelRestorePreview}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton
                variant="danger"
                loading={isRestoring}
                disabled={isExporting || isSharing || isPickingRestoreFile}
                onPress={confirmRestoreBackup}
              >
                Restore Now
              </PrimaryButton>
            </View>
          </Card>
        ) : null}

        <Card accent="primary">
          <Text style={styles.eyebrow}>Data safety guidance</Text>
          <Text style={styles.sectionTitle}>Keep backup files private</Text>
          <SafetyLine text="Export regularly, especially before changing phones or clearing app data." />
          <SafetyLine text="Store backup files somewhere you trust and can find later." />
          <SafetyLine text="Do not share backup files publicly. They contain business and customer records." />
          <SafetyLine text="Backups may include whether PIN protection was on, but they do not include your PIN, biometric unlock setting, or device-only unlock credentials." />
          <SafetyLine text="After restoring on this device, turn PIN and biometric unlock on again if you want the app to lock the same way." />
          <SafetyLine
            text="Restore only when you are sure you want this saved copy to become your current Orbit Ledger data."
          />
        </Card>

        {lastBackup ? (
          <Card accent="success">
            <Text style={styles.eyebrow}>Recent backup</Text>
            <Text style={styles.sectionTitle}>Last saved backup</Text>
            <Text style={styles.fileName}>{lastBackup.fileName}</Text>
            <Text style={styles.muted}>Saved {formatTimestamp(lastBackup.savedAt)}</Text>
            {exportedCounts ? (
              <View style={styles.summaryGrid}>
                <SummaryPill
                  label="Business"
                  value={exportedCounts.hasBusinessSettings ? 'Included' : 'Not set'}
                />
                <SummaryPill label="Customers" value={`${exportedCounts.customers}`} />
                <SummaryPill label="Transactions" value={`${exportedCounts.transactions}`} />
                <SummaryPill label="Invoices" value={`${exportedCounts.invoices}`} />
                <SummaryPill label="Invoice items" value={`${exportedCounts.invoiceItems}`} />
                <SummaryPill label="Products" value={`${exportedCounts.products}`} />
                <SummaryPill label="Tax profiles" value={`${exportedCounts.taxProfiles}`} />
                <SummaryPill label="Tax packs" value={`${exportedCounts.taxPacks}`} />
                <SummaryPill
                  label="Country packages"
                  value={`${exportedCounts.countryPackages}`}
                />
                <SummaryPill
                  label="Package templates"
                  value={`${exportedCounts.countryPackageTemplates}`}
                />
                <SummaryPill
                  label="Templates"
                  value={`${exportedCounts.documentTemplates}`}
                />
                <SummaryPill
                  label="Compliance configs"
                  value={`${exportedCounts.complianceConfigs}`}
                />
                <SummaryPill
                  label="Compliance reports"
                  value={`${exportedCounts.complianceReports}`}
                />
                <SummaryPill
                  label="Preferences"
                  value={`${exportedCounts.appPreferences}`}
                />
                <SummaryPill
                  label="Document history"
                  value={`${exportedCounts.documentHistory}`}
                />
                <SummaryPill
                  label="PIN protection"
                  value={exportedCounts.hasSecurity ? 'Status only' : 'Not set'}
                />
              </View>
            ) : null}
            <PrimaryButton
              variant="secondary"
              loading={isSharing}
              disabled={isExporting}
              onPress={shareBackup}
            >
              Share Backup File
            </PrimaryButton>
            </Card>
        ) : (
          <EmptyState
            title="No backups exported yet"
            message="Export your first backup so you have a private copy of your ledger data."
            action={
              <PrimaryButton loading={isExporting} disabled={isSharing} onPress={exportBackup}>
                Export First Backup
              </PrimaryButton>
            }
          />
        )}

        <PinConfirmationModal
          visible={isRestorePinConfirmationVisible}
          title="Confirm restore"
          message="Enter your PIN to restore this backup. This will replace your current local Orbit Ledger data."
          onCancel={() => setIsRestorePinConfirmationVisible(false)}
          onConfirmed={() => {
            setIsRestorePinConfirmationVisible(false);
            void restoreSelectedBackup();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function IncludedRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.includedRow}>
      <Text style={styles.includedTitle}>{title}</Text>
      <Text style={styles.muted}>{detail}</Text>
    </View>
  );
}

function SafetyLine({ text }: { text: string }) {
  return (
    <View style={styles.safetyLine}>
      <View style={styles.safetyMarker} />
      <Text style={styles.safetyText}>{text}</Text>
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return <SummaryCard label={label} value={value} tone="primary" />;
}

function getBackupRecordCounts(backupFile: SavedBackupFile): BackupRecordCounts {
  return (
    backupFile.backup.metadata.recordCounts ?? {
      customers: backupFile.backup.data.customers.length,
      transactions: backupFile.backup.data.transactions.length,
      taxProfiles: backupFile.backup.data.taxProfiles.length,
      taxPacks: backupFile.backup.data.taxPacks.length,
      documentTemplates: backupFile.backup.data.documentTemplates.length,
      complianceConfigs: backupFile.backup.data.complianceConfigs.length,
      countryPackages: backupFile.backup.data.countryPackages.length,
      countryPackageTemplates: backupFile.backup.data.countryPackageTemplates.length,
      complianceReports: backupFile.backup.data.complianceReports.length,
      products: backupFile.backup.data.products.length,
      invoices: backupFile.backup.data.invoices.length,
      invoiceItems: backupFile.backup.data.invoiceItems.length,
      appPreferences: backupFile.backup.data.appPreferences.length,
      documentHistory: backupFile.backup.data.documentHistory.length,
    }
  );
}

function logBackupRestoreError(error: unknown): void {
  if (error instanceof BackupFileReadError) {
    console.warn('[backup-restore] Backup file could not be opened', {
      message: error.message,
      technicalDetails: error.technicalDetails,
    });
    return;
  }

  if (error instanceof BackupValidationError) {
    console.warn('[backup-restore] Backup validation failed', {
      message: error.message,
      technicalDetails: error.technicalDetails,
    });
    return;
  }

  console.warn('[backup-restore] Backup file could not be read', error);
}

function getRestoreFailureMessage(error: unknown): string {
  if (error instanceof BackupValidationError) {
    return `${error.message} Your current Orbit Ledger data was not changed.`;
  }

  if (error instanceof BackupRestoreError) {
    return error.currentDataPreserved
      ? `${error.message} Your current Orbit Ledger data was preserved.`
      : 'Restore could not be completed. Please review your Orbit Ledger data before trying again.';
  }

  return 'Restore could not be completed. Please review your Orbit Ledger data before trying again.';
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
    </View>
  );
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(value: number | null): string {
  if (value === null) {
    return 'Unknown';
  }

  if (value < 1024) {
    return `${value} bytes`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  overviewCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  includedList: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  includedRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  includedTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  guidanceCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  safetyLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  safetyMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  safetyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  progressRow: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  statusCard: {
    borderRadius: 8,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statusSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  statusError: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.accentSurface,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: typography.body,
    fontWeight: '900',
  },
  statusSuccessText: {
    color: colors.primary,
  },
  statusErrorText: {
    color: colors.danger,
  },
  statusMessage: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  resultCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyStateCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fileName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryPill: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  previewLine: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  previewValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  warningBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  restoreActions: {
    gap: spacing.sm,
  },
});
