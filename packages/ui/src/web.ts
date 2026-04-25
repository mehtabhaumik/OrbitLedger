import { brand } from './brand';
import { colors, radii, spacing, typography } from './theme';

export const webShell = {
  maxContentWidth: 1440,
  sidebarWidth: 264,
  sidebarCollapsedWidth: 84,
  topbarHeight: 72,
  contentPaddingX: 32,
  contentPaddingY: 24,
  pageGap: 24,
  panelGap: 20,
} as const;

export const webSurface = {
  app: colors.shell,
  sidebar: colors.sidebar,
  topbar: colors.topbarGlass,
  workspace: colors.surface,
  panel: colors.surface,
  panelRaised: colors.surfaceRaised,
  divider: colors.border,
  dividerStrong: colors.borderStrong,
  glassBorder: colors.glassBorder,
} as const;

export const webTypography = {
  pageTitle: 30,
  pageSubtitle: 15,
  sectionTitle: 20,
  panelTitle: 16,
  tableHeader: 13,
  tableCell: 14,
  statValue: 30,
  statLabel: 12,
} as const;

export const webStatus = {
  offline: {
    background: colors.warningSurface,
    foreground: colors.warning,
  },
  syncing: {
    background: colors.primarySurface,
    foreground: colors.primary,
  },
  synced: {
    background: colors.successSurface,
    foreground: colors.success,
  },
  error: {
    background: colors.dangerSurface,
    foreground: colors.danger,
  },
  premium: {
    background: colors.premiumSurface,
    foreground: colors.premium,
  },
  intelligence: {
    background: colors.taxSurface,
    foreground: colors.tax,
  },
} as const;

export const webTable = {
  rowHeight: 56,
  denseRowHeight: 48,
  zebraStripe: colors.tableStripe,
  selectedBackground: colors.selectedRow,
  hoverBackground: '#F4F8FF',
  headerBackground: '#F9FBFE',
  borderRadius: radii.md,
} as const;

export const webComponentRules = {
  card:
    'Use white surfaces with subtle border and limited shadow. Accent appears in side stripe, chip, icon, or critical number.',
  panel:
    'Panels may be sticky on large screens and should hold filters, details, or document metadata without becoming decorative.',
  table:
    'Tables are a strength on web. Prefer sortable columns, visible status chips, right-aligned amounts, and restrained row actions.',
  documentPreview:
    'Use a clean centered document canvas with metadata and actions in the surrounding shell, not mixed into the page body.',
  navigation:
    'Use left sidebar plus top context bar. Do not mirror mobile bottom navigation on desktop widths.',
} as const;

export const webInformationArchitecture = [
  {
    key: 'home',
    label: 'Home',
    description: 'Receivables, follow-up priorities, recent activity, sync health, and quick actions.',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'Searchable customer list, dues review, and ledger drill-down.',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    description: 'Fast entry, filters, audit-friendly review, and recent customer shortcuts.',
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Invoice list, editor, preview, and export actions with stronger document treatment.',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Business review, compliance summaries, aging, and health insights.',
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Statements, invoice previews, saved document history, and print/download/share.',
  },
  {
    key: 'backup',
    label: 'Backup',
    description: 'Backup status, export, restore preview, and trust messaging.',
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Business profile, sync, tax, country packages, security, and billing.',
  },
] as const;

export const webBrandGuidance = {
  paletteIntent: brand.semantics.tone,
  usage: brand.semantics.usage,
  mobileExpression: brand.platformExpression.mobile,
  webExpression: brand.platformExpression.web,
  avoid: [
    'full-rainbow dashboards',
    'pink-first action hierarchy',
    'mobile cards simply stretched to desktop width',
    'marketing-style hero layouts inside the app shell',
    'heavy gradients behind data tables or documents',
  ],
  emphasize: [
    'neutral workspace surfaces',
    'clear KPI banding',
    'structured tables',
    'trust signals for sync, backup, and security',
    'controlled glass only in shell/header/overlay surfaces',
  ],
} as const;

export const webFoundation = {
  shell: webShell,
  surface: webSurface,
  typography: webTypography,
  status: webStatus,
  table: webTable,
  rules: webComponentRules,
  informationArchitecture: webInformationArchitecture,
  brand: webBrandGuidance,
  mobileTypography: typography,
  spacing,
} as const;
