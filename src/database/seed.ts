import { getDatabase } from './client';
import { throwDatabaseError } from './errors';
import {
  addCustomer,
  addTransaction,
  getBusinessSettings,
  saveBusinessSettings,
  saveTaxProfile,
  searchCustomers,
} from './repository';

type CountRow = {
  count: number;
};

export type PerformanceSeedSize = 'standard' | 'heavy';

type PerformanceSeedTargets = {
  customerCount: number;
  transactionsPerCustomer: number;
  productCount: number;
  invoiceCount: number;
};

const PERFORMANCE_SEED_TARGETS: Record<PerformanceSeedSize, PerformanceSeedTargets> = {
  standard: {
    customerCount: 100,
    transactionsPerCustomer: 10,
    productCount: 80,
    invoiceCount: 120,
  },
  heavy: {
    customerCount: 1000,
    transactionsPerCustomer: 20,
    productCount: 300,
    invoiceCount: 1000,
  },
};

export async function seedDevelopmentData(): Promise<void> {
  if (!__DEV__) {
    return;
  }

  try {
    const db = await getDatabase();
    const { count } = (await db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM customers')) ?? {
      count: 0,
    };

    const settings = await getBusinessSettings();
    if (!settings) {
      await saveBusinessSettings({
        businessName: 'Rudraix Demo Traders',
        ownerName: 'Rudraix',
        phone: '+91 98765 43210',
        email: 'hello@rudraix.local',
        address: 'Demo Market Road, Ahmedabad',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'GJ',
        authorizedPersonName: 'Rudraix',
        authorizedPersonTitle: 'Owner',
        taxSetupRequired: true,
      });
    }

    await saveTaxProfile({
      countryCode: 'IN',
      stateCode: 'GJ',
      taxType: 'GST',
      version: 'dev-seed-1',
      source: 'seed',
      taxRulesJson: {
        note: 'Development-only starter tax data for local tax-ready document testing.',
        rates: [],
      },
    });

    if (count > 0) {
      return;
    }

    const customerA = await addCustomer({
      name: 'Aarav Kirana Store',
      phone: '+91 99887 77665',
      address: 'Station Road',
      openingBalance: 1200,
      notes: 'Pays weekly',
    });
    const customerB = await addCustomer({
      name: 'Meera Tailors',
      phone: '+91 88776 66554',
      address: 'Old City',
      openingBalance: 0,
    });
    const customerC = await addCustomer({
      name: 'Naman Freelance Design',
      openingBalance: -250,
      notes: 'Advance held',
    });

    await addTransaction({
      customerId: customerA.id,
      type: 'credit',
      amount: 850,
      note: 'Supplies delivered',
    });
    await addTransaction({
      customerId: customerA.id,
      type: 'payment',
      amount: 500,
      note: 'Cash received',
    });
    await addTransaction({
      customerId: customerB.id,
      type: 'credit',
      amount: 1500,
      note: 'Monthly stitching work',
    });
    await addTransaction({
      customerId: customerC.id,
      type: 'credit',
      amount: 250,
      note: 'Adjusted against advance',
    });

    await searchCustomers('');
  } catch (error) {
    return throwDatabaseError('seedDevelopmentData', error);
  }
}

