import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordUsageAnalyticsEvent } from '../analytics';
import { BottomActionBar } from '../components/BottomActionBar';
import { recordStatementGeneratedForBackupNudge } from '../backup';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectField } from '../components/SelectField';
import {
  acknowledgeDocumentTaxNotice,
  getBusinessSettings,
  getCustomerLedger,
  getDocumentTaxNoticeAcknowledged,
} from '../database';
import {
  buildCustomerStatementDocument,
  buildStatementPdfFileName,
  canUseTemplate,
  generateAndSavePdfFromStructuredDocument,
  generatePdfFromStructuredDocument,
  getBuiltInDocumentTemplate,
  getBuiltInDocumentTemplateCatalog,
  getGeneratedDocumentHistory,
  getPreferredDocumentTemplateKey,
  loadDocumentTemplateForBusiness,
  openGeneratedPdf,
  openPrintPreview,
  printGeneratedPdf,
  saveGeneratedPdfToDevice,
  savePreferredDocumentTemplateKey,
  shareGeneratedPdf,
} from '../documents';
import type {
  CustomerStatementData,
  DocumentTemplateCatalogItem,
  DocumentTemplateKey,
  DocumentDateRange,
  GeneratedPdf,
  GeneratedDocumentHistoryEntry,
  SavedPdf,
  StructuredDocument,
} from '../documents';
import type { BusinessSettings, CustomerLedger } from '../database';
import { recordRatingPositiveMoment } from '../engagement';
import {
  getActiveProBrandTheme,
  getSubscriptionStatus,
  recordPdfGeneratedForUpgradeNudge,
  recordPremiumFeatureAttemptForUpgradeNudge,
  resolveDocumentFeatureGates,
} from '../monetization';
import type { DocumentFeatureGateState, ProBrandTheme, SubscriptionStatus } from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import {
  buildPaymentRequestMessage,
  sharePaymentRequestMessage,
  type PaymentShareDetails,
} from '../collections';
import { getBusinessPaymentDetails } from '../payments/businessPaymentDetails';
import { colors, spacing, touch, typography } from '../theme/theme';

type StatementPreviewScreenProps = NativeStackScreenProps<RootStackParamList, 'StatementPreview'>;
type StatementFilterKey = 'last_7_days' | 'last_30_days' | 'this_month' | 'all_time' | 'custom';
type DateRangeField = 'from' | 'to';

type StatementFilter = {
  key: StatementFilterKey;
  label: string;
  range?: DocumentDateRange;
};

type StatementSource = {
  businessProfile: BusinessSettings;
  ledger: CustomerLedger;
  subscriptionStatus: SubscriptionStatus;
  proBrandTheme: ProBrandTheme;
  documentTemplate: Awaited<ReturnType<typeof loadDocumentTemplateForBusiness>>;
  selectedTemplateKey: DocumentTemplateKey;
};
type ExportStatus = {
  tone: 'success' | 'warning' | 'error';
  message: string;
};

const quickFilters: Array<{ key: Exclude<StatementFilterKey, 'custom'>; label: string }> = [
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'all_time', label: 'All time' },
];
const TAX_READY_DOCUMENT_NOTICE =
  'Local document labels can use your saved region setup. You can continue with the current setup or check for online updates from settings.';

