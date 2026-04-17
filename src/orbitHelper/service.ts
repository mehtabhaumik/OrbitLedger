import { getDatabase } from '../database';
import { BUNDLED_ORBIT_HELPER_PACK } from './bundledPack';
import type {
  OrbitHelperArticle,
  OrbitHelperPack,
  OrbitHelperSearchResult,
  OrbitHelperStatus,
  OrbitHelperUpdateProvider,
  OrbitHelperUpdateResult,
} from './types';

type AppPreferenceRow = {
  key: string;
  value: string;
  updated_at: string;
};

const STATUS_KEY = 'orbit_helper_status';
const MIN_QUERY_LENGTH = 2;

const bundledUpdateProvider: OrbitHelperUpdateProvider = {
  name: 'bundled',
  async getCandidatePack(currentStatus) {
    if (!currentStatus || compareVersion(BUNDLED_ORBIT_HELPER_PACK.version, currentStatus.version) > 0) {
      return BUNDLED_ORBIT_HELPER_PACK;
    }

    return null;
  },
};

export async function getOrbitHelperStatus(): Promise<OrbitHelperStatus> {
  const savedStatus = await readStatus();
  if (savedStatus) {
    return savedStatus;
  }

  return installOrbitHelperPack(BUNDLED_ORBIT_HELPER_PACK);
}

export async function checkOrbitHelperUpdatesSilently(
  providers: OrbitHelperUpdateProvider[] = [bundledUpdateProvider]
): Promise<OrbitHelperUpdateResult> {
  const checkedAt = new Date().toISOString();
  const currentStatus = await getOrbitHelperStatus();

  for (const provider of providers) {
    try {
      const candidate = await provider.getCandidatePack(currentStatus);
      if (candidate && validateOrbitHelperPack(candidate)) {
        const status = await installOrbitHelperPack(candidate, checkedAt);
        return { checkedAt, updated: true, status };
      }
    } catch {
      // Helper updates should never interrupt ledger work. Keep the last working pack.
    }
  }

  const status = await writeStatus({
    ...currentStatus,
    lastCheckedAt: checkedAt,
  });

  return { checkedAt, updated: false, status };
}

export async function searchOrbitHelper(
  query: string,
  screenContext?: string
): Promise<OrbitHelperSearchResult[]> {
  await getOrbitHelperStatus();
  const cleanedQuery = normalizeSearch(query);
  const articles = getActiveOrbitHelperArticles();

  if (cleanedQuery.length < MIN_QUERY_LENGTH) {
    return getSuggestedOrbitHelperArticles(screenContext).map((article, index) => ({
      article,
      score: 100 - index,
    }));
  }

  const terms = cleanedQuery.split(' ').filter(Boolean);
  return articles
    .map((article) => ({
      article,
      score: scoreArticle(article, terms, screenContext),
    }))
    .filter((result) => result.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 8);
}

export function getSuggestedOrbitHelperArticles(screenContext?: string): OrbitHelperArticle[] {
  const articles = getActiveOrbitHelperArticles();
  const contextMatches = screenContext
    ? articles.filter((article) => article.screenContext?.includes(screenContext))
    : [];
  const defaultSuggestions = [
    'add-payment',
    'create-invoice',
    'backup-restore',
    'tax-packs',
    'pin-security',
    'customer-balance',
  ]
    .map((id) => articles.find((article) => article.id === id))
    .filter((article): article is OrbitHelperArticle => Boolean(article));

  return dedupeArticles([...contextMatches, ...defaultSuggestions]).slice(0, 6);
}

export function getOrbitHelperArticle(articleId: string): OrbitHelperArticle | null {
  return getActiveOrbitHelperArticles().find((article) => article.id === articleId) ?? null;
}

function getActiveOrbitHelperArticles(): OrbitHelperArticle[] {
  return BUNDLED_ORBIT_HELPER_PACK.articles;
}

async function installOrbitHelperPack(
  pack: OrbitHelperPack,
  lastCheckedAt: string | null = null
): Promise<OrbitHelperStatus> {
  if (!validateOrbitHelperPack(pack)) {
    throw new Error('Orbit Helper pack is invalid.');
  }

  return writeStatus({
    packName: pack.name,
    version: pack.version,
    locale: pack.locale,
    source: pack.source,
    installedAt: new Date().toISOString(),
    updatedAt: pack.updatedAt,
    lastCheckedAt,
  });
}

function validateOrbitHelperPack(pack: OrbitHelperPack): boolean {
  return (
    Boolean(pack.id) &&
    Boolean(pack.name) &&
    Boolean(pack.locale) &&
    Boolean(pack.version) &&
    pack.articles.length > 0 &&
    pack.articles.every(
      (article) =>
        Boolean(article.id) &&
        Boolean(article.title) &&
        Boolean(article.summary) &&
        article.body.length > 0 &&
        article.tags.length > 0
    )
  );
}

async function readStatus(): Promise<OrbitHelperStatus | null> {
  try {
    const value = await getPreference(STATUS_KEY);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<OrbitHelperStatus>;
    if (
      typeof parsed.packName !== 'string' ||
      typeof parsed.version !== 'string' ||
      typeof parsed.locale !== 'string' ||
      (parsed.source !== 'bundled' && parsed.source !== 'remote') ||
      typeof parsed.installedAt !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      packName: parsed.packName,
      version: parsed.version,
      locale: parsed.locale,
      source: parsed.source,
      installedAt: parsed.installedAt,
      updatedAt: parsed.updatedAt,
      lastCheckedAt: typeof parsed.lastCheckedAt === 'string' ? parsed.lastCheckedAt : null,
    };
  } catch {
    return null;
  }
}

async function writeStatus(status: OrbitHelperStatus): Promise<OrbitHelperStatus> {
  await setPreference(STATUS_KEY, JSON.stringify(status));
  return status;
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT * FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}

function scoreArticle(
  article: OrbitHelperArticle,
  terms: string[],
  screenContext?: string
): number {
  const title = normalizeSearch(article.title);
  const summary = normalizeSearch(article.summary);
  const tags = article.tags.map(normalizeSearch);
  const body = normalizeSearch(article.body.join(' '));
  let score = screenContext && article.screenContext?.includes(screenContext) ? 12 : 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += 12;
    }
    if (summary.includes(term)) {
      score += 8;
    }
    if (tags.some((tag) => tag.includes(term))) {
      score += 10;
    }
    if (body.includes(term)) {
      score += 3;
    }
  }

  return score;
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9% ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeArticles(articles: OrbitHelperArticle[]): OrbitHelperArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.id)) {
      return false;
    }

    seen.add(article.id);
    return true;
  });
}

function compareVersion(next: string, current: string): number {
  if (next === current) {
    return 0;
  }

  return next.localeCompare(current, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}
