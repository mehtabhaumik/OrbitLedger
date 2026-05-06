import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import { StatusChip } from '../components/StatusChip';
import { getBusinessSettings } from '../database';
import type { BusinessSettings } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { getBusinessPaymentDetails } from '../payments/businessPaymentDetails';
import {
  formatMobileProviderEventStatus,
  getMobilePaymentProviderPlan,
  getMobilePaymentProviderReadiness,
  listMobilePaymentProviderEvents,
  markMobilePaymentProviderEventReviewed,
  mobileProviderLabel,
  reverseMobilePaymentProviderEvent,
  type MobilePaymentProviderEvent,
} from '../payments/providerEvents';
import { colors, spacing, typography } from '../theme/theme';

type PaymentProviderEventsScreenProps = NativeStackScreenProps<RootStackParamList, 'PaymentProviderEvents'>;

export function PaymentProviderEventsScreen({ navigation }: PaymentProviderEventsScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [events, setEvents] = useState<MobilePaymentProviderEvent[]>([]);
  const [paymentPageUrl, setPaymentPageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reviewingEventId, setReviewingEventId] = useState<string | null>(null);
  const [reversingEventId, setReversingEventId] = useState<string | null>(null);
  const plan = getMobilePaymentProviderPlan();
  const readiness = getMobilePaymentProviderReadiness({ paymentPageUrl });
  const currency = business?.currency ?? 'INR';

  const loadEvents = useCallback(async () => {
    const [settings, paymentDetails] = await Promise.all([getBusinessSettings(), getBusinessPaymentDetails()]);
    setBusiness(settings);
    setPaymentPageUrl(paymentDetails.paymentPageUrl ?? null);
    if (!settings?.workspaceId) {
      setEvents([]);
      return;
    }
    setEvents(await listMobilePaymentProviderEvents(settings.workspaceId));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      async function load() {
        try {
          setIsLoading(true);
          await loadEvents();
        } catch {
          if (isActive) {
            Alert.alert('Payment events could not load', 'Please try again.');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }
      void load();
      return () => {
        isActive = false;
      };
    }, [loadEvents])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadEvents();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function markReviewed(event: MobilePaymentProviderEvent) {
    if (!business?.workspaceId) {
      return;
    }
    setReviewingEventId(event.id);
    try {
      await markMobilePaymentProviderEventReviewed(
        business.workspaceId,
        event.id,
        'Reviewed on mobile provider event console.'
      );
      await loadEvents();
      Alert.alert('Event reviewed', 'This provider event is marked reviewed.');
    } catch {
      Alert.alert('Review failed', 'Please try again.');
    } finally {
      setReviewingEventId(null);
    }
  }

  function reverseEvent(event: MobilePaymentProviderEvent) {
    if (!business?.workspaceId || event.reversed) {
      return;
    }

    Alert.alert(
      'Reverse provider event?',
      'This keeps the event history and marks the provider payment as reversed for review.',
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'Reverse event',
          style: 'destructive',
          onPress: () => void confirmReverseEvent(event),
        },
      ]
    );
  }

  async function confirmReverseEvent(event: MobilePaymentProviderEvent) {
    if (!business?.workspaceId) {
      return;
    }

    setReversingEventId(event.id);
    try {
      await reverseMobilePaymentProviderEvent(
        business.workspaceId,
        event.id,
        'Provider event reversed from mobile review.'
      );
      await loadEvents();
      Alert.alert('Event reversed', 'This provider event is marked reversed.');
    } catch {
      Alert.alert('Reverse failed', 'Please try again.');
    } finally {
      setReversingEventId(null);
    }
  }

  const reviewCount = events.filter((event) => !event.applied && !event.reversed && event.applyStatus !== 'reviewed').length;

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading payment events</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Payment Events"
          subtitle="Review provider events without turning on online checkout too early."
          backLabel="Dashboard"
          onBack={() => navigation.goBack()}
        />

        <Card glass elevated accent="primary">
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Provider admin</Text>
              <Text style={styles.title}>{plan.collectionLabel}</Text>
              <Text style={styles.copy}>{plan.adminCopy}</Text>
            </View>
            <StatusChip label={plan.statusLabel} tone={plan.statusTone === 'connected' ? 'success' : 'warning'} />
          </View>
        </Card>

        <Section title="Readiness" subtitle={readiness.launchMessage}>
          {readiness.checks.map((check) => (
            <Card compact key={check.label} accent={check.ready ? 'success' : 'warning'} style={styles.checkRow}>
              <Text style={styles.checkLabel}>{check.label}</Text>
              <StatusChip label={check.ready ? 'Ready' : 'Review'} tone={check.ready ? 'success' : 'warning'} />
            </Card>
          ))}
        </Section>

        <Section title="Event review" subtitle={`${reviewCount} event${reviewCount === 1 ? '' : 's'} need owner review.`}>
          {!business?.workspaceId ? (
            <EmptyState
              title="Cloud workspace needed"
              message="Provider event review uses your synced workspace. Connect this business to cloud sync first."
              action={
                <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                  Open Settings
                </PrimaryButton>
              }
            />
          ) : events.length === 0 ? (
            <EmptyState
              title="No provider events yet"
              message="Manual payment collection is still active. Provider events will appear here after a provider is connected."
            />
          ) : (
            events.map((event) => (
              <Card compact key={event.id} accent={event.applied ? 'success' : 'warning'} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>
                      {mobileProviderLabel(event.source)} · {formatMobileProviderEventStatus(event)}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {formatCurrency(event.amount, event.currency || currency)} · {event.reference ?? event.providerPaymentId ?? 'No reference'}
                    </Text>
                    <Text style={styles.eventMeta}>
                      {event.createdAt ? formatShortDate(event.createdAt) : 'No date'} · {event.invoiceId ? 'Matched invoice' : 'Not matched'}
                    </Text>
                  </View>
                  <StatusChip label={event.applied ? 'Applied' : event.applyStatus === 'reviewed' ? 'Reviewed' : 'Review'} tone={event.applied ? 'success' : 'warning'} />
                </View>
                <PrimaryButton
                  disabled={reviewingEventId === event.id || event.applyStatus === 'reviewed'}
                  loading={reviewingEventId === event.id}
                  onPress={() => void markReviewed(event)}
                  variant="secondary"
                >
                  Mark Reviewed
                </PrimaryButton>
                <PrimaryButton
                  disabled={event.reversed || reversingEventId === event.id}
                  loading={reversingEventId === event.id}
                  onPress={() => reverseEvent(event)}
                  variant="ghost"
                >
                  Reverse Event
                </PrimaryButton>
              </Card>
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingRoot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  copy: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 23,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkLabel: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  eventCard: {
    gap: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  eventCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  eventTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  eventMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
});
