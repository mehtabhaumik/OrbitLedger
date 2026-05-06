import { describe, expect, it } from 'vitest';

import {
  canUseSharedDocumentTemplate,
  getAccessibleSharedDocumentTemplate,
  getDefaultSharedDocumentTemplate,
  getSharedDocumentTemplate,
  getSharedDocumentTemplateCatalog,
  getSharedDocumentTemplates,
} from './documentTemplateCatalog';

describe('shared document template catalog', () => {
  it('provides free and pro invoice and statement templates for every supported country', () => {
    for (const countryCode of ['IN', 'US', 'GB', 'GENERIC']) {
      for (const templateType of ['invoice', 'statement'] as const) {
        const templates = getSharedDocumentTemplateCatalog({ countryCode, templateType });
        expect(templates.some((template) => template.tier === 'free')).toBe(true);
        expect(templates.some((template) => template.tier === 'pro')).toBe(true);
        expect(templates.every((template) => template.documentType === templateType)).toBe(true);
      }
    }
  });

  it('keeps template metadata and table columns internally consistent', () => {
    for (const template of getSharedDocumentTemplates()) {
      expect(template.key).toBe(template.config.metadata.templateKey);
      expect(template.label).toBe(template.config.metadata.templateLabel);
      expect(template.tier).toBe(template.config.metadata.templateTier);
      expect(template.visualStyle).toBe(template.config.metadata.visualStyle);
      expect(template.columns.length).toBeGreaterThan(0);
      const tableColumns =
        template.documentType === 'invoice'
          ? template.config.tableColumns.invoice_item_table
          : template.config.tableColumns.transaction_table;
      expect(tableColumns).toEqual(template.columns);
    }
  });

  it('enforces free versus pro access from the same catalog', () => {
    const proTemplate = getSharedDocumentTemplate('IN_PAYMENT_FOCUSED_PRO');
    const freeTemplate = getSharedDocumentTemplate('IN_GST_STANDARD_FREE');

    expect(proTemplate).not.toBeNull();
    expect(freeTemplate).not.toBeNull();
    expect(canUseSharedDocumentTemplate(proTemplate!, false)).toBe(false);
    expect(canUseSharedDocumentTemplate(proTemplate!, true)).toBe(true);
    expect(canUseSharedDocumentTemplate(freeTemplate!, false)).toBe(true);
  });

  it('falls back from locked or unknown selections to the correct default tier', () => {
    expect(
      getAccessibleSharedDocumentTemplate(
        { countryCode: 'IN', templateType: 'invoice', key: 'IN_PAYMENT_FOCUSED_PRO' },
        false
      ).key
    ).toBe('IN_CLEAN_BASIC_FREE');
    expect(getDefaultSharedDocumentTemplate({ countryCode: 'IN', templateType: 'invoice' }, true).tier).toBe('pro');
    expect(getDefaultSharedDocumentTemplate({ countryCode: 'BR', templateType: 'statement' }, false).key).toBe(
      'GENERIC_STATEMENT_STANDARD_FREE'
    );
  });

  it('locks the golden India GST invoice shape used by web and mobile', () => {
    const template = getSharedDocumentTemplate('IN_GST_STANDARD_FREE');

    expect(template?.countryFormat).toBe('india_gst');
    expect(template?.taxLabel).toBe('GST');
    expect(template?.taxRegistrationLabel).toBe('GSTIN');
    expect(template?.columns.map((column) => column.key)).toEqual([
      'name',
      'hsnSac',
      'quantity',
      'price',
      'taxableValue',
      'taxRate',
      'cgst',
      'sgst',
      'igst',
      'total',
    ]);
  });
});
