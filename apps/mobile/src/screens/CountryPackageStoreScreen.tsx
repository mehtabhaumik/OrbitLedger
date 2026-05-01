import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { FounderFooterLink } from '../components/FounderFooterLink';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { StatusChip } from '../components/StatusChip';
import {
  applyCountryPackageUpdateFromProvider,
  loadInstalledCountryPackage,
  manualCheckCountryPackageUpdates,
  type CountryPackageUpdateCandidate,
  type CountryPackageUpdateCheckResult,
} from '../countryPackages';
import {
  getBusinessSettings,
  saveBusinessSettings,
  type BusinessSettings,
  type CountryPackageLookup,
  type CountryPackageWithComponents,
} from '../database';
import {
  getCountryPackEntitlements,
  getCountryPackProduct,
  getSubscriptionStatus,
  loadBillingProductDetails,
  purchaseCountryPack,
  recordPremiumFeatureAttemptForUpgradeNudge,
  restoreStorePurchases,
  type CountryPackEntitlement,
  type StoreProductDetails,
  type SubscriptionStatus,
} from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import { borders, colors, radii, spacing, typography } from '../theme/theme';

type CountryPackageStoreProps = NativeStackScreenProps<RootStackParamList, 'CountryPackageStore'>;

type CountryPackageCatalogEntry = {
  id: string;
  countryCode: string;
  regionCode: string;
  name: string;
  description: string;
  requiredTier: 'free' | 'pro';
  highlights: string[];
};

type InstalledPackageMap = Record<string, CountryPackageWithComponents | null>;
type UpdateStatusMap = Record<string, CountryPackageUpdateCheckResult | null>;

const starterCatalog: CountryPackageCatalogEntry[] = [
  {
    id: 'IN:',
    countryCode: 'IN',
    regionCode: '',
    name: 'India Starter Package',
    description: 'Starter GST labels, India invoice wording, statements, and practical summaries.',
    requiredTier: 'free',
    highlights: ['GST labels', 'Invoice and statement wording', 'Starter summaries'],
  },
  {
    id: 'US:',
    countryCode: 'US',
    regionCode: '',
    name: 'United States Starter Package',
    description: 'Starter sales tax labels, document wording, and review summaries.',
    requiredTier: 'pro',
    highlights: ['Sales tax labels', 'Document wording', 'Review summaries'],
  },
  {
    id: 'GB:',
    countryCode: 'GB',
    regionCode: '',
    name: 'United Kingdom Starter Package',
    description: 'Starter VAT labels, statement wording, and review summaries.',
    requiredTier: 'pro',
    highlights: ['VAT labels', 'Document wording', 'Review summaries'],
  },
];

