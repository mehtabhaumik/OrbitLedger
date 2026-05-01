import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '../components/Card';
import { OrbitHelperStatus } from '../components/OrbitHelperStatus';
import { ScreenHeader } from '../components/ScreenHeader';
import { Section } from '../components/Section';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type FounderNoteScreenProps = NativeStackScreenProps<RootStackParamList, 'FounderNote'>;

const points = {
  different: [
    'It is built around daily jobs: collect money, record activity, trust documents, protect records.',
    'Core work stays fast and reliable, even when the internet is unavailable.',
    'Local labels, reports, and security stay available without making the daily ledger feel heavy.',
  ],
  issues: [
    'Small businesses often track dues in chats, notebooks, or spreadsheets that break down under daily pressure.',
    'They need speed at the counter, simple follow-up tools, and documents they can trust before they share them.',
    'They also need backup, restore, and security to feel responsible with real business records.',
  ],
  future: [
    'Sharper collections workflows and payment-promise follow-up.',
    'Stronger local document labels, templates, and review exports.',
    'Faster, smoother quality across Android, iPhone, tablet, and desktop.',
  ],
};

export function FounderNoteScreen({ navigation }: FounderNoteScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Founder’s Note"
          subtitle="Why Orbit Ledger exists, what makes it different, and what comes next."
          onBack={() => navigation.goBack()}
        />

        <Card accent="primary" elevated glass>
          <Text style={styles.kicker}>Vision</Text>
          <Text style={styles.heroTitle}>A business command center for everyday collections.</Text>
          <Text style={styles.heroBody}>
            Orbit Ledger is designed for owners who do not have time for clutter. The app should
            make money movement, dues, documents, backups, and trust signals obvious within a few
            seconds on a small phone screen.
          </Text>
        </Card>

        <Section
          title="Why this app is different"
          subtitle="The product is shaped around real daily money control, not a broad feature checklist."
        >
          <Card glass>
            {points.different.map((point) => (
              <View key={point} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section
          title="What issue it resolves"
          subtitle="Orbit Ledger is meant to reduce friction in collections, invoicing, and record trust."
        >
          <Card glass>
            {points.issues.map((point) => (
              <View key={point} style={styles.bulletRow}>
                <View style={[styles.bullet, styles.warningBullet]} />
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section
          title="Future plan"
          subtitle="The roadmap stays practical: faster actions, stronger trust, and smarter daily workflows."
        >
          <Card glass>
            {points.future.map((point) => (
              <View key={point} style={styles.bulletRow}>
                <View style={[styles.bullet, styles.taxBullet]} />
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="Orbit Helper" subtitle="The helper stays available without getting in the way.">
          <OrbitHelperStatus />
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
  content: {
    padding: spacing.lg,
    paddingBottom: 144,
    gap: spacing.xl,
  },
  kicker: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 34,
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  warningBullet: {
    backgroundColor: colors.warning,
  },
  taxBullet: {
    backgroundColor: colors.tax,
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
});
