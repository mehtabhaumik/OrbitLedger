import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  getInvoiceDocumentStateLabel,
  getInvoicePaymentStatusLabel,
} from '@orbit-ledger/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { recordUsageAnalyticsEvent } from '../analytics';
import { BottomActionBar } from '../components/BottomActionBar';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectField } from '../components/SelectField';
import {
  getBusinessSettings,
  getCustomerLedger,
  getInvoice,
  listInvoicePaymentAllocations,
  updateInvoicePaymentStatus,
  updateInvoiceStatus,
} from '../database';
import type { BusinessSettings, Customer, InvoicePaymentAllocation, InvoiceWithItems } from '../database';
import {
  buildInvoiceDocument,
  buildInvoicePdfFileName,
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
  DocumentTemplateCatalogItem,
  DocumentTemplateKey,
  GeneratedPdf,
  GeneratedDocumentHistoryEntry,
  InvoiceDocumentData,
  SavedPdf,
  StructuredDocument,
} from '../documents';
import { recordRatingPositiveMoment } from '../engagement';
import { formatCurrency, formatShortDate } from '../lib/format';
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
import { getInvoiceTaxDocumentLabels, getInvoiceTaxProfile, type InvoiceTaxProfile } from '../tax';
import { colors, spacing, typography } from '../theme/theme';

type InvoicePreviewScreenProps = NativeStackScreenProps<RootStackParamList, 'InvoicePreview'>;

type InvoicePreviewSource = {
  businessProfile: BusinessSettings;
  customer: Customer | null;
  invoice: InvoiceWithItems;
  subscriptionStatus: SubscriptionStatus;
  proBrandTheme: ProBrandTheme;
  documentTemplate: Awaited<ReturnType<typeof loadDocumentTemplateForBusiness>>;
  selectedTemplateKey: DocumentTemplateKey;
  invoiceTaxProfile: InvoiceTaxProfile | null;
};

type ExportStatus = {
  tone: 'success' | 'warning' | 'error';
  message: string;
};