export async function seedPerformanceData(size: PerformanceSeedSize = 'standard'): Promise<void> {
  if (!__DEV__) {
    return;
  }

  try {
    const targets = PERFORMANCE_SEED_TARGETS[size];
    const db = await getDatabase();
    const settings = await getBusinessSettings();
    if (!settings) {
      await saveBusinessSettings({
        businessName: 'Rudraix Performance Ledger',
        ownerName: 'Rudraix',
        phone: '+91 98765 43210',
        email: 'hello@rudraix.local',
        address: 'Performance Market Road, Ahmedabad',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'GJ',
        authorizedPersonName: 'Rudraix',
        authorizedPersonTitle: 'Owner',
        taxSetupRequired: true,
      });
    }

    const existingCustomers = (await db.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM customers WHERE id LIKE 'perf-cus-%'"
    )) ?? { count: 0 };
    const existingProducts = (await db.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM products WHERE id LIKE 'perf-prd-%'"
    )) ?? { count: 0 };
    const existingInvoices = (await db.getFirstAsync<CountRow>(
      "SELECT COUNT(*) AS count FROM invoices WHERE id LIKE 'perf-inv-%'"
    )) ?? { count: 0 };
    if (
      existingCustomers.count >= targets.customerCount &&
      existingProducts.count >= targets.productCount &&
      existingInvoices.count >= targets.invoiceCount
    ) {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    await db.withTransactionAsync(async () => {
      for (let index = existingCustomers.count + 1; index <= targets.customerCount; index += 1) {
        const customerId = buildSeedId('perf-cus', index);
        const createdAt = daysAgoIso(now, 180 - (index % 90));
        const openingBalance = index % 6 === 0 ? -250 : index % 4 === 0 ? 0 : 300 + (index % 12) * 120;

        await db.runAsync(
          `INSERT OR IGNORE INTO customers (
            id,
            name,
            phone,
            address,
            notes,
            opening_balance,
            is_archived,
            created_at,
            updated_at,
            sync_id,
            last_modified,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending')`,
          customerId,
          `Performance Customer ${String(index).padStart(3, '0')}`,
          `+91 90000 ${String(10000 + index).slice(-5)}`,
          `Market Block ${index % 18}, Ahmedabad`,
          index % 5 === 0 ? 'Bulk buyer with recurring dues' : 'Performance test customer',
          openingBalance,
          createdAt,
          nowIso,
          customerId,
          nowIso
        );

        for (let transactionIndex = 1; transactionIndex <= targets.transactionsPerCustomer; transactionIndex += 1) {
          const transactionId = `${customerId}-txn-${String(transactionIndex).padStart(3, '0')}`;
          const type = transactionIndex % 3 === 0 ? 'payment' : 'credit';
          const amount =
            type === 'payment'
              ? 150 + ((index + transactionIndex) % 9) * 75
              : 220 + ((index + transactionIndex) % 14) * 95;
          const effectiveDate = daysAgoDateOnly(now, (index + transactionIndex) % 120);
          const createdAtIso = `${effectiveDate}T${String((transactionIndex % 10) + 8).padStart(2, '0')}:15:00.000Z`;

          await db.runAsync(
            `INSERT OR IGNORE INTO transactions (
              id,
              customer_id,
              type,
              amount,
              note,
              effective_date,
              created_at,
              sync_id,
              last_modified,
              sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            transactionId,
            customerId,
            type,
            amount,
            type === 'payment' ? 'Performance payment entry' : 'Performance credit entry',
            effectiveDate,
            createdAtIso,
            transactionId,
            createdAtIso
          );
        }
      }

      for (let index = existingProducts.count + 1; index <= targets.productCount; index += 1) {
        const productId = buildSeedId('perf-prd', index);
        const createdAt = daysAgoIso(now, index % 45);
        await db.runAsync(
          `INSERT OR IGNORE INTO products (
            id,
            name,
            price,
            stock_quantity,
            unit,
            created_at,
            sync_id,
            last_modified,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          productId,
          `Performance Product ${String(index).padStart(3, '0')}`,
          75 + (index % 20) * 25,
          40 + (index % 25),
          index % 3 === 0 ? 'hr' : 'pcs',
          createdAt,
          productId,
          createdAt
        );
      }

      for (let index = existingInvoices.count + 1; index <= targets.invoiceCount; index += 1) {
        const invoiceId = buildSeedId('perf-inv', index);
        const customerId = buildSeedId('perf-cus', ((index - 1) % targets.customerCount) + 1);
        const issueDate = daysAgoDateOnly(now, index % 90);
        const productId = buildSeedId('perf-prd', ((index - 1) % targets.productCount) + 1);
        const quantity = 1 + (index % 4);
        const price = 250 + (index % 17) * 50;
        const subtotal = quantity * price;
        const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
        const total = subtotal + taxAmount;

        await db.runAsync(
          `INSERT OR IGNORE INTO invoices (
            id,
            customer_id,
            invoice_number,
            issue_date,
            due_date,
            subtotal,
            tax_amount,
            total_amount,
            status,
            notes,
            created_at,
            sync_id,
            last_modified,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, 'pending')`,
          invoiceId,
          customerId,
          `PERF-${String(index).padStart(5, '0')}`,
          issueDate,
          daysAheadDateOnly(issueDate, 15),
          subtotal,
          taxAmount,
          total,
          'Performance invoice seed',
          `${issueDate}T10:00:00.000Z`,
          invoiceId,
          nowIso
        );

        await db.runAsync(
          `INSERT OR IGNORE INTO invoice_items (
            id,
            invoice_id,
            product_id,
            name,
            description,
            quantity,
            price,
            tax_rate,
            total,
            sync_id,
            last_modified,
            sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 18, ?, ?, ?, 'pending')`,
          `${invoiceId}-item-001`,
          invoiceId,
          productId,
          `Performance invoice item ${index}`,
          'Seeded service/product line for large-list testing',
          quantity,
          price,
          total,
          `${invoiceId}-item-001`,
          nowIso
        );
      }
    });
  } catch (error) {
    return throwDatabaseError('seedPerformanceData', error);
  }
}

function buildSeedId(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

function daysAgoIso(referenceDate: Date, days: number): string {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysAgoDateOnly(referenceDate: Date, days: number): string {
  return daysAgoIso(referenceDate, days).slice(0, 10);
}

function daysAheadDateOnly(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
