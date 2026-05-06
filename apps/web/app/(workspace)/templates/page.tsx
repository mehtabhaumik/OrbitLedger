import Link from 'next/link';

import { AppShell } from '@/components/app-shell';
import {
  type WebDocumentTemplate,
} from '@/lib/web-documents';
import { buildTemplatePreviewDocument, getTemplatePreviewTemplates } from '@/lib/template-preview-demo';

export default function TemplateShowcasePage() {
  const templates = getTemplatePreviewTemplates();

  return (
    <AppShell
      title="Invoice Templates"
      subtitle="Preview free and Pro invoice layouts before choosing one for real documents."
    >
      <section className="ol-panel-glass">
        <div className="ol-panel-header">
          <div>
            <div className="ol-panel-title">Template showcase</div>
            <p className="ol-panel-copy">
              These previews use sample data only. Open any template to inspect it in a separate tab. Real printing and downloads stay inside saved invoices.
            </p>
          </div>
          <span className="ol-chip ol-chip--primary">India GST ready</span>
        </div>
        <div className="ol-template-showcase-grid">
          {templates.map((template) => (
            <TemplateShowcaseCard key={template.key} template={template} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function TemplateShowcaseCard({
  template,
}: {
  template: WebDocumentTemplate;
}) {
  const document = buildTemplatePreviewDocument(template.key);

  return (
    <article className="ol-template-showcase-card">
      <div className="ol-template-showcase-header">
        <div>
          <strong>{template.label}</strong>
          <p>{template.description}</p>
        </div>
        <span className={`ol-chip ${template.tier === 'pro' ? 'ol-chip--premium' : 'ol-chip--primary'}`}>
          {template.tier === 'pro' ? 'Pro' : 'Free'}
        </span>
      </div>
      <iframe className="ol-template-showcase-frame" title={`${template.label} preview`} srcDoc={document.html} />
      <Link
        className="ol-button-secondary ol-template-showcase-open"
        href={`/templates/preview?template=${encodeURIComponent(template.key)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open preview
      </Link>
      {template.tier === 'pro' ? (
        <p className="ol-template-lock-note">Pro sample only. Upgrade to use this layout on customer documents.</p>
      ) : (
        <p className="ol-template-lock-note">Included in Free. Preview uses fake data and cannot be printed from the preview tab.</p>
      )}
    </article>
  );
}
