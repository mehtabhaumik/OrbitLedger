import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radii, shadows, spacing, touch, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  helperText,
  error,
  disabled = false,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={touch.hitSlop}
        onPress={() => setIsOpen(true)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [
          styles.button,
          error ? styles.buttonError : null,
          disabled ? styles.buttonDisabled : null,
          pressed && !disabled ? styles.buttonPressed : null,
        ]}
      >
        <View style={styles.valueBlock}>
          <Text style={[styles.value, !selectedOption ? styles.placeholder : null]} numberOfLines={1}>
            {selectedOption?.label ?? placeholder}
          </Text>
          {selectedOption?.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {selectedOption.description}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>Change</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <Modal animationType="slide" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Text style={styles.sheetSubtitle}>Choose what fits best.</Text>
              </View>
              <PrimaryButton variant="ghost" onPress={() => setIsOpen(false)}>
                Close
              </PrimaryButton>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    onPress={() => selectValue(item.value)}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected ? styles.optionSelected : null,
                      pressed ? styles.optionPressed : null,
                    ]}
                  >
                    <View style={styles.valueBlock}>
                      <Text style={styles.optionLabel}>{item.label}</Text>
                      {item.description ? (
                        <Text style={styles.optionDescription}>{item.description}</Text>
                      ) : null}
                    </View>
                    {isSelected ? <Text style={styles.selectedText}>Selected</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  button: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  buttonError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    backgroundColor: colors.primarySurface,
  },
  valueBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  value: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  placeholder: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  chevron: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  error: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    ...shadows.raised,
    maxHeight: '78%',
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    backgroundColor: colors.background,
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  option: {
    minHeight: 64,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.primarySurface,
  },
  optionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  optionLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  optionDescription: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  selectedText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
});
