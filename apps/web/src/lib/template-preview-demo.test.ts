import { describe, expect, it } from 'vitest';
import { buildCustomerHealthScore } from '@orbit-ledger/core';

import {
  buildPublicTemplateDemoData,
  buildOfficeTemplateDemoData,
  buildSharedTemplateDemoData,
  buildSharedTemplateDemoDataForTemplates,
  buildTemplatePreviewDocument,
  buildWorkspaceTemplateDemoData,
  protectTemplatePreviewHtml,
} from './template-preview-demo';

describe('template preview demo', () => {
  it('keeps public landing demo data fake even if workspace data is provided', () => {
    const demoData = buildPublicTemplateDemoData('IN_GST_STANDARD_FREE');

    expect(demoData.isPublicSafe).toBe(true);
    expect(demoData.source).toBe('public_sample');
    expect(demoData.workspace.businessName).toBe('Orbit Demo Services Pvt Ltd');
    expect(demoData.customer.email).toContain('example.invalid');
  });

  it('does not leak provided workspace/customer/product data into public previews', () => {
    const demoData = buildSharedTemplateDemoData({
      mode: 'public',
      templateKey: 'IN_BRANDED_ADVANCED_PRO',
      workspace: {
        workspaceId: 'real-workspace',
        businessName: 'Real Private Company',
        ownerName: 'Private Owner',
        phone: '+91 99999 99999',
        email: 'private-owner@example.com',
        address: 'Private Address',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'GJ',
        logoUri: null,
        authorizedPersonName: '',
        authorizedPersonTitle: '',
        signatureUri: null,
        paymentInstructions: {},
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        serverRevision: 1,
        dataState: 'full_dataset',
      },
      customers: [
        {
          id: 'private-customer',
          name: 'Private Customer',
          legalName: 'Private Customer',
          customerType: 'business',
          contactPerson: null,
          phone: null,
          whatsapp: null,
          email: 'private-customer@example.com',
          address: null,
          billingAddress: null,
          shippingAddress: null,
          city: null,
          town: null,
          stateCode: null,
          countryCode: 'IN',
          postalCode: null,
          gstin: null,
          pan: null,
          taxNumber: null,
          registrationNumber: null,
          placeOfSupply: null,
          defaultTaxTreatment: null,
          notes: null,
          openingBalance: 0,
          creditLimit: null,
          paymentTerms: null,
          preferredPaymentMode: null,
          preferredInvoiceTemplate: null,
          preferredLanguage: null,
          tags: [],
          isArchived: false,
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
          balance: 0,
          health: buildCustomerHealthScore({ balance: 0 }),
        },
      ],
      products: [
        {
          id: 'private-product',
          name: 'Private Product',
          price: 9999,
          stockQuantity: 1,
          unit: 'Unit',
          createdAt: '2026-05-02T00:00:00.000Z',
          lastModified: '2026-05-02T00:00:00.000Z',
          serverRevision: 1,
        },
      ],
    });

    expect(demoData.isPublicSafe).toBe(true);
    expect(demoData.workspace.businessName).not.toBe('Real Private Company');
    expect(demoData.customer.name).not.toBe('Private Customer');
    expect(demoData.invoice.items.map((item) => item.name)).not.toContain('Private Product');
  });

  it('uses authenticated workspace and saved customers/products for signed-in previews', () => {
    const demoData = buildWorkspaceTemplateDemoData({
      templateKey: 'IN_PAYMENT_FOCUSED_PRO',
      workspace: {
        workspaceId: 'workspace-1',
        businessName: 'Rudraix Lab',
        ownerName: 'Bhaumik Mehta',
        phone: '+91 90000 12345',
        email: 'owner@example.invalid',
        address: 'Workspace Road',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'GJ',
        logoUri: null,
        authorizedPersonName: '',
        authorizedPersonTitle: '',
        signatureUri: null,
        paymentInstructions: {},
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        serverRevision: 1,
        dataState: 'full_dataset',
      },
      customers: [
        {
          id: 'customer-1',
          name: 'Sonali Traders',
          legalName: 'Sonali Traders',
          customerType: 'business',
          contactPerson: 'Sonali',
          phone: '+91 95555 55555',
          whatsapp: '+91 95555 55555',
          email: 'sonali@example.invalid',
          address: 'Customer Road',
          billingAddress: 'Customer Road',
          shippingAddress: 'Customer Road',
          city: 'Ahmedabad',
          town: null,
          stateCode: 'GJ',
          countryCode: 'IN',
          postalCode: '380001',
          gstin: null,
          pan: null,
          taxNumber: null,
          registrationNumber: null,
          placeOfSupply: 'Gujarat',
          defaultTaxTreatment: 'Taxable',
          notes: null,
          openingBalance: 0,
          creditLimit: null,
          paymentTerms: null,
          preferredPaymentMode: null,
          preferredInvoiceTemplate: null,
          preferredLanguage: null,
          tags: [],
          isArchived: false,
          createdAt: '2026-05-02T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
          balance: 1500,
          health: buildCustomerHealthScore({ balance: 1500, totalCredit: 5000, totalPayment: 3500 }),
        },
      ],
      products: [
        {
          id: 'product-1',
          name: 'Monthly Support',
          price: 2500,
          stockQuantity: 10,
          unit: 'Service',
          createdAt: '2026-05-02T00:00:00.000Z',
          lastModified: '2026-05-02T00:00:00.000Z',
          serverRevision: 1,
        },
      ],
    });

    expect(demoData.isPublicSafe).toBe(false);
    expect(demoData.workspace.businessName).toBe('Rudraix Lab');
    expect(demoData.customer.name).toBe('Sonali Traders');
    expect(demoData.customerSource).toBe('workspace');
    expect(demoData.itemSource).toBe('inventory');
    expect(demoData.invoice.items[0]?.name).toBe('Monthly Support');
  });

  it('uses the selected Office company branding for Office previews', () => {
    const demoData = buildOfficeTemplateDemoData({
      officeWorkspace: {
        workspaceId: 'office-company',
        businessName: 'Selected Office Company',
        ownerName: 'Office Owner',
        phone: '+91 90000 77777',
        email: 'office@example.invalid',
        address: 'Office Company Address',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'MH',
        logoUri: null,
        authorizedPersonName: '',
        authorizedPersonTitle: '',
        signatureUri: null,
        paymentInstructions: {},
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        serverRevision: 1,
        dataState: 'full_dataset',
      },
      templateKey: 'IN_GST_LETTERHEAD_PRO',
    });

    expect(demoData.mode).toBe('office');
    expect(demoData.source).toBe('office_workspace_sample');
    expect(demoData.workspace.businessName).toBe('Selected Office Company');
    expect(demoData.workspace.address).toBe('Office Company Address');
  });

  it('creates distinct sample customers and invoice lines for different templates', () => {
    const [gstDemo, paymentDemo, brandedDemo] = buildSharedTemplateDemoDataForTemplates([
      'IN_GST_STANDARD_FREE',
      'IN_PAYMENT_FOCUSED_PRO',
      'IN_BRANDED_ADVANCED_PRO',
    ]);

    expect(new Set([gstDemo.customer.id, paymentDemo.customer.id, brandedDemo.customer.id]).size).toBeGreaterThan(1);
    expect(gstDemo.invoice.invoiceNumber).not.toBe(paymentDemo.invoice.invoiceNumber);
    expect(paymentDemo.invoice.items.map((item) => item.name)).not.toEqual(brandedDemo.invoice.items.map((item) => item.name));
  });

  it('uses an uploaded watermark image when one is provided for a Pro preview', () => {
    const document = buildTemplatePreviewDocument('IN_BRANDED_ADVANCED_PRO', {
      watermarkImageUrl: 'data:image/png;base64,preview-watermark',
      watermarkOpacity: 0.12,
    });

    expect(document.html).toContain('brand-watermark brand-watermark-image');
    expect(document.html).toContain('data:image/png;base64,preview-watermark');
    expect(document.html).toContain('--pro-watermark-opacity:0.12');
  });

  it('injects the sample preview guard into generated bodies with template classes', () => {
    const guarded = protectTemplatePreviewHtml('<html><head></head><body class="document-invoice"><main>Invoice</main></body></html>');

    expect(guarded).toContain('<body class="document-invoice"><div class="sample-preview-ribbon">');
    expect(guarded).toContain('Sample preview only. Printing is disabled.');
  });
});