export function CountryPackageStoreScreen({ navigation }: CountryPackageStoreProps) {
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [countryPackEntitlements, setCountryPackEntitlements] = useState<CountryPackEntitlement[]>([]);
  const [countryPackProducts, setCountryPackProducts] = useState<StoreProductDetails[]>([]);
  const [installedPackages, setInstalledPackages] = useState<InstalledPackageMap>({});
  const [updateStatuses, setUpdateStatuses] = useState<UpdateStatusMap>({});
  const [loading, setLoading] = useState(true);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalog = useMemo(
    () => buildCountryPackageCatalog(businessSettings),
    [businessSettings]
  );

  const refreshPackages = useCallback(
    async (entries: CountryPackageCatalogEntry[]) => {
      const installedEntries = await Promise.all(
        entries.map(async (entry) => [
          entry.id,
          await loadInstalledCountryPackage(toPackageLookup(entry)),
        ] as const)
      );
      setInstalledPackages(Object.fromEntries(installedEntries));
    },
    []
  );

  const loadStore = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [settings, subscription, entitlements, products] = await Promise.all([
        getBusinessSettings(),
        getSubscriptionStatus(),
        getCountryPackEntitlements(),
        loadBillingProductDetails(),
      ]);

      if (!settings) {
        navigation.replace('Setup');
        return;
      }

      const entries = buildCountryPackageCatalog(settings);
      setBusinessSettings(settings);
      setSubscriptionStatus(subscription);
      setCountryPackEntitlements(entitlements);
      setCountryPackProducts(products.countryPacks);
      await refreshPackages(entries);
    } catch {
      setErrorMessage('Region settings could not load. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigation, refreshPackages]);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const activePackageId = businessSettings
    ? packageIdFromLookup({
        countryCode: businessSettings.countryCode,
        regionCode: businessSettings.stateCode,
      })
    : null;

  async function buyCountryPackage(entry: CountryPackageCatalogEntry) {
    if (busyPackageId) {
      return;
    }

    await recordPremiumFeatureAttemptForUpgradeNudge('tax_ready_documents');
    const product = getCountryPackProduct(entry.countryCode);

    if (!product) {
      Alert.alert(
        'Country pack not available',
        'This country package does not have a configured store product yet.'
      );
      return;
    }

    Alert.alert(
      `Buy ${entry.name}?`,
      'Orbit Ledger will open the app store purchase flow. The package is ready to use after the store confirms purchase.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void completeCountryPackagePurchase(entry);
          },
        },
      ]
    );
  }

  async function completeCountryPackagePurchase(entry: CountryPackageCatalogEntry) {
    setBusyPackageId(`${entry.id}:purchase`);

    try {
      const purchaseResult = await purchaseCountryPack(entry.countryCode);
      const nextEntitlements =
        purchaseResult.countryPackEntitlements ?? (await getCountryPackEntitlements());
      setCountryPackEntitlements(nextEntitlements);
      Alert.alert(
        purchaseResult.status === 'pending' ? 'Purchase pending' : 'Country pack unlocked',
        purchaseResult.message
      );

      if (purchaseResult.status === 'completed') {
        await installOrActivatePackage(entry, undefined, true);
      }
    } catch (error) {
      Alert.alert('Purchase not completed', getPurchaseErrorMessage(error));
    } finally {
      setBusyPackageId(null);
    }
  }

  async function checkForUpdate(entry: CountryPackageCatalogEntry) {
    setBusyPackageId(`${entry.id}:check`);
    setErrorMessage(null);

    try {
      const result = await manualCheckCountryPackageUpdates(toPackageLookup(entry));
      setUpdateStatuses((current) => ({ ...current, [entry.id]: result }));

      if (result.updateAvailable) {
        Alert.alert(
          'Package update available',
          `${entry.name} v${result.latestVersion} can be installed and used after it is applied.`
        );
        return;
      }

      Alert.alert('Package is up to date', result.message);
    } catch {
      setErrorMessage('Update check failed. No installed package was changed.');
      Alert.alert('Update check failed', 'No installed package was changed.');
    } finally {
      setBusyPackageId(null);
    }
  }

  async function installOrActivatePackage(
    entry: CountryPackageCatalogEntry,
    candidate?: CountryPackageUpdateCandidate,
    bypassAccessCheck = false
  ) {
    if (!businessSettings) {
      return;
    }

    const access = resolvePackageAccess(entry, countryPackEntitlements);
    if (!bypassAccessCheck && !access.allowed) {
      await buyCountryPackage(entry);
      return;
    }

    setBusyPackageId(`${entry.id}:install`);
    setErrorMessage(null);

    try {
      const lookup = toPackageLookup(entry);
      const installedPackage = installedPackages[entry.id] ?? null;

      if (!candidate && installedPackage) {
        await activateInstalledPackage(entry, installedPackage);
        return;
      }

      const updateCandidate = candidate ?? (await manualCheckCountryPackageUpdates(lookup)).candidate;
      if (!updateCandidate) {
        setErrorMessage('No online country package is available for this region yet.');
        Alert.alert(
          'No online package available',
          'Your current country setup was not changed. Try again after the update service is available.'
        );
        return;
      }

      const result = await applyCountryPackageUpdateFromProvider(lookup, updateCandidate);
      if (result.status !== 'installed' || !result.countryPackage) {
        setErrorMessage(result.message);
        Alert.alert('Package could not be installed', result.message);
        return;
      }

      await activateInstalledPackage(entry, result.countryPackage);
    } catch {
      setErrorMessage('Country package could not be installed. Your current country setup was not changed.');
      Alert.alert(
        'Package could not be installed',
        'Your current country setup was not changed. Please try again.'
      );
    } finally {
      setBusyPackageId(null);
    }
  }

  async function activateInstalledPackage(
    entry: CountryPackageCatalogEntry,
    installed: CountryPackageWithComponents
  ) {
    if (!businessSettings) {
      return;
    }

    const savedSettings = await saveBusinessSettings({
      ...businessSettings,
      countryCode: installed.countryCode,
      stateCode: installed.regionCode,
      taxMode: 'manual',
      taxProfileVersion: installed.taxPack.version,
      taxProfileSource: 'remote',
      taxLastSyncedAt: installed.taxPack.lastUpdated,
      taxSetupRequired: false,
    });

    setBusinessSettings(savedSettings);
    setInstalledPackages((current) => ({ ...current, [entry.id]: installed }));
    setUpdateStatuses((current) => ({ ...current, [entry.id]: null }));

    Alert.alert(
      'Country package active',
      `${entry.name} is installed and now controls the active country setup.`
    );
  }

  async function applyPackageUpdate(entry: CountryPackageCatalogEntry) {
    const status = updateStatuses[entry.id];

    if (!status?.candidate) {
      await checkForUpdate(entry);
      return;
    }

    await installOrActivatePackage(entry, status.candidate);
  }

  async function restorePurchasesForPackages() {
    if (busyPackageId) {
      return;
    }

    setBusyPackageId('restore-purchases');
    setErrorMessage(null);

    try {
      const result = await restoreStorePurchases();
      setSubscriptionStatus(result.subscriptionStatus);
      setCountryPackEntitlements(result.countryPackEntitlements);
      Alert.alert('Purchases refreshed', result.message);
    } catch {
      const message = 'Store purchases could not be refreshed. Existing package access was preserved.';
      setErrorMessage(message);
      Alert.alert('Restore failed', message);
    } finally {
      setBusyPackageId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.centeredText}>Loading region settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Region Settings"
          subtitle="Install local labels, document wording, and starter summaries for your market."
          backLabel="Back"
          onBack={() => navigation.goBack()}
        />

        <Card glass elevated accent="tax">
          <Text style={styles.infoTitle}>Active country setup</Text>
          <Text style={styles.infoText}>
            {businessSettings
              ? `${businessSettings.countryCode} / ${businessSettings.stateCode || 'All regions'}`
              : 'No business profile loaded'}
          </Text>
          <Text style={styles.infoFootnote}>
            Switching countries here checks the setup first, then updates the business profile.
          </Text>
        </Card>

        {errorMessage ? (
          <Card compact accent="warning">
            <Text style={styles.warningText}>{errorMessage}</Text>
          </Card>
        ) : null}

        {subscriptionStatus ? (
          <Card compact accent={subscriptionStatus.isPro ? 'premium' : 'primary'} style={styles.planCard}>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>Package access</Text>
              <Text style={styles.planText}>
                {subscriptionStatus.isPro
                  ? 'Pro document features are active. Paid region packs are still unlocked by their own store purchase.'
                  : 'Included region settings are available now. Paid packs add richer labels, templates, and summaries without blocking your ledger.'}
              </Text>
            </View>
            <StatusChip label={subscriptionStatus.tierLabel} tone={subscriptionStatus.isPro ? 'premium' : 'neutral'} />
            <PrimaryButton
              disabled={Boolean(busyPackageId)}
              loading={busyPackageId === 'restore-purchases'}
              onPress={() => void restorePurchasesForPackages()}
              variant="secondary"
            >
              Restore Purchases
            </PrimaryButton>
          </Card>
        ) : null}

        <Section title="Available packages" subtitle="Install once, then use local labels, documents, and report setup when needed.">
          {catalog.map((entry) => {
            const installedPackage = installedPackages[entry.id] ?? null;
            const updateStatus = updateStatuses[entry.id] ?? null;
            const access = resolvePackageAccess(entry, countryPackEntitlements);
            const isActive = activePackageId === entry.id && Boolean(installedPackage);
            const isChecking = busyPackageId === `${entry.id}:check`;
            const isInstalling = busyPackageId === `${entry.id}:install`;
            const isPurchasing = busyPackageId === `${entry.id}:purchase`;
            const isBusy = Boolean(busyPackageId);
            const product = getCountryPackProduct(entry.countryCode);
            const storeProduct = product
              ? countryPackProducts.find((entryProduct) => entryProduct.productId === product.productId)
              : null;

            return (
              <CountryPackageCard
                accessLabel={access.label}
                busy={isBusy}
                entry={entry}
                installedPackage={installedPackage}
                isActive={isActive}
                isChecking={isChecking}
                isInstalling={isInstalling}
                isPurchasing={isPurchasing}
                key={entry.id}
                onCheckUpdate={() => void checkForUpdate(entry)}
                onInstallOrActivate={() => void installOrActivatePackage(entry)}
                onUnlock={() => void buyCountryPackage(entry)}
                onUpdate={() => void applyPackageUpdate(entry)}
                priceLabel={storeProduct?.displayPrice ?? product?.fallbackPrice ?? null}
                updateStatus={updateStatus}
              />
            );
          })}
        </Section>

        <FounderFooterLink />
      </ScrollView>
    </SafeAreaView>
  );
}

