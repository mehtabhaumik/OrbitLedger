#!/usr/bin/env node

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const apiKey =
  process.env.ORBIT_LEDGER_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY ||
  'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w';
const storageBucket =
  process.env.ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_STORAGE_BUCKET ||
  'orbit-ledger-f41c2.firebasestorage.app';
const ownerEmail = requireEnv('ORBIT_LEDGER_QA_EMAIL');
const ownerPassword = requireEnv('ORBIT_LEDGER_QA_PASSWORD');
const viewerEmail = process.env.ORBIT_LEDGER_QA_VIEWER_EMAIL?.trim() || '';
const viewerPassword = process.env.ORBIT_LEDGER_QA_VIEWER_PASSWORD?.trim() || '';
let workspaceId = process.env.ORBIT_LEDGER_QA_WORKSPACE_ID?.trim() || '';

const now = new Date();
const nowIso = now.toISOString();
const today = nowIso.slice(0, 10);
const billingMonth = today.slice(0, 7);
const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const ids = {
  customer: 'qa_customer_sonali',
  secondCustomer: 'qa_customer_aarav',
  product: 'qa_product_printer_service',
  invoice: 'qa_invoice_monthly',
  invoiceItem: 'qa_invoice_item_service',
  invoiceVersion: 'qa_invoice_version_v1',
  transactionCredit: 'qa_transaction_credit',
  transactionPayment: 'qa_transaction_payment',
  allocation: 'qa_payment_allocation',
  recurringRule: 'qa_recurring_rule_monthly',
  emailQueue: 'qa_email_queue_next',
  officeMemberOwner: '',
  officeMemberViewer: '',
};

async function main() {
  const owner = await getOrCreateUser(ownerEmail, ownerPassword);
  workspaceId = workspaceId || `qa_web_smoke_workspace_${owner.localId.slice(0, 12).toLowerCase()}`;
  ids.officeMemberOwner = owner.localId;
  const viewer = viewerEmail && viewerPassword ? await getOrCreateUser(viewerEmail, viewerPassword) : null;
  if (viewer) {
    ids.officeMemberViewer = viewer.localId;
  }
  const firestoreAccessToken = process.env.ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN?.trim() || owner.idToken;
  const storageAccessToken = process.env.ORBIT_LEDGER_STORAGE_ADMIN_ACCESS_TOKEN?.trim() || owner.idToken;

  await seedFirestore(owner, firestoreAccessToken);
  await seedStorage(storageAccessToken);

  console.log(`PASS: seeded QA workspace ${workspaceId} for ${maskEmail(ownerEmail)}.`);
  if (viewer) {
    console.log(`PASS: seeded viewer Office member ${maskEmail(viewerEmail)}.`);
  }
}

