import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import { formatWorkspaceDocumentAddress } from './workspace-address';

export type PrintPreparedBy = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export type PrintMetric = {
  label: string;
  value: string | number;
  helper?: string | null;
};

export type PrintTableColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
};

export type PrintTableRow = Record<string, string | number | null | undefined>;

export type PrintSection =
  | {
      type: 'summary';
      title: string;
      description?: string | null;
      metrics: PrintMetric[];
    }
  | {
      type: 'table';
      title: string;
      description?: string | null;
      columns: PrintTableColumn[];
      rows: PrintTableRow[];
      emptyText?: string;
    }
  | {
      type: 'notes';
      title: string;
      description?: string | null;
      lines: Array<string | null | undefined>;
    }
  | {
      type: 'image';
      title: string;
      description?: string | null;
      src: string;
      caption?: string | null;
    };

export type PrintDocumentInput = {
  title: string;
  subtitle?: string | null;
  workspace: OrbitWorkspaceSummary;
  preparedBy?: PrintPreparedBy | null;
  generatedAt?: Date | string;
  sections: PrintSection[];
  classification?: string | null;
};

export function buildOrbitPrintDocument(input: PrintDocumentInput): string {
  const generatedAt = input.generatedAt ?? new Date();
  const timestamp = formatPrintDateTime(generatedAt, input.workspace.countryCode);
  const preparedBy = buildPreparedByLine(input.preparedBy);
  const workspaceAddress = formatWorkspaceDocumentAddress(input.workspace);
  const workspaceContact = compactPrintParts([input.workspace.phone, input.workspace.email]).join(' | ');
  const classification = input.classification?.trim() || 'Business record';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} - Orbit Ledger</title>
  <style>${printStyles}</style>
</head>
<body>
  <main class="ol-print-page">
    <header class="ol-print-header">
      <div class="ol-print-brand">
        ${printLogo(input.workspace)}
        <div class="ol-print-business">
          <strong>${escapeHtml(input.workspace.legalName || input.workspace.businessName)}</strong>
          <span>${escapeHtml(workspaceAddress)}</span>
          ${workspaceContact ? `<span>${escapeHtml(workspaceContact)}</span>` : ''}
        </div>
      </div>
      <div class="ol-print-meta">
        <span>${escapeHtml(classification)}</span>
        <strong>${escapeHtml(input.title)}</strong>
        <em>Generated ${escapeHtml(timestamp)}</em>
      </div>
    </header>

    <section class="ol-print-title-block">
      <div>
        <h1>${escapeHtml(input.title)}</h1>
        ${input.subtitle ? `<p>${escapeHtml(input.subtitle)}</p>` : ''}
      </div>
      <div class="ol-print-stamp">Print copy</div>
    </section>

    ${input.sections.map(renderPrintSection).join('\n')}

    <footer class="ol-print-footer">
      <span>Created with Orbit Ledger</span>
      <span>${escapeHtml(input.workspace.businessName)}${preparedBy ? ` | ${escapeHtml(preparedBy)}` : ''}</span>
      <span>${escapeHtml(timestamp)}</span>
    </footer>
  </main>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

