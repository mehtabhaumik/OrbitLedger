import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { DateInput } from '../components/DateInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { TextField } from '../components/TextField';
import {
  addInvoice,
  getBusinessSettings,
  getFeatureToggles,
  getInvoice,
  getProduct,
  listProducts,
  searchCustomerSummaries,
  updateInvoice,
} from '../database';
import type {
  AppFeatureToggles,
  BusinessSettings,
  CustomerSummary,
  InvoiceWithItems,
  Product,
} from '../database';
import {
  businessNameSchema,
  dateInputSchema,
  getTodayDateInput,
  normalizeDecimalInput,
} from '../forms/validation';
import { showSuccessFeedback } from '../lib/feedback';
import { formatCurrency } from '../lib/format';
import type { RootStackParamList } from '../navigation/types';
import {
  resolveDefaultInvoiceTaxRate,
  resolveInvoiceItemTaxRate,
  type ResolvedTaxRate,
} from '../tax';
import { colors, shadows, spacing, touch, typography } from '../theme/theme';

type InvoiceFormScreenProps = NativeStackScreenProps<RootStackParamList, 'InvoiceForm'>;
const LOW_STOCK_WARNING_THRESHOLD = 5;
const INITIAL_VISIBLE_INVOICE_ITEMS = 8;
const INVOICE_ITEM_BATCH_SIZE = 8;

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  name: businessNameSchema('item name').max(80, 'Keep item name short.'),
  description: z.string().trim().max(180, 'Keep description under 180 characters.').optional(),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, 'Enter a valid quantity.')
    .refine((value) => Number(value) > 0, 'Quantity must be greater than zero.'),
  price: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price.')
    .refine((value) => Number(value) >= 0, 'Price cannot be negative.'),
  taxRate: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^\d+(\.\d{1,3})?$/.test(value),
      'Enter a valid tax rate.'
    )
    .refine((value) => !value || Number(value) <= 100, 'Tax rate cannot be above 100%.'),
});

