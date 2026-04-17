import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dateInputToDate,
  getDateInputFromDate,
  isValidDateInput,
} from '../forms/validation';
import { colors, radii, spacing, touch, typography } from '../theme/theme';
import { PrimaryButton } from './PrimaryButton';

type DateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  optional?: boolean;
};

export function DateInput({
  label,
  value,
  onChange,
  error,
  helperText,
  maximumDate,
  minimumDate,
  optional = false,
}: DateInputProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedDate = value && isValidDateInput(value) ? dateInputToDate(value) : new Date();

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') {
      setIsPickerOpen(false);
    }

    if (event.type === 'dismissed' || !date) {
      return;
    }

    onChange(getDateInputFromDate(date));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={touch.hitSlop}
        onPress={() => setIsPickerOpen(true)}
        pressRetentionOffset={touch.pressRetentionOffset}
        style={({ pressed }) => [
          styles.field,
          error ? styles.fieldError : null,
          pressed ? styles.fieldPressed : null,
        ]}
      >
        <Text style={[styles.value, !value ? styles.placeholder : null]}>
          {value || 'Choose date'}
        </Text>
        <Text style={styles.actionText}>Pick</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {optional && value ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={touch.hitSlop}
          onPress={() => onChange('')}
          pressRetentionOffset={touch.pressRetentionOffset}
          style={styles.clearButton}
        >
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}
      {isPickerOpen ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerPanel : null}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <View style={styles.iosPickerActions}>
              {optional ? (
                <PrimaryButton
                  variant="ghost"
                  onPress={() => {
                    onChange('');
                    setIsPickerOpen(false);
                  }}
                >
                  Clear
                </PrimaryButton>
              ) : null}
              <PrimaryButton variant="secondary" onPress={() => setIsPickerOpen(false)}>
                Done
              </PrimaryButton>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  field: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
  },
  fieldPressed: {
    backgroundColor: colors.primarySurface,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  placeholder: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  actionText: {
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
  clearButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
  },
  clearText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  iosPickerPanel: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  iosPickerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