export function openOrbitPrintDocument(input: PrintDocumentInput): void {
  const html = buildOrbitPrintDocument(input);
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const target = window.open(blobUrl, '_blank', 'width=980,height=760');
  if (!target) {
    URL.revokeObjectURL(blobUrl);
    throw new Error('Allow popups to open the print preview.');
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function formatPrintDateTime(value: Date | string, countryCode?: string | null): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const locale = localeForCountry(countryCode);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZoneName: 'short',
    year: 'numeric',
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
}

export function formatPrintCurrency(value: number, currency = 'INR', countryCode?: string | null): string {
  return new Intl.NumberFormat(localeForCountry(countryCode), {
    currency,
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(Number.isFinite(value) ? value : 0);
}

export function printPreparedByFromUser(user: { displayName?: string | null; email?: string | null } | null | undefined): PrintPreparedBy {
  return {
    name: user?.displayName ?? null,
    email: user?.email ?? null,
  };
}

function renderPrintSection(section: PrintSection): string {
  if (section.type === 'summary') {
    return `<section class="ol-print-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.description ? `<p class="ol-print-section-description">${escapeHtml(section.description)}</p>` : ''}
      <div class="ol-print-summary-grid">
        ${section.metrics
          .map(
            (metric) => `<article class="ol-print-metric">
              <span>${escapeHtml(metric.label)}</span>
              <strong>${escapeHtml(String(metric.value))}</strong>
              ${metric.helper ? `<small>${escapeHtml(metric.helper)}</small>` : ''}
            </article>`
          )
          .join('')}
      </div>
    </section>`;
  }

  if (section.type === 'table') {
    const rows = section.rows.length
      ? section.rows
          .map(
            (row) => `<tr>${section.columns
              .map((column) => `<td data-label="${escapeAttribute(column.label)}" class="${column.align === 'right' ? 'is-right' : column.align === 'center' ? 'is-center' : ''}">${escapeHtml(String(row[column.key] ?? ''))}</td>`)
              .join('')}</tr>`
          )
          .join('')
      : `<tr><td colspan="${section.columns.length}" class="ol-print-empty">${escapeHtml(section.emptyText ?? 'No records in this print view.')}</td></tr>`;
    return `<section class="ol-print-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.description ? `<p class="ol-print-section-description">${escapeHtml(section.description)}</p>` : ''}
      <table class="ol-print-table">
        <thead><tr>${section.columns.map((column) => `<th class="${column.align === 'right' ? 'is-right' : column.align === 'center' ? 'is-center' : ''}">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }

  if (section.type === 'image') {
    return `<section class="ol-print-section ol-print-image-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.description ? `<p class="ol-print-section-description">${escapeHtml(section.description)}</p>` : ''}
      <figure>
        <img src="${escapeAttribute(section.src)}" alt="${escapeAttribute(section.caption ?? section.title)}" />
        ${section.caption ? `<figcaption>${escapeHtml(section.caption)}</figcaption>` : ''}
      </figure>
    </section>`;
  }

  const lines = section.lines.map((line) => line?.trim()).filter((line): line is string => Boolean(line));
  return `<section class="ol-print-section">
    <h2>${escapeHtml(section.title)}</h2>
    ${section.description ? `<p class="ol-print-section-description">${escapeHtml(section.description)}</p>` : ''}
    <div class="ol-print-notes">
      ${lines.length ? lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('') : '<p>No notes saved.</p>'}
    </div>
  </section>`;
}

function printLogo(workspace: OrbitWorkspaceSummary): string {
  const logoUrl = workspace.logoUri || (workspace as { logoUrl?: string | null }).logoUrl;
  if (logoUrl) {
    return `<img class="ol-print-logo" src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(workspace.businessName)} logo" />`;
  }

  return `<div class="ol-print-logo-fallback">${escapeHtml(initials(workspace.businessName))}</div>`;
}

function buildPreparedByLine(preparedBy?: PrintPreparedBy | null): string {
  if (!preparedBy) {
    return '';
  }
  const name = preparedBy.name?.trim();
  const email = preparedBy.email?.trim();
  const role = preparedBy.role?.trim();
  const roleText = role ? `, ${role}` : '';
  if (name && email) {
    return `Prepared by ${name}${roleText} (${email})`;
  }
  if (name) {
    return `Prepared by ${name}${roleText}`;
  }
  if (email) {
    return `Prepared by ${email}`;
  }
  return '';
}

function compactPrintParts(parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'OL';
}

function localeForCountry(countryCode?: string | null): string {
  const code = countryCode?.trim().toUpperCase();
  if (code === 'US') {
    return 'en-US';
  }
  if (code === 'GB' || code === 'UK') {
    return 'en-GB';
  }
  if (code === 'CA') {
    return 'en-CA';
  }
  if (code === 'AU') {
    return 'en-AU';
  }
  return 'en-IN';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

const printStyles = `
  :root {
    color-scheme: light;
    --text: #111827;
    --muted: #526174;
    --line: #d8e2ef;
    --soft: #f6f9fc;
    --accent: #245db5;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #eef3f8; color: var(--text); font-family: Inter, Arial, sans-serif; }
  .ol-print-page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 15mm; box-shadow: 0 24px 80px rgba(15, 23, 42, .18); }
  .ol-print-header { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(180px, .75fr); gap: 18px; align-items: start; border-bottom: 2px solid var(--line); padding-bottom: 16px; }
  .ol-print-brand { display: flex; gap: 13px; min-width: 0; }
  .ol-print-logo, .ol-print-logo-fallback { width: 52px; height: 52px; border-radius: 16px; flex: 0 0 auto; }
  .ol-print-logo { object-fit: contain; border: 1px solid var(--line); background: #fff; }
  .ol-print-logo-fallback { display: grid; place-items: center; background: #e8f1ff; color: var(--accent); font-weight: 950; letter-spacing: .04em; }
  .ol-print-business { min-width: 0; display: grid; gap: 4px; }
  .ol-print-business strong { font-size: 20px; line-height: 1.15; overflow-wrap: anywhere; }
  .ol-print-business span { color: var(--muted); font-size: 11px; line-height: 1.45; overflow-wrap: anywhere; }
  .ol-print-meta { display: grid; justify-items: end; gap: 5px; text-align: right; min-width: 0; }
  .ol-print-meta span { color: var(--accent); border: 1px solid #c7d9f5; background: #f4f8ff; border-radius: 999px; padding: 5px 9px; font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .ol-print-meta strong { font-size: 17px; line-height: 1.2; overflow-wrap: anywhere; }
  .ol-print-meta em { color: var(--muted); font-size: 10px; font-style: normal; }
  .ol-print-title-block { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 18px 0 12px; }
  .ol-print-title-block h1 { margin: 0; font-size: 28px; line-height: 1.05; letter-spacing: -0.01em; }
  .ol-print-title-block p { margin: 7px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; max-width: 128mm; }
  .ol-print-stamp { flex: 0 0 auto; border: 1px solid var(--line); border-radius: 999px; padding: 7px 12px; font-size: 10px; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .ol-print-section { border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .ol-print-section h2 { margin: 0 0 10px; font-size: 15px; line-height: 1.2; }
  .ol-print-section-description { margin: -3px 0 10px; color: var(--muted); font-size: 11px; line-height: 1.45; max-width: 170mm; overflow-wrap: anywhere; }
  .ol-print-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .ol-print-metric { background: var(--soft); border: 1px solid #e5edf6; border-radius: 10px; padding: 10px; min-width: 0; break-inside: avoid; }
  .ol-print-metric span { display: block; color: #7a8798; font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .ol-print-metric strong { display: block; margin-top: 7px; font-size: 18px; line-height: 1.15; overflow-wrap: anywhere; }
  .ol-print-metric small { display: block; margin-top: 6px; color: var(--muted); font-size: 10px; line-height: 1.35; }
  .ol-print-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .ol-print-table th, .ol-print-table td { border-bottom: 1px solid #e2eaf4; padding: 8px 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  .ol-print-table th { color: #66758a; background: var(--soft); font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
  .ol-print-table tr { break-inside: avoid; page-break-inside: avoid; }
  .ol-print-table .is-right { text-align: right; }
  .ol-print-table .is-center { text-align: center; }
  .ol-print-empty { text-align: center; color: var(--muted); padding: 18px !important; }
  .ol-print-notes { display: grid; gap: 7px; }
  .ol-print-notes p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
  .ol-print-image-section figure { margin: 0; display: grid; gap: 8px; }
  .ol-print-image-section img { width: 100%; max-height: 120mm; object-fit: contain; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
  .ol-print-image-section figcaption { color: var(--muted); font-size: 10px; line-height: 1.4; }
  .ol-print-footer { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); margin-top: 16px; padding-top: 10px; color: var(--muted); font-size: 9px; line-height: 1.35; }
  .ol-print-footer span { min-width: 0; overflow-wrap: anywhere; }
  @media screen and (max-width: 900px) {
    .ol-print-page { width: min(100%, 210mm); min-height: auto; padding: 20px; }
    .ol-print-header, .ol-print-title-block { grid-template-columns: 1fr; display: grid; }
    .ol-print-meta { justify-items: start; text-align: left; }
    .ol-print-summary-grid { grid-template-columns: 1fr 1fr; }
    .ol-print-footer { display: grid; }
  }
  @media screen and (max-width: 560px) {
    .ol-print-page { padding: 14px; }
    .ol-print-title-block h1 { font-size: 24px; }
    .ol-print-summary-grid { grid-template-columns: 1fr; }
    .ol-print-table,
    .ol-print-table tbody,
    .ol-print-table tr,
    .ol-print-table td { display: block; width: 100%; }
    .ol-print-table thead { display: none; }
    .ol-print-table tr { border: 1px solid #e2eaf4; border-radius: 12px; padding: 8px; margin-top: 8px; background: #fff; }
    .ol-print-table td { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #edf2f7; padding: 7px 0; text-align: right; }
    .ol-print-table td:last-child { border-bottom: 0; }
    .ol-print-table td::before { content: attr(data-label); flex: 0 0 42%; color: #66758a; font-size: 9px; font-weight: 900; letter-spacing: .06em; text-align: left; text-transform: uppercase; }
    .ol-print-table td.is-right,
    .ol-print-table td.is-center { text-align: right; }
  }
  @media print {
    body { background: #fff; }
    .ol-print-page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
    .ol-print-section, .ol-print-metric, .ol-print-table tr, .ol-print-image-section figure { break-inside: avoid; page-break-inside: avoid; }
    @page { size: A4; margin: 10mm; }
  }
`;
