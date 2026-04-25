import { getDatabase } from '../database/client';

export type ProBrandThemeKey = 'ledger_green' | 'graphite' | 'moss';

export type ProBrandTheme = {
  key: ProBrandThemeKey;
  label: string;
  description: string;
  accentColor: string;
  surfaceColor: string;
  lineColor: string;
  textColor: string;
};

type ProBrandThemePreferenceRow = {
  value: string;
};

const PRO_BRAND_THEME_KEY = 'monetization_pro_brand_theme';

export const DEFAULT_PRO_BRAND_THEME_KEY: ProBrandThemeKey = 'ledger_green';

export const PRO_BRAND_THEMES: Record<ProBrandThemeKey, ProBrandTheme> = {
  ledger_green: {
    key: 'ledger_green',
    label: 'Ledger Green',
    description: 'Clean green identity for practical business records.',
    accentColor: '#145C52',
    surfaceColor: '#E5F1ED',
    lineColor: '#D6E0DA',
    textColor: '#18231F',
  },
  graphite: {
    key: 'graphite',
    label: 'Graphite',
    description: 'Quiet professional tone for formal statements.',
    accentColor: '#3F514A',
    surfaceColor: '#EEF2EF',
    lineColor: '#D3DBD6',
    textColor: '#18231F',
  },
  moss: {
    key: 'moss',
    label: 'Moss',
    description: 'Warm but restrained accent for branded documents.',
    accentColor: '#4F6B3F',
    surfaceColor: '#EEF4EA',
    lineColor: '#D5E1CF',
    textColor: '#18231F',
  },
};

export function getProBrandTheme(key?: string | null): ProBrandTheme {
  if (key && isProBrandThemeKey(key)) {
    return PRO_BRAND_THEMES[key];
  }

  return PRO_BRAND_THEMES[DEFAULT_PRO_BRAND_THEME_KEY];
}

export async function getActiveProBrandTheme(): Promise<ProBrandTheme> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProBrandThemePreferenceRow>(
      'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
      PRO_BRAND_THEME_KEY
    );

    return getProBrandTheme(row?.value);
  } catch (error) {
    console.warn('[monetization] Could not load Pro brand theme', error);
    return getProBrandTheme();
  }
}

export async function saveActiveProBrandTheme(key: ProBrandThemeKey): Promise<ProBrandTheme> {
  const theme = getProBrandTheme(key);

  try {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO app_preferences (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at`,
      PRO_BRAND_THEME_KEY,
      theme.key,
      new Date().toISOString()
    );

    return theme;
  } catch (error) {
    console.warn('[monetization] Could not save Pro brand theme', error);
    throw error;
  }
}

function isProBrandThemeKey(value: string): value is ProBrandThemeKey {
  return Object.prototype.hasOwnProperty.call(PRO_BRAND_THEMES, value);
}