export function StatementPreviewScreen({ navigation, route }: StatementPreviewScreenProps) {
  const { customerId } = route.params;
  const [source, setSource] = useState<StatementSource | null>(null);
  const [filter, setFilter] = useState<StatementFilter>(() => createQuickFilter('all_time'));
  const [activeDateField, setActiveDateField] = useState<DateRangeField | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showTaxNotice, setShowTaxNotice] = useState(false);
  const [isAcknowledgingTaxNotice, setIsAcknowledgingTaxNotice] = useState(false);
  const [isUpgradePromptDismissed, setIsUpgradePromptDismissed] = useState(false);
  const [lastSavedPdf, setLastSavedPdf] = useState<SavedPdf | null>(null);
  const [viewedPdf, setViewedPdf] = useState<GeneratedPdf | null>(null);
  const [isPdfViewerVisible, setIsPdfViewerVisible] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<GeneratedDocumentHistoryEntry[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentShareDetails>({});
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const documentGates = useMemo<DocumentFeatureGateState | null>(() => {
    if (!source) {
      return null;
    }

    return resolveDocumentFeatureGates(source.subscriptionStatus);
  }, [source]);
  const document = useMemo<StructuredDocument<CustomerStatementData> | null>(() => {
    if (!source || !documentGates) {
      return null;
    }

    return buildCustomerStatementDocument({
      businessProfile: source.businessProfile,
      customer: source.ledger.customer,
      transactions: source.ledger.transactions,
      dateRange: filter.range,
      documentOptions: {
        includeCustomBranding: documentGates.includeCustomBranding,
        pdfStyle: documentGates.pdfStyle,
        proTheme: documentGates.pdfStyle === 'advanced' ? source.proBrandTheme : null,
        gatedPremiumFeatures: documentGates.lockedFeatures.map((access) => access.feature),
        documentTemplate:
          getBuiltInDocumentTemplate(source.selectedTemplateKey)?.config ?? source.documentTemplate,
      },
    });
  }, [documentGates, filter.range, source]);
  const data = document?.data;
  const activeProTheme = data?.rendering.proTheme;
  const visibleRows = useMemo(() => data?.transactions.slice(0, 8) ?? [], [data]);
  const customRange = filter.range ?? data?.metadata.dateRange ?? todayRange();
  const appliedFilterText = data
    ? `${filter.label} · ${formatRange(data.metadata.dateRange)}`
    : filter.label;
  const statementFileName = document ? buildStatementPdfFileName(document) : 'Customer_Statement.pdf';
  const exportInProgress =
    isSaving || isSharing || isOpeningPdf || isOpeningPreview || isPrintingPdf || isRegenerating;

  const loadStatement = useCallback(
    async (canUpdate: () => boolean = () => true) => {
      if (canUpdate()) {
        setIsLoading(true);
        setLoadError(null);
      }

      try {
        const [
          businessProfile,
          ledger,
          taxNoticeAcknowledged,
          subscriptionStatus,
          proBrandTheme,
          savedPaymentDetails,
        ] =
          await Promise.all([
            getBusinessSettings(),
            getCustomerLedger(customerId),
            getDocumentTaxNoticeAcknowledged(),
            getSubscriptionStatus(),
            getActiveProBrandTheme(),
            getBusinessPaymentDetails(),
          ]);

        if (!businessProfile) {
          navigation.replace('Setup');
          return;
        }

        const [documentTemplate, selectedTemplateKey] = await Promise.all([
          loadDocumentTemplateForBusiness(businessProfile, 'statement'),
          getPreferredDocumentTemplateKey(businessProfile, 'statement', subscriptionStatus.isPro),
        ]);

        if (canUpdate()) {
          setSource({
            businessProfile,
            ledger,
            subscriptionStatus,
            proBrandTheme,
            documentTemplate,
            selectedTemplateKey,
          });
          setShowTaxNotice(!taxNoticeAcknowledged);
          setDocumentHistory(getGeneratedDocumentHistory());
          setPaymentDetails(savedPaymentDetails);
        }
      } catch {
        if (canUpdate()) {
          const message = 'Statement could not load. Please try again.';
          setLoadError(message);
          setSource(null);
          Alert.alert('Statement could not load', 'Please try again.');
        }
      } finally {
        if (canUpdate()) {
          setIsLoading(false);
        }
      }
    },
    [customerId, navigation]
  );

  useEffect(() => {
    let isMounted = true;

    void loadStatement(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadStatement]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadStatement();
    });

    return unsubscribe;
  }, [loadStatement, navigation]);

  async function acknowledgeTaxNotice() {
    try {
      setIsAcknowledgingTaxNotice(true);
      await acknowledgeDocumentTaxNotice();
      setShowTaxNotice(false);
    } catch {
      Alert.alert('Notice could not be saved', 'You can continue without setup for now.');
    } finally {
      setIsAcknowledgingTaxNotice(false);
    }
  }

  async function savePdf() {
    if (!document) {
      return;
    }

    try {
      setExportStatus(null);
      setIsSaving(true);
      const savedPdf = await generateAndSavePdfFromStructuredDocument(document, statementFileName);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getGeneratedDocumentHistory());
      await recordStatementGeneratedForBackupNudge();
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
      setExportStatus({
        tone: 'success',
        message: `Saved as ${savedPdf.fileName}.`,
      });
      Alert.alert('Statement saved', `${savedPdf.fileName} has been saved.`);
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'PDF could not be saved. Please try again.',
      });
      Alert.alert('PDF could not be saved', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function sharePdf() {
    if (!document) {
      return;
    }

    try {
      setExportStatus(null);
      setIsSharing(true);
      const savedPdf = await generateAndSavePdfFromStructuredDocument(document, statementFileName);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getGeneratedDocumentHistory());
      await recordStatementGeneratedForBackupNudge();
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');

      try {
        await shareGeneratedPdf(savedPdf, savedPdf.fileName);
      } catch {
        setExportStatus({
          tone: 'warning',
          message: `${savedPdf.fileName} was saved, but sharing is not available right now.`,
        });
        Alert.alert(
          'Statement saved',
          'Sharing is not available right now. The statement was still saved.'
        );
        return;
      }

      setExportStatus({
        tone: 'success',
        message: `${savedPdf.fileName} is saved and ready for WhatsApp, email, or file apps.`,
      });
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'PDF could not be shared. Please try again.',
      });
      Alert.alert('PDF could not be shared', 'Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  async function sharePaymentMessage() {
    if (!document || !source) {
      return;
    }

    try {
      setExportStatus(null);
      setIsSharing(true);
      const data = document.data;
      const message = buildPaymentRequestMessage({
        kind: 'statement',
        businessName: data.businessIdentity.businessName,
        customerName: data.customerIdentity.name,
        amount: source.ledger.balance,
        currency: data.metadata.currency,
        countryCode: data.businessIdentity.countryCode,
        statementDate: data.metadata.statementDate,
        paymentDetails,
      });
      await sharePaymentRequestMessage(message);
      setExportStatus({
        tone: 'success',
        message: 'Statement message is ready to send. Record payment only after you confirm it.',
      });
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'Statement message could not be shared. Please try again.',
      });
      Alert.alert('Message could not be shared', 'Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  async function viewPdf() {
    if (!document) {
      return;
    }

    let generatedPdf: GeneratedPdf | null = null;
    try {
      setExportStatus(null);
      setIsOpeningPdf(true);
      generatedPdf = await generatePdfFromStructuredDocument(document, statementFileName);
      setViewedPdf(generatedPdf);
      setIsPdfViewerVisible(true);
      await openGeneratedPdf(generatedPdf);
      await recordStatementGeneratedForBackupNudge();
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
    } catch {
      if (generatedPdf) {
        setExportStatus({
          tone: 'warning',
          message:
            'The statement is ready, but your device could not open it. You can still save, share, or print it here.',
        });
        Alert.alert(
          'Statement is ready',
          'Your device could not open it. You can still save, share, or print it from this screen.'
        );
        return;
      }

      setExportStatus({
        tone: 'error',
        message: 'Statement PDF could not be created. Please try again.',
      });
      Alert.alert('Statement PDF could not be created', 'Please try again.');
    } finally {
      setIsOpeningPdf(false);
    }
  }

  async function openViewedPdf() {
    if (!viewedPdf) {
      return;
    }

    try {
      setIsOpeningPdf(true);
      await openGeneratedPdf(viewedPdf);
    } catch {
      Alert.alert('PDF could not open', 'Your device may not have a PDF viewer available.');
    } finally {
      setIsOpeningPdf(false);
    }
  }

  async function saveViewedPdf() {
    if (!viewedPdf || !document) {
      return;
    }

    if (!viewedPdf.isTemporary) {
      Alert.alert('Statement already saved', `${viewedPdf.fileName} is already saved.`);
      return;
    }

    try {
      setExportStatus(null);
      setIsSaving(true);
      const savedPdf = saveGeneratedPdfToDevice(viewedPdf, statementFileName, document);
      setViewedPdf(savedPdf);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getGeneratedDocumentHistory());
      await recordStatementGeneratedForBackupNudge();
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
      setExportStatus({
        tone: 'success',
        message: `Saved as ${savedPdf.fileName}.`,
      });
      Alert.alert('Statement saved', `${savedPdf.fileName} has been saved.`);
    } catch {
      Alert.alert('PDF could not be saved', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function shareViewedPdf() {
    if (!viewedPdf) {
      return;
    }

    try {
      setIsSharing(true);
      await shareGeneratedPdf(viewedPdf, viewedPdf.fileName);
    } catch {
      Alert.alert('PDF could not be shared', 'Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  async function printViewedPdf() {
    if (!viewedPdf) {
      return;
    }

    try {
      setIsPrintingPdf(true);
      await printGeneratedPdf(viewedPdf);
    } catch {
      Alert.alert('PDF could not be printed', 'Please try again.');
    } finally {
      setIsPrintingPdf(false);
    }
  }

  async function printPreview() {
    if (!document) {
      return;
    }

    try {
      setExportStatus(null);
      setIsOpeningPreview(true);
      await openPrintPreview(document);
      await recordStatementGeneratedForBackupNudge();
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
    } catch {
      Alert.alert('Preview could not open', 'Please try again.');
    } finally {
      setIsOpeningPreview(false);
    }
  }

  async function regeneratePreview() {
    try {
      setExportStatus(null);
      setIsRegenerating(true);
      const [businessProfile, ledger, subscriptionStatus, proBrandTheme] = await Promise.all([
        getBusinessSettings(),
        getCustomerLedger(customerId),
        getSubscriptionStatus(),
        getActiveProBrandTheme(),
      ]);

      if (!businessProfile) {
        navigation.replace('Setup');
        return;
      }

      const [documentTemplate, selectedTemplateKey] = await Promise.all([
        loadDocumentTemplateForBusiness(businessProfile, 'statement'),
        getPreferredDocumentTemplateKey(businessProfile, 'statement', subscriptionStatus.isPro),
      ]);

      setSource({
        businessProfile,
        ledger,
        subscriptionStatus,
        proBrandTheme,
        documentTemplate,
        selectedTemplateKey,
      });
      setLastSavedPdf(null);
      setDocumentHistory(getGeneratedDocumentHistory());
      setExportStatus({
        tone: 'success',
        message: 'Preview refreshed with the latest ledger data.',
      });
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'Preview could not be refreshed. Please try again.',
      });
      Alert.alert('Preview could not be refreshed', 'Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }

  async function openUpgradeFromDocumentPrompt() {
    const firstLockedFeature = documentGates?.lockedFeatures[0]?.feature;
    if (firstLockedFeature) {
      await recordPremiumFeatureAttemptForUpgradeNudge(firstLockedFeature);
    }

    navigation.navigate('Upgrade');
  }

  async function changeStatementTemplate(nextTemplateKey: string) {
    if (!source) {
      return;
    }

    const nextTemplate = getBuiltInDocumentTemplate(nextTemplateKey as DocumentTemplateKey);
    if (!nextTemplate) {
      return;
    }

    if (!canUseTemplate(nextTemplate, source.subscriptionStatus.isPro)) {
      await recordPremiumFeatureAttemptForUpgradeNudge('advanced_pdf_styling');
      Alert.alert('Pro template', `${nextTemplate.label} is available with Orbit Ledger Pro.`);
      navigation.navigate('Upgrade');
      return;
    }

    try {
      await savePreferredDocumentTemplateKey(source.businessProfile, 'statement', nextTemplate.key);
      setSource((current) =>
        current
          ? {
              ...current,
              selectedTemplateKey: nextTemplate.key,
            }
          : current
      );
      setExportStatus({
        tone: 'success',
        message: `${nextTemplate.label} will be used for this statement PDF.`,
      });
    } catch {
      Alert.alert('Template could not be saved', 'Please try again.');
    }
  }

  function applyQuickFilter(key: Exclude<StatementFilterKey, 'custom'>) {
    setFilter(createQuickFilter(key));
    setActiveDateField(null);
  }

  function openCustomDatePicker(field: DateRangeField) {
    setFilter((currentFilter) => ({
      key: 'custom',
      label: 'Custom range',
      range: currentFilter.range ?? data?.metadata.dateRange ?? todayRange(),
    }));
    setActiveDateField(field);
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setActiveDateField(null);
    }

    if (event.type === 'dismissed' || !selectedDate || !activeDateField) {
      return;
    }

    const selectedIsoDate = toIsoDate(selectedDate);
    setFilter((currentFilter) => {
      const nextRange = {
        ...(currentFilter.range ?? data?.metadata.dateRange ?? todayRange()),
        [activeDateField]: selectedIsoDate,
      };

      if (nextRange.from > nextRange.to) {
        if (activeDateField === 'from') {
          nextRange.to = selectedIsoDate;
        } else {
          nextRange.from = selectedIsoDate;
        }
      }

      return {
        key: 'custom',
        label: 'Custom range',
        range: nextRange,
      };
    });
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>Preparing statement preview</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Statement could not load</Text>
          <Text style={styles.muted}>{loadError ?? 'Statement data is unavailable.'}</Text>
          <PrimaryButton onPress={() => void loadStatement()}>
            Try Again
          </PrimaryButton>
          <PrimaryButton variant="secondary" onPress={() => navigation.goBack()}>
            Go Back
          </PrimaryButton>
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
      >
        <ScreenHeader
          title="Statement Preview"
          subtitle="Review the statement before exporting a PDF."
          onBack={() => navigation.goBack()}
        />

        {showTaxNotice ? (
          <View style={styles.taxNoticeCard}>
            <Text style={styles.taxNoticeLabel}>Local document labels</Text>
            <Text style={styles.taxNoticeText}>{TAX_READY_DOCUMENT_NOTICE}</Text>
            <PrimaryButton
              variant="secondary"
              loading={isAcknowledgingTaxNotice}
              onPress={acknowledgeTaxNotice}
            >
              Got it
            </PrimaryButton>
          </View>
        ) : null}

        {documentGates?.upgradeMessage && !isUpgradePromptDismissed ? (
          <View style={styles.upgradePromptCard}>
            <View style={styles.upgradePromptHeader}>
              <View style={styles.upgradePromptTextBlock}>
                <Text style={styles.upgradePromptLabel}>Optional Pro upgrade</Text>
                <Text style={styles.sectionTitle}>{documentGates.upgradeTitle}</Text>
              </View>
              <View style={styles.basicPdfPill}>
                <Text style={styles.basicPdfPillText}>Basic PDF active</Text>
              </View>
            </View>
            <Text style={styles.upgradePromptText}>{documentGates.upgradeMessage}</Text>
            <PrimaryButton onPress={() => void openUpgradeFromDocumentPrompt()}>
              View Pro Benefits
            </PrimaryButton>
            <PrimaryButton variant="secondary" onPress={() => setIsUpgradePromptDismissed(true)}>
              Continue with Basic PDF
            </PrimaryButton>
          </View>
        ) : null}

        <View style={styles.templateCard}>
          <Text style={styles.sectionTitle}>Statement Template</Text>
          <Text style={styles.muted}>
            Choose the statement layout. The standard format is balance-forward; Pro adds branded
            account-letterhead presentation.
          </Text>
          <SelectField
            label="Template"
            value={source?.selectedTemplateKey ?? ''}
            options={getTemplateOptions(
              source ? getBuiltInDocumentTemplateCatalog(source.businessProfile, 'statement') : [],
              source?.subscriptionStatus.isPro ?? false
            )}
            onChange={(value) => void changeStatementTemplate(value)}
          />
        </View>

        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Statement Range</Text>
            <Text style={styles.filterIndicator}>Applied: {appliedFilterText}</Text>
          </View>

          <View style={styles.filterChips}>
            {quickFilters.map((option) => {
              const isActive = filter.key === option.key;

              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  onPress={() => applyQuickFilter(option.key)}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customRangeRow}>
            <DateField
              label="From"
              value={customRange.from}
              isActive={activeDateField === 'from'}
              onPress={() => openCustomDatePicker('from')}
            />
            <DateField
              label="To"
              value={customRange.to}
              isActive={activeDateField === 'to'}
              onPress={() => openCustomDatePicker('to')}
            />
          </View>
          <Text style={styles.muted}>Choose dates to create a custom statement range.</Text>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewHeaderText}>
              <Text style={styles.reviewLabel}>Review before sharing</Text>
              <Text style={styles.sectionTitle}>Customer statement</Text>
            </View>
            <View style={styles.reviewStatusPill}>
              <Text style={styles.reviewStatusText}>{formatEntryCount(data.transactions.length)}</Text>
            </View>
          </View>
          <View style={styles.reviewLines}>
            <ReviewLine label="Customer" value={data.customerIdentity.name} />
            <ReviewLine label="Period" value={formatRange(data.metadata.dateRange)} />
            <ReviewLine label="Amount due" value={data.summary.amountDue.formatted} emphasized />
            <ReviewLine label="Final balance" value={data.summary.finalBalance.formatted} emphasized />
            <ReviewLine
              label="Document style"
              value={
                documentGates?.pdfStyle === 'advanced'
                  ? `${data.rendering.template.label} · ${activeProTheme?.label ?? 'Pro theme'}`
                  : data.rendering.template.label
              }
            />
            <ReviewLine label="PDF name" value={statementFileName} />
          </View>
          <Text style={styles.reviewHelper}>
            The PDF will include every transaction in this statement range, even when only the
            first few entries are shown in the mobile preview.
          </Text>
        </View>

        {activeDateField ? (
          <DateTimePicker
            value={dateFromIso(customRange[activeDateField])}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
          />
        ) : null}

        <View
          style={[
            styles.previewSheet,
            activeProTheme
              ? {
                  backgroundColor: activeProTheme.surfaceColor,
                  borderColor: activeProTheme.accentColor,
                }
              : null,
          ]}
        >
          {activeProTheme ? (
            <View
              style={[
                styles.proThemeStrip,
                {
                  backgroundColor: colors.surface,
                  borderColor: activeProTheme.lineColor,
                },
              ]}
            >
              <View
                style={[
                  styles.proThemeDot,
                  {
                    backgroundColor: activeProTheme.accentColor,
                  },
                ]}
              />
              <View style={styles.proThemeTextBlock}>
                <Text style={[styles.proThemeLabel, { color: activeProTheme.accentColor }]}>
                  Pro branding active
                </Text>
                <Text style={styles.proThemeText}>
                  {activeProTheme.label} theme will be used for this document.
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.header}>
            {data.businessIdentity.logo ? (
              <Image
                source={{ uri: data.businessIdentity.logo.uri }}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoFallbackText}>OL</Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.businessName}>{data.businessIdentity.businessName}</Text>
              <Text style={styles.muted}>{data.businessIdentity.address}</Text>
              <Text style={styles.muted}>{data.businessIdentity.phone}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.sectionTitle}>{data.customerIdentity.name}</Text>
            {data.customerIdentity.phone ? (
              <Text style={styles.muted}>{data.customerIdentity.phone}</Text>
            ) : null}
            {data.customerIdentity.address ? (
              <Text style={styles.muted}>{data.customerIdentity.address}</Text>
            ) : null}
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaBox}>
              <Text style={styles.label}>Statement Date</Text>
              <Text style={styles.metaValue}>{data.metadata.statementDate}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.label}>Date Range</Text>
              <Text style={styles.metaValue}>
                {data.metadata.dateRange.from} to {data.metadata.dateRange.to}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {visibleRows.length === 0 ? (
              <View style={styles.inlineEmptyState}>
                <Text style={styles.inlineEmptyTitle}>
                  {data.transactions.length === 0
                    ? 'No transactions recorded yet'
                    : 'No transactions in this statement period'}
                </Text>
                <Text style={styles.muted}>
                  {data.transactions.length === 0
                    ? 'Add a credit or payment before generating a statement.'
                    : 'Try all time or choose a wider date range.'}
                </Text>
                {data.transactions.length === 0 ? (
                  <PrimaryButton onPress={() => navigation.navigate('TransactionForm', { customerId })}>
                    Add Transaction
                  </PrimaryButton>
                ) : (
                  <PrimaryButton variant="secondary" onPress={() => applyQuickFilter('all_time')}>
                    Show All Time
                  </PrimaryButton>
                )}
              </View>
            ) : (
              visibleRows.map((row) => (
                <View key={row.transactionId} style={styles.transactionRow}>
                  <View style={styles.transactionText}>
                    <Text style={styles.transactionDate}>{row.date}</Text>
                    <Text style={styles.transactionDescription}>{row.description}</Text>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text style={row.credit ? styles.credit : styles.payment}>
                      {row.credit
                        ? `Credit ${row.credit.formatted}`
                        : `Payment ${row.payment?.formatted ?? ''}`}
                    </Text>
                    <Text style={styles.balanceText}>{row.runningBalance.formatted}</Text>
                  </View>
                </View>
              ))
            )}
            {data.transactions.length > visibleRows.length ? (
              <Text style={styles.muted}>
                {data.transactions.length - visibleRows.length} more rows included in the PDF.
              </Text>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Totals</Text>
            <Text style={styles.muted}>{data.summary.dueMessage}</Text>
            <SummaryLine label="Opening balance" value={data.summary.openingBalance.formatted} />
            <SummaryLine label="Credit / charges" value={data.summary.totalCredit.formatted} />
            <SummaryLine label="Payments received" value={data.summary.totalPayment.formatted} />
            <SummaryLine label="Closing balance" value={data.summary.finalBalance.formatted} emphasized />
          </View>

          <View style={styles.signatureBlock}>
            {data.footer.signature ? (
              <Image
                source={{ uri: data.footer.signature.uri }}
                style={styles.signature}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.muted}>
                {data.rendering.customBrandingIncluded
                  ? 'Signature not added'
                  : 'Logo and signature branding available with Pro'}
              </Text>
            )}
            <Text style={styles.sectionTitle}>{data.footer.authorizedPersonName}</Text>
            <Text style={styles.muted}>{data.footer.designation}</Text>
          </View>
        </View>

        <View style={styles.exportCard}>
          <Text style={styles.sectionTitle}>Export and Share</Text>
          <View style={styles.fileNameBox}>
            <Text style={styles.label}>PDF file name</Text>
            <Text style={styles.fileNameText}>{statementFileName}</Text>
          </View>
          <Text style={styles.muted}>
            Save keeps a copy you can find later. Share lets you send it through WhatsApp, email,
            or file apps when available.
          </Text>
          {lastSavedPdf ? (
            <Text style={styles.muted}>Last saved as {lastSavedPdf.fileName}</Text>
          ) : null}
          {documentHistory.length > 0 ? (
            <View style={styles.historyList}>
              <Text style={styles.label}>Recent exports</Text>
              {documentHistory.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <Text style={styles.historyFileName}>{item.fileName}</Text>
                  <Text style={styles.historyMeta}>{formatShortTimestamp(item.createdAt)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.inlineEmptyState}>
              <Text style={styles.inlineEmptyTitle}>No statements exported yet</Text>
              <Text style={styles.muted}>Save or share this statement to keep a copy.</Text>
            </View>
          )}
          {exportStatus ? (
            <View
              style={[
                styles.exportStatus,
                exportStatus.tone === 'success' ? styles.exportStatusSuccess : null,
                exportStatus.tone === 'warning' ? styles.exportStatusWarning : null,
                exportStatus.tone === 'error' ? styles.exportStatusError : null,
              ]}
            >
              <Text
                style={[
                  styles.exportStatusText,
                  exportStatus.tone === 'success'
                    ? styles.exportStatusSuccessText
                    : exportStatus.tone === 'warning'
                      ? styles.exportStatusWarningText
                    : styles.exportStatusErrorText,
                ]}
              >
                {exportStatus.message}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            variant="secondary"
            loading={isSharing}
            disabled={exportInProgress && !isSharing}
            onPress={sharePaymentMessage}
          >
            Share Payment Message
          </PrimaryButton>
          <PrimaryButton
            loading={isOpeningPdf}
            disabled={exportInProgress && !isOpeningPdf}
            onPress={viewPdf}
          >
            View PDF
          </PrimaryButton>
          <PrimaryButton
            variant="secondary"
            loading={isOpeningPreview}
            disabled={exportInProgress && !isOpeningPreview}
            onPress={printPreview}
          >
            Open Print Preview
          </PrimaryButton>
        </View>
      </ScrollView>
      <BottomActionBar>
        <PrimaryButton loading={isSharing} disabled={exportInProgress && !isSharing} onPress={sharePdf}>
          Share PDF
        </PrimaryButton>
        <PrimaryButton
          variant="secondary"
          loading={isSaving}
          disabled={exportInProgress && !isSaving}
          onPress={savePdf}
        >
          Save PDF Locally
        </PrimaryButton>
        <PrimaryButton
          variant="ghost"
          loading={isRegenerating}
          disabled={exportInProgress && !isRegenerating}
          onPress={regeneratePreview}
        >
          Regenerate Preview
        </PrimaryButton>
      </BottomActionBar>
      <PdfViewerModal
        visible={isPdfViewerVisible}
        pdf={viewedPdf}
        title="Statement PDF ready"
        isOpening={isOpeningPdf}
        isSaving={isSaving}
        isSharing={isSharing}
        isPrinting={isPrintingPdf}
        onClose={() => setIsPdfViewerVisible(false)}
        onOpen={openViewedPdf}
        onSave={saveViewedPdf}
        onShare={shareViewedPdf}
        onPrint={printViewedPdf}
      />
    </SafeAreaView>
  );
}

function DateField({
  label,
  value,
  isActive,
  onPress,
}: {
  label: string;
  value: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={touch.hitSlop}
      onPress={onPress}
      pressRetentionOffset={touch.pressRetentionOffset}
      style={[styles.dateField, isActive ? styles.dateFieldActive : null]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.dateFieldValue}>{value}</Text>
    </Pressable>
  );
}

function SummaryLine({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={emphasized ? styles.summaryEmphasis : styles.muted}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={2}
        style={emphasized ? styles.summaryEmphasis : styles.summaryValue}
      >
        {value}
      </Text>
    </View>
  );
}

function ReviewLine({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.reviewLine}>
      <Text style={styles.reviewLineLabel}>{label}</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={2}
        style={[styles.reviewLineValue, emphasized ? styles.reviewLineValueEmphasis : null]}
      >
        {value}
      </Text>
    </View>
  );
}

function createQuickFilter(key: Exclude<StatementFilterKey, 'custom'>): StatementFilter {
  const today = startOfToday();

  switch (key) {
    case 'last_7_days':
      return {
        key,
        label: 'Last 7 days',
        range: {
          from: toIsoDate(addDays(today, -6)),
          to: toIsoDate(today),
        },
      };
    case 'last_30_days':
      return {
        key,
        label: 'Last 30 days',
        range: {
          from: toIsoDate(addDays(today, -29)),
          to: toIsoDate(today),
        },
      };
    case 'this_month':
      return {
        key,
        label: 'This month',
        range: {
          from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
          to: toIsoDate(today),
        },
      };
    case 'all_time':
      return {
        key,
        label: 'All time',
      };
  }
}

function todayRange(): DocumentDateRange {
  const today = toIsoDate(startOfToday());
  return { from: today, to: today };
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatRange(range: DocumentDateRange): string {
  return `${range.from} to ${range.to}`;
}

function formatEntryCount(count: number): string {
  return count === 1 ? '1 entry' : `${count} entries`;
}

function getTemplateOptions(
  templates: DocumentTemplateCatalogItem[],
  isPro: boolean
): Array<{ label: string; value: string; description: string }> {
  return templates.map((template) => ({
    label: template.tier === 'pro' && !isPro ? `${template.label} · Pro` : template.label,
    value: template.key,
    description:
      template.tier === 'pro' && !isPro
        ? `Locked until Pro is active. ${template.description}`
        : template.description,
  }));
}

function formatShortTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
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
  errorState: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 240,
    gap: spacing.lg,
  },
  previewSheet: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  proThemeStrip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  proThemeDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  proThemeTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  proThemeLabel: {
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  proThemeText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  logoFallback: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  logoFallbackText: {
    color: colors.primary,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  businessName: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  taxNoticeCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    gap: spacing.md,
  },
  taxNoticeLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  taxNoticeText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 21,
  },
  upgradePromptCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.primarySurface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  upgradePromptHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  upgradePromptTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  upgradePromptLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  upgradePromptText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 21,
  },
  basicPdfPill: {
    borderRadius: 8,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: 136,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  basicPdfPillText: {
    color: colors.primary,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  filterCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  templateCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftColor: colors.tax,
    borderLeftWidth: 4,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  filterHeader: {
    gap: spacing.xs,
  },
  filterIndicator: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateField: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dateFieldActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  dateFieldValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  exportCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reviewCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  reviewHeaderText: {
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
  reviewStatusPill: {
    borderRadius: 8,
    backgroundColor: colors.primarySurface,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: 136,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  reviewStatusText: {
    color: colors.primary,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  reviewLines: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  reviewLine: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  reviewLineLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  reviewLineValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    lineHeight: 20,
  },
  reviewLineValueEmphasis: {
    color: colors.primary,
    fontSize: typography.body,
  },
  reviewHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  fileNameBox: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs,
  },
  fileNameText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    lineHeight: 20,
  },
  exportStatus: {
    borderRadius: 8,
    padding: spacing.md,
  },
  exportStatusSuccess: {
    backgroundColor: colors.successSurface,
  },
  exportStatusError: {
    backgroundColor: colors.dangerSurface,
  },
  exportStatusWarning: {
    backgroundColor: colors.warningSurface,
  },
  exportStatusText: {
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  exportStatusSuccessText: {
    color: colors.primary,
  },
  exportStatusErrorText: {
    color: colors.danger,
  },
  exportStatusWarningText: {
    color: colors.warning,
  },
  historyList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  historyItem: {
    gap: spacing.xs,
  },
  inlineEmptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  inlineEmptyTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  historyFileName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metaGrid: {
    gap: spacing.md,
  },
  metaBox: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs,
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  transactionRow: {
    minHeight: 68,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transactionText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  transactionDate: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  transactionDescription: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
    flexShrink: 1,
  },
  transactionAmount: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 152,
    gap: spacing.xs,
  },
  credit: {
    color: colors.accent,
    fontSize: typography.label,
    fontWeight: '900',
    textAlign: 'right',
  },
  payment: {
    color: colors.success,
    fontSize: typography.label,
    fontWeight: '900',
    textAlign: 'right',
  },
  balanceText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'right',
  },
  summaryCard: {
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 170,
    textAlign: 'right',
  },
  summaryEmphasis: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
    maxWidth: 180,
    textAlign: 'right',
  },
  signatureBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  signature: {
    width: 160,
    height: 56,
  },
  actions: {
    gap: spacing.md,
  },
});
