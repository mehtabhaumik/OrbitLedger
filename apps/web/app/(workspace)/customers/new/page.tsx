'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import {
  normalizePhoneForCountry,
  parseAmount,
  validateBusinessName,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES, getDefaultIndianCity, getIndianCityOptions } from '@/lib/india';
import { createWorkspaceCustomer } from '@/lib/workspace-data';
import { useOfficeAccess } from '@/providers/office-access-provider';
import { useToast } from '@/providers/toast-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export default function NewCustomerPage() {
  const { activeWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const officeAccess = useOfficeAccess();
  const router = useRouter();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [customerType, setCustomerType] = useState<'individual' | 'business'>('business');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [stateCode, setStateCode] = useState(activeWorkspace?.stateCode || 'GJ');
  const [city, setCity] = useState(getDefaultIndianCity(activeWorkspace?.stateCode || 'GJ'));
  const [town, setTown] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function updateState(value: string) {
    setStateCode(value);
    setCity((current) => (getIndianCityOptions(value).includes(current) ? current : getDefaultIndianCity(value)));
  }

  async function saveCustomer() {
    if (!activeWorkspace) {
      return;
    }
    if (!officeAccess.can('manage_customers')) {
      showToast(officeAccess.getLockedMessage('manage_customers'), 'info');
      return;
    }
    const countryCode = activeWorkspace.countryCode || 'IN';
    const validationError =
      validateName(name, 'Customer name', true) ||
      validateBusinessName(legalName, 'Legal / business name', false) ||
      validateName(contactPerson, 'Contact person', false) ||
      validatePhone(phone, countryCode, false) ||
      validateEmail(email, false);
    if (validationError) {
      showToast(validationError, 'danger');
      return;
    }
    if ((creditLimit.trim() && parseAmount(creditLimit) === null) || (openingBalance.trim() && parseAmount(openingBalance) === null)) {
      showToast('Amounts must be valid numbers.', 'danger');
      return;
    }

    setIsSaving(true);
    try {
      const customer = await createWorkspaceCustomer(activeWorkspace.workspaceId, {
        name,
        legalName,
        customerType,
        contactPerson,
        phone: normalizePhoneForCountry(countryCode, phone) ?? phone,
        whatsapp: normalizePhoneForCountry(countryCode, whatsapp) ?? whatsapp,
        email,
        address: billingAddress,
        billingAddress,
        shippingAddress,
        city,
        town,
        stateCode,
        countryCode,
        postalCode,
        gstin,
        pan,
        paymentTerms,
        creditLimit: parseAmount(creditLimit),
        openingBalance: parseAmount(openingBalance) ?? 0,
        tags: splitTags(tags),
        notes,
      });
      showToast('Customer saved.', 'success');
      router.push(`/customers/detail?customerId=${encodeURIComponent(customer.id)}` as Route);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Customer could not be saved.', 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell title="Add customer" subtitle="Save the customer once, then use the record everywhere.">
      <div className="ol-inline-actions" style={{ marginBottom: 18 }}>
        <Link className="ol-button-secondary" href={'/customers' as Route}>
          Back to customers
        </Link>
      </div>
      <section className="ol-panel-glass">
        <div className="ol-form-stack">
          <div className="ol-form-band">
            <div className="ol-form-band-header">
              <div>
                <div className="ol-form-band-title">Core details</div>
                <p className="ol-form-band-copy">Only display name is required. Optional fields improve invoices and exports.</p>
              </div>
            </div>
            <div className="ol-form-band-grid">
              <CustomerInput
                help="The short name Orbit Ledger shows in lists, invoices, statements, and follow-up screens."
                label="Display name"
                required
                value={name}
                onChange={setName}
              />
              <CustomerInput
                help="Use the official business or legal name when it differs from the display name."
                label="Legal / business name"
                value={legalName}
                onChange={setLegalName}
              />
              <label className="ol-field">
                <span className="ol-field-label ol-field-label--with-meta">
                  <span className="ol-field-label-text">
                    Customer type
                    <span className="ol-required-badge">Required</span>
                  </span>
                  <CustomerFieldHelp help="Required because customer type helps Orbit Ledger format records, tax context, and follow-up language correctly." label="Customer type" />
                </span>
                <select aria-required="true" className="ol-select" required value={customerType} onChange={(event) => setCustomerType(event.target.value as 'individual' | 'business')}>
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <CustomerInput label="Contact person" value={contactPerson} onChange={setContactPerson} />
              <CustomerInput inputMode="tel" label="Phone" value={phone} onChange={setPhone} />
              <CustomerInput inputMode="tel" label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
              <CustomerInput help="Used for invoice delivery, statements, reminders, and support context when available." inputMode="email" label="Email" value={email} onChange={setEmail} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-grid">
              <CustomerInput label="Billing address" value={billingAddress} onChange={setBillingAddress} />
              <CustomerInput label="Shipping address" value={shippingAddress} onChange={setShippingAddress} />
              <label className="ol-field">
                <span className="ol-field-label ol-field-label--with-meta">
                  <span className="ol-field-label-text">
                    Country
                    <span className="ol-required-badge">Required</span>
                  </span>
                  <CustomerFieldHelp help="Required for launch tax and location defaults. India is active now; more country packs are planned." label="Country" />
                </span>
                <select aria-required="true" className="ol-select" disabled required value={INDIA_COUNTRY.code}>
                  <option value={INDIA_COUNTRY.code}>{INDIA_COUNTRY.name}</option>
                </select>
                <span className="ol-field-helper">India is active for launch. Other country packs are upcoming.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label ol-field-label--with-meta">
                  <span className="ol-field-label-text">
                    State
                    <span className="ol-required-badge">Required</span>
                  </span>
                  <CustomerFieldHelp help="Required for India-first customer records, tax context, and city defaults." label="State" />
                </span>
                <select aria-required="true" className="ol-select" required value={stateCode} onChange={(event) => updateState(event.target.value)}>
                  {INDIAN_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label ol-field-label--with-meta">
                  <span className="ol-field-label-text">
                    City
                    <span className="ol-required-badge">Required</span>
                  </span>
                  <CustomerFieldHelp help="Required so billing records, statements, and location filters have a clear city value." label="City" />
                </span>
                <select aria-required="true" className="ol-select" required value={city} onChange={(event) => setCity(event.target.value)}>
                  {getIndianCityOptions(stateCode).map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </label>
              <CustomerInput label="Town / village" value={town} onChange={setTown} />
              <CustomerInput label="PIN / postcode" value={postalCode} onChange={setPostalCode} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-grid">
              <CustomerInput help="Customer GST number used on tax-ready invoices and exports." label="GSTIN" value={gstin} onChange={(value) => setGstin(value.toUpperCase())} />
              <CustomerInput help="Customer PAN for Indian tax/reference records when you need it." label="PAN" value={pan} onChange={(value) => setPan(value.toUpperCase())} />
              <CustomerInput
                help="How soon this customer is expected to pay after an invoice. For example, Net 15 means payment is due 15 days after the invoice date."
                label="Payment terms"
                value={paymentTerms}
                onChange={setPaymentTerms}
                placeholder="Example: Net 15"
              />
              <CustomerInput help="Optional internal limit for how much unpaid balance you are comfortable allowing for this customer." inputMode="decimal" label="Credit limit" value={creditLimit} onChange={setCreditLimit} />
              <CustomerInput help="Existing amount this customer already owed or had as credit before you started using Orbit Ledger." inputMode="decimal" label="Opening balance" value={openingBalance} onChange={setOpeningBalance} />
              <CustomerInput help="Internal labels for filtering or grouping customers, such as VIP, wholesale, or follow-up." label="Tags" value={tags} onChange={setTags} placeholder="VIP, wholesale, follow-up" />
            </div>
          </div>
          <label className="ol-field">
            <span className="ol-field-label ol-field-label--with-meta">
              <span className="ol-field-label-text">Notes</span>
              <CustomerFieldHelp help="Optional. Add internal customer context such as billing preferences, follow-up instructions, or relationship notes when useful." label="Notes" />
            </span>
            <textarea className="ol-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="ol-actions">
            <button className="ol-button" disabled={isSaving || !officeAccess.can('manage_customers')} type="button" onClick={() => void saveCustomer()}>
              {isSaving ? 'Saving...' : 'Save customer'}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function CustomerInput({
  help,
  inputMode,
  label,
  onChange,
  placeholder,
  required = false,
  value,
}: {
  help?: string;
  inputMode?: 'decimal' | 'email' | 'tel';
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label ol-field-label--with-meta">
        <span className="ol-field-label-text">
          {label}
          {required ? <span className="ol-required-badge">Required</span> : null}
        </span>
        {help ? <CustomerFieldHelp help={help} label={label} /> : null}
      </span>
      <input
        aria-required={required || undefined}
        className={`ol-input${inputMode === 'decimal' ? ' ol-amount' : ''}`}
        inputMode={inputMode}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CustomerFieldHelp({ help, label }: { help: string; label: string }) {
  return (
    <details className="ol-field-info">
      <summary aria-label={`What is ${label}?`}>?</summary>
      <span>{help}</span>
    </details>
  );
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}
