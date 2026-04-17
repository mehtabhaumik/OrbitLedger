import { brand } from './brand';

export const colors = {
  background: brand.colors.background,
  surface: brand.colors.paper,
  surfaceMuted: '#EEF3F8',
  surfaceRaised: brand.colors.raised,
  text: brand.colors.ink,
  textMuted: brand.colors.mutedInk,
  border: brand.colors.line,
  borderStrong: brand.colors.lineStrong,
  primary: brand.colors.ledgerBlue,
  primaryPressed: brand.colors.ledgerBluePressed,
  primarySurface: brand.colors.ledgerBlueSurface,
  accent: brand.colors.due,
  accentSurface: brand.colors.dueSurface,
  success: brand.colors.paid,
  successSurface: brand.colors.paidSurface,
  danger: brand.colors.danger,
  dangerSurface: brand.colors.dangerSurface,
  warning: brand.colors.caution,
  warningSurface: brand.colors.cautionSurface,
  warningBorder: '#E6C35A',
  tax: brand.colors.tax,
  taxSurface: brand.colors.taxSurface,
  premium: brand.colors.premium,
  premiumSurface: brand.colors.premiumSurface,
  offline: brand.colors.ledgerGreen,
  offlineSurface: brand.colors.ledgerGreenSurface,
  backdrop: 'rgba(23, 32, 51, 0.72)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  title: 28,
  hero: 24,
  sectionTitle: 19,
  cardTitle: 16,
  amount: 24,
  balance: 30,
  body: 16,
  label: 14,
  caption: 13,
};

export const radii = {
  sm: 6,
  md: 8,
};

export const layout = {
  screenPadding: spacing.lg,
  cardPadding: spacing.xl,
  sectionGap: spacing.xl,
  cardGap: spacing.lg,
  minTapTarget: 48,
};

export const touch = {
  hitSlop: {
    top: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    left: spacing.sm,
  },
  pressRetentionOffset: {
    top: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    left: spacing.lg,
  },
};

export const borders = {
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
};

export const shadows = {
  card: {
    elevation: 1,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  raised: {
    elevation: 3,
    shadowColor: colors.text,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
};
