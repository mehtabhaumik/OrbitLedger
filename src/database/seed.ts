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
        businessName: 'Bhaumik Mehta Demo Traders',
        ownerName: 'Bhaumik Mehta',
        phone: '+91 98765 43210',
        email: 'hello@bhaumikmehta.local',
        address: 'Demo Market Road, Ahmedabad',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'GJ',
        authorizedPersonName: 'Bhaumik Mehta',
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