function CountryPackageCard({
  accessLabel,
  busy,
  entry,
  installedPackage,
  isActive,
  isChecking,
  isInstalling,
  isPurchasing,
  onCheckUpdate,
  onInstallOrActivate,
  onUnlock,
  onUpdate,
  priceLabel,
  updateStatus,
}: {
  accessLabel: string;
  busy: boolean;
  entry: CountryPackageCatalogEntry;
  installedPackage: CountryPackageWithComponents | null;
  isActive: boolean;
  isChecking: boolean;
  isInstalling: boolean;
  isPurchasing: boolean;
  onCheckUpdate: () => void;
  onInstallOrActivate: () => void;
  onUnlock: () => void;
  onUpdate: () => void;
  priceLabel: string | null;
  updateStatus: CountryPackageUpdateCheckResult | null;
}) {
  const isLocked = accessLabel === 'Locked';
  const hasUpdate = Boolean(updateStatus?.updateAvailable && updateStatus.candidate);
  const actionLabel = getPackageActionLabel({
    isActive,
    isLocked,
    hasUpdate,
    installed: Boolean(installedPackage),
  });

  return (
    <Card accent={isActive ? 'success' : entry.requiredTier === 'pro' ? 'premium' : 'tax'} style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleGroup}>
          <Text style={styles.packageName}>{entry.name}</Text>
          <Text style={styles.packageRegion}>{entry.countryCode} / {entry.regionCode || 'All regions'}</Text>
        </View>
        <View style={styles.badgeWrap}>
          <StatusChip label={accessLabel} tone={accessLabel === 'Locked' ? 'warning' : 'neutral'} />
          {installedPackage ? <StatusChip label={isActive ? 'Active' : 'Installed'} tone="success" /> : null}
          {hasUpdate ? <StatusChip label="Update available" tone="warning" /> : null}
        </View>
      </View>

      <Text style={styles.packageDescription}>{entry.description}</Text>

      <View style={styles.highlightList}>
        {entry.highlights.map((highlight) => (
          <Text key={highlight} style={styles.highlightText}>- {highlight}</Text>
        ))}
      </View>

      <View style={styles.packageMeta}>
        <MetaRow label="Installed version" value={installedPackage ? `v${installedPackage.version}` : 'Not installed'} />
        <MetaRow
          label="Tax setup"
          value={installedPackage ? `${installedPackage.taxPack.taxType} v${installedPackage.taxPack.version}` : 'Included after install'}
        />
        <MetaRow
          label="Templates"
          value={installedPackage?.templates.length ? installedPackage.templates.map((template) => `${template.templateType} v${template.version}`).join(', ') : 'Invoice and statement'}
        />
        <MetaRow
          label="Last checked"
          value={updateStatus ? formatShortDateTime(updateStatus.checkedAt) : 'Not checked yet'}
        />
        <MetaRow
          label="Latest online version"
          value={updateStatus?.latestVersion ? `v${updateStatus.latestVersion}` : 'Check when needed'}
        />
        <MetaRow label="Store price" value={priceLabel ?? (entry.requiredTier === 'free' ? 'Included' : 'Configured in store')} />
      </View>

      {updateStatus ? (
        <View style={hasUpdate ? styles.updateNotice : styles.currentNotice}>
          <Text style={styles.noticeText}>{updateStatus.message}</Text>
        </View>
      ) : null}

      <View style={styles.packageActions}>
        {isLocked ? (
          <PrimaryButton disabled={busy && !isPurchasing} loading={isPurchasing} onPress={onUnlock}>
            Buy Country Pack
          </PrimaryButton>
        ) : (
          <PrimaryButton
            disabled={busy && !isInstalling}
            loading={isInstalling}
            onPress={hasUpdate ? onUpdate : onInstallOrActivate}
          >
            {actionLabel}
          </PrimaryButton>
        )}
        <PrimaryButton
          disabled={isLocked || isInstalling || (busy && !isChecking)}
          loading={isChecking}
          onPress={onCheckUpdate}
          variant="secondary"
        >
          Check Updates
        </PrimaryButton>
      </View>
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function buildCountryPackageCatalog(
  businessSettings: BusinessSettings | null
): CountryPackageCatalogEntry[] {
  const currentCountryCode = normalizeCode(businessSettings?.countryCode ?? 'IN') || 'IN';
  const currentRegionCode = normalizeCode(businessSettings?.stateCode ?? '');
  const currentId = packageIdFromLookup({
    countryCode: currentCountryCode,
    regionCode: currentRegionCode,
  });
  const currentPackage: CountryPackageCatalogEntry = {
    id: currentId,
    countryCode: currentCountryCode,
    regionCode: currentRegionCode,
    name: `${currentCountryCode}${currentRegionCode ? `-${currentRegionCode}` : ''} Current Region Package`,
    description: 'An online package matched to your current business country and region.',
    requiredTier: isIncludedCountryPackage(currentCountryCode) ? 'free' : 'pro',
    highlights: ['Tax setup', 'Local document templates', 'Review summary structure'],
  };

  const entries = [currentPackage, ...starterCatalog];
  const seen = new Set<string>();

  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }

    seen.add(entry.id);
    return true;
  });
}

