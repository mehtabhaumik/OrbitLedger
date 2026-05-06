import { describe, expect, it } from 'vitest';

import { buildTemplatePreviewDocument, protectTemplatePreviewHtml } from './template-preview-demo';

describe('template preview demo', () => {
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
