export type BusinessHealthTone = 'healthy' | 'watch' | 'action';

export type BusinessHealthSnapshot = {
  generatedAt: string;
  period: {
    label: string;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  business: {
    businessName: string;
    currency: string;
  };
  score: {
    value: number;
    tone: BusinessHealthTone;
    label: string;
    helper: string;
  };
  totals: {
    currentReceivable: number;
    previousReceivable: number;
    receivableChange: number;
    paymentsReceived: number;
    previousPaymentsReceived: number;
    creditGiven: number;
    previousCreditGiven: number;
    invoiceSales: number;
    previousInvoiceSales: number;
    collectionRate: number;
    outstandingCustomerCount: number;
    riskyCustomerCount: number;
    improvingCustomerCount: number;
    missedPromiseCount: number;
    lowStockProductCount: number;
  };
  actionItems: BusinessHealthActionItem[];
  bestCustomers: BusinessHealthCustomer[];
  riskyCustomers: BusinessHealthCustomer[];
  improvingCustomers: BusinessHealthCustomer[];
  lowStockProducts: BusinessHealthLowStockProduct[];
};

export type BusinessHealthActionItem = {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionLabel: string;
  target: 'get_paid' | 'products' | 'daily_closing' | 'reports' | 'customers';
};

export type BusinessHealthCustomer = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
  paymentsReceived: number;
  creditGiven: number;
  invoiceSales: number;
  lastPaymentAt: string | null;
  oldestCreditAt: string | null;
  latestActivityAt: string | null;
};

export type BusinessHealthLowStockProduct = {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
};
