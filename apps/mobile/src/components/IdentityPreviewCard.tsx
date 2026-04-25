import { Image, StyleSheet, Text, View } from 'react-native';

import { borders, colors, layout, radii, spacing, typography } from '../theme/theme';

type IdentityPreviewCardProps = {
  businessName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUri?: string | null;
  authorizedPersonName?: string;
  authorizedPersonTitle?: string;
  signatureUri?: string | null;
};

export function IdentityPreviewCard({
  businessName,
  ownerName,
  address,
  phone,
  email,
  logoUri,
  authorizedPersonName,
  authorizedPersonTitle,
  signatureUri,
}: IdentityPreviewCardProps) {
  const displayName = businessName?.trim() || 'Your business name';
  const displayOwner = ownerName?.trim() || 'Owner name';
  const displayAddress = address?.trim() || 'Business address';
  const displayPhone = phone?.trim() || 'Phone';
  const displayEmail = email?.trim() || 'Email';
  const displaySigner = authorizedPersonName?.trim() || displayOwner;
  const displayTitle = authorizedPersonTitle?.trim() || 'Authorized person';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="cover" />
          ) : (
            <Text style={styles.logoFallback}>Logo</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.businessName}>{displayName}</Text>
          <Text style={styles.meta}>{displayOwner}</Text>
          <Text style={styles.meta}>{displayPhone}</Text>
          <Text style={styles.meta}>{displayEmail}</Text>
        </View>
      </View>
      <Text style={styles.address}>{displayAddress}</Text>
      <View style={styles.footer}>
        <View style={styles.signatureBox}>
          {signatureUri ? (
            <Image source={{ uri: signatureUri }} style={styles.signature} resizeMode="contain" />
          ) : (
            <Text style={styles.logoFallback}>Signature</Text>
          )}
        </View>
        <View style={styles.signer}>
          <Text style={styles.signerName}>{displaySigner}</Text>
          <Text style={styles.meta}>{displayTitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...borders.card,
    backgroundColor: colors.surface,
    padding: layout.cardPadding,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  logoBox: {
    width: 58,
    height: 58,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  businessName: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  address: {
    color: colors.text,
    fontSize: typography.label,
    lineHeight: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
  },
  signatureBox: {
    width: 118,
    height: 48,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  signature: {
    width: '100%',
    height: '100%',
  },
  signer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  signerName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
});
