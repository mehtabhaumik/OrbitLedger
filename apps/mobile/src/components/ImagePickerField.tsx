import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, spacing, touch, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';

type ImagePickerFieldProps = {
  label: string;
  helperText: string;
  value?: string | null;
  fallbackLabel: string;
  assetName: 'logo' | 'signature';
  onChange: (uri: string | null) => void;
  onError: (message: string) => void;
};

export function ImagePickerField({
  label,
  helperText,
  value,
  fallbackLabel,
  assetName,
  onChange,
  onError,
}: ImagePickerFieldProps) {
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError('Photo library permission is needed to choose an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: assetName === 'logo',
      aspect: assetName === 'logo' ? [1, 1] : [4, 2],
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    const copiedUri = copyImageToLocalStorage(result.assets[0].uri, assetName);
    onChange(copiedUri);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.previewRow}>
        <View style={[styles.preview, assetName === 'signature' ? styles.signaturePreview : null]}>
          {value ? (
            <Image
              source={{ uri: value }}
              style={styles.image}
              resizeMode={assetName === 'signature' ? 'contain' : 'cover'}
              onError={() => onError(`${label} could not be displayed. Choose it again or remove it.`)}
            />
          ) : (
            <Text style={styles.fallback}>{fallbackLabel}</Text>
          )}
        </View>
        <View style={styles.actions}>
          <PrimaryButton variant="secondary" onPress={pickImage}>
            {value ? 'Change image' : 'Choose image'}
          </PrimaryButton>
          {value ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={touch.hitSlop}
              onPress={() => onChange(null)}
              pressRetentionOffset={touch.pressRetentionOffset}
              style={styles.remove}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.helper}>{helperText}</Text>
    </View>
  );
}

function copyImageToLocalStorage(sourceUri: string, assetName: string): string {
  try {
    const directory = new Directory(Paths.document, 'identity-assets');
    directory.create({ intermediates: true, idempotent: true });

    const source = new File(sourceUri);
    const extension = source.extension || '.jpg';
    const destination = new File(directory, `${assetName}-${Date.now()}${extension}`);
    source.copy(destination);

    return destination.uri;
  } catch (error) {
    console.warn('[image-picker] Falling back to picker URI', error);
    return sourceUri;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  preview: {
    width: 78,
    height: 78,
    borderRadius: radii.md,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  signaturePreview: {
    width: 118,
    height: 66,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  actions: {
    flex: 1,
    gap: spacing.sm,
  },
  remove: {
    minHeight: layout.minTapTarget,
    justifyContent: 'center',
  },
  removeText: {
    color: colors.danger,
    fontSize: typography.label,
    fontWeight: '700',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
});
