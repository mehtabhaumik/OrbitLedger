'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  buildTemplatePreviewDocument,
  protectTemplatePreviewHtml,
} from '@/lib/template-preview-demo';
import type { WebProBrandTheme } from '@/lib/web-monetization';

export function TemplatePreviewSearchClient({
  backHref = '/templates',
  backLabel = 'Back to templates',
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const searchParams = useSearchParams();

  return <TemplatePreviewClient backHref={backHref} backLabel={backLabel} initialTemplateKey={searchParams.get('template')} />;
}

export function TemplatePreviewClient({
  backHref = '/templates',
  backLabel = 'Back to templates',
  initialTemplateKey,
}: {
  backHref?: string;
  backLabel?: string;
  initialTemplateKey: string | null;
}) {
  const [accentColor, setAccentColor] = useState('#145C52');
  const [surfaceColor, setSurfaceColor] = useState('#E5F1ED');
  const [lineColor, setLineColor] = useState('#B7D6CB');
  const [textColor, setTextColor] = useState('#18231F');
  const [watermarkText, setWatermarkText] = useState('Demo');
  const [useLogoWatermark, setUseLogoWatermark] = useState(false);
  const [watermarkImageUrl, setWatermarkImageUrl] = useState<string | null>(null);
  const [watermarkImageName, setWatermarkImageName] = useState<string | null>(null);
  const [watermarkUploadError, setWatermarkUploadError] = useState<string | null>(null);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.08);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);

  const proTheme: WebProBrandTheme = useMemo(
    () => ({
      key: 'ledger_green',
      label: 'Custom preview',
      description: 'Custom colors selected for this sample preview.',
      accentColor,
      surfaceColor,
      lineColor,
      textColor,
    }),
    [accentColor, lineColor, surfaceColor, textColor]
  );
  const document = useMemo(
    () =>
      buildTemplatePreviewDocument(initialTemplateKey, {
        proTheme,
        watermarkText,
        watermarkImageUrl,
        useLogoWatermark,
        watermarkOpacity,
        includeLogo,
        includeSignature,
      }),
    [includeLogo, includeSignature, initialTemplateKey, proTheme, useLogoWatermark, watermarkImageUrl, watermarkOpacity, watermarkText]
  );
  const protectedHtml = useMemo(() => protectTemplatePreviewHtml(document.html), [document.html]);
  const isProTemplate = document.template.tier === 'pro';

  function handleWatermarkImagePicked(file: File | null) {
    setWatermarkUploadError(null);
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setWatermarkUploadError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setWatermarkUploadError('Use an image under 2 MB for a crisp, fast preview.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setWatermarkImageUrl(result);
      setWatermarkImageName(file.name);
      setUseLogoWatermark(false);
    };
    reader.onerror = () => {
      setWatermarkUploadError('This image could not be loaded for preview.');
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="ol-template-preview-page">
      <header className="ol-template-preview-toolbar">
        <div>
          <div className="ol-panel-title">{document.template.label}</div>
          <p className="ol-panel-copy">
            Sample preview only. This tab uses fake business and customer data, and printing is disabled here.
          </p>
        </div>
        <Link className="ol-button-secondary" href={backHref as Route}>
          {backLabel}
        </Link>
      </header>

      <section className="ol-template-preview-controls">
        <div>
          <strong>Premium branding controls</strong>
          <p>
            Pro templates can carry your logo, signature, custom colors, and watermark. These controls are for sample preview only.
          </p>
        </div>
        <label className="ol-color-control">
          Header color
          <input disabled={!isProTemplate} type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
        </label>
        <label className="ol-color-control">
          Background
          <input disabled={!isProTemplate} type="color" value={surfaceColor} onChange={(event) => setSurfaceColor(event.target.value)} />
        </label>
        <label className="ol-color-control">
          Line color
          <input disabled={!isProTemplate} type="color" value={lineColor} onChange={(event) => setLineColor(event.target.value)} />
        </label>
        <label className="ol-color-control">
          Font color
          <input disabled={!isProTemplate} type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} />
        </label>
        <label className="ol-field ol-template-watermark-field">
          <span className="ol-field-label">Watermark text</span>
          <input
            className="ol-input"
            disabled={!isProTemplate || Boolean(watermarkImageUrl || useLogoWatermark)}
            maxLength={24}
            value={watermarkText}
            onChange={(event) => setWatermarkText(event.target.value)}
          />
        </label>
        <div className="ol-preview-watermark-upload">
          <span className="ol-field-label">Watermark image</span>
          <div className="ol-preview-watermark-upload-row">
            <label className={`ol-button-secondary ${!isProTemplate ? 'is-disabled' : ''}`}>
              Upload image
              <input
                accept="image/png,image/jpeg,image/webp"
                disabled={!isProTemplate}
                type="file"
                onChange={(event) => handleWatermarkImagePicked(event.target.files?.[0] ?? null)}
              />
            </label>
            {watermarkImageUrl ? (
              <button
                className="ol-button-ghost"
                disabled={!isProTemplate}
                type="button"
                onClick={() => {
                  setWatermarkImageUrl(null);
                  setWatermarkImageName(null);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
          <span className={watermarkUploadError ? 'ol-field-error' : 'ol-preview-watermark-helper'}>
            {watermarkUploadError ??
              (watermarkImageName
                ? `Selected: ${watermarkImageName}`
                : 'Preview only · PNG, JPG, or WebP under 2 MB')}
          </span>
        </div>
        <label className="ol-field ol-template-watermark-field">
          <span className="ol-field-label">Watermark opacity</span>
          <input
            className="ol-range"
            disabled={!isProTemplate}
            max="0.3"
            min="0.02"
            step="0.01"
            type="range"
            value={watermarkOpacity}
            onChange={(event) => setWatermarkOpacity(Number(event.target.value))}
          />
          <span className="ol-field-helper">{Math.round(watermarkOpacity * 100)}%</span>
        </label>
        <label className="ol-toggle-row">
          <input checked={includeLogo} disabled={!isProTemplate} type="checkbox" onChange={(event) => setIncludeLogo(event.target.checked)} />
          Logo
        </label>
        <label className="ol-toggle-row">
          <input checked={includeSignature} disabled={!isProTemplate} type="checkbox" onChange={(event) => setIncludeSignature(event.target.checked)} />
          Signature
        </label>
        <label className="ol-toggle-row">
          <input
            checked={useLogoWatermark}
            disabled={!isProTemplate || Boolean(watermarkImageUrl)}
            type="checkbox"
            onChange={(event) => setUseLogoWatermark(event.target.checked)}
          />
          Logo watermark
        </label>
        {!isProTemplate ? (
          <span className="ol-template-control-note">Open a Pro template to try branding controls.</span>
        ) : null}
      </section>

      <iframe
        className="ol-template-preview-full-frame"
        title={`${document.template.label} sample preview`}
        srcDoc={protectedHtml}
      />
    </main>
  );
}