function resolvePackageAccess(
  entry: CountryPackageCatalogEntry,
  countryPackEntitlements: CountryPackEntitlement[]
): { allowed: boolean; label: string } {
  if (entry.requiredTier === 'free') {
    return { allowed: true, label: 'Included' };
  }

  const hasCountryPackPurchase = countryPackEntitlements.some(
    (entitlement) => entitlement.countryCode === entry.countryCode
  );
  if (hasCountryPackPurchase) {
    return { allowed: true, label: 'Purchased' };
  }

  return { allowed: false, label: 'Locked' };
}

function getPackageActionLabel({
  isActive,
  isLocked,
  hasUpdate,
  installed,
}: {
  isActive: boolean;
  isLocked: boolean;
  hasUpdate: boolean;
  installed: boolean;
}): string {
  if (isLocked) {
    return 'Buy Country Pack';
  }

  if (hasUpdate) {
    return 'Apply Update';
  }

  if (isActive) {
    return 'Reapply Package';
  }

  return installed ? 'Switch to Package' : 'Install and Activate';
}

function toPackageLookup(entry: CountryPackageCatalogEntry): CountryPackageLookup {
  return {
    countryCode: entry.countryCode,
    regionCode: entry.regionCode,
  };
}

function packageIdFromLookup(lookup: CountryPackageLookup): string {
  const countryCode = normalizeCode(lookup.countryCode);
  const regionCode = normalizeCode(lookup.regionCode ?? '');
  return `${countryCode}:${regionCode}`;
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function isIncludedCountryPackage(countryCode: string): boolean {
  // India access is included by default; package data still installs through the update provider.
  return normalizeCode(countryCode) === 'IN';
}

function formatShortDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function getPurchaseErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalizedCode = code.toLowerCase();
  const normalized = message.toLowerCase();

  if (
    normalizedCode.includes('cancel') ||
    normalized.includes('cancel') ||
    normalized.includes('user-cancelled')
  ) {
    return 'Purchase cancelled. No change was made.';
  }

  if (normalized.includes('not available')) {
    return 'Store billing is not available in this build, or this product is not configured in the store yet.';
  }

  return 'The country pack purchase could not be completed. Please try again.';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  centeredText: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  infoCard: {
    ...borders.card,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  infoTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  infoText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  infoFootnote: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  warningCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningSurface,
    padding: spacing.md,
  },
  warningText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  planCard: {
    ...borders.card,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySurface,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  planCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitle: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  planText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  successPill: {
    backgroundColor: colors.successSurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  successPillText: {
    color: colors.success,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  neutralPill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  neutralPillText: {
    color: colors.textMuted,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  packageList: {
    gap: spacing.lg,
  },
  packageCard: {
    ...borders.card,
    backgroundColor: colors.surface,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  packageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  packageTitleGroup: {
    flex: 1,
    gap: spacing.xs,
  },
  packageName: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 23,
  },
  packageRegion: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  badgeWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: spacing.xs,
  },
  statusBadge: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successSurface,
    borderColor: colors.borderStrong,
  },
  statusBadgeWarning: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
  },
  statusBadgeText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  statusBadgeTextSuccess: {
    color: colors.success,
  },
  statusBadgeTextWarning: {
    color: colors.text,
  },
  packageDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  highlightList: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  highlightText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  packageMeta: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  metaRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  updateNotice: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warningBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  currentNotice: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  noticeText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  packageActions: {
    gap: spacing.md,
  },
});
