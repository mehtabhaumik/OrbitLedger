import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { BottomNavigation } from '../components/BottomNavigation';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FormSection } from '../components/FormSection';
import { ListRow } from '../components/ListRow';
import { MoneyText } from '../components/MoneyText';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SkeletonCard } from '../components/SkeletonCard';
import { StatusChip } from '../components/StatusChip';
import { TextField } from '../components/TextField';
import { addProduct, getBusinessSettings, getFeatureToggles, listProducts } from '../database';
import type { AppFeatureToggles, BusinessSettings, Product } from '../database';
import { businessNameSchema, normalizeDecimalInput } from '../forms/validation';
import { formatCurrency } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type ProductsScreenProps = NativeStackScreenProps<RootStackParamList, 'Products'>;

const productSchema = z.object({
  name: businessNameSchema('product name').max(80, 'Keep product name short.'),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price.')
    .refine((value) => Number(value) >= 0, 'Price cannot be negative.'),
  stockQuantity: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, 'Enter valid stock quantity.')
    .refine((value) => Number(value) >= 0, 'Stock cannot be negative.'),
  unit: z
    .string()
    .trim()
    .min(1, 'Enter unit.')
    .max(20, 'Keep unit short.')
    .regex(/^[A-Za-z][A-Za-z0-9\s./-]*$/, 'Use a simple unit such as pcs, kg, or hour.'),
});

type ProductFormValues = z.infer<typeof productSchema>;

const defaultValues: ProductFormValues = {
  name: '',
  price: '',
  stockQuantity: '0',
  unit: 'pcs',
};

export function ProductsScreen({ navigation }: ProductsScreenProps) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const inventoryEnabled = (featureToggles?.invoices ?? true) && (featureToggles?.inventory ?? true);
  const currency = business?.currency ?? 'INR';
  const {
    control,
    formState: { errors, isSubmitting, isValid },
    handleSubmit,
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const loadProducts = useCallback(async () => {
    const [settings, toggles] = await Promise.all([
      getBusinessSettings(),
      getFeatureToggles(),
    ]);

    if (!settings) {
      navigation.replace('Setup');
      return;
    }

    const savedProducts = toggles.invoices && toggles.inventory ? await listProducts({ limit: 100 }) : [];
    setBusiness(settings);
    setFeatureToggles(toggles);
    setProducts(savedProducts);
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function load() {
        try {
          setIsLoading(true);
          await loadProducts();
        } catch {
          if (isActive) {
            Alert.alert('Products could not load', 'Please try again.');
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
    }, [loadProducts])
  );

  async function refresh() {
    try {
      setIsRefreshing(true);
      await loadProducts();
    } catch {
      Alert.alert('Refresh failed', 'Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function saveProduct(input: ProductFormValues) {
    if (!inventoryEnabled) {
      Alert.alert('Products are turned off', 'Enable inventory in business profile settings to add products.');
      return;
    }

    try {
      await addProduct({
        name: input.name,
        price: Number(input.price),
        stockQuantity: Number(input.stockQuantity),
        unit: input.unit,
      });
      reset(defaultValues);
      setIsFormVisible(false);
      await loadProducts();
      Alert.alert('Product saved', 'The product was saved on this device.');
    } catch {
      Alert.alert('Product could not be saved', 'Please check the product details and try again.');
    }
  }

  if (isLoading && !business) {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading products</Text>
        <View style={styles.loadingSkeleton}>
          <SkeletonCard lines={2} />
        </View>
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
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
        >
          <ScreenHeader
            title="Products"
            subtitle="Simple product list for invoice entry."
            backLabel="Dashboard"
            onBack={() => navigation.goBack()}
          />

          {!inventoryEnabled ? (
            <EmptyState
              title="Products are turned off"
              message="Enable invoices and inventory in business profile settings to use product selection."
              action={
                <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
                  Open Settings
                </PrimaryButton>
              }
            />
          ) : (
            <>
              <Card glass accent="success" elevated>
                <View style={styles.actionCopy}>
                  <Text style={styles.sectionTitle}>Product List</Text>
                  <Text style={styles.emptyText}>
                    Save frequently used items so invoice entry stays fast.
                  </Text>
                </View>
                <PrimaryButton
                  variant={isFormVisible ? 'ghost' : 'secondary'}
                  onPress={() => setIsFormVisible((current) => !current)}
                >
                  {isFormVisible ? 'Close Form' : 'Add Product'}
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  onPress={() => navigation.navigate('InventoryReorderAssistant')}
                >
                  Reorder Assistant
                </PrimaryButton>
              </Card>

              {isFormVisible ? (
                <FormSection
                  title="Add Product"
                  subtitle="Keep product names short so invoice selection stays quick."
                  accent="primary"
                >
                  <Controller
                    control={control}
                    name="name"
                    render={({ field: { onBlur, onChange, value } }) => (
                      <TextField
                        label="Product name"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder="Item name"
                        value={value}
                        error={errors.name?.message}
                      />
                    )}
                  />
                  <View style={styles.inputRow}>
                    <View style={styles.inputColumn}>
                      <Controller
                        control={control}
                        name="price"
                        render={({ field: { onBlur, onChange, value } }) => (
                          <TextField
                            label="Price"
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            onBlur={onBlur}
                            onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                            placeholder="0.00"
                            value={value}
                            error={errors.price?.message}
                          />
                        )}
                      />
                    </View>
                    <View style={styles.inputColumn}>
                      <Controller
                        control={control}
                        name="stockQuantity"
                        render={({ field: { onBlur, onChange, value } }) => (
                          <TextField
                            label="Stock"
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            onBlur={onBlur}
                            onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                            placeholder="0"
                            value={value}
                            error={errors.stockQuantity?.message}
                          />
                        )}
                      />
                    </View>
                  </View>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field: { onBlur, onChange, value } }) => (
                      <TextField
                        label="Unit"
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder="pcs, kg, hour"
                        value={value}
                        error={errors.unit?.message}
                      />
                    )}
                  />
                  <PrimaryButton
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    onPress={handleSubmit(saveProduct)}
                  >
                    Save Product
                  </PrimaryButton>
                </FormSection>
              ) : null}

              {products.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  message="Add products you use often. They can be selected while creating invoices."
                  action={
                    <PrimaryButton variant="secondary" onPress={() => setIsFormVisible(true)}>
                      Add Product
                    </PrimaryButton>
                  }
                />
              ) : (
                <View style={styles.list}>
                  {products.map((product) => (
                    <ListRow
                      key={product.id}
                      accent={product.stockQuantity <= 5 ? 'warning' : 'success'}
                      title={product.name}
                      subtitle={`Stock ${formatQuantity(product.stockQuantity)} ${product.unit}`}
                      meta={product.stockQuantity <= 5 ? 'Low stock attention' : 'Ready for invoices'}
                      right={
                        <>
                          <StatusChip
                            label={product.stockQuantity <= 5 ? 'Low stock' : 'In stock'}
                            tone={product.stockQuantity <= 5 ? 'warning' : 'success'}
                          />
                          <MoneyText size="sm" align="right">
                            {formatCurrency(product.price, currency)}
                          </MoneyText>
                        </>
                      }
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BottomNavigation
        active="dashboard"
        onCustomers={() => navigation.navigate('Customers')}
        onDashboard={() => navigation.navigate('Dashboard')}
        onSettings={() => navigation.navigate('BusinessProfileSettings')}
      />
    </SafeAreaView>
  );
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
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
  loadingSkeleton: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 112,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  actionCopy: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputColumn: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 76,
    padding: spacing.lg,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  amount: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    maxWidth: 128,
    textAlign: 'right',
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
  },
});