export function InvoicePreviewScreen({ navigation, route }: InvoicePreviewScreenProps) {
  const { invoiceId } = route.params;
  const [source, setSource] = useState<InvoicePreviewSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpgradePromptDismissed, setIsUpgradePromptDismissed] = useState(false);
  const [lastSavedPdf, setLastSavedPdf] = useState<SavedPdf | null>(null);
  const [viewedPdf, setViewedPdf] = useState<GeneratedPdf | null>(null);
  const [isPdfViewerVisible, setIsPdfViewerVisible] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<GeneratedDocumentHistoryEntry[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<InvoicePaymentAllocation[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentShareDetails>({});
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const documentGates = useMemo<DocumentFeatureGateState | null>(() => {
    if (!source) {
      return null;
    }

    return resolveDocumentFeatureGates(source.subscriptionStatus);
  }, [source]);

  const document = useMemo<StructuredDocument<InvoiceDocumentData> | null>(() => {
    if (!source || !documentGates) {
      return null;
    }

    return buildInvoiceDocument({
      businessProfile: source.businessProfile,
      customer: source.customer,
      invoice: source.invoice,
      documentOptions: {
        includeCustomBranding: documentGates.includeCustomBranding,
        pdfStyle: documentGates.pdfStyle,
        proTheme: documentGates.pdfStyle === 'advanced' ? source.proBrandTheme : null,
        gatedPremiumFeatures: documentGates.lockedFeatures.map((access) => access.feature),
        documentTemplate:
          getBuiltInDocumentTemplate(source.selectedTemplateKey)?.config ?? source.documentTemplate,
        ...getInvoiceTaxDocumentLabels(source.invoiceTaxProfile),
      },
    });
  }, [documentGates, source]);

  const data = document?.data;
  const activeProTheme = data?.rendering.proTheme;
  const visibleItems = useMemo(() => data?.items.slice(0, 10) ?? [], [data]);
  const invoiceFileName = document ? buildInvoicePdfFileName(document) : 'OrbitLedger_Invoice.pdf';
  const exportInProgress =
    isSaving || isSharing || isOpeningPdf || isOpeningPreview || isPrintingPdf || isRegenerating;

  const loadInvoicePreview = useCallback(
    async (canUpdate: () => boolean = () => true) => {
      if (canUpdate()) {
        setIsLoading(true);
        setLoadError(null);
      }

      try {
        const [businessProfile, invoice, subscriptionStatus, proBrandTheme, savedPaymentDetails] = await Promise.all([
          getBusinessSettings(),
          getInvoice(invoiceId),
          getSubscriptionStatus(),
          getActiveProBrandTheme(),
          getBusinessPaymentDetails(),
        ]);

        if (!businessProfile) {
          navigation.replace('Setup');
          return;
        }

        if (!invoice) {
          throw new Error('Invoice not found.');
        }

        const [customer, documentTemplate, invoiceTaxProfile, selectedTemplateKey, allocations] = await Promise.all([
          loadInvoiceCustomer(invoice),
          loadDocumentTemplateForBusiness(businessProfile, 'invoice'),
          getInvoiceTaxProfile(businessProfile),
          getPreferredDocumentTemplateKey(businessProfile, 'invoice', subscriptionStatus.isPro),
          listInvoicePaymentAllocations(invoiceId),
        ]);

        if (canUpdate()) {
          setSource({
            businessProfile,
            customer,
            invoice,
            subscriptionStatus,
            proBrandTheme,
            documentTemplate,
            selectedTemplateKey,
            invoiceTaxProfile,
          });
          setDocumentHistory(getInvoiceDocumentHistory());
          setPaymentAllocations(allocations);
          setPaymentDetails(savedPaymentDetails);
        }
      } catch {
        if (canUpdate()) {
          const message = 'Invoice preview could not load. Please try again.';
          setLoadError(message);
          setSource(null);
          Alert.alert('Invoice preview could not load', 'Please try again.');
        }
      } finally {
        if (canUpdate()) {
          setIsLoading(false);
        }
      }
    },
    [invoiceId, navigation]
  );

  useEffect(() => {
    let isMounted = true;

    void loadInvoicePreview(() => isMounted);

    return () => {
      isMounted = false;
    };
  }, [loadInvoicePreview]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadInvoicePreview();
    });

    return unsubscribe;
  }, [loadInvoicePreview, navigation]);

  async function savePdf() {
    if (!document) {
      return;
    }

    try {
      setExportStatus(null);
      setIsSaving(true);
      const savedPdf = await generateAndSavePdfFromStructuredDocument(document, invoiceFileName);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getInvoiceDocumentHistory());
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
      setExportStatus({
        tone: 'success',
        message: `Saved as ${savedPdf.fileName}.`,
      });
      Alert.alert('Invoice saved', `${savedPdf.fileName} has been saved.`);
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'Invoice PDF could not be saved. Please try again.',
      });
      Alert.alert('Invoice PDF could not be saved', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function markPaymentStatus(paymentStatus: 'paid' | 'unpaid') {
    try {
      setExportStatus(null);
      await updateInvoicePaymentStatus(invoiceId, paymentStatus);
      await loadInvoicePreview();
      setExportStatus({
        tone: 'success',
        message: paymentStatus === 'paid' ? 'Invoice marked paid.' : 'Invoice marked unpaid.',
      });
    } catch {
      Alert.alert('Invoice could not update', 'Please try again.');
    }
  }

  function recordInvoicePayment() {
    if (!sourceInvoice?.customerId) {
      Alert.alert('Customer required', 'Choose a customer on this invoice before recording payment.');
      return;
    }
    const dueAmount = Math.max(sourceInvoice.totalAmount - sourceInvoice.paidAmount, 0);
    if (dueAmount <= 0) {
      Alert.alert('Invoice is paid', 'No payment is due on this invoice.');
      return;
    }
    navigation.navigate('TransactionForm', {
      customerId: sourceInvoice.customerId,
      type: 'payment',
      invoiceId,
      amount: dueAmount,
    });
  }

  function cancelInvoice() {
    Alert.alert('Cancel invoice?', 'This keeps the history but marks the invoice as cancelled.', [
      { text: 'Keep invoice', style: 'cancel' },
      {
        text: 'Cancel invoice',
        style: 'destructive',
        onPress: () => {
          void updateInvoiceStatus(invoiceId, 'cancelled')
            .then(() => loadInvoicePreview())
            .catch(() => Alert.alert('Invoice could not update', 'Please try again.'));
        },
      },
    ]);
  }

  async function sharePdf() {
    if (!document) {
      return;
    }

    try {
      setExportStatus(null);
      setIsSharing(true);
      const savedPdf = await generateAndSavePdfFromStructuredDocument(document, invoiceFileName);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getInvoiceDocumentHistory());
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
          'Invoice saved',
          'Sharing is not available right now. The invoice was still saved.'
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
        message: 'Invoice PDF could not be shared. Please try again.',
      });
      Alert.alert('Invoice PDF could not be shared', 'Please try again.');
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
        kind: 'invoice',
        businessName: data.businessIdentity.businessName,
        customerName: data.customerIdentity.name,
        amount: source.invoice.totalAmount,
        currency: data.metadata.currency,
        countryCode: data.businessIdentity.countryCode,
        dueDate: data.metadata.dueDate,
        invoiceNumber: data.metadata.invoiceNumber,
        paymentDetails,
      });
      await sharePaymentRequestMessage(message);
      setExportStatus({
        tone: 'success',
        message: 'Payment message is ready to send. Record the payment only after you confirm it.',
      });
    } catch {
      setExportStatus({
        tone: 'error',
        message: 'Payment message could not be shared. Please try again.',
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
      generatedPdf = await generatePdfFromStructuredDocument(document, invoiceFileName);
      setViewedPdf(generatedPdf);
      setIsPdfViewerVisible(true);
      await openGeneratedPdf(generatedPdf);
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
    } catch {
      if (generatedPdf) {
        setExportStatus({
          tone: 'warning',
          message:
            'The invoice is ready, but your device could not open it. You can still save, share, or print it here.',
        });
        Alert.alert(
          'Invoice is ready',
          'Your device could not open it. You can still save, share, or print it from this screen.'
        );
        return;
      }

      setExportStatus({
        tone: 'error',
        message: 'Invoice PDF could not be created. Please try again.',
      });
      Alert.alert('Invoice PDF could not be created', 'Please try again.');
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
      Alert.alert('Invoice already saved', `${viewedPdf.fileName} is already saved.`);
      return;
    }

    try {
      setExportStatus(null);
      setIsSaving(true);
      const savedPdf = saveGeneratedPdfToDevice(viewedPdf, invoiceFileName, document);
      setViewedPdf(savedPdf);
      setLastSavedPdf(savedPdf);
      setDocumentHistory(getInvoiceDocumentHistory());
      await recordPdfGeneratedForUpgradeNudge();
      await recordRatingPositiveMoment('pdf_generated');
      await recordUsageAnalyticsEvent('pdf_generated');
      setExportStatus({
        tone: 'success',
        message: `Saved as ${savedPdf.fileName}.`,
      });
      Alert.alert('Invoice saved', `${savedPdf.fileName} has been saved.`);
    } catch {
      Alert.alert('Invoice PDF could not be saved', 'Please try again.');
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
      Alert.alert('Invoice PDF could not be shared', 'Please try again.');
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
      Alert.alert('Invoice PDF could not be printed', 'Please try again.');
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
      await loadInvoicePreview();
      setLastSavedPdf(null);
      setExportStatus({
        tone: 'success',
        message: 'Preview refreshed with the latest invoice data.',
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

  async function changeInvoiceTemplate(nextTemplateKey: string) {
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
      await savePreferredDocumentTemplateKey(source.businessProfile, 'invoice', nextTemplate.key);
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
        message: `${nextTemplate.label} will be used for this invoice PDF.`,
      });
    } catch {
      Alert.alert('Template could not be saved', 'Please try again.');
    }
  }

  async function openUpgradeFromDocumentPrompt() {
    const firstLockedFeature = documentGates?.lockedFeatures[0]?.feature;
    if (firstLockedFeature) {
      await recordPremiumFeatureAttemptForUpgradeNudge(firstLockedFeature);
    }

    navigation.navigate('Upgrade');
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.muted}>Preparing invoice preview</Text>
      </SafeAreaView>
    );
  }

  const sourceInvoice = source?.invoice;

  if (!data || !sourceInvoice) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Invoice preview could not load</Text>
          <Text style={styles.muted}>{loadError ?? 'Invoice data is unavailable.'}</Text>
          <PrimaryButton onPress={() => void loadInvoicePreview()}>
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
          title="Invoice Preview"
          subtitle="Review the invoice before exporting a PDF."
          onBack={() => navigation.goBack()}
        />

        <PrimaryButton
          variant="secondary"
          onPress={() => navigation.navigate('InvoiceForm', { invoiceId })}
        >
          Edit Invoice
        </PrimaryButton>

        <View style={styles.lifecycleActions}>
          <PrimaryButton
            variant="secondary"
            onPress={recordInvoicePayment}
          >
            Record Payment
          </PrimaryButton>
          {sourceInvoice.paidAmount <= 0 ? (
            <PrimaryButton
              variant="ghost"
              onPress={() => void markPaymentStatus('unpaid')}
            >
              Mark Unpaid
            </PrimaryButton>
          ) : null}
          <PrimaryButton
            variant="ghost"
            onPress={cancelInvoice}
          >
            Cancel Invoice
          </PrimaryButton>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewHeaderText}>
              <Text style={styles.reviewLabel}>Payment allocation</Text>
              <Text style={styles.sectionTitle}>Money applied to this invoice</Text>
            </View>
            <View style={styles.reviewStatusPill}>
              <Text style={styles.reviewStatusText}>
                {formatCurrency(Math.max(sourceInvoice.totalAmount - sourceInvoice.paidAmount, 0), data.metadata.currency)} due
              </Text>
            </View>
          </View>
          <View style={styles.reviewLines}>
            <ReviewLine label="Invoice total" value={formatCurrency(sourceInvoice.totalAmount, data.metadata.currency)} />
            <ReviewLine label="Allocated payments" value={formatCurrency(sourceInvoice.paidAmount, data.metadata.currency)} />
            <ReviewLine label="Still due" value={formatCurrency(Math.max(sourceInvoice.totalAmount - sourceInvoice.paidAmount, 0), data.metadata.currency)} emphasized />
          </View>
          {paymentAllocations.length ? (
            <View style={styles.allocationList}>
              {paymentAllocations.map((allocation) => (
                <View key={allocation.id} style={styles.allocationItem}>
                  <View style={styles.allocationText}>
                    <Text style={styles.allocationTitle}>
                      {formatCurrency(allocation.amount, data.metadata.currency)}
                    </Text>
                    <Text style={styles.muted}>
                      {formatShortDate(allocation.transactionEffectiveDate)}
                      {allocation.transactionNote ? ` - ${allocation.transactionNote}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No payments are allocated to this invoice yet.</Text>
          )}
        </View>

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
          <Text style={styles.sectionTitle}>Invoice Template</Text>
          <Text style={styles.muted}>
            Choose the country-ready layout for this invoice. Pro templates add branding and a more
            polished letterhead.
          </Text>
          <SelectField
            label="Template"
            value={source?.selectedTemplateKey ?? ''}
            options={getTemplateOptions(
              source ? getBuiltInDocumentTemplateCatalog(source.businessProfile, 'invoice') : [],
              source?.subscriptionStatus.isPro ?? false
            )}
            onChange={(value) => void changeInvoiceTemplate(value)}
          />
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewHeaderText}>
              <Text style={styles.reviewLabel}>Review before sharing</Text>
              <Text style={styles.sectionTitle}>Invoice {data.metadata.invoiceNumber}</Text>
            </View>
            <View style={styles.reviewStatusPill}>
              <Text style={styles.reviewStatusText}>{getInvoicePaymentStatusLabel(sourceInvoice.paymentStatus)}</Text>
            </View>
          </View>
          <View style={styles.reviewLines}>
            <ReviewLine label="Invoice state" value={getInvoiceDocumentStateLabel(sourceInvoice.documentState)} />
            <ReviewLine label="Payment state" value={getInvoicePaymentStatusLabel(sourceInvoice.paymentStatus)} />
            <ReviewLine label="Customer" value={data.customerIdentity.name} />
            <ReviewLine label="Issue date" value={formatShortDate(data.metadata.issueDate)} />
            <ReviewLine
              label="Due date"
              value={data.metadata.dueDate ? formatShortDate(data.metadata.dueDate) : 'Not set'}
            />
            <ReviewLine label="Items" value={formatItemCount(data.items.length)} />
            <ReviewLine label="Total" value={data.summary.totalAmount.formatted} emphasized />
            <ReviewLine label="Tax format" value={formatCountryFormat(data.rendering.template.countryFormat)} />
            <ReviewLine
              label="Document style"
              value={
                documentGates?.pdfStyle === 'advanced'
                  ? `${data.rendering.template.label} · ${activeProTheme?.label ?? 'Pro theme'}`
                  : data.rendering.template.label
              }
            />
            <ReviewLine label="PDF name" value={invoiceFileName} />
          </View>
          <Text style={styles.reviewHelper}>
            The PDF will include every invoice item, even when only the first few items are shown in
            the mobile preview.
          </Text>
        </View>

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
              <View style={[styles.proThemeDot, { backgroundColor: activeProTheme.accentColor }]} />
              <View style={styles.proThemeTextBlock}>
                <Text style={[styles.proThemeLabel, { color: activeProTheme.accentColor }]}>
                  Pro branding active
                </Text>
                <Text style={styles.proThemeText}>
                  {activeProTheme.label} theme will be used for this invoice.
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
              {data.businessIdentity.taxRegistrationNumber ? (
                <Text style={styles.muted}>
                  {data.taxPlaceholder.taxSummaryLabel ?? 'Tax'} ID:{' '}
                  {data.businessIdentity.taxRegistrationNumber}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.identityGrid}>
            <View style={styles.identityBox}>
              <Text style={styles.label}>Bill To</Text>
              <Text style={styles.sectionTitle}>{data.customerIdentity.name}</Text>
              {data.customerIdentity.phone ? (
                <Text style={styles.muted}>{data.customerIdentity.phone}</Text>
              ) : null}
              {data.customerIdentity.address ? (
                <Text style={styles.muted}>{data.customerIdentity.address}</Text>
              ) : null}
            </View>
            <View style={styles.identityBox}>
              <Text style={styles.label}>Invoice</Text>
              <Text style={styles.sectionTitle}>{data.metadata.invoiceNumber}</Text>
              <Text style={styles.muted}>Issued {data.metadata.issueDate}</Text>
              <Text style={styles.muted}>
                Due {data.metadata.dueDate ?? 'not set'} - {data.metadata.status}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {visibleItems.map((item) => (
              <View key={item.itemId} style={styles.itemRow}>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.muted}>
                    Qty {formatQuantity(item.quantity)} - {item.price.formatted} -{' '}
                    {data.taxPlaceholder.taxColumnLabel ?? 'Tax'} {item.taxRate}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{item.total.formatted}</Text>
              </View>
            ))}
            {data.items.length > visibleItems.length ? (
              <Text style={styles.muted}>
                {data.items.length - visibleItems.length} more items included in the PDF.
              </Text>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Totals</Text>
            <SummaryLine label="Subtotal" value={data.summary.subtotal.formatted} />
            <SummaryLine
              label={data.taxPlaceholder.taxSummaryLabel ?? 'Tax'}
              value={data.summary.taxAmount.formatted}
            />
            <SummaryLine label="Total" value={data.summary.totalAmount.formatted} emphasized />
            <Text style={styles.muted}>Amount in words: {data.summary.amountInWords}</Text>
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
            <Text style={styles.fileNameText}>{invoiceFileName}</Text>
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
              <Text style={styles.label}>Recent invoice exports</Text>
              {documentHistory.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <Text style={styles.historyFileName}>{item.fileName}</Text>
                  <Text style={styles.historyMeta}>{formatShortTimestamp(item.createdAt)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.inlineEmptyState}>
              <Text style={styles.inlineEmptyTitle}>No invoices exported yet</Text>
              <Text style={styles.muted}>Save or share this invoice to keep a copy.</Text>
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
        title="Invoice PDF ready"
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

async function loadInvoiceCustomer(invoice: InvoiceWithItems): Promise<Customer | null> {
  if (!invoice.customerId) {
    return null;
  }

  try {
    const ledger = await getCustomerLedger(invoice.customerId);
    return ledger.customer;
  } catch {
    return null;
  }
}

function getInvoiceDocumentHistory(): GeneratedDocumentHistoryEntry[] {
  return getGeneratedDocumentHistory().filter((entry) => entry.documentKind === 'invoice');
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
        minimumFontScale={0.78}
        numberOfLines={2}
        style={emphasized ? styles.reviewLineValueEmphasis : styles.reviewLineValue}
      >
        {value}
      </Text>
    </View>
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
      <Text style={emphasized ? styles.summaryLabelEmphasis : styles.summaryLabel}>{label}</Text>
      <Text style={emphasized ? styles.summaryValueEmphasis : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function formatItemCount(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

function formatCountryFormat(format: string | undefined): string {
  if (format === 'india_gst') {
    return 'India GST';
  }
  if (format === 'us_sales_tax') {
    return 'US sales tax';
  }
  if (format === 'uk_vat') {
    return 'UK VAT';
  }
  return 'Standard tax';
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

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function formatShortTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
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
    padding: spacing.xl,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 240,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
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
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  errorState: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  upgradePromptCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
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
    minWidth: 0,
  },
  upgradePromptLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  upgradePromptText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  basicPdfPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: 136,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  basicPdfPillText: {
    color: colors.textMuted,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  lifecycleActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  templateCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftColor: colors.tax,
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  reviewHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  reviewLabel: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reviewStatusPill: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 28,
    maxWidth: 132,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  reviewStatusText: {
    color: colors.primary,
    flexShrink: 1,
    flexWrap: 'wrap',
    lineHeight: 16,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  reviewLines: {
    gap: spacing.sm,
  },
  reviewLine: {
    alignItems: 'flex-start',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  reviewLineLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: typography.label,
  },
  reviewLineValue: {
    color: colors.text,
    flex: 1.35,
    fontSize: typography.label,
    fontWeight: '800',
    textAlign: 'right',
  },
  reviewLineValueEmphasis: {
    color: colors.primary,
    flex: 1.35,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  reviewHelper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  allocationList: {
    gap: spacing.sm,
  },
  allocationItem: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  allocationText: {
    gap: spacing.xs,
  },
  allocationTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  previewSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  proThemeStrip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
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
    textTransform: 'uppercase',
  },
  proThemeText: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  logo: {
    borderRadius: 8,
    height: 64,
    width: 64,
  },
  logoFallback: {
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  logoFallbackText: {
    color: colors.primary,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  businessName: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  identityGrid: {
    gap: spacing.md,
  },
  identityBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  itemRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  itemText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  itemName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  itemDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  itemTotal: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 128,
    textAlign: 'right',
  },
  summaryCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryLine: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  summaryLabelEmphasis: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  summaryValueEmphasis: {
    color: colors.primary,
    fontSize: typography.amount,
    fontWeight: '900',
  },
  signatureBlock: {
    alignItems: 'flex-end',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  signature: {
    height: 64,
    width: 180,
  },
  exportCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  fileNameBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  fileNameText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  historyList: {
    gap: spacing.sm,
  },
  historyItem: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  historyFileName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  historyMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  inlineEmptyState: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  inlineEmptyTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  exportStatus: {
    borderRadius: 8,
    padding: spacing.md,
  },
  exportStatusSuccess: {
    backgroundColor: colors.successSurface,
  },
  exportStatusWarning: {
    backgroundColor: colors.warningSurface,
  },
  exportStatusError: {
    backgroundColor: colors.dangerSurface,
  },
  exportStatusText: {
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  exportStatusSuccessText: {
    color: colors.success,
  },
  exportStatusWarningText: {
    color: colors.warning,
  },
  exportStatusErrorText: {
    color: colors.danger,
  },
  actions: {
    gap: spacing.md,
  },
});