const invoiceSchema = z.object({
  customerId: z.string().optional(),
  invoiceNumber: z
    .string()
    .trim()
    .min(1, 'Enter invoice number.')
    .max(40, 'Invoice number is too long.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9/-]*$/, 'Use letters, numbers, hyphen, or slash only.'),
  issueDate: dateInputSchema('issue date'),
  dueDate: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || dateInputSchema('due date').safeParse(value).success, 'Choose a real due date.'),
  notes: z.string().trim().max(240, 'Keep notes under 240 characters.').optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one invoice item.'),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export function InvoiceFormScreen({ navigation, route }: InvoiceFormScreenProps) {
  const initialCustomerId = route.params?.customerId;
  const invoiceId = route.params?.invoiceId;
  const isEditing = Boolean(invoiceId);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [featureToggles, setFeatureToggles] = useState<AppFeatureToggles | null>(null);
  const [loadedInvoice, setLoadedInvoice] = useState<InvoiceWithItems | null>(null);
  const [resolvedTaxRate, setResolvedTaxRate] = useState<ResolvedTaxRate>({
    rate: 0,
    source: 'none',
    label: 'No tax applied',
  });
  const itemTaxRateCacheRef = useRef(new Map<string, ResolvedTaxRate>());
  const [visibleItemCount, setVisibleItemCount] = useState(INITIAL_VISIBLE_INVOICE_ITEMS);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(Boolean(invoiceId));
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setValue,
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: initialCustomerId ?? '',
      invoiceNumber: buildInvoiceNumber(),
      issueDate: getTodayDateInput(),
      dueDate: '',
      notes: '',
      items: [createBlankInvoiceFormItem()],
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });
  const { append, fields, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const selectedCustomerId = useWatch({ control, name: 'customerId' }) ?? '';
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const totals = useMemo(
    () => calculateInvoiceTotals(watchedItems, resolvedTaxRate.rate),
    [resolvedTaxRate.rate, watchedItems]
  );
  const invoicesEnabled = featureToggles?.invoices ?? true;
  const inventoryEnabled = invoicesEnabled && (featureToggles?.inventory ?? true);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const stockBaselines = useMemo(
    () => getOriginalStockBaselines(loadedInvoice),
    [loadedInvoice]
  );
  const stockIssues = useMemo(
    () => getStockIssues(watchedItems, inventoryEnabled ? products : [], stockBaselines),
    [inventoryEnabled, products, stockBaselines, watchedItems]
  );
  const visibleFields = useMemo(
    () => fields.slice(0, visibleItemCount),
    [fields, visibleItemCount]
  );
  const hiddenItemCount = Math.max(fields.length - visibleFields.length, 0);
  const visibleCustomers = useMemo(() => {
    const cleaned = customerQuery.trim().toLowerCase();
    if (!cleaned) {
      return customers.slice(0, 10);
    }

    return customers
      .filter((customer) =>
        [customer.name, customer.phone, customer.address]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(cleaned))
      )
      .slice(0, 16);
  }, [customerQuery, customers]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [settings, activeCustomers, savedFeatureToggles, invoice] = await Promise.all([
          getBusinessSettings(),
          searchCustomerSummaries('', 100),
          getFeatureToggles(),
          invoiceId ? getInvoice(invoiceId) : Promise.resolve(null),
        ]);
        const taxRate = savedFeatureToggles.tax
          ? await resolveDefaultInvoiceTaxRate(settings)
          : {
              rate: 0,
              source: 'none' as const,
              label: 'Tax is off',
            };
        const savedProducts =
          savedFeatureToggles.invoices && savedFeatureToggles.inventory
            ? await listProducts({ limit: 100 })
            : [];
        const invoiceProducts =
          savedFeatureToggles.invoices && savedFeatureToggles.inventory && invoice
            ? await Promise.all(
                Array.from(
                  new Set(invoice.items.map((item) => item.productId).filter(Boolean) as string[])
                )
                  .filter((productId) => !savedProducts.some((product) => product.id === productId))
                  .map((productId) => getProduct(productId))
              )
            : [];
        const allProducts = [
          ...savedProducts,
          ...invoiceProducts.filter((product): product is Product => Boolean(product)),
        ];

        if (isMounted) {
          setCurrency(settings?.currency ?? 'INR');
          setBusinessSettings(settings);
          setCustomers(activeCustomers);
          setProducts(allProducts);
          setFeatureToggles(savedFeatureToggles);
          setResolvedTaxRate(taxRate);
          itemTaxRateCacheRef.current.clear();

          if (invoiceId) {
            if (!invoice) {
              Alert.alert('Invoice not found', 'This invoice could not be opened for editing.', [
                { text: 'Done', onPress: () => navigation.goBack() },
              ]);
              return;
            }

            setLoadedInvoice(invoice);
            reset({
              customerId: invoice.customerId ?? '',
              invoiceNumber: invoice.invoiceNumber,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate ?? '',
              notes: invoice.notes ?? '',
              items: invoice.items.map((item) => ({
                productId: item.productId ?? '',
                name: item.name,
                description: item.description ?? '',
                quantity: formatQuantityInput(item.quantity),
                price: formatMoneyInput(item.price),
                taxRate: formatTaxRateInput(item.taxRate),
              })),
            });
            setVisibleItemCount(INITIAL_VISIBLE_INVOICE_ITEMS);
          }
        }
      } catch {
        Alert.alert(
          isEditing ? 'Invoice could not load' : 'Customers could not load',
          'You can try again later.'
        );
      } finally {
        if (isMounted) {
          setIsLoadingCustomers(false);
          setIsLoadingInvoice(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [invoiceId, isEditing, navigation, reset]);

  function selectCustomer(customerId: string) {
    setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true });
    setCustomerQuery('');
  }

  function selectProduct(index: number, product: Product) {
    setValue(`items.${index}.productId`, product.id, { shouldDirty: true, shouldValidate: true });
    setValue(`items.${index}.name`, product.name, { shouldDirty: true, shouldValidate: true });
    setValue(`items.${index}.price`, String(product.price), { shouldDirty: true, shouldValidate: true });
    void applyAutomaticItemTaxRate(index, product.name);
  }

  function clearProduct(index: number) {
    setValue(`items.${index}.productId`, '', { shouldDirty: true, shouldValidate: true });
  }

  function appendInvoiceItem() {
    append(createBlankInvoiceFormItem());
    setVisibleItemCount((current) => Math.max(current + 1, INITIAL_VISIBLE_INVOICE_ITEMS));
  }

  async function applyAutomaticItemTaxRate(index: number, itemName: string) {
    const savedTaxRate = watchedItems[index]?.taxRate?.trim();
    if (!featureToggles?.tax || !businessSettings || savedTaxRate) {
      return;
    }

    try {
      const cacheKey = buildInvoiceItemTaxCacheKey(businessSettings, itemName);
      const cachedTaxRate = itemTaxRateCacheRef.current.get(cacheKey);
      const itemTaxRate =
        cachedTaxRate ??
        (await resolveInvoiceItemTaxRate({
          businessSettings,
          itemName,
        }));
      itemTaxRateCacheRef.current.set(cacheKey, itemTaxRate);
      if (itemTaxRate.source === 'none') {
        return;
      }

      setValue(`items.${index}.taxRate`, formatTaxRateInput(itemTaxRate.rate), {
        shouldDirty: true,
        shouldValidate: true,
      });
      setResolvedTaxRate((current) => (current.source === 'none' ? itemTaxRate : current));
    } catch {
      // Keep invoice entry fast if tax lookup fails; save still falls back to the default local rate.
    }
  }

  async function onSubmit(input: InvoiceFormValues) {
    try {
      if (!invoicesEnabled) {
        Alert.alert('Invoices are turned off', 'Enable invoices in business profile settings to create one.');
        return;
      }

      const invoiceItems = normalizeInvoiceItems(input.items, inventoryEnabled || isEditing);
      const currentStockIssues = getStockIssues(
        invoiceItems,
        inventoryEnabled ? products : [],
        stockBaselines
      );
      if (currentStockIssues.length > 0) {
        Alert.alert('Stock is too low', currentStockIssues[0].message);
        return;
      }

      if (isEditing && invoiceId) {
        const invoice = await updateInvoice(invoiceId, {
          customerId: input.customerId || null,
          invoiceNumber: input.invoiceNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate || null,
          notes: input.notes,
          items: invoiceItems.map((item) => ({
            productId: item.productId || null,
            name: item.name,
            description: item.description?.trim() || null,
            quantity: Number(item.quantity),
            price: Number(item.price),
            taxRate: parseTaxRateInput(item.taxRate, resolvedTaxRate.rate),
          })),
        });

        showSuccessFeedback('Invoice updated locally.', 'Invoice updated');
        navigation.replace('InvoicePreview', { invoiceId: invoice.id });
        return;
      }

      const invoice = await addInvoice({
        customerId: input.customerId || null,
        invoiceNumber: input.invoiceNumber,
        issueDate: input.issueDate,
        dueDate: input.dueDate || null,
        notes: input.notes,
        status: 'draft',
        items: invoiceItems.map((item) => ({
          productId: item.productId || null,
          name: item.name,
          description: item.description?.trim() || null,
          quantity: Number(item.quantity),
          price: Number(item.price),
          taxRate: parseTaxRateInput(item.taxRate, resolvedTaxRate.rate),
        })),
      });

      showSuccessFeedback('Invoice saved locally.', 'Invoice saved');
      navigation.replace('InvoicePreview', { invoiceId: invoice.id });
    } catch {
      Alert.alert(
        isEditing ? 'Invoice could not be updated' : 'Invoice could not be saved',
        'Please check the details and try again.'
      );
    }
  }

  if (!isLoadingCustomers && !isLoadingInvoice && !invoicesEnabled) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.disabledContent}>
          <ScreenHeader
            title="Invoices are off"
            subtitle="Invoice tools are hidden while this module is disabled."
            onBack={() => navigation.goBack()}
          />
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Invoices are turned off</Text>
            <Text style={styles.muted}>
              Enable invoices in business profile settings when you want to create invoices again.
            </Text>
            <PrimaryButton variant="secondary" onPress={() => navigation.navigate('BusinessProfileSettings')}>
              Open Settings
            </PrimaryButton>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title={isEditing ? 'Edit Invoice' : 'Create Invoice'}
            subtitle={
              isEditing
                ? 'Update invoice details, items, stock, and tax values.'
                : 'Build a simple invoice without changing the customer ledger.'
            }
            onBack={() => navigation.goBack()}
          />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            {isLoadingCustomers || isLoadingInvoice ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>{isEditing ? 'Loading invoice' : 'Loading customers'}</Text>
              </View>
            ) : selectedCustomer ? (
              <View style={styles.selectedCustomerCard}>
                <View style={styles.selectedCustomerHeader}>
                  <View style={styles.customerTextBlock}>
                    <Text style={styles.overline}>Selected customer</Text>
                    <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                    <Text style={styles.muted}>{selectedCustomer.phone ?? 'No phone saved'}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={touch.hitSlop}
                    onPress={() => selectCustomer('')}
                    pressRetentionOffset={touch.pressRetentionOffset}
                    style={styles.changeButton}
                  >
                    <Text style={styles.changeButtonText}>Change</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.customerPicker}>
                <TextField
                  label="Find customer"
                  value={customerQuery}
                  onChangeText={setCustomerQuery}
                  placeholder="Search name, phone, or address"
                  helperText="Invoices can be saved without changing ledger balances."
                />
                {customers.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No customers yet</Text>
                    <Text style={styles.muted}>
                      Add a customer first, or save this invoice without a linked customer.
                    </Text>
                    <PrimaryButton variant="secondary" onPress={() => navigation.navigate('CustomerForm')}>
                      Add Customer
                    </PrimaryButton>
                  </View>
                ) : (
                  <View style={styles.customerChoices}>
                    {visibleCustomers.map((customer) => (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={touch.hitSlop}
                        key={customer.id}
                        onPress={() => selectCustomer(customer.id)}
                        pressRetentionOffset={touch.pressRetentionOffset}
                        style={styles.customerChoice}
                      >
                        <View style={styles.customerTextBlock}>
                          <Text style={styles.choiceName}>{customer.name}</Text>
                          <Text style={styles.muted}>{customer.phone ?? 'No phone saved'}</Text>
                        </View>
                        <Text style={styles.chooseText}>Choose</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <PrimaryButton variant="ghost" onPress={() => selectCustomer('')}>
                  Save without customer
                </PrimaryButton>
              </View>
            )}
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <Controller
              control={control}
              name="invoiceNumber"
              render={({ field: { onBlur, onChange, value } }) => (
                <TextField
                  label="Invoice number"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.invoiceNumber?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="issueDate"
              render={({ field: { onChange, value } }) => (
                <DateInput
                  label="Issue date"
                  value={value}
                  onChange={onChange}
                  error={errors.issueDate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="dueDate"
              render={({ field: { onChange, value } }) => (
                <DateInput
                  label="Due date"
                  value={value ?? ''}
                  onChange={onChange}
                  optional
                  error={errors.dueDate?.message}
                  helperText="Optional."
                />
              )}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={touch.hitSlop}
                onPress={appendInvoiceItem}
                pressRetentionOffset={touch.pressRetentionOffset}
                style={styles.addItemButton}
              >
                <Text style={styles.addItemText}>Add item</Text>
              </Pressable>
            </View>
            {visibleFields.map((field, index) => {
              const item = watchedItems[index];
              const selectedProduct = item?.productId ? productById.get(item.productId) : undefined;
              const stockMessage = getItemStockMessage(item, selectedProduct, stockBaselines);
              const suggestedProducts = products
                .filter((product) => product.id !== selectedProduct?.id)
                .slice(0, 6);

              return (
                <View key={field.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>Item {index + 1}</Text>
                    {fields.length > 1 ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={touch.hitSlop}
                        onPress={() => remove(index)}
                        pressRetentionOffset={touch.pressRetentionOffset}
                        style={styles.removeItemButton}
                      >
                        <Text style={styles.removeItemText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {inventoryEnabled ? (
                    <View style={styles.productPicker}>
                      <Text style={styles.productPickerLabel}>Inventory product</Text>
                      {selectedProduct ? (
                        <View style={styles.selectedProductLine}>
                          <View style={styles.customerTextBlock}>
                            <Text style={styles.choiceName}>{selectedProduct.name}</Text>
                            <Text style={styles.muted}>
                              {formatCurrency(selectedProduct.price, currency)} · Stock{' '}
                              {formatQuantity(selectedProduct.stockQuantity)} {selectedProduct.unit}
                            </Text>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            hitSlop={touch.hitSlop}
                            onPress={() => clearProduct(index)}
                            pressRetentionOffset={touch.pressRetentionOffset}
                            style={styles.changeButton}
                          >
                            <Text style={styles.changeButtonText}>Custom</Text>
                          </Pressable>
                        </View>
                      ) : products.length > 0 ? (
                        <View style={styles.productChoices}>
                          {suggestedProducts.map((product) => (
                            <Pressable
                              accessibilityRole="button"
                              hitSlop={touch.hitSlop}
                              key={product.id}
                              onPress={() => selectProduct(index, product)}
                              pressRetentionOffset={touch.pressRetentionOffset}
                              style={styles.productChoice}
                            >
                              <View style={styles.customerTextBlock}>
                                <Text style={styles.choiceName}>{product.name}</Text>
                                <Text style={styles.muted}>
                                  {formatCurrency(product.price, currency)} · Stock{' '}
                                  {formatQuantity(product.stockQuantity)} {product.unit}
                                </Text>
                              </View>
                              <Text style={styles.chooseText}>Use</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.muted}>
                          No products saved yet. You can still add a custom invoice item.
                        </Text>
                      )}
                    </View>
                  ) : null}
                  <Controller
                    control={control}
                    name={`items.${index}.name`}
                    render={({ field: { onBlur, onChange, value } }) => (
                      <TextField
                        label="Item name"
                        value={value}
                        onBlur={() => {
                          onBlur();
                          void applyAutomaticItemTaxRate(index, value);
                        }}
                        onChangeText={onChange}
                        placeholder="Product or service"
                        error={errors.items?.[index]?.name?.message}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`items.${index}.description`}
                    render={({ field: { onBlur, onChange, value } }) => (
                      <TextField
                        label="Service description"
                        value={value ?? ''}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder="Optional service details"
                        helperText="Use this for itemized service notes that should appear on the invoice."
                        multiline
                        error={errors.items?.[index]?.description?.message}
                      />
                    )}
                  />
                  <View style={styles.itemAmountRow}>
                    <View style={styles.itemAmountField}>
                      <Controller
                        control={control}
                        name={`items.${index}.quantity`}
                        render={({ field: { onBlur, onChange, value } }) => (
                          <TextField
                            label="Qty"
                            value={value}
                            onBlur={onBlur}
                            onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            error={errors.items?.[index]?.quantity?.message}
                          />
                        )}
                      />
                    </View>
                    <View style={styles.itemAmountField}>
                      <Controller
                        control={control}
                        name={`items.${index}.price`}
                        render={({ field: { onBlur, onChange, value } }) => (
                          <TextField
                            label="Price"
                            value={value}
                            onBlur={onBlur}
                            onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                            keyboardType="decimal-pad"
                            inputMode="decimal"
                            placeholder="0.00"
                            error={errors.items?.[index]?.price?.message}
                          />
                        )}
                      />
                    </View>
                  </View>
                  <Controller
                    control={control}
                    name={`items.${index}.taxRate`}
                    render={({ field: { onBlur, onChange, value } }) => (
                      <TextField
                        label="Tax rate %"
                        value={value ?? ''}
                        onBlur={onBlur}
                        onChangeText={(text) => onChange(normalizeDecimalInput(text))}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder={formatTaxRateInput(resolvedTaxRate.rate)}
                        helperText="Auto-filled from the active local tax pack when available. You can override it."
                        error={errors.items?.[index]?.taxRate?.message}
                      />
                    )}
                  />
                  <Text style={styles.itemTotal}>
                    Item subtotal {formatCurrency(calculateItemSubtotal(watchedItems[index]), currency)}
                  </Text>
                  {stockMessage ? (
                    <Text
                      style={stockMessage.kind === 'error' ? styles.stockError : styles.stockWarning}
                    >
                      {stockMessage.message}
                    </Text>
                  ) : null}
                </View>
              );
            })}
            {hiddenItemCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={touch.hitSlop}
                onPress={() => setVisibleItemCount((current) => current + INVOICE_ITEM_BATCH_SIZE)}
                pressRetentionOffset={touch.pressRetentionOffset}
                style={styles.loadMoreItemsButton}
              >
                <Text style={styles.loadMoreItemsText}>
                  Show {Math.min(hiddenItemCount, INVOICE_ITEM_BATCH_SIZE)} more items
                </Text>
                <Text style={styles.loadMoreItemsMeta}>
                  {hiddenItemCount} item{hiddenItemCount === 1 ? '' : 's'} hidden for faster editing.
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Totals</Text>
            <SummaryLine label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
            <SummaryLine
              label={resolvedTaxRate.rate > 0 ? `Tax (${resolvedTaxRate.label})` : 'Tax'}
              value={formatCurrency(totals.taxAmount, currency)}
            />
            <SummaryLine label="Total" value={formatCurrency(totals.total, currency)} emphasized />
            <Text style={styles.muted}>
              {resolvedTaxRate.source === 'none'
                ? 'No local tax rate is configured, so tax is kept at zero.'
                : 'Tax is applied from the active local tax setup.'}
            </Text>
          </View>

          <Controller
            control={control}
            name="notes"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                label="Notes"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="Optional note for this invoice"
                multiline
                error={errors.notes?.message}
              />
            )}
          />

          <PrimaryButton
            disabled={
              isSubmitting ||
              isLoadingCustomers ||
              isLoadingInvoice ||
              stockIssues.length > 0
            }
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            {isEditing ? 'Update Invoice' : 'Save Invoice'}
          </PrimaryButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryLine({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={emphasized ? styles.summaryLabelEmphasis : styles.summaryLabel}>{label}</Text>
      <Text style={emphasized ? styles.summaryValueEmphasis : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function calculateInvoiceTotals(
  items: InvoiceFormValues['items'],
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);
  const taxAmount = items.reduce(
    (sum, item) => {
      const itemTaxRate = parseTaxRateInput(item?.taxRate, taxRate);
      return sum + roundMoney(calculateItemSubtotal(item) * (itemTaxRate / 100));
    },
    0
  );
  return {
    subtotal: roundMoney(subtotal),
    taxAmount: roundMoney(taxAmount),
    total: roundMoney(subtotal + taxAmount),
  };
}

function calculateItemSubtotal(item: InvoiceFormValues['items'][number] | undefined): number {
  if (!item) {
    return 0;
  }

  const quantity = Number(item.quantity);
  const price = Number(item.price);
  if (!Number.isFinite(quantity) || !Number.isFinite(price)) {
    return 0;
  }

  return roundMoney(quantity * price);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function normalizeInvoiceItems(
  items: InvoiceFormValues['items'],
  inventoryEnabled: boolean
): InvoiceFormValues['items'] {
  return items.map((item) => ({
    ...item,
    productId: inventoryEnabled ? item.productId : '',
  }));
}

function createBlankInvoiceFormItem(): InvoiceFormValues['items'][number] {
  return { productId: '', name: '', description: '', quantity: '1', price: '', taxRate: '' };
}

function getOriginalStockBaselines(invoice: InvoiceWithItems | null): Map<string, number> {
  const baselines = new Map<string, number>();

  for (const item of invoice?.items ?? []) {
    if (!item.productId) {
      continue;
    }

    baselines.set(item.productId, roundQuantity((baselines.get(item.productId) ?? 0) + item.quantity));
  }

  return baselines;
}

function getStockIssues(
  items: InvoiceFormValues['items'],
  products: Product[],
  stockBaselines: Map<string, number>
): Array<{ productId: string; message: string }> {
  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + quantity);
  }

  return Array.from(quantitiesByProduct.entries()).flatMap(([productId, quantity]) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) {
      return [{ productId, message: 'Selected product could not be found.' }];
    }

    const availableQuantity = product.stockQuantity + (stockBaselines.get(productId) ?? 0);
    if (quantity > availableQuantity) {
      return [
        {
          productId,
          message: `${product.name} has only ${formatQuantity(availableQuantity)} ${product.unit} available for this invoice.`,
        },
      ];
    }

    return [];
  });
}

function getItemStockMessage(
  item: InvoiceFormValues['items'][number] | undefined,
  product: Product | undefined,
  stockBaselines: Map<string, number>
): { kind: 'warning' | 'error'; message: string } | null {
  if (!item?.productId || !product) {
    return null;
  }

  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const availableQuantity = product.stockQuantity + (stockBaselines.get(product.id) ?? 0);
  const remaining = availableQuantity - quantity;
  if (remaining < 0) {
    return {
      kind: 'error',
      message: `Only ${formatQuantity(availableQuantity)} ${product.unit} available for this invoice.`,
    };
  }

  if (remaining <= LOW_STOCK_WARNING_THRESHOLD) {
    return {
      kind: 'warning',
      message: `Low stock after save: ${formatQuantity(remaining)} ${product.unit} remaining.`,
    };
  }

  return null;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
}

function formatQuantityInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function formatMoneyInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatTaxRateInput(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function parseTaxRateInput(value: string | undefined, fallbackRate: number): number {
  if (!value) {
    return fallbackRate;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackRate;
}

function buildInvoiceItemTaxCacheKey(settings: BusinessSettings, itemName: string): string {
  return [
    settings.countryCode,
    settings.stateCode,
    settings.taxProfileVersion ?? '',
    settings.taxLastSyncedAt ?? '',
    itemName.trim().toLowerCase(),
  ].join('|');
}

function buildInvoiceNumber(): string {
  const now = new Date();
  const date = getTodayDateInput().replace(/-/g, '');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `INV-${date}-${hours}${minutes}${seconds}${milliseconds}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  disabledContent: {
    flex: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  formCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingCard: {
    ...shadows.card,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.lg,
  },
  selectedCustomerCard: {
    ...shadows.card,
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.lg,
  },
  selectedCustomerHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  customerTextBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  overline: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  selectedCustomerName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  customerPicker: {
    gap: spacing.md,
  },
  customerChoices: {
    gap: spacing.sm,
  },
  customerChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  choiceName: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  chooseText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  changeButton: {
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  changeButtonText: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '900',
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
  muted: {
    color: colors.textMuted,
    fontSize: typography.label,
    lineHeight: 20,
  },
  addItemButton: {
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  addItemText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  itemCard: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadMoreItemsButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  loadMoreItemsText: {
    color: colors.primary,
    fontSize: typography.label,
    fontWeight: '900',
  },
  loadMoreItemsMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 17,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  itemTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  productPicker: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  productPickerLabel: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  productChoices: {
    gap: spacing.sm,
  },
  productChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  selectedProductLine: {
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  removeItemButton: {
    minHeight: 40,
    justifyContent: 'center',
  },
  removeItemText: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '900',
  },
  itemAmountRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  itemAmountField: {
    flex: 1,
    minWidth: 0,
  },
  itemTotal: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
    textAlign: 'right',
  },
  stockWarning: {
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  stockError: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '900',
    lineHeight: 18,
  },
  summaryCard: {
    ...shadows.card,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  summaryLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: typography.label,
    fontWeight: '800',
  },
  summaryValue: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: '900',
  },
  summaryLabelEmphasis: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '900',
  },
  summaryValueEmphasis: {
    color: colors.primary,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
});