async function seedFirestore(owner, accessToken) {
  const workspace = {
    owner_uid: owner.localId,
    owner_email: ownerEmail,
    business_name: 'Orbit Ledger QA Workspace',
    legal_name: 'Orbit Ledger QA Workspace Pvt Ltd',
    owner_name: 'QA Owner',
    contact_person: 'QA Owner',
    business_type: 'business',
    phone: '+919999999999',
    whatsapp: '+919999999999',
    email: ownerEmail,
    website: 'https://example.invalid',
    address: 'QA Business Park, Ahmedabad',
    address_line_1: 'QA Business Park',
    address_line_2: 'Ellisbridge',
    city: 'Ahmedabad',
    town: 'Navrangpura',
    postal_code: '380009',
    gstin: '24ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    tax_number: 'QA-TAX-001',
    registration_number: 'QA-REG-001',
    place_of_supply: 'GJ',
    default_tax_treatment: 'taxable',
    default_payment_terms: 'Net 7',
    default_due_days: 7,
    default_tax_rate: 18,
    default_invoice_template: 'india-gst-standard',
    default_statement_template: 'basic-statement',
    default_invoice_notes: 'Thank you for your business.',
    default_recurring_email_subject: 'Invoice {{invoiceNumber}} from {{businessName}}',
    default_recurring_email_body:
      'Hello {{customerName}},\n\nYour invoice {{invoiceNumber}} is attached.\n\nYou can pay here:\n{{paymentLink}}\n\nThank you,\n{{businessName}}',
    default_recurring_email_include_payment_link: true,
    default_recurring_email_attach_pdf: true,
    default_recurring_email_current_month_only: true,
    default_recurring_email_send_day_behavior: 'custom_day',
    default_recurring_email_day: 15,
    document_filename_format: '{customer}_{invoice}_{date}_{revision}_{country}',
    document_footer_preference: 'auto',
    document_brand_header_color: '#245f56',
    document_brand_background_color: '#f6f8fb',
    document_brand_font_color: '#111827',
    reminder_style: 'soft',
    overdue_alert_timing: '1_day_after_due',
    follow_up_cadence_days: 7,
    payment_notice_tone: 'friendly',
    urgent_payment_stamp_default: false,
    backup_reminder_frequency: 'weekly',
    default_language: 'en',
    currency: 'INR',
    country_code: 'IN',
    state_code: 'GJ',
    document_watermark_type: 'text',
    document_watermark_text: 'QA SAMPLE',
    document_watermark_opacity: 0.08,
    authorized_person_name: 'QA Owner',
    authorized_person_title: 'Owner',
    payment_upi_id: 'qa@bank',
    payment_page_url: 'https://orbit-ledger-f41c2.web.app/pay/',
    payment_note: 'Please mention invoice number.',
    payment_bank_account_name: 'Orbit Ledger QA Workspace',
    payment_bank_name: 'QA Bank',
    payment_bank_account_number: '1234567890',
    payment_bank_ifsc: 'HDFC0001234',
    payment_bank_branch: 'Ahmedabad',
    data_state: 'full_dataset',
    created_at: nowIso,
    updated_at: nowIso,
    server_revision: 1,
  };

  await writeDocument(accessToken, `workspaces/${workspaceId}`, workspace);
  await writeDocument(accessToken, `workspaces/${workspaceId}/office_members/${owner.localId}`, {
    uid: owner.localId,
    workspace_id: workspaceId,
    role: 'owner',
    status: 'active',
    email: ownerEmail,
    display_name: 'QA Owner',
    invited_by: owner.localId,
    invited_at: nowIso,
    accepted_at: nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (viewerEmail && viewerPassword && ids.officeMemberViewer) {
    await writeDocument(accessToken, `workspaces/${workspaceId}/office_members/${ids.officeMemberViewer}`, {
      uid: ids.officeMemberViewer,
      workspace_id: workspaceId,
      role: 'viewer',
      status: 'active',
      email: viewerEmail,
      display_name: 'QA Viewer',
      invited_by: owner.localId,
      invited_at: nowIso,
      accepted_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  await writeDocument(accessToken, `workspaces/${workspaceId}/customers/${ids.customer}`, {
    name: 'Sonali Traders',
    legal_name: 'Sonali Traders',
    customer_type: 'business',
    contact_person: 'Sonali Patel',
    phone: '+919586976949',
    whatsapp: '+919586976949',
    email: 'sonali.qa@example.invalid',
    address: 'Sample Market Road, Ahmedabad',
    billing_address: 'Sample Market Road, Ahmedabad',
    shipping_address: 'Sample Market Road, Ahmedabad',
    city: 'Ahmedabad',
    town: 'Navrangpura',
    state_code: 'GJ',
    country_code: 'IN',
    postal_code: '380009',
    gstin: '24SONAL1234F1Z5',
    pan: 'SONAL1234F',
    place_of_supply: 'GJ',
    default_tax_treatment: 'taxable',
    notes: 'Seed customer for authenticated QA smoke tests.',
    opening_balance: 0,
    current_balance: 1500,
    credit_limit: 10000,
    payment_terms: 'Net 7',
    preferred_payment_mode: 'upi',
    preferred_invoice_template: 'india-gst-standard',
    preferred_language: 'en',
    tags: ['qa', 'follow-up'],
    is_archived: false,
    created_at: nowIso,
    updated_at: nowIso,
    server_revision: 1,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/customers/${ids.secondCustomer}`, {
    name: 'Aarav Sample Stores',
    customer_type: 'business',
    phone: '+919111111111',
    email: 'aarav.qa@example.invalid',
    city: 'Ahmedabad',
    state_code: 'GJ',
    country_code: 'IN',
    current_balance: 0,
    tags: ['qa', 'reliable'],
    is_archived: false,
    created_at: nowIso,
    updated_at: nowIso,
    server_revision: 1,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/products/${ids.product}`, {
    name: 'Printer Maintenance',
    price: 1500,
    stock_quantity: 8,
    unit: 'service',
    created_at: nowIso,
    last_modified: nowIso,
    server_revision: 1,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/invoices/${ids.invoice}`, {
    customer_id: ids.customer,
    customer_name: 'Sonali Traders',
    invoice_number: 'QA-WEB-1001',
    issue_date: today,
    due_date: dueDate,
    billing_month: billingMonth,
    subtotal: 1500,
    tax_amount: 270,
    total_amount: 1770,
    paid_amount: 270,
    status: 'issued',
    document_state: 'created',
    payment_status: 'partially_paid',
    payment_status_reason: 'UPI received',
    version_number: 1,
    use_for_monthly_auto_email: true,
    recurring_rule_id: ids.recurringRule,
    auto_email_prepared_at: nowIso,
    auto_email_scheduled_for: dueDate,
    has_auto_email_history: true,
    latest_auto_email_status: 'scheduled',
    latest_auto_email_sent_at: null,
    latest_auto_email_version_id: ids.invoiceVersion,
    is_archived: false,
    created_at: nowIso,
    last_modified: nowIso,
    server_revision: 1,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/invoice_items/${ids.invoiceItem}`, {
    invoice_id: ids.invoice,
    product_id: ids.product,
    name: 'Printer Maintenance',
    description: 'Monthly maintenance and inspection',
    quantity: 1,
    price: 1500,
    tax_rate: 18,
    total: 1770,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/invoice_versions/${ids.invoiceVersion}`, {
    invoice_id: ids.invoice,
    invoice_number: 'QA-WEB-1001',
    version_number: 1,
    created_at: nowIso,
    reason: 'First saved invoice',
    customer_id: ids.customer,
    customer_name: 'Sonali Traders',
    issue_date: today,
    due_date: dueDate,
    document_state: 'created',
    payment_status: 'partially_paid',
    payment_status_reason: 'UPI received',
    auto_email_scheduled_for: dueDate,
    auto_email_recipient: 'sonali.qa@example.invalid',
    auto_email_status: 'scheduled',
    auto_email_used_version_id: ids.invoiceVersion,
    subtotal: 1500,
    tax_amount: 270,
    total_amount: 1770,
    paid_amount: 270,
    notes: 'QA invoice version snapshot.',
    snapshot_hash: `qa-${billingMonth}`,
    items: [
      {
        id: ids.invoiceItem,
        invoiceId: ids.invoice,
        productId: ids.product,
        name: 'Printer Maintenance',
        description: 'Monthly maintenance and inspection',
        quantity: 1,
        price: 1500,
        taxRate: 18,
        total: 1770,
      },
    ],
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/transactions/${ids.transactionCredit}`, {
    customer_id: ids.customer,
    type: 'credit',
    amount: 1770,
    note: 'QA opening invoice amount',
    effective_date: today,
    created_at: nowIso,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/transactions/${ids.transactionPayment}`, {
    customer_id: ids.customer,
    type: 'payment',
    amount: 270,
    note: 'QA partial payment',
    payment_mode: 'upi',
    payment_details: { upiId: 'customer@upi' },
    payment_clearance_status: 'cleared',
    payment_attachments: [
      {
        id: 'qa-proof',
        name: 'qa-payment-proof.png',
        uri: `gs://${storageBucket}/workspaces/${workspaceId}/attachments/payment-instruments/qa-payment-proof.png`,
        type: 'image',
        size: 68,
        contentType: 'image/png',
        createdAt: nowIso,
      },
    ],
    effective_date: today,
    created_at: nowIso,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/payment_allocations/${ids.allocation}`, {
    transaction_id: ids.transactionPayment,
    invoice_id: ids.invoice,
    customer_id: ids.customer,
    amount: 270,
    payment_mode: 'upi',
    payment_details: { upiId: 'customer@upi' },
    payment_clearance_status: 'cleared',
    payment_attachments: [
      {
        id: 'qa-proof',
        name: 'qa-payment-proof.png',
        uri: `gs://${storageBucket}/workspaces/${workspaceId}/attachments/payment-instruments/qa-payment-proof.png`,
        type: 'image',
        size: 68,
        contentType: 'image/png',
        createdAt: nowIso,
      },
    ],
    is_reversed: false,
    created_at: nowIso,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/recurring_invoice_rules/${ids.recurringRule}`, {
    name: 'Monthly printer service',
    customer_id: ids.customer,
    customer_name: 'Sonali Traders',
    start_date: billingMonth + '-01',
    end_date: null,
    invoice_day: 1,
    next_run_date: dueDate,
    due_days: 7,
    invoice_number_prefix: 'QA-WEB',
    notes: 'QA monthly recurring rule.',
    email_enabled: true,
    email_recipient: 'sonali.qa@example.invalid',
    email_day: 15,
    email_subject: 'Invoice {{invoiceNumber}} from {{businessName}}',
    email_body: 'Hello {{customerName}},\n\nYour invoice is attached.\n\n{{paymentLink}}',
    email_include_payment_link: true,
    email_attach_pdf: true,
    email_current_month_only: true,
    email_automation_approved: true,
    email_automation_approved_at: nowIso,
    email_approval_summary: 'Approved for QA monthly email smoke.',
    email_approval_required: false,
    last_settings_changed_at: nowIso,
    next_email_date: dueDate,
    status: 'active',
    items: [
      {
        id: ids.invoiceItem,
        productId: ids.product,
        name: 'Printer Maintenance',
        description: 'Monthly maintenance and inspection',
        quantity: 1,
        price: 1500,
        taxRate: 18,
        total: 1770,
      },
    ],
    last_created_invoice_id: ids.invoice,
    last_created_run_date: today,
    created_at: nowIso,
    last_modified: nowIso,
  });
  await writeDocument(accessToken, `workspaces/${workspaceId}/email_queue/${ids.emailQueue}`, {
    kind: 'recurring_invoice',
    status: 'scheduled',
    scheduled_for: dueDate,
    sent_at: null,
    recipient_email: 'sonali.qa@example.invalid',
    subject: 'Invoice QA-WEB-1001 from Orbit Ledger QA Workspace',
    body: 'Hello Sonali Traders,\n\nYour invoice is attached.\n\nhttps://orbit-ledger-f41c2.web.app/pay/',
    invoice_id: ids.invoice,
    invoice_number: 'QA-WEB-1001',
    customer_id: ids.customer,
    recurring_rule_id: ids.recurringRule,
    include_payment_link: true,
    attachment: 'invoice_pdf',
    last_error: null,
    created_at: nowIso,
    last_modified: nowIso,
  });
}

async function seedStorage(idToken) {
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAEtAJJXIDTjwAAAABJRU5ErkJggg==',
    'base64'
  );
  await uploadStorageObject(
    idToken,
    `workspaces/${workspaceId}/attachments/payment-instruments/qa-payment-proof.png`,
    pngBytes,
    'image/png'
  );
  await uploadStorageObject(
    idToken,
    `workspaces/${workspaceId}/logos/qa-logo.png`,
    pngBytes,
    'image/png'
  );
}

async function getOrCreateUser(email, password) {
  const signedIn = await signInUser(email, password);
  if (signedIn) {
    return signedIn;
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await safeJson(response);
  if (response.ok && body?.idToken && body?.localId) {
    return body;
  }

  const message = body?.error?.message ? String(body.error.message) : JSON.stringify(body);
  throw new Error(`Could not create QA account ${maskEmail(email)}: ${response.status} ${message}`);
}

async function signInUser(email, password) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await safeJson(response);
  if (response.ok && body?.idToken && body?.localId) {
    return body;
  }

  const message = body?.error?.message ? String(body.error.message) : '';
  if (message.includes('EMAIL_NOT_FOUND') || message.includes('INVALID_LOGIN_CREDENTIALS')) {
    return null;
  }
  throw new Error(`Could not sign in QA account ${maskEmail(email)}: ${response.status} ${message}`);
}

async function writeDocument(idToken, path, data) {
  const createResponse = await createDocument(idToken, path, data);
  if (createResponse.ok) {
    await safeJson(createResponse);
    return;
  }

  const createBody = await safeJson(createResponse);
  const alreadyExists =
    createResponse.status === 409 ||
    String(createBody?.error?.status ?? '').includes('ALREADY_EXISTS') ||
    String(createBody?.error?.message ?? '').includes('already exists');
  if (!alreadyExists && createResponse.status !== 403) {
    throw new Error(`Could not create ${path}: ${createResponse.status} ${JSON.stringify(createBody)}`);
  }

  const patchResponse = await patchDocument(idToken, path, data);
  const patchBody = await safeJson(patchResponse);
  if (!patchResponse.ok) {
    if (alreadyExists) {
      throw new Error(`Could not update ${path}: ${patchResponse.status} ${JSON.stringify(patchBody)}`);
    }
    throw new Error(
      `Could not create ${path}: ${createResponse.status} ${JSON.stringify(createBody)}; update also failed: ${patchResponse.status} ${JSON.stringify(patchBody)}`
    );
  }
}

async function patchDocument(idToken, path, data) {
  return fetch(firestoreDocumentUrl(path), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
}

async function createDocument(idToken, path, data) {
  const segments = path.split('/');
  const documentId = segments.pop();
  const collectionPath = segments.join('/');
  if (!documentId || !collectionPath) {
    throw new Error(`Invalid Firestore document path: ${path}`);
  }

  return fetch(`${firestoreCollectionUrl(collectionPath)}?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
}

async function uploadStorageObject(idToken, name, bytes, contentType) {
  const response = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o?uploadType=media&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': contentType,
      },
      body: bytes,
    }
  );
  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(`Could not upload ${name}: ${response.status} ${JSON.stringify(body)}`);
  }
}

function firestoreDocumentUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function firestoreCollectionUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function toFirestoreFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  throw new Error(`Unsupported Firestore seed value: ${String(value)}`);
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Use a dedicated QA account, not a personal account.`);
  }
  return value;
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) {
    return '[invalid-email]';
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
