import { Modal, StyleSheet, Text, View } from 'react-native';

import type { GeneratedPdf } from '../documents';
import { colors, radii, shadows, spacing, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';

type PdfViewerModalProps = {
  visible: boolean;
  pdf: GeneratedPdf | null;
  title: string;
  onClose: () => void;
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
  onPrint: () => void;
  isOpening?: boolean;
  isSaving?: boolean;
  isSharing?: boolean;
  isPrinting?: boolean;
};

export function PdfViewerModal({
  visible,
  pdf,
  title,
  onClose,
  onOpen,
  onSave,
  onShare,
  onPrint,
  isOpening = false,
  isSaving = false,
  isSharing = false,
  isPrinting = false,
}: PdfViewerModalProps) {
  const isBusy = isOpening || isSaving || isSharing || isPrinting;
  const pageLabel = pdf ? `${pdf.numberOfPages} ${pdf.numberOfPages === 1 ? 'page' : 'pages'}` : '';

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.eyebrow}>Document view</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            Open the document, or use the actions below to save, share, or print it.
          </Text>
          {pdf ? (
            <View style={styles.fileCard}>
              <Text style={styles.fileName} numberOfLines={2}>
                {pdf.fileName}
              </Text>
              <Text style={styles.fileMeta}>
                {pageLabel} · {pdf.isTemporary ? 'Not saved yet' : 'Saved'}
              </Text>
            </View>
          ) : null}
          <PrimaryButton
            loading={isOpening}
            disabled={!pdf || (isBusy && !isOpening)}
            onPress={onOpen}
          >
            Open Document
          </PrimaryButton>
          <PrimaryButton
            variant="secondary"
            loading={isSaving}
            disabled={!pdf || (isBusy && !isSaving)}
            onPress={onSave}
          >
            Save
          </PrimaryButton>
          <PrimaryButton
            variant="secondary"
            loading={isSharing}
            disabled={!pdf || (isBusy && !isSharing)}
            onPress={onShare}
          >
            Share
          </PrimaryButton>
          <PrimaryButton
            variant="ghost"
            loading={isPrinting}
            disabled={!pdf || (isBusy && !isPrinting)}
            onPress={onPrint}
          >
            Print
          </PrimaryButton>
          <PrimaryButton variant="ghost" disabled={isBusy} onPress={onClose}>
            Done
          </PrimaryButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    ...shadows.raised,
    gap: spacing.md,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
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
    lineHeight: 24,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  fileCard: {
    gap: spacing.xs,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
  },
  fileName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    lineHeight: 19,
  },
  fileMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
});
