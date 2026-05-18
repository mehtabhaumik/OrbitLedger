'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  appendPaymentLinkToMessage,
  buildInvoicePaymentLink,
  buildManualPaymentInstructionLines,
  deriveInvoicePaymentStatus,
  doesPaymentAwaitClearance,
  doesPaymentClearInvoice,
  getManualPaymentInstructionTemplate,
  getManualPaymentVerificationPlan,
  getInvoiceDocumentStateLabel,
  getInvoicePaymentDocumentStatusLine,
  getInvoicePaymentStatusLabel,
  getPaymentClearanceDocumentStatusLine,
  getPaymentClearanceStatusLabel,
  getPaymentClearanceStatusesForMode,
  getPaymentClearanceUnpaidReason,
  getPaymentDocumentModeLine,
  getPaymentModeConfig,
  normalizePaymentClearanceStatus,
  PAYMENT_MODE_CONFIGS,
  summarizePaymentClearance,
  summarizePaymentMode,
  type InvoiceDocumentState,
  type InvoicePaymentStatus,
  type PaymentClearanceStatus,
  type PaymentInstrumentAttachment,
  type PaymentLinkDetails,
  type PaymentMode,
  type PaymentModeDetails,
} from '@orbit-ledger/core';

import { AppShell } from '@/components/app-shell';
import {
  archiveWorkspaceInvoice,
  createWorkspaceInvoicePayment,
  deleteDraftWorkspaceInvoice,
  getWorkspaceInvoiceDetail,
  listWorkspaceInvoicePaymentAllocations,
  listWorkspaceCustomers,
  listWorkspaceProducts,
  reverseWorkspaceInvoicePaymentAllocation,
  saveWorkspaceInvoiceDetail,
  updateWorkspacePaymentClearance,
  type WorkspaceCustomer,
  type WorkspaceInvoiceDetail,
  type WorkspaceInvoiceVersion,
  type WorkspaceInvoicePaymentAllocation,
  type WorkspaceProduct,
} from '@/lib/workspace-data';
import {
  buildInvoiceWebDocument,
  buildPaymentRequestMessage,
  downloadInvoiceCsv,
  downloadInvoicePdf,
  getWebDocumentTemplates,
  getWebTemplateAccessError,
  openPrintableDocument,
  type WebDocumentTemplate,
} from '@/lib/web-documents';
import {
  resolveWebFeatureAccess,
} from '@/lib/web-monetization';
import { getWebPaymentProviderPlan } from '@/lib/payment-provider-mode';
import { createRazorpayCheckoutLink } from '@/lib/provider-checkout';
import { uploadPaymentInstrumentImage } from '@/lib/workspace-storage';
import { useConfirmDialog } from '@/providers/confirm-dialog-provider';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useWebSubscription } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

type EditableItem = {
  id?: string;
  productId?: string | null;
  name: string;
  description: string;
  quantity: string;
  price: string;
  taxRate: string;
};

const REVISION_REASON_OPTIONS = [
  'Item added',
  'Item removed',
  'Item name or description corrected',
  'Quantity corrected',
  'Price corrected',
  'Tax rate corrected',
  'Tax split corrected',
  'Total amount corrected',
  'Customer changed',
  'Customer name corrected',
  'Customer GSTIN or tax ID corrected',
  'Billing address corrected',
  'Shipping address corrected',
  'Place of supply corrected',
  'Issue date corrected',
  'Due date corrected',
  'Payment terms changed',
  'Payment instructions updated',
  'Payment proof updated',
  'Invoice notes updated',
  'Template or branding updated',
  'Discount or adjustment added',
  'Discount or adjustment removed',
  'Compliance wording corrected',
  'Duplicate or typing mistake fixed',
  'Customer requested revision',
  'Internal review correction',
];

export default function InvoiceEditorPage() {
  return (
    <Suspense fallback={<InvoiceEditorShell message="Loading invoice..." />}>
      <InvoiceEditorContent />
    </Suspense>
  );
}

function InvoiceEditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get('invoiceId') ?? '';
  const versionId = searchParams.get('versionId') ?? '';
  const { activeWorkspace } = useWorkspace();
  const { status: subscription } = useWebSubscription();
  const { showToast } = useToast();
  const { confirm, prompt } = useConfirmDialog();
  const officeAccess = useOfficeAccess();
  const providerPlan = getWebPaymentProviderPlan();
  const [invoice, setInvoice] = useState<WorkspaceInvoiceDetail | null>(null);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<InvoicePaymentStatus>('unpaid');
  const [useForMonthlyAutoEmail, setUseForMonthlyAutoEmail] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentDetails, setPaymentDetails] = useState<PaymentModeDetails>({});
  const [paymentClearanceStatus, setPaymentClearanceStatus] = useState<PaymentClearanceStatus>('received');
  const [hasPaymentClearancePreviewOverride, setHasPaymentClearancePreviewOverride] = useState(false);
  const [paymentAttachments, setPaymentAttachments] = useState<PaymentInstrumentAttachment[]>([]);
  const [includeInstrumentInDocument, setIncludeInstrumentInDocument] = useState(false);
  const [urgentPaymentRequired, setUrgentPaymentRequired] = useState(false);
  const [paymentLinkDetails, setPaymentLinkDetails] = useState<PaymentLinkDetails>({});
  const [includePaymentLinkInDocument, setIncludePaymentLinkInDocument] = useState(true);
  const [allocations, setAllocations] = useState<WorkspaceInvoicePaymentAllocation[]>([]);
  const [revisionReasonChoice, setRevisionReasonChoice] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([emptyItem()]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState('');
  const premiumTemplateAccess = resolveWebFeatureAccess(subscription, 'advanced_pdf_styling');
  const paymentProofAccess = resolveWebFeatureAccess(subscription, 'payment_proof_attachments');
  const paymentLinkAccess = resolveWebFeatureAccess(subscription, 'payment_links');
  const recurringAutoEmailAccess = resolveWebFeatureAccess(subscription, 'recurring_auto_email');
  const paymentReversalAccess = resolveWebFeatureAccess(subscription, 'payment_reversals');
  const invoiceTemplates = activeWorkspace ? getWebDocumentTemplates(activeWorkspace, 'invoice') : [];
  const selectedTemplate = invoiceTemplates.find((template) => template.key === templateKey) ?? invoiceTemplates[0];
  const paymentInstructionTemplate = getManualPaymentInstructionTemplate(activeWorkspace?.countryCode);
  const isReadOnlyVersion = Boolean(versionId);
  const effectiveRevisionReason = getEffectiveRevisionReason(revisionReasonChoice, revisionReason);
  const needsRevisionReason = Boolean(invoice && !isReadOnlyVersion && invoice.documentState !== 'draft');
  const canEditInvoiceDocument = Boolean(
    invoice && officeAccess.can(invoice.documentState === 'draft' ? 'create_invoices' : 'edit_latest_invoice')
  );
  const canSaveInvoice = Boolean(
    invoice && !isReadOnlyVersion && !isSaving && canEditInvoiceDocument && (!needsRevisionReason || effectiveRevisionReason)
  );

  const defaultTaxRate = useMemo(
    () =>
      typeof activeWorkspace?.defaultTaxRate === 'number'
        ? activeWorkspace.defaultTaxRate
        : getDefaultInvoiceTaxRate(activeWorkspace?.countryCode, selectedTemplate?.countryFormat),
    [activeWorkspace?.countryCode, activeWorkspace?.defaultTaxRate, selectedTemplate?.countryFormat]
  );

  useEffect(() => {
    if (!activeWorkspace || !invoiceId) {
      setMessage(invoiceId ? null : 'Choose an invoice from the invoice list.');
      return;
    }
    setMessage(null);
    void Promise.all([
      getWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoiceId),
      listWorkspaceCustomers(activeWorkspace.workspaceId),
      listWorkspaceProducts(activeWorkspace.workspaceId),
      listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoiceId),
    ])
      .then(([nextInvoice, nextCustomers, nextProducts, nextAllocations]) => {
        setCustomers(nextCustomers);
        setProducts(nextProducts);
        if (!nextInvoice) {
          setMessage('Invoice could not be found.');
          return;
        }
        const selectedVersion = versionId
          ? nextInvoice.versions?.find((version) => version.id === versionId) ?? null
          : null;
        if (versionId && !selectedVersion) {
          setInvoice(null);
          setAllocations([]);
          setMessage('Saved invoice version could not be found.');
          return;
        }
        const invoiceForScreen = selectedVersion
          ? buildReadonlyVersionInvoiceDetail(nextInvoice, selectedVersion)
          : nextInvoice;
        setInvoice(invoiceForScreen);
        setAllocations(selectedVersion ? [] : nextAllocations);
        const nextDueAmount = Math.max(invoiceForScreen.totalAmount - invoiceForScreen.paidAmount, 0);
        setPaymentAmount(nextDueAmount > 0 ? formatAmountInput(nextDueAmount) : '');
        setPaymentDate(new Date().toISOString().slice(0, 10));
        setPaymentNote(`Payment for invoice ${invoiceForScreen.invoiceNumber}`);
        setCustomerId(invoiceForScreen.customerId ?? '');
        setInvoiceNumber(invoiceForScreen.invoiceNumber);
        setIssueDate(invoiceForScreen.issueDate);
        setDueDate(
          invoiceForScreen.dueDate ??
            (invoiceForScreen.documentState === 'draft'
              ? addDays(invoiceForScreen.issueDate, activeWorkspace.defaultDueDays)
              : '') ??
            ''
        );
        setPaymentStatus(invoiceForScreen.paymentStatus);
        setUseForMonthlyAutoEmail(Boolean(invoiceForScreen.useForMonthlyAutoEmail));
        setHasPaymentClearancePreviewOverride(false);
        setUrgentPaymentRequired(
          invoiceForScreen.documentState === 'draft' ? Boolean(activeWorkspace.urgentPaymentStampDefault) : false
        );
        setTemplateKey(
          resolveInvoiceTemplatePreference(
            nextCustomers.find((customer) => customer.id === invoiceForScreen.customerId) ?? null,
            activeWorkspace.defaultInvoiceTemplate,
            getWebDocumentTemplates(activeWorkspace, 'invoice')
          )
        );
        setRevisionReasonChoice('');
        setRevisionReason('');
        setNotes(invoiceForScreen.notes ?? (invoiceForScreen.documentState === 'draft' ? activeWorkspace.defaultInvoiceNotes ?? '' : ''));
        const nextDefaultTaxRate =
          typeof activeWorkspace.defaultTaxRate === 'number'
            ? activeWorkspace.defaultTaxRate
            : getDefaultInvoiceTaxRate(activeWorkspace.countryCode);
        setItems(
          invoiceForScreen.items.length
            ? invoiceForScreen.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                name: item.name,
                description: item.description ?? '',
                quantity: String(item.quantity),
                price: String(item.price),
                taxRate: String(typeof item.taxRate === 'number' ? item.taxRate : nextDefaultTaxRate),
              }))
            : [emptyItem(nextDefaultTaxRate)]
        );
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Invoice could not be loaded.');
      });
  }, [activeWorkspace, invoiceId, versionId]);

  useEffect(() => {
    if (activeWorkspace) {
      setPaymentLinkDetails(activeWorkspace.paymentInstructions);
    }
  }, [activeWorkspace]);

  const totals = useMemo(() => {
    return items.reduce(
      (summary, item) => {
        const quantity = parseMoney(item.quantity);
        const price = parseMoney(item.price);
        const taxRate = parseMoney(item.taxRate);
        const subtotal = quantity * price;
        summary.subtotal += subtotal;
        summary.tax += subtotal * (taxRate / 100);
        return summary;
      },
      { subtotal: 0, tax: 0 }
    );
  }, [items]);
  const total = totals.subtotal + totals.tax;
  const currency = activeWorkspace?.currency ?? 'INR';
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const dueAmount = invoice ? Math.max(total - invoice.paidAmount, 0) : 0;
  const stagedPaymentAmount = !isReadOnlyVersion
    ? Math.min(Math.max(parseMoney(paymentAmount), 0), dueAmount)
    : 0;
  const stagedPaymentClears =
    stagedPaymentAmount > 0 && doesPaymentClearInvoice(paymentClearanceStatus, paymentMode);
  const stagedPaymentAwaits =
    stagedPaymentAmount > 0 && doesPaymentAwaitClearance(paymentClearanceStatus, paymentMode);
  const selectedClearanceClears = doesPaymentClearInvoice(paymentClearanceStatus, paymentMode);
  const previewPaidAmount = invoice
    ? invoice.paidAmount + (stagedPaymentClears ? stagedPaymentAmount : 0)
    : 0;
  const previewPaymentStatus = invoice
    ? hasPaymentClearancePreviewOverride && !selectedClearanceClears
      ? 'unpaid'
      : paymentStatus === 'paid' && previewPaidAmount < total
        ? deriveInvoicePaymentStatus({
            dueDate,
            totalAmount: total,
            paidAmount: previewPaidAmount,
            pendingAmount: stagedPaymentAwaits ? stagedPaymentAmount : 0,
          })
        : paymentStatus
    : paymentStatus;
  const previewPaymentStatusReason =
    hasPaymentClearancePreviewOverride && !selectedClearanceClears
      ? getPaymentClearanceUnpaidReason(paymentClearanceStatus, paymentMode)
      : invoice?.paymentStatusReason ?? null;
  const previewPaymentDocumentStatusLine =
    hasPaymentClearancePreviewOverride
      ? getPaymentClearanceDocumentStatusLine(paymentClearanceStatus, paymentMode)
      : getInvoicePaymentDocumentStatusLine({
          paymentStatus: previewPaymentStatus,
          paymentStatusReason: previewPaymentStatusReason,
        });
  const previewPaymentDocumentModeLine = hasPaymentClearancePreviewOverride
    ? getPaymentDocumentModeLine(paymentMode, paymentDetails)
    : null;
  const documentInstrumentAttachment =
    paymentAttachments[0] ?? allocations.flatMap((allocation) => allocation.paymentAttachments)[0] ?? null;
  const hostedPaymentPageUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/pay/` : undefined;
  const invoicePaymentLink = useMemo(
    () =>
      activeWorkspace
        ? buildInvoicePaymentLink({
            amount: dueAmount > 0 ? dueAmount : total,
            businessName: activeWorkspace.businessName,
            countryCode: activeWorkspace.countryCode,
            currency,
            customerName: selectedCustomer?.name ?? null,
            dueDate,
            invoiceNumber,
            details: {
              ...paymentLinkDetails,
              hostedPaymentPageUrl,
              preferHostedPaymentPage: true,
            },
          })
        : null,
    [activeWorkspace, currency, dueAmount, dueDate, hostedPaymentPageUrl, invoiceNumber, paymentLinkDetails, selectedCustomer?.name, total]
  );
  const paymentVerificationPlan = useMemo(
    () =>
      getManualPaymentVerificationPlan({
        allocationStrategy: 'selected_invoice',
        clearanceStatus: paymentClearanceStatus,
        paymentMode,
      }),
    [paymentClearanceStatus, paymentMode]
  );
  const paymentClearanceOptions = useMemo(
    () => getPaymentClearanceStatusesForMode(paymentMode),
    [paymentMode]
  );

  useEffect(() => {
    setPaymentClearanceStatus((current) =>
      normalizePaymentClearanceStatus(current, paymentMode, paymentDetails)
    );
  }, [paymentDetails, paymentMode]);

  const currentInvoiceDocument = useMemo(() => {
    if (!activeWorkspace || !invoice) {
      return null;
    }
    const documentInvoice: WorkspaceInvoiceDetail = {
      ...invoice,
      customerId: customerId || null,
      invoiceNumber,
      issueDate,
      dueDate: dueDate || null,
      status: invoice.documentState,
      documentState: invoice.documentState,
      paymentStatus: previewPaymentStatus,
      paymentStatusReason: previewPaymentStatus === 'paid' ? null : previewPaymentStatusReason,
      notes,
      totalAmount: total,
      paidAmount: previewPaidAmount,
      items: items
        .filter((item) => item.name.trim())
        .map((item, index) => {
          const quantity = parseMoney(item.quantity);
          const price = parseMoney(item.price);
          const taxRate = parseMoney(item.taxRate);
          const subtotal = quantity * price;
          return {
            id: item.id ?? `draft-${index}`,
            invoiceId: invoice.id,
            productId: item.productId ?? null,
            name: item.name.trim(),
            description: item.description.trim() || null,
            quantity,
            price,
            taxRate,
            total: subtotal + subtotal * (taxRate / 100),
          };
        }),
    };
    const documentCustomer =
      isReadOnlyVersion && invoice.customerName
        ? selectedCustomer
          ? { ...selectedCustomer, name: invoice.customerName }
          : ({ id: invoice.customerId ?? 'saved-version-customer', name: invoice.customerName } as WorkspaceCustomer)
        : selectedCustomer;

    return buildInvoiceWebDocument({
      workspace: activeWorkspace,
      invoice: documentInvoice,
      customer: documentCustomer,
      subscription,
      templateKey: selectedTemplate?.key,
      urgentPaymentRequired,
      instrumentAttachment:
        paymentProofAccess.allowed && includeInstrumentInDocument && documentInstrumentAttachment
          ? {
              name: documentInstrumentAttachment.name,
              url: documentInstrumentAttachment.url,
              contentType: documentInstrumentAttachment.contentType,
            }
          : null,
      paymentLink: paymentLinkAccess.allowed && includePaymentLinkInDocument ? invoicePaymentLink : null,
      manualPaymentInstructions: buildManualPaymentInstructionLines(
        paymentLinkDetails,
        activeWorkspace.countryCode
      ),
      paymentModeLine: previewPaymentDocumentModeLine,
      paymentStatusLine: previewPaymentDocumentStatusLine,
    });
  }, [activeWorkspace, customerId, documentInstrumentAttachment, dueDate, includeInstrumentInDocument, includePaymentLinkInDocument, invoice, invoiceNumber, invoicePaymentLink, isReadOnlyVersion, issueDate, items, notes, paymentDetails, paymentLinkAccess.allowed, paymentLinkDetails, paymentProofAccess.allowed, previewPaidAmount, previewPaymentDocumentModeLine, previewPaymentDocumentStatusLine, previewPaymentStatus, previewPaymentStatusReason, selectedCustomer, selectedTemplate?.key, subscription, total, urgentPaymentRequired]);

  function selectedTemplateAccessError() {
    return activeWorkspace
      ? getWebTemplateAccessError(activeWorkspace, 'invoice', templateKey || selectedTemplate?.key, subscription.isPro)
      : null;
  }

  async function saveInvoice(
    nextPaymentStatus = previewPaymentStatus,
    reason = effectiveRevisionReason,
    documentState?: InvoiceDocumentState
  ) {
    if (!activeWorkspace || !invoice) {
      return;
    }

    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to make changes.', 'info');
      return;
    }
    if (!canEditInvoiceDocument) {
      showToast(officeAccess.getLockedMessage(invoice.documentState === 'draft' ? 'create_invoices' : 'edit_latest_invoice'), 'info');
      return;
    }

    if (!invoiceNumber.trim() || !issueDate.trim()) {
      showToast('Add an invoice number and issue date before saving.', 'danger');
      return;
    }

    if (invoice.documentState !== 'draft' && !reason.trim()) {
      showToast('Choose why this invoice is being updated before saving.', 'danger');
      return;
    }

    if (useForMonthlyAutoEmail && !recurringAutoEmailAccess.allowed) {
      showToast(recurringAutoEmailAccess.message ?? 'Monthly auto email is not included in your plan.', 'info');
      return;
    }

    const hasInvalidItem = items.some(
      (item) =>
        item.name.trim() &&
        (parseMoney(item.quantity) <= 0 || parseMoney(item.price) < 0 || parseMoney(item.taxRate) < 0)
    );
    if (hasInvalidItem) {
      showToast('Check item quantity, price, and tax before saving.', 'danger');
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await saveWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoice.id, {
        customerId: customerId || null,
        invoiceNumber,
        issueDate,
        dueDate: dueDate || null,
        documentState,
        paymentStatus: nextPaymentStatus,
        paymentStatusReason: nextPaymentStatus === 'paid' ? null : previewPaymentStatusReason,
        useForMonthlyAutoEmail,
        revisionReason: reason,
        notes,
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId ?? null,
          name: item.name,
          description: item.description,
          quantity: parseMoney(item.quantity),
          price: parseMoney(item.price),
          taxRate: parseMoney(item.taxRate),
        })),
      });
      setInvoice(updated);
      setPaymentStatus(updated.paymentStatus);
      setHasPaymentClearancePreviewOverride(false);
      setRevisionReasonChoice('');
      setRevisionReason('');
      showToast('Invoice saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  function updateItem(index: number, field: keyof EditableItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((entry) => entry.id === productId);
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }
        if (!product) {
          return { ...item, productId: null };
        }
        return {
          ...item,
          productId: product.id,
          name: product.name,
          price: String(product.price),
          taxRate: item.taxRate || formatTaxRateInput(defaultTaxRate),
        };
      })
    );
  }

  function duplicateItem(index: number) {
    setItems((current) => {
      const item = current[index];
      return item ? [...current.slice(0, index + 1), { ...item, id: undefined }, ...current.slice(index + 1)] : current;
    });
  }

  function removeItem(index: number) {
    setItems((current) => {
      if (current.length === 1) {
        return [emptyItem()];
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function viewPdf() {
    const accessError = selectedTemplateAccessError();
    if (accessError) {
      showToast(accessError, 'danger');
      return;
    }
    if (!currentInvoiceDocument) {
      return;
    }
    try {
      openPrintableDocument(currentInvoiceDocument.html);
      showToast('Invoice opened. Choose Save as PDF in the print window.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice PDF could not be opened.', 'danger');
    }
  }

  async function downloadInvoiceDocument() {
    const accessError = selectedTemplateAccessError();
    if (accessError) {
      showToast(accessError, 'danger');
      return;
    }
    if (!currentInvoiceDocument) {
      return;
    }
    try {
      await downloadInvoicePdf(currentInvoiceDocument);
      showToast('Invoice PDF downloaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice PDF could not be downloaded.', 'danger');
    }
  }

  function downloadInvoiceCsvFile() {
    const accessError = selectedTemplateAccessError();
    if (accessError) {
      showToast(accessError, 'danger');
      return;
    }
    if (!currentInvoiceDocument) {
      return;
    }
    downloadInvoiceCsv(currentInvoiceDocument);
    showToast('Invoice CSV downloaded.', 'success');
  }

  async function copyPaymentMessage() {
    if (!activeWorkspace || !currentInvoiceDocument) {
      return;
    }
    const messageText = buildPaymentRequestMessage({
      businessName: activeWorkspace.businessName,
      customerName: selectedCustomer?.name ?? 'Customer',
      amount: dueAmount > 0 ? dueAmount : total,
      currency,
      documentLabel: 'invoice',
      documentNumber: invoiceNumber,
      countryCode: activeWorkspace.countryCode,
      paymentDetails: paymentLinkDetails,
    });
    await navigator.clipboard.writeText(appendPaymentLinkToMessage(messageText, invoicePaymentLink));
    showToast('Payment message copied.', 'success');
  }

  async function createRazorpayCheckout() {
    if (!activeWorkspace || !invoice) {
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to record payment.', 'info');
      return;
    }
    if (!officeAccess.can('record_payments')) {
      showToast(officeAccess.getLockedMessage('record_payments'), 'info');
      return;
    }
    if (dueAmount <= 0) {
      showToast('This invoice has no pending amount.', 'info');
      return;
    }
    if (!providerPlan.canCreateOnlineCheckout) {
      showToast('Online checkout is not connected yet. Use manual payment details for now.', 'info');
      return;
    }

    setIsCreatingCheckout(true);
    try {
      const checkout = await createRazorpayCheckoutLink({
        workspaceId: activeWorkspace.workspaceId,
        invoiceId: invoice.id,
        callbackUrl: `${window.location.origin}/pay/`,
      });
      setPaymentLinkDetails((current) => ({ ...current, paymentPageUrl: checkout.checkoutUrl }));
      await navigator.clipboard.writeText(checkout.checkoutUrl);
      showToast('Online checkout link copied.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Online checkout could not be created.', 'info');
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function recordInvoicePayment(amountOverride?: number) {
    if (!activeWorkspace || !invoice) {
      return;
    }
    const amountToSave = amountOverride ?? parseMoney(paymentAmount);
    if (!invoice.customerId && !customerId) {
      showToast('Choose a customer before recording payment.', 'danger');
      return;
    }
    if (!officeAccess.can('record_payments')) {
      showToast(officeAccess.getLockedMessage('record_payments'), 'info');
      return;
    }
    if (amountToSave <= 0) {
      showToast('Enter a payment amount before saving.', 'danger');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const updated = await createWorkspaceInvoicePayment(activeWorkspace.workspaceId, invoice.id, {
        amount: amountToSave,
        effectiveDate: paymentDate,
        note: paymentNote,
        paymentMode,
        paymentDetails,
        paymentClearanceStatus,
        paymentAttachments,
      });
      const nextAllocations = await listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoice.id);
      setInvoice(updated);
      setPaymentStatus(updated.paymentStatus);
      setAllocations(nextAllocations);
      const nextDueAmount = Math.max(updated.totalAmount - updated.paidAmount, 0);
      setPaymentAmount(nextDueAmount > 0 ? formatAmountInput(nextDueAmount) : '');
      setPaymentNote(`Payment for invoice ${updated.invoiceNumber}`);
      setPaymentMode('cash');
      setPaymentDetails({});
      setPaymentClearanceStatus('received');
      setHasPaymentClearancePreviewOverride(false);
      setPaymentAttachments([]);
      showToast(paymentVerificationPlan.successMessage, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment could not be recorded.', 'danger');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function attachPaymentInstrument(file: File | null) {
    if (!activeWorkspace || !file) {
      return;
    }
    if (!paymentProofAccess.allowed) {
      showToast(paymentProofAccess.message ?? 'Payment proof attachments are not included in your plan.', 'info');
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to attach proof.', 'info');
      return;
    }
    if (!officeAccess.can('record_payments')) {
      showToast(officeAccess.getLockedMessage('record_payments'), 'info');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const attachment = await uploadPaymentInstrumentImage(activeWorkspace.workspaceId, invoice?.id ?? 'payment', file);
      setPaymentAttachments((current) => [attachment, ...current].slice(0, 3));
      setIncludeInstrumentInDocument(true);
      showToast('Payment proof attached.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment proof could not be attached.', 'danger');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function updateAllocationClearance(allocationId: string, clearanceStatus: PaymentClearanceStatus) {
    if (!activeWorkspace || !invoice) {
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to update payments.', 'info');
      return;
    }
    if (!officeAccess.can('verify_payments')) {
      showToast(officeAccess.getLockedMessage('verify_payments'), 'info');
      return;
    }

    setIsRecordingPayment(true);
    try {
      await updateWorkspacePaymentClearance(activeWorkspace.workspaceId, allocationId, { clearanceStatus });
      const [updatedInvoice, nextAllocations] = await Promise.all([
        getWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoice.id),
        listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoice.id),
      ]);
      if (updatedInvoice) {
        setInvoice(updatedInvoice);
        setPaymentStatus(updatedInvoice.paymentStatus);
      }
      setAllocations(nextAllocations);
      showToast('Payment clearance updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment clearance could not be updated.', 'danger');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function reversePaymentAllocation(allocation: WorkspaceInvoicePaymentAllocation) {
    if (!activeWorkspace || !invoice) {
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to update payments.', 'info');
      return;
    }
    if (!paymentReversalAccess.allowed) {
      showToast(paymentReversalAccess.message ?? 'Payment reversals are not included in your plan.', 'info');
      return;
    }
    if (!officeAccess.can('reverse_payments')) {
      showToast(officeAccess.getLockedMessage('reverse_payments'), 'info');
      return;
    }
    const note = await prompt({
      title: 'Why are you reversing this payment?',
      message: 'The original record stays in history. Add a short reason for the correction.',
      inputLabel: 'Correction reason',
      defaultValue:
        allocation.paymentClearanceStatus === 'bounced'
          ? 'Payment bounced and must not count toward this invoice.'
          : 'Payment recorded by mistake.',
      confirmLabel: 'Continue',
      required: true,
      tone: 'danger',
    });
    if (note === null) {
      return;
    }
    const confirmed = await confirm({
      title: 'Reverse this payment?',
      message: 'The original record stays in history and invoice totals will be recalculated.',
      detail: note,
      confirmLabel: 'Reverse payment',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setIsRecordingPayment(true);
    try {
      await reverseWorkspaceInvoicePaymentAllocation(activeWorkspace.workspaceId, allocation.id, { note });
      const [updatedInvoice, nextAllocations] = await Promise.all([
        getWorkspaceInvoiceDetail(activeWorkspace.workspaceId, invoice.id),
        listWorkspaceInvoicePaymentAllocations(activeWorkspace.workspaceId, invoice.id),
      ]);
      if (updatedInvoice) {
        setInvoice(updatedInvoice);
        setPaymentStatus(updatedInvoice.paymentStatus);
        setPaymentAmount(formatAmountInput(Math.max(updatedInvoice.totalAmount - updatedInvoice.paidAmount, 0)));
      }
      setAllocations(nextAllocations);
      showToast('Payment reversed and invoice balance updated.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Payment could not be reversed.', 'danger');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  async function cancelInvoice() {
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to cancel it.', 'info');
      return;
    }
    if (!invoice || invoice.documentState === 'draft') {
      showToast('Delete an unsaved draft instead of cancelling it.', 'info');
      return;
    }
    if (!officeAccess.can('cancel_or_archive_invoices')) {
      showToast(officeAccess.getLockedMessage('cancel_or_archive_invoices'), 'info');
      return;
    }
    const confirmed = await confirm({
      title: 'Cancel this invoice?',
      message: 'This keeps the invoice history but marks the document as cancelled.',
      confirmLabel: 'Cancel invoice',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    await saveInvoice(paymentStatus, 'Invoice cancelled', 'cancelled');
  }

  async function deleteDraftInvoice() {
    if (!activeWorkspace || !invoice) {
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to delete drafts.', 'info');
      return;
    }
    if (invoice.documentState !== 'draft') {
      showToast('Only unsaved drafts can be deleted.', 'info');
      return;
    }
    if (!officeAccess.can('cancel_or_archive_invoices')) {
      showToast(officeAccess.getLockedMessage('cancel_or_archive_invoices'), 'info');
      return;
    }
    const confirmed = await confirm({
      title: 'Delete this draft invoice?',
      message: 'This invoice was never final, so no official invoice history will be kept.',
      confirmLabel: 'Delete draft',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteDraftWorkspaceInvoice(activeWorkspace.workspaceId, invoice.id);
      showToast('Draft invoice deleted.', 'success');
      router.push('/invoices');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Draft invoice could not be deleted.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleInvoiceArchive() {
    if (!activeWorkspace || !invoice) {
      return;
    }
    if (isReadOnlyVersion) {
      showToast('Saved invoice versions are view-only. Open the latest invoice to archive it.', 'info');
      return;
    }
    if (!officeAccess.can('cancel_or_archive_invoices')) {
      showToast(officeAccess.getLockedMessage('cancel_or_archive_invoices'), 'info');
      return;
    }
    const nextArchived = !invoice.isArchived;
    const confirmed = await confirm({
      title: nextArchived ? 'Archive this invoice?' : 'Restore this invoice?',
      message: nextArchived
        ? 'It will be hidden from the active invoice list, but the history stays available.'
        : 'This invoice will move back to the active invoice list.',
      confirmLabel: nextArchived ? 'Archive invoice' : 'Restore invoice',
      tone: nextArchived ? 'danger' : 'default',
    });
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await archiveWorkspaceInvoice(activeWorkspace.workspaceId, invoice.id, nextArchived);
      setInvoice(updated);
      showToast(nextArchived ? 'Invoice archived.' : 'Invoice restored to active list.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Invoice archive state could not be updated.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-actions ol-actions--sticky ol-invoice-action-bar" aria-label="Invoice actions">
        <Link className="ol-button-secondary" href="/invoices">
          Back to invoices
        </Link>
        <button className="ol-button" type="button" onClick={() => void saveInvoice()} disabled={!canSaveInvoice}>
          {isSaving ? 'Saving...' : 'Save invoice'}
        </button>
        <button className="ol-button-secondary" type="button" onClick={viewPdf} disabled={!currentInvoiceDocument}>
          View / print
        </button>
        <details className="ol-action-menu">
          <summary className="ol-button-secondary">Download</summary>
          <div className="ol-action-menu-list">
            <button className="ol-button-secondary" type="button" onClick={() => void downloadInvoiceDocument()} disabled={!currentInvoiceDocument}>
              PDF
            </button>
            <button className="ol-button-secondary" type="button" onClick={downloadInvoiceCsvFile} disabled={!currentInvoiceDocument}>
              CSV
            </button>
          </div>
        </details>
        <button className="ol-button-secondary" type="button" onClick={() => void recordInvoicePayment(dueAmount)} disabled={isReadOnlyVersion || isRecordingPayment || !invoice || dueAmount <= 0 || !officeAccess.can('record_payments')}>
          Record due payment
        </button>
        <details className="ol-action-menu">
          <summary className="ol-button-secondary">More actions</summary>
          <div className="ol-action-menu-list">
            <button className="ol-button-secondary" type="button" onClick={() => void copyPaymentMessage()} disabled={!currentInvoiceDocument || total <= 0}>
              Copy payment message
            </button>
            {providerPlan.canCreateOnlineCheckout && !isReadOnlyVersion ? (
              <button className="ol-button-secondary" type="button" onClick={() => void createRazorpayCheckout()} disabled={isCreatingCheckout || !invoice || dueAmount <= 0 || !officeAccess.can('record_payments')}>
                {isCreatingCheckout ? 'Creating checkout...' : 'Create checkout link'}
              </button>
            ) : null}
            {isReadOnlyVersion && invoice ? (
              <Link className="ol-button-secondary" href={`/invoices/detail?invoiceId=${encodeURIComponent(invoice.id)}`}>
                Open latest invoice
              </Link>
            ) : invoice?.documentState === 'draft' ? (
              <button className="ol-button-secondary ol-button-danger-subtle" type="button" onClick={() => void deleteDraftInvoice()} disabled={isSaving || !invoice || !officeAccess.can('cancel_or_archive_invoices')}>
                Delete draft
              </button>
            ) : (
              <button className="ol-button-secondary" type="button" onClick={() => void toggleInvoiceArchive()} disabled={isSaving || !invoice || !officeAccess.can('cancel_or_archive_invoices')}>
                {invoice?.isArchived ? 'Unarchive invoice' : 'Archive invoice'}
              </button>
            )}
            <button className="ol-button-secondary ol-button-danger-subtle" type="button" onClick={() => void cancelInvoice()} disabled={isReadOnlyVersion || isSaving || !invoice || invoice.documentState === 'draft' || invoice.documentState === 'cancelled' || !officeAccess.can('cancel_or_archive_invoices')}>
              Cancel invoice
            </button>
          </div>
        </details>
      </div>

      {message ? (
        <div className="ol-message ol-message--danger">{message}</div>
      ) : null}

      {isReadOnlyVersion && invoice ? (
        <div className="ol-message ol-message--info">
          You are viewing saved version v{invoice.versionNumber}. Older versions are frozen and cannot be edited.
        </div>
      ) : null}

      {invoice ? (
        <>
          <section className="ol-panel">
            <div className="ol-form-row ol-form-row--4">
              <label className="ol-field">
                <span className="ol-field-label">Customer</span>
                <select
                  className="ol-select"
                  disabled={isReadOnlyVersion}
                  value={customerId}
                  onChange={(event) => {
                    const nextCustomerId = event.target.value;
                    setCustomerId(nextCustomerId);
                    setTemplateKey(
                      resolveInvoiceTemplatePreference(
                        customers.find((customer) => customer.id === nextCustomerId) ?? null,
                        activeWorkspace?.defaultInvoiceTemplate,
                        invoiceTemplates
                      )
                    );
                  }}
                >
                  <option value="">No customer selected</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Invoice number</span>
                <input className="ol-input" disabled={isReadOnlyVersion} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Issue date</span>
                <input className="ol-input" disabled={isReadOnlyVersion} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Due date</span>
                <input className="ol-input" disabled={isReadOnlyVersion} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
            <div className="ol-review-grid" style={{ marginTop: 16 }}>
              <Review label="Document state" value={getInvoiceDocumentStateLabel(invoice.documentState)} />
              <Review label="Payment state" value={getInvoicePaymentStatusLabel(paymentStatus)} />
              <Review label="Latest version" value={invoice.versionNumber ? `v${invoice.versionNumber}` : 'Not saved yet'} />
              <Review label="Saved history" value={`${invoice.versions?.length ?? 0} version${(invoice.versions?.length ?? 0) === 1 ? '' : 's'}`} />
              <Review label="List visibility" value={invoice.isArchived ? 'Archived' : 'Active'} />
            </div>
            <label className="ol-checkbox-row" style={{ marginTop: 16 }}>
              <input
                className="ol-checkbox"
                checked={useForMonthlyAutoEmail}
                disabled={isReadOnlyVersion || invoice.documentState === 'cancelled' || !recurringAutoEmailAccess.allowed}
                type="checkbox"
                onChange={(event) => setUseForMonthlyAutoEmail(event.target.checked)}
              />
              <span>Use this for monthly auto email</span>
            </label>
            <p className="ol-helper" style={{ marginTop: 6 }}>
              {recurringAutoEmailAccess.allowed
                ? 'Enable this only when this invoice should be used for this customer\'s monthly automatic email.'
                : `${recurringAutoEmailAccess.message} This control stays locked until then.`}
            </p>
            {invoice.documentState === 'draft' || isReadOnlyVersion ? (
              <div className="ol-message" style={{ marginTop: 16 }}>
                {isReadOnlyVersion
                  ? 'This saved version keeps the original version note and cannot be changed.'
                  : 'The first save creates version v1 automatically.'}
              </div>
            ) : (
              <div className="ol-form-row ol-form-row--2" style={{ marginTop: 16 }}>
                <label className="ol-field">
                  <span className="ol-field-label">Update reason</span>
                  <select
                    className="ol-select"
                    value={revisionReasonChoice}
                    onChange={(event) => {
                      setRevisionReasonChoice(event.target.value);
                      if (event.target.value !== 'other') {
                        setRevisionReason('');
                      }
                    }}
                  >
                    <option value="">Choose a reason</option>
                    {REVISION_REASON_OPTIONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                    <option value="other">Other reason</option>
                  </select>
                  <span className="ol-field-help">Required before saving changes to the latest invoice.</span>
                </label>
                {revisionReasonChoice === 'other' ? (
                  <label className="ol-field">
                    <span className="ol-field-label">Custom reason</span>
                    <input
                      className="ol-input"
                      placeholder="Describe what changed"
                      value={revisionReason}
                      onChange={(event) => setRevisionReason(event.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            )}
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">PDF template</span>
              <select
                className="ol-select"
                disabled={isReadOnlyVersion}
                value={templateKey || selectedTemplate?.key || ''}
                onChange={(event) => setTemplateKey(event.target.value)}
              >
                {invoiceTemplates.map((template) => (
                  <option disabled={template.tier === 'pro' && !premiumTemplateAccess.allowed} key={template.key} value={template.key}>
                    {template.tier === 'pro' ? `${template.label} · Pro Plus` : template.label}
                  </option>
                ))}
              </select>
              <span className="ol-field-help">
                Pro Plus templates are shown in the showcase and stay locked for document output until your plan includes them.
              </span>
            </label>
            <div className="ol-actions" style={{ marginTop: 12 }}>
              <Link className="ol-button-secondary" href="/templates">
                View template showcase
              </Link>
            </div>
            <TemplatePreviewGrid
              isPro={premiumTemplateAccess.allowed}
              selectedKey={selectedTemplate?.key ?? ''}
              templates={invoiceTemplates}
              onSelect={(value) => {
                const template = invoiceTemplates.find((entry) => entry.key === value);
                if (template?.tier === 'pro' && !premiumTemplateAccess.allowed) {
                  showToast(`${template.label} is available with Orbit Ledger ${premiumTemplateAccess.requiredPlanLabel}. Preview it in the showcase.`, 'info');
                  return;
                }
                setTemplateKey(value);
              }}
            />
            <label className="ol-field" style={{ marginTop: 16 }}>
              <span className="ol-field-label">Notes</span>
              <textarea className="ol-textarea" disabled={isReadOnlyVersion} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div className="ol-panel-title">Line items</div>
              <button className="ol-button-secondary" type="button" disabled={isReadOnlyVersion} onClick={() => setItems((current) => [...current, emptyItem(defaultTaxRate)])}>
                Add item
              </button>
            </div>
            <div className="ol-form-grid">
              {items.map((item, index) => (
                <div className="ol-form-row ol-form-row--invoice-item" key={`${item.id ?? 'new'}-${index}`}>
                  <label className="ol-field">
                    <span className="ol-field-label">Product</span>
                    <select
                      className="ol-select"
                      disabled={isReadOnlyVersion}
                      value={item.productId ?? ''}
                      onChange={(event) => selectProduct(index, event.target.value)}
                    >
                      <option value="">Custom item</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {formatQuantity(product.stockQuantity)} {product.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Item</span>
                    <input className="ol-input" disabled={isReadOnlyVersion} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Description</span>
                    <input className="ol-input" disabled={isReadOnlyVersion} value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Qty</span>
                    <input className="ol-input ol-amount" disabled={isReadOnlyVersion} inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Price</span>
                    <input className="ol-input ol-amount" disabled={isReadOnlyVersion} inputMode="decimal" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} />
                  </label>
                  <label className="ol-field">
                    <span className="ol-field-label">Tax %</span>
                    <input className="ol-input ol-amount" disabled={isReadOnlyVersion} inputMode="decimal" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} />
                  </label>
                  <div className="ol-field ol-field--action">
                    <span className="ol-field-label">Line</span>
                    <div className="ol-inline-actions">
                      <button
                        aria-label="Copy line"
                        className="ol-button-secondary ol-icon-button"
                        title="Copy line"
                        type="button"
                        disabled={isReadOnlyVersion}
                        onClick={() => duplicateItem(index)}
                      >
                        <CopyIcon />
                      </button>
                      <button
                        aria-label="Remove line"
                        className="ol-button-secondary ol-icon-button ol-icon-button--danger"
                        title="Remove line"
                        type="button"
                        disabled={isReadOnlyVersion}
                        onClick={() => removeItem(index)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ol-metric-grid">
            <Metric label="Subtotal" value={formatCurrency(totals.subtotal, currency)} tone="primary" />
            <Metric label="Tax" value={formatCurrency(totals.tax, currency)} tone="warning" />
            <Metric label="Total" value={formatCurrency(total, currency)} tone="success" />
            <Metric label="Paid" value={formatCurrency(invoice.paidAmount, currency)} tone="success" />
            <Metric label="Amount due" value={formatCurrency(Math.max(total - invoice.paidAmount, 0), currency)} tone="warning" />
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Payment allocation</div>
                <p className="ol-panel-copy">
                  Record a confirmed payment here so invoice status follows real allocated money.
                </p>
              </div>
              <span className={`ol-chip ol-chip--${paymentStatus === 'paid' ? 'success' : paymentStatus === 'overdue' ? 'warning' : 'primary'}`}>
                {getInvoicePaymentStatusLabel(paymentStatus)}
              </span>
            </div>
            <div className="ol-form-row ol-form-row--4">
              <label className="ol-field">
                <span className="ol-field-label">Payment amount</span>
                <input
                  className="ol-input ol-amount"
                  disabled={isReadOnlyVersion}
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment date</span>
                <input className="ol-input" disabled={isReadOnlyVersion} type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment mode</span>
                <select
                  className="ol-select"
                  disabled={isReadOnlyVersion}
	                  value={paymentMode}
	                  onChange={(event) => {
	                    const nextMode = event.target.value as PaymentMode;
	                    const nextStatus = normalizePaymentClearanceStatus(paymentClearanceStatus, nextMode, {});
	                    setPaymentMode(nextMode);
	                    setPaymentDetails({});
	                    setHasPaymentClearancePreviewOverride(true);
	                    setPaymentClearanceStatus(nextStatus);
	                  }}
                >
                  {PAYMENT_MODE_CONFIGS.map((config) => (
                    <option key={config.mode} value={config.mode}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">Payment note</span>
                <input className="ol-input" disabled={isReadOnlyVersion} value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} />
              </label>
              <PaymentModeFields disabled={isReadOnlyVersion} details={paymentDetails} mode={paymentMode} onChange={setPaymentDetails} />
              <label className="ol-field">
                <span className="ol-field-label">Clearance</span>
                <select
                  className="ol-select"
                  disabled={isReadOnlyVersion}
                  value={paymentClearanceStatus}
	                  onChange={(event) => {
	                    setHasPaymentClearancePreviewOverride(true);
	                    setPaymentClearanceStatus(event.target.value as PaymentClearanceStatus);
	                  }}
                >
                  {paymentClearanceOptions.map((status) => (
                    <option key={status} value={status}>
                      {getPaymentClearanceStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ol-field">
                <span className="ol-field-label">
                  {paymentMode === 'cheque' || paymentMode === 'demand_draft' ? 'Cheque/DD proof' : 'Payment proof'}
                </span>
                <div className="ol-proof-upload-card">
                  <label className={`ol-button-secondary${isReadOnlyVersion || !paymentProofAccess.allowed ? ' is-disabled' : ''}`} style={{ width: 'fit-content' }}>
                    Upload proof
                    <input
                      hidden
                      disabled={isReadOnlyVersion || !paymentProofAccess.allowed}
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      type="file"
                      onChange={(event) => {
                        void attachPaymentInstrument(event.currentTarget.files?.[0] ?? null);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <span>
                    Add cheque, demand draft, UPI, bank, card, wallet, or receipt proof as PNG, JPG, WebP, or PDF.
                  </span>
                </div>
                {!paymentProofAccess.allowed ? (
                  <div className="ol-template-lock-note">{paymentProofAccess.message}</div>
                ) : null}
              </div>
              {paymentAttachments.length ? (
                <div className="ol-field">
                  <span className="ol-field-label">Attached proof</span>
                  <div className="ol-attachment-strip">
                    {paymentAttachments.map((attachment) => (
                      <a
                        className="ol-instrument-preview"
                        href={attachment.url}
                        key={attachment.id}
                        target="_blank"
                        rel="noreferrer"
                        title="Open proof"
                      >
                        {attachment.contentType === 'application/pdf' ? (
                          <span className="ol-proof-file-icon">PDF</span>
                        ) : (
                          <img alt={attachment.name} src={attachment.url} />
                        )}
                        <span>{attachment.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              <label className="ol-check-row">
                <input
                  type="checkbox"
                  disabled={isReadOnlyVersion || !paymentProofAccess.allowed}
                  checked={includeInstrumentInDocument}
                  onChange={(event) => setIncludeInstrumentInDocument(event.target.checked)}
                />
                <span>Show attached payment proof on invoice</span>
              </label>
              <label className="ol-check-row">
                <input
                  type="checkbox"
                  disabled={isReadOnlyVersion}
                  checked={urgentPaymentRequired}
                  onChange={(event) => setUrgentPaymentRequired(event.target.checked)}
                />
                <span>Add payment required urgently stamp</span>
              </label>
              {paymentInstructionTemplate.fields.map((field) => (
                <label className="ol-field" key={field.key}>
                  <span className="ol-field-label">{field.label}</span>
                  <input
                    className="ol-input"
                    disabled={isReadOnlyVersion}
                    placeholder={field.placeholder}
                    value={String(paymentLinkDetails[field.key] ?? '')}
                    onChange={(event) =>
                      setPaymentLinkDetails((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                  />
                  <span className="ol-field-help">{field.helper}</span>
                </label>
              ))}
              <label className="ol-check-row">
                <input
                  type="checkbox"
                  disabled={isReadOnlyVersion || !paymentLinkAccess.allowed}
                  checked={includePaymentLinkInDocument}
                  onChange={(event) => setIncludePaymentLinkInDocument(event.target.checked)}
                />
                <span>Show payment link on invoice</span>
              </label>
              {!paymentLinkAccess.allowed ? (
                <div className="ol-message">{paymentLinkAccess.message}</div>
              ) : invoicePaymentLink ? (
                <div className="ol-message ol-message--success">
                  {invoicePaymentLink.label}: {invoicePaymentLink.reference}
                </div>
              ) : (
                <div className="ol-message">Add UPI ID or a secure payment page to create a payment link.</div>
              )}
              {providerPlan.canCreateOnlineCheckout ? (
                <div className="ol-field ol-field--action">
                  <span className="ol-field-label">Online checkout</span>
                  <button
                    className="ol-button-secondary"
                    type="button"
                    disabled={isReadOnlyVersion || isCreatingCheckout || !invoice || dueAmount <= 0 || !officeAccess.can('record_payments')}
                    onClick={() => void createRazorpayCheckout()}
                  >
                    {isCreatingCheckout ? 'Creating...' : 'Create checkout link'}
                  </button>
                </div>
              ) : (
                <div className="ol-field">
                  <span className="ol-field-label">Collection mode</span>
                  <div className="ol-message" style={{ margin: 0 }}>{providerPlan.paymentPageCopy}</div>
                </div>
              )}
              <div className="ol-field ol-field--action">
                <span className="ol-field-label">Action</span>
                <button className="ol-button" type="button" disabled={isReadOnlyVersion || isRecordingPayment || dueAmount <= 0 || !officeAccess.can('record_payments')} onClick={() => void recordInvoicePayment()}>
                  {isRecordingPayment ? 'Recording...' : paymentVerificationPlan.actionLabel}
                </button>
              </div>
            </div>
            <div className="ol-review-grid" style={{ marginTop: 16 }}>
              <Review label="Verification" value={paymentVerificationPlan.statusLabel} />
              <Review label="Invoice effect" value={paymentVerificationPlan.invoiceEffect} />
              <Review label="Balance effect" value={paymentVerificationPlan.customerBalanceEffect} />
              <Review label="Allocated" value={formatCurrency(invoice.paidAmount, currency)} />
              <Review label="Still due" value={formatCurrency(Math.max(invoice.totalAmount - invoice.paidAmount, 0), currency)} />
              <Review label="Payment records" value={`${allocations.length}`} />
            </div>
            <div className="ol-list" style={{ marginTop: 16 }}>
              {allocations.map((allocation) => (
                <div className="ol-list-item" key={allocation.id}>
                  <div className="ol-list-icon">Pay</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">
                      {formatCurrency(allocation.amount, currency)}
                      {allocation.isReversed ? <span className="ol-chip ol-chip--warning" style={{ marginLeft: 8 }}>Reversed</span> : null}
                    </div>
                    <div className="ol-list-text">
                      {summarizePaymentMode(allocation.paymentMode, allocation.paymentDetails)} · {summarizePaymentClearance(allocation.paymentClearanceStatus, allocation.paymentDetails)} · {allocation.transactionEffectiveDate || allocation.createdAt.slice(0, 10)}
                      {allocation.transactionNote ? ` · ${allocation.transactionNote}` : ''}
                      {allocation.reversalReason ? ` · ${allocation.reversalReason}` : ''}
                    </div>
                    {allocation.paymentAttachments.length ? (
                      <div className="ol-attachment-strip" style={{ marginTop: 10 }}>
                        {allocation.paymentAttachments.map((attachment) => (
                          <a
                            className="ol-instrument-preview"
                            href={attachment.url}
                            key={attachment.id}
                            target="_blank"
                            rel="noreferrer"
                            download={attachment.name}
                          >
                            <img alt={attachment.name} src={attachment.url} />
                            <span>Open / download</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="ol-inline-actions">
                    <button
                      className="ol-button-secondary"
                      disabled={isRecordingPayment || allocation.isReversed || allocation.paymentClearanceStatus === 'cleared' || !officeAccess.can('verify_payments')}
                      type="button"
                      onClick={() => void updateAllocationClearance(allocation.id, 'cleared')}
                    >
                      Verify cleared
                    </button>
                    <button
                      className="ol-button-ghost"
                      disabled={isRecordingPayment || allocation.isReversed || allocation.paymentClearanceStatus === 'bounced' || !officeAccess.can('verify_payments')}
                      type="button"
                      onClick={() => void updateAllocationClearance(allocation.id, 'bounced')}
                    >
                      Mark bounced
                    </button>
                    <button
                      className="ol-button-ghost"
                      disabled={isRecordingPayment || allocation.isReversed || !paymentReversalAccess.allowed || !officeAccess.can('reverse_payments')}
                      type="button"
                      onClick={() => void reversePaymentAllocation(allocation)}
                    >
                      Reverse
                    </button>
                  </div>
                </div>
              ))}
              {!allocations.length ? (
                <div className="ol-empty">No payments are allocated to this invoice yet.</div>
              ) : null}
            </div>
          </section>

          <section className="ol-panel-glass">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">PDF readiness</div>
                <p className="ol-panel-copy">
                  The PDF uses the same country-ready template catalog, plan access, branding rules,
                  and payment message flow across Orbit Ledger.
                </p>
              </div>
              <span className={`ol-chip ${currentInvoiceDocument?.template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
                {currentInvoiceDocument?.template.label ?? 'Template'}
              </span>
            </div>
            <div className="ol-review-grid">
              <Review label="PDF name" value={currentInvoiceDocument?.fileName ?? 'Save invoice details first'} />
              <Review label="Tax format" value={currentInvoiceDocument?.template.countryFormat?.replace(/_/g, ' ') ?? 'Local'} />
              <Review label="PDF style" value={currentInvoiceDocument?.pdfStyle === 'advanced' ? 'Advanced' : 'Basic'} />
              <Review label="Customer" value={selectedCustomer?.name ?? 'Unlinked customer'} />
              <Review label="Payment link" value={invoicePaymentLink ? invoicePaymentLink.label : 'Not added'} />
            </div>
          </section>

          <section className="ol-panel">
            <div className="ol-panel-header">
              <div>
                <div className="ol-panel-title">Invoice history</div>
                <p className="ol-panel-copy">
                  Saved versions stay available for review, export, and correction.
                </p>
              </div>
            </div>
            <div className="ol-list">
              {(invoice.versions ?? []).map((version) => (
                <div className="ol-list-item" key={version.id}>
                  <div className="ol-list-icon">v{version.versionNumber}</div>
                  <div className="ol-list-copy">
                    <div className="ol-list-title">
                      {version.invoiceNumber} · {formatCurrency(version.totalAmount, currency)}
                    </div>
                    <div className="ol-list-text">
                      {formatDateTime(version.createdAt)} · {version.reason} · {getInvoiceDocumentStateLabel(version.documentState)} · {getInvoicePaymentStatusLabel(version.paymentStatus)}
                    </div>
                  </div>
                  <Link className="ol-button-secondary" href={`/invoices/detail?invoiceId=${encodeURIComponent(version.invoiceId)}&versionId=${encodeURIComponent(version.id)}`}>
                    View
                  </Link>
                </div>
              ))}
              {!(invoice.versions ?? []).length ? (
                <div className="ol-empty">Save this invoice to create version v1.</div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function InvoiceEditorShell({ message }: { message: string }) {
  return (
    <AppShell title="Invoice Editor" subtitle="Edit invoice details, line items, tax, and download a clean copy.">
      <div className="ol-message ol-message--success">{message}</div>
    </AppShell>
  );
}

function emptyItem(taxRate = 0): EditableItem {
  return { productId: null, name: '', description: '', quantity: '1', price: '0', taxRate: formatTaxRateInput(taxRate) };
}

function getEffectiveRevisionReason(reasonChoice: string, customReason: string): string {
  return (reasonChoice === 'other' ? customReason : reasonChoice).trim();
}

function buildReadonlyVersionInvoiceDetail(
  invoice: WorkspaceInvoiceDetail,
  version: WorkspaceInvoiceVersion
): WorkspaceInvoiceDetail {
  return {
    ...invoice,
    customerId: version.customerId,
    customerName: version.customerName,
    invoiceNumber: version.invoiceNumber,
    issueDate: version.issueDate,
    dueDate: version.dueDate,
    status: version.documentState,
    documentState: version.documentState,
    paymentStatus: version.paymentStatus,
    paymentStatusReason: version.paymentStatusReason ?? null,
    autoEmailPreparedAt: invoice.autoEmailPreparedAt,
    autoEmailScheduledFor: version.autoEmailScheduledFor,
    latestAutoEmailStatus: version.autoEmailStatus,
    latestAutoEmailSentAt: version.autoEmailSentAt,
    latestAutoEmailVersionId: version.autoEmailUsedVersionId,
    subtotal: version.subtotal,
    taxAmount: version.taxAmount,
    totalAmount: version.totalAmount,
    paidAmount: version.paidAmount,
    versionNumber: version.versionNumber,
    notes: version.notes,
    latestSnapshotHash: version.snapshotHash,
    items: version.items.map((item, index) => ({
      ...item,
      id: item.id || `${version.id}-item-${index}`,
      invoiceId: version.invoiceId,
    })),
  };
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[, ]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDefaultInvoiceTaxRate(countryCode?: string | null, countryFormat?: string | null): number {
  const normalizedCountryCode = countryCode?.trim().toUpperCase();
  if (normalizedCountryCode === 'IN' || countryFormat === 'india_gst') {
    return 18;
  }
  if (normalizedCountryCode === 'GB' || countryFormat === 'uk_vat') {
    return 20;
  }
  return 0;
}

function formatTaxRateInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatAmountInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function addDays(date: string, days?: number | null): string | null {
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    return null;
  }
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const next = new Date(timestamp);
  next.setUTCDate(next.getUTCDate() + Math.max(0, Math.floor(days)));
  return next.toISOString().slice(0, 10);
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function PaymentModeFields({
  disabled = false,
  details,
  mode,
  onChange,
}: {
  disabled?: boolean;
  details: PaymentModeDetails;
  mode: PaymentMode;
  onChange: (details: PaymentModeDetails) => void;
}) {
  const config = getPaymentModeConfig(mode);
  const update = (field: keyof PaymentModeDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  if (mode === 'cash') {
    return null;
  }

  return (
    <>
      {['cheque', 'demand_draft', 'bank_transfer', 'upi', 'wallet'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Reference</span>
          <input className="ol-input" disabled={disabled} value={details.referenceNumber ?? ''} onChange={(event) => update('referenceNumber', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft', 'bank_transfer'].includes(mode) ? (
        <label className="ol-field">
          <span className="ol-field-label">Bank</span>
          <input className="ol-input" disabled={disabled} value={details.bankName ?? ''} onChange={(event) => update('bankName', event.target.value)} />
        </label>
      ) : null}
      {['cheque', 'demand_draft'].includes(mode) ? (
        <>
          <label className="ol-field">
            <span className="ol-field-label">Branch</span>
            <input className="ol-input" disabled={disabled} value={details.branchName ?? ''} onChange={(event) => update('branchName', event.target.value)} />
          </label>
          <label className="ol-field">
            <span className="ol-field-label">Instrument date</span>
            <input className="ol-input" disabled={disabled} type="date" value={details.instrumentDate ?? ''} onChange={(event) => update('instrumentDate', event.target.value)} />
          </label>
        </>
      ) : null}
      {mode === 'upi' ? (
        <label className="ol-field">
          <span className="ol-field-label">UPI ID</span>
          <input className="ol-input" disabled={disabled} value={details.upiId ?? ''} onChange={(event) => update('upiId', event.target.value)} />
        </label>
      ) : null}
      {mode === 'card' ? (
        <label className="ol-field">
          <span className="ol-field-label">Card last 4</span>
          <input className="ol-input" disabled={disabled} inputMode="numeric" maxLength={4} value={details.cardLastFour ?? ''} onChange={(event) => update('cardLastFour', event.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
      ) : null}
      {mode === 'wallet' ? (
        <label className="ol-field">
          <span className="ol-field-label">Provider</span>
          <input className="ol-input" disabled={disabled} value={details.provider ?? ''} onChange={(event) => update('provider', event.target.value)} />
        </label>
      ) : null}
      {mode === 'other' ? (
        <label className="ol-field">
          <span className="ol-field-label">Payment detail</span>
          <input className="ol-input" disabled={disabled} value={details.note ?? ''} onChange={(event) => update('note', event.target.value)} />
        </label>
      ) : null}
      <div className="ol-field">
        <span className="ol-field-label">Mode note</span>
        <div className="ol-message ol-message--success" style={{ margin: 0 }}>{config.helper}</div>
      </div>
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'warning' | 'success' }) {
  return (
    <article className="ol-metric-card" data-tone={tone}>
      <div className="ol-metric-label">{label}</div>
      <div className="ol-metric-value">{value}</div>
      <div className="ol-metric-helper">Invoice calculation.</div>
    </article>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="ol-review-item">
      <span className="ol-review-label">{label}</span>
      <strong className="ol-review-value">{value}</strong>
    </div>
  );
}

function TemplatePreviewGrid({
  isPro,
  onSelect,
  selectedKey,
  templates,
}: {
  isPro: boolean;
  selectedKey: string;
  templates: WebDocumentTemplate[];
  onSelect(value: string): void;
}) {
  return (
    <div className="ol-template-preview-grid">
      {templates.map((template) => (
        <button
          className={`ol-template-preview-card${template.key === selectedKey ? ' is-selected' : ''}`}
          disabled={template.tier === 'pro' && !isPro}
          key={template.key}
          type="button"
          onClick={() => onSelect(template.key)}
        >
          <span className={`ol-chip ${template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
            {template.tier === 'pro' ? (isPro ? 'Included in Pro Plus' : 'Requires Pro Plus') : 'Free'}
          </span>
          <strong>{template.label}</strong>
          <small>{template.description}</small>
          <span className="ol-template-preview-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
      ))}
    </div>
  );
}

function resolveInvoiceTemplatePreference(
  customer: WorkspaceCustomer | null,
  workspaceDefault: string | null | undefined,
  templates: WebDocumentTemplate[]
) {
  const candidate = customer?.preferredInvoiceTemplate || workspaceDefault || '';
  return templates.some((template) => template.key === candidate) ? candidate : '';
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path
        d="M8 8.5c0-1.1.9-2 2-2h7c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7c-1.1 0-2-.9-2-2v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5 15.5V6.75c0-1.24 1.01-2.25 2.25-2.25H15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" viewBox="0 0 24 24">
      <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path
        d="M6.5 7l.7 12.2A2 2 0 0 0 9.2 21h5.6a2 2 0 0 0 2-1.8L17.5 7M9 7l.6-2h4.8L15 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  if (!value) {
    return 'Time not saved';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
