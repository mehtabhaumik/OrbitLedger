import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { Section } from '../components/Section';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatusChip } from '../components/StatusChip';
import {
  PRO_PLAN_CATALOG,
  getBillingLastRefreshAt,
  getSubscriptionStatus,
  loadBillingProductDetails,
  purchaseProPlan,
  restoreStorePurchases,
} from '../monetization';
import type {
  ProPlanCatalogItem,
  StoreProductDetails,
  SubscriptionPlanId,
  SubscriptionStatus,
} from '../monetization';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type UpgradeScreenProps = NativeStackScreenProps<RootStackParamList, 'Upgrade'>;

const proBenefits = [
  {
    title: 'Polished statements',
    detail: 'Cleaner statement layouts with stronger spacing, typography, and print formatting.',
  },
  {
    title: 'Business branding',
    detail: 'Use your logo, authorized signature, and a restrained Pro theme in customer documents.',
  },
  {
    title: 'Future premium tools',
    detail: 'Prepared for tax-ready documents, templates, and other advanced business workflows.',
  },
];

export function UpgradeScreen({ navigation }: UpgradeScreenProps) {
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [storeProducts, setStoreProducts] = useState<StoreProductDetails[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [activatingPlanId, setActivatingPlanId] = useState<SubscriptionPlanId | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSubscriptionStatus() {
      try {
        const [status, products, billingRefreshAt] = await Promise.all([
          getSubscriptionStatus(),
          loadBillingProductDetails(),
          getBillingLastRefreshAt(),
        ]);
        if (isMounted) {
          setSubscriptionStatus(status);
          setStoreProducts(products.subscriptions);
          setLastRefreshAt(billingRefreshAt);
        }
      } catch {
        if (isMounted) {
          setSubscriptionStatus(null);
          setBillingMessage('Store plans could not load. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSubscription(false);
        }
      }
    }

    void loadSubscriptionStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  function startUpgrade(plan: ProPlanCatalogItem) {
    Alert.alert(
      `Buy ${plan.title} Pro?`,
      'Orbit Ledger will open the app store purchase flow. Pro access unlocks only after the store confirms the subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void buyPlan(plan.id);
          },
        },
      ]
    );
  }

  async function buyPlan(planId: SubscriptionPlanId) {
    setActivatingPlanId(planId);
    setBillingMessage(null);

    try {
      const result = await purchaseProPlan(planId);
      const status = result.subscriptionStatus ?? (await getSubscriptionStatus());
      setSubscriptionStatus(status);
      setBillingMessage(result.message);
      Alert.alert(
        result.status === 'pending' ? 'Purchase pending' : 'Purchase updated',
        result.message
      );
    } catch (error) {
      const message = getPurchaseErrorMessage(error);
      setBillingMessage(message);
      Alert.alert('Purchase not completed', message);
    } finally {
      setActivatingPlanId(null);
    }
  }

  async function restorePurchases() {
    setIsRestoring(true);
    setBillingMessage(null);

    try {
      const result = await restoreStorePurchases();
      setSubscriptionStatus(result.subscriptionStatus);
      setLastRefreshAt(new Date().toISOString());
      setBillingMessage(result.message);
      Alert.alert('Purchases refreshed', result.message);
    } catch {
      const message = 'Store purchases could not be refreshed. Please try again.';
      setBillingMessage(message);
      Alert.alert('Restore failed', message);
    } finally {
      setIsRestoring(false);
    }
  }

  const isPro = subscriptionStatus?.isPro ?? false;
  const activePlanId = subscriptionStatus?.planId ?? null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Upgrade to Pro"
          subtitle="Premium document polish for businesses that share statements often."
          backLabel="Back"
          onBack={() => navigation.goBack()}
        />

        <Card glass elevated accent="premium">
          <Text style={styles.eyebrow}>Orbit Ledger Pro</Text>
          <Text style={styles.heroTitle}>Sharper documents, with your business identity.</Text>
          <Text style={styles.heroText}>
            Pro is for premium document presentation. Daily ledger tracking, customers,
            transactions, basic PDF export, backups, restore, and PIN protection stay available
            offline on Free.
          </Text>
          {billingMessage ? <Text style={styles.storeMessage}>{billingMessage}</Text> : null}
          <StatusChip
            label={
              isLoadingSubscription
                ? 'Checking plan'
                : isPro
                  ? formatActivePlan(subscriptionStatus)
                  : 'Free plan active'
            }
            tone={isPro ? 'premium' : 'neutral'}
          />
        </Card>

        <Section title="Pro benefits" subtitle="Helpful upgrades, not a trap for core ledger work.">
          {proBenefits.map((benefit) => (
            <Card key={benefit.title} compact accent="premium" style={styles.benefitRow}>
              <View style={styles.benefitDot} />
              <View style={styles.benefitCopy}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDetail}>{benefit.detail}</Text>
              </View>
            </Card>
          ))}
        </Section>

        <Section title="Choose Pro plan" subtitle="Prices and availability are loaded from Google Play or App Store.">
          {PRO_PLAN_CATALOG.map((plan) => {
            const storeProduct = storeProducts.find((product) => product.productId === plan.productId);
            const displayPrice = storeProduct?.displayPrice || plan.price;

            return (
              <Card
                accent="premium"
                elevated={plan.isBestValue}
                glass={plan.isBestValue}
                key={plan.id}
                style={plan.isBestValue ? styles.planCardBestValue : styles.planCard}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planTitleBlock}>
                    <Text style={styles.planTitle}>{plan.title}</Text>
                    <Text style={styles.planHelper}>{storeProduct?.description || plan.helper}</Text>
                  </View>
                  {plan.isBestValue ? (
                    <StatusChip label="Best value" tone="premium" />
                  ) : null}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{displayPrice}</Text>
                  <Text style={styles.cadence}>{plan.cadence}</Text>
                </View>
                <Text style={styles.productIdText}>Store product ID: {plan.productId}</Text>
                <PrimaryButton
                  disabled={
                    isLoadingSubscription ||
                    isRestoring ||
                    Boolean(activatingPlanId) ||
                    (activePlanId === plan.id && isPro)
                  }
                  loading={activatingPlanId === plan.id}
                  onPress={() => startUpgrade(plan)}
                  variant={activePlanId === plan.id && isPro ? 'secondary' : 'primary'}
                >
                  {activePlanId === plan.id && isPro
                    ? 'Current Pro Plan'
                    : `Buy ${plan.title} Pro`}
                </PrimaryButton>
              </Card>
            );
          })}
        </Section>

        <Card compact accent="tax">
          <Text style={styles.entitlementTitle}>Store entitlement</Text>
          <Text style={styles.entitlementText}>
            Purchases are confirmed by Google Play Billing on Android and App Store in-app
            purchases on iOS. Orbit Ledger keeps a local derived cache so Pro features remain
            available after the store confirms access.
          </Text>
          <Text style={styles.productIdText}>
            Last store refresh: {lastRefreshAt ? formatShortDateTime(lastRefreshAt) : 'Not refreshed yet'}
          </Text>
          <PrimaryButton
            disabled={isLoadingSubscription || Boolean(activatingPlanId) || isRestoring}
            loading={isRestoring}
            onPress={() => void restorePurchases()}
            variant="secondary"
          >
            Restore Purchases
          </PrimaryButton>
        </Card>

        <Card compact accent="success">
          <Text style={styles.noteTitle}>Free stays useful</Text>
          <Text style={styles.noteText}>
            Upgrading is optional. Orbit Ledger will not block basic dues, payments, customer
            records, basic statement exports, backups, restore, or app lock features.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
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
    return 'Store billing is not available in this build. Use a native development or production build with configured store products.';
  }

  return 'The store purchase could not be completed. Please try again.';
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

function formatActivePlan(status: SubscriptionStatus | null): string {
  if (!status?.isPro) {
    return 'Free plan active';
  }

  if (status.planId === 'pro_monthly') {
    return 'Monthly Pro active';
  }

  if (status.planId === 'pro_yearly') {
    return 'Yearly Pro active';
  }

  return 'Pro active';
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
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 21,
  },
  storeMessage: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 20,
  },
  statusPillFree: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  statusPillPro: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successSurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 1,
    minHeight: 30,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  statusPillTextFree: {
    color: colors.textMuted,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  statusPillTextPro: {
    color: colors.success,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  benefitRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  benefitDot: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    height: 12,
    marginTop: 4,
    width: 12,
  },
  benefitCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  benefitTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  benefitDetail: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  planCardBestValue: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  planHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  planTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  planHelper: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  bestValuePill: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexShrink: 1,
    minHeight: 28,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  bestValueText: {
    color: colors.surface,
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 16,
  },
  priceRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  price: {
    color: colors.text,
    fontSize: typography.balance,
    fontWeight: '900',
  },
  cadence: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  productIdText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  noteCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  entitlementCard: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  entitlementTitle: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  entitlementText: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  noteTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  noteText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
});
