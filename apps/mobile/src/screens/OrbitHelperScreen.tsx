import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ListRow } from '../components/ListRow';
import { OrbitHelperStatus } from '../components/OrbitHelperStatus';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import {
  getBusinessSettings,
  getDashboardSummary,
  getRecentTransactions,
  getTopDueCustomers,
  listPaymentPromiseFollowUps,
} from '../database';
import {
  buildPracticalHelperCards,
  checkOrbitHelperUpdatesSilently,
  getSuggestedOrbitHelperArticles,
  searchOrbitHelper,
} from '../orbitHelper';
import type {
  OrbitHelperArticle,
  OrbitHelperStatus as OrbitHelperStatusData,
  PracticalHelperCard,
  PracticalHelperTarget,
} from '../orbitHelper';
import type { RootStackParamList } from '../navigation/types';
import { colors, layout, radii, spacing, touch, typography } from '../theme/theme';

type OrbitHelperScreenProps = NativeStackScreenProps<RootStackParamList, 'OrbitHelper'>;

export function OrbitHelperScreen({ navigation, route }: OrbitHelperScreenProps) {
  const screenContext = route.params?.screenContext;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<OrbitHelperStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [results, setResults] = useState<OrbitHelperArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<OrbitHelperArticle | null>(null);
  const [practicalHelpers, setPracticalHelpers] = useState<PracticalHelperCard[]>([]);

  const suggestions = useMemo(
    () => getSuggestedOrbitHelperArticles(screenContext),
    [screenContext]
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [
          updateResult,
          helperResults,
          businessSettings,
          dashboardSummary,
          topDueCustomers,
          recentTransactions,
          promises,
        ] = await Promise.all([
          checkOrbitHelperUpdatesSilently(),
          searchOrbitHelper('', screenContext),
          getBusinessSettings(),
          getDashboardSummary().catch(() => null),
          getTopDueCustomers(5).catch(() => []),
          getRecentTransactions(12).catch(() => []),
          listPaymentPromiseFollowUps(8).catch(() => []),
        ]);
        const helperStatus = updateResult.status;
        if (isMounted) {
          setStatus(helperStatus);
          setResults(helperResults.map((result) => result.article));
          setSelectedArticle(helperResults[0]?.article ?? null);
          setPracticalHelpers(
            buildPracticalHelperCards({
              businessName: businessSettings?.businessName ?? 'Orbit Ledger',
              currency: businessSettings?.currency ?? 'INR',
              promises,
              recentTransactions,
              summary: dashboardSummary,
              topDueCustomers,
            })
          );
        }
      } catch {
        if (isMounted) {
          Alert.alert('Orbit Helper could not start', 'Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [screenContext]);

  useEffect(() => {
    let isMounted = true;

    async function runSearch() {
      const helperResults = await searchOrbitHelper(query, screenContext);
      if (isMounted) {
        const articles = helperResults.map((result) => result.article);
        setResults(articles);
        setSelectedArticle((current) => {
          if (current && articles.some((article) => article.id === current.id)) {
            return current;
          }

          return articles[0] ?? null;
        });
      }
    }

    void runSearch();

    return () => {
      isMounted = false;
    };
  }, [query, screenContext]);

  async function checkUpdates() {
    try {
      setIsCheckingUpdates(true);
      const result = await checkOrbitHelperUpdatesSilently();
      setStatus(result.status);
      Alert.alert(
        result.updated ? 'Orbit Helper updated' : 'Orbit Helper is current',
        result.updated
          ? `Updated to ${result.status.packName} ${result.status.version}.`
          : 'Your help content is already current.'
      );
    } catch {
      Alert.alert('Update check failed', 'Orbit Helper kept the last working help content.');
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  function openAction(article: OrbitHelperArticle, actionIndex: number) {
    const action = article.actions?.[actionIndex];
    if (!action) {
      return;
    }

    switch (action.target) {
      case 'TransactionForm':
        navigation.navigate('TransactionForm', action.params as RootStackParamList['TransactionForm']);
        break;
      case 'InvoiceForm':
        navigation.navigate('InvoiceForm', action.params as RootStackParamList['InvoiceForm']);
        break;
      case 'PinManagement':
        navigation.navigate('PinManagement', { mode: 'enable' });
        break;
      default:
        navigation.navigate(action.target);
    }
  }

  function openPracticalHelper(target: PracticalHelperTarget) {
    switch (target) {
      case 'get_paid':
        navigation.navigate('GetPaid');
        break;
      case 'monthly_review':
        navigation.navigate('MonthlyBusinessReview');
        break;
      case 'business_health':
        navigation.navigate('BusinessHealthSnapshot');
        break;
      case 'daily_closing':
        navigation.navigate('DailyClosingReport');
        break;
      case 'customers':
        navigation.navigate('Customers');
        break;
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} size="large" />
        <OrbitHelperStatus />
        <Text style={styles.muted}>Preparing help</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Orbit Helper"
            subtitle="Help for your ledger, invoices, backups, tax setup, and security."
            onBack={() => navigation.goBack()}
          />

          <Card elevated glass accent="primary" style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <Text style={styles.eyebrow}>Quiet assistant</Text>
                <Text style={styles.heroTitle}>Ask without leaving your workflow.</Text>
                <Text style={styles.heroCopy}>
                  Orbit Helper keeps guidance close by. It does not change your records,
                  interrupt your ledger work, or require internet for everyday help.
                </Text>
              </View>
              <OrbitHelperStatus compact />
            </View>
          </Card>

          <Section title="Practical helpers" subtitle="Local tasks that prepare your next move.">
            <View style={styles.helperCardGrid}>
              {practicalHelpers.map((helper) => (
                <Card key={helper.id} compact accent={helper.priority === 'high' ? 'warning' : 'primary'}>
                  <View style={styles.helperCardHeader}>
                    <View style={styles.helperCardTitleBlock}>
                      <Text style={styles.helperCardTitle}>{helper.title}</Text>
                      <Text style={styles.helperCardSubtitle}>{helper.subtitle}</Text>
                    </View>
                    <StatusChip
                      label={helper.priority === 'high' ? 'Today' : helper.priority === 'medium' ? 'Next' : 'Ready'}
                      tone={helper.priority === 'high' ? 'warning' : 'primary'}
                    />
                  </View>
                  <Text style={styles.helperCardResult}>{helper.result}</Text>
                  <Text style={styles.helperPrivacy}>{helper.privacyNote}</Text>
                  <PrimaryButton
                    variant="secondary"
                    onPress={() => openPracticalHelper(helper.target)}
                  >
                    {helper.actionLabel}
                  </PrimaryButton>
                </Card>
              ))}
            </View>
          </Section>

          <TextField
            autoCapitalize="none"
            autoCorrect
            label="Ask Orbit Helper"
            value={query}
            onChangeText={setQuery}
            placeholder="Ask about payments, invoices, backups, tax, or PIN"
            helperText="Short answers with action buttons."
            returnKeyType="search"
          />

          <Section title="Suggested questions" subtitle="Start with the common daily tasks.">
            <View style={styles.questionGrid}>
              {suggestions.map((article) => (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={touch.hitSlop}
                  key={article.id}
                  onPress={() => {
                    setQuery(article.title);
                    setSelectedArticle(article);
                  }}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={({ pressed }) => [
                    styles.questionChip,
                    selectedArticle?.id === article.id ? styles.questionChipSelected : null,
                    pressed ? styles.questionChipPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.questionChipText,
                      selectedArticle?.id === article.id ? styles.questionChipTextSelected : null,
                    ]}
                  >
                    {article.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Section>

          <Section title="Answer" subtitle="Concise help with safe navigation actions.">
            {selectedArticle ? (
              <Card accent="tax" style={styles.answerCard}>
                <View style={styles.answerHeader}>
                  <View style={styles.answerTitleBlock}>
                    <Text style={styles.answerTitle}>{selectedArticle.title}</Text>
                    <Text style={styles.answerSummary}>{selectedArticle.summary}</Text>
                  </View>
                  <StatusChip label="Ready" tone="tax" />
                </View>
                <View style={styles.answerSteps}>
                  {selectedArticle.body.map((paragraph, index) => (
                    <View key={paragraph} style={styles.answerStep}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.answerBody}>{paragraph}</Text>
                    </View>
                  ))}
                </View>
                {selectedArticle.actions?.length ? (
                  <View style={styles.answerActions}>
                    {selectedArticle.actions.map((action, index) => (
                      <PrimaryButton
                        key={`${action.target}-${action.label}`}
                        variant={index === 0 ? 'secondary' : 'ghost'}
                        onPress={() => openAction(selectedArticle, index)}
                      >
                        {action.label}
                      </PrimaryButton>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : (
              <EmptyState
                title="No matching help yet"
                message="Try a simpler question like add payment, create invoice, backup, tax, or PIN."
              />
            )}
          </Section>

          <Section title="More help" subtitle="Tap a topic to load the answer above.">
            <Card compact style={styles.resultCard}>
              {results.map((article) => (
                <ListRow
                  key={article.id}
                  title={article.title}
                  subtitle={article.summary}
                  meta={article.tags.slice(0, 4).join(' · ')}
                  accent={article.id === selectedArticle?.id ? 'primary' : 'neutral'}
                  selected={article.id === selectedArticle?.id}
                  onPress={() => setSelectedArticle(article)}
                  right={<Text style={styles.openText}>Open</Text>}
                />
              ))}
            </Card>
          </Section>

          <Section title="Helper content" subtitle="Guidance that can refresh safely.">
            <Card compact accent="success">
              <View style={styles.statusHeader}>
                <OrbitHelperStatus label="Orbit Helper is ready" />
                <StatusChip label="Ready" tone="success" />
              </View>
              <InfoRow label="Pack" value={status?.packName ?? 'Orbit Helper Core'} />
              <InfoRow label="Version" value={status?.version ?? 'Bundled'} />
              <InfoRow label="Updated" value={formatOptionalDate(status?.updatedAt)} />
              <InfoRow label="Last checked" value={formatOptionalDate(status?.lastCheckedAt)} />
              <Text style={styles.statusCopy}>
                Updates run quietly through validated help packs. If an update fails, Orbit Helper
                keeps the last working help content.
              </Text>
              <PrimaryButton
                variant="secondary"
                loading={isCheckingUpdates}
                disabled={isCheckingUpdates}
                onPress={checkUpdates}
              >
                Check Helper Content
              </PrimaryButton>
            </Card>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatOptionalDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not checked yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return date.toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
    padding: spacing.xl,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  heroCard: {
    minHeight: 180,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
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
    fontSize: typography.hero,
    fontWeight: '900',
    lineHeight: 29,
  },
  heroCopy: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  questionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  questionChip: {
    minHeight: layout.minTapTarget,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
  },
  questionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  questionChipPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  questionChipText: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
    lineHeight: 19,
  },
  questionChipTextSelected: {
    color: colors.primary,
    fontWeight: '900',
  },
  answerCard: {
    gap: spacing.lg,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  answerTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  answerTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
    lineHeight: 24,
  },
  answerSummary: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  answerSteps: {
    gap: spacing.md,
  },
  answerStep: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.taxSurface,
  },
  stepNumberText: {
    color: colors.tax,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  answerBody: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  answerActions: {
    gap: spacing.sm,
  },
  helperCardGrid: {
    gap: spacing.md,
  },
  helperCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  helperCardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  helperCardTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 22,
  },
  helperCardSubtitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  helperCardResult: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  helperPrivacy: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 17,
  },
  resultCard: {
    overflow: 'hidden',
    padding: 0,
  },
  openText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusCopy: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.text,
    flex: 1,
    fontSize: typography.label,
    fontWeight: '900',
    lineHeight: 20,
    textAlign: 'right',
  },
});
