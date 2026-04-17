export type OrbitHelperActionTarget =
  | 'Dashboard'
  | 'Customers'
  | 'CustomerForm'
  | 'TransactionForm'
  | 'Invoices'
  | 'InvoiceForm'
  | 'Products'
  | 'Reports'
  | 'ComplianceReports'
  | 'BackupRestore'
  | 'TaxSetup'
  | 'CountryPackageStore'
  | 'BusinessProfileSettings'
  | 'PinManagement'
  | 'Upgrade'
  | 'Feedback';

export type OrbitHelperAction = {
  label: string;
  target: OrbitHelperActionTarget;
  params?: Record<string, unknown>;
};

export type OrbitHelperArticle = {
  id: string;
  title: string;
  summary: string;
  body: string[];
  tags: string[];
  screenContext?: string[];
  actions?: OrbitHelperAction[];
};

export type OrbitHelperPack = {
  id: string;
  name: string;
  locale: string;
  version: string;
  source: 'bundled' | 'remote';
  updatedAt: string;
  articles: OrbitHelperArticle[];
};

export type OrbitHelperStatus = {
  packName: string;
  version: string;
  locale: string;
  source: OrbitHelperPack['source'];
  installedAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
};

export type OrbitHelperSearchResult = {
  article: OrbitHelperArticle;
  score: number;
};

export type OrbitHelperUpdateResult = {
  checkedAt: string;
  updated: boolean;
  status: OrbitHelperStatus;
};

export type OrbitHelperUpdateProvider = {
  name: string;
  getCandidatePack: (currentStatus: OrbitHelperStatus | null) => Promise<OrbitHelperPack | null>;
};
