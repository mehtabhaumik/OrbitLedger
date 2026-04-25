import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PIN_LENGTH } from '../security/pinLock';
import { colors, radii, spacing, touch, typography } from '../theme/theme';

type PinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  errorMessage?: string | null;
  helperText?: string;
};

const digitRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'delete'],
];

export function PinPad({
  value,
  onChange,
  onComplete,
  disabled = false,
  errorMessage,
  helperText,
}: PinPadProps) {
  function handleDigitPress(digit: string) {
    if (disabled || value.length >= PIN_LENGTH) {
      return;
    }

    const nextValue = `${value}${digit}`;
    onChange(nextValue);

    if (nextValue.length === PIN_LENGTH) {
      onComplete?.(nextValue);
    }
  }

  function handleDeletePress() {
    if (disabled || value.length === 0) {
      return;
    }

    onChange(value.slice(0, -1));
  }

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={`${value.length} of ${PIN_LENGTH} PIN digits entered`}
        style={styles.dots}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index < value.length ? styles.dotFilled : null]}
          />
        ))}
      </View>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      <Text style={[styles.errorText, !errorMessage ? styles.errorTextHidden : null]}>
        {errorMessage ?? ' '}
      </Text>

      <View style={styles.keypad}>
        {digitRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key) => {
              if (!key) {
                return <View key="empty" style={styles.keyButtonSpacer} />;
              }

              const isDelete = key === 'delete';
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isDelete ? 'Delete PIN digit' : `PIN digit ${key}`}
                  disabled={disabled}
                  hitSlop={touch.hitSlop}
                  key={key}
                  onPress={isDelete ? handleDeletePress : () => handleDigitPress(key)}
                  pressRetentionOffset={touch.pressRetentionOffset}
                  style={({ pressed }) => [
                    styles.keyButton,
                    pressed && !disabled ? styles.keyButtonPressed : null,
                    disabled ? styles.keyButtonDisabled : null,
                  ]}
                >
                  <Text style={isDelete ? styles.deleteLabel : styles.keyLabel}>
                    {isDelete ? 'Delete' : key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    width: '100%',
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  dot: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 16,
    width: 16,
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.label,
    fontWeight: '700',
    lineHeight: 20,
    minHeight: 20,
    textAlign: 'center',
  },
  keypad: {
    gap: spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  keyButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 84,
    minHeight: 64,
  },
  keyButtonSpacer: {
    flex: 1,
    maxWidth: 84,
    minHeight: 64,
  },
  keyButtonPressed: {
    backgroundColor: colors.primarySurface,
  },
  keyButtonDisabled: {
    opacity: 0.5,
  },
  keyLabel: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  deleteLabel: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '800',
  },
  errorTextHidden: {
    color: 'transparent',
  },
});
