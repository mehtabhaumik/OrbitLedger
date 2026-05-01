import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, radii, spacing, typography } from '../theme/theme';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, helperText, style, ...inputProps },
  ref
) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '800',
  },
  input: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 20,
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSurface,
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
});
