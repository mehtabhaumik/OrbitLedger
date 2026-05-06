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
              <CustomerInput label="Display name" value={name} onChange={setName} />
              <CustomerInput label="Legal / business name" value={legalName} onChange={setLegalName} />
              <label className="ol-field">
                <span className="ol-field-label">Customer type</span>
                <select className="ol-select" value={customerType} onChange={(event) => setCustomerType(event.target.value as 'individual' | 'business')}>
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                </select>
              </label>
              <CustomerInput label="Contact person" value={contactPerson} onChange={setContactPerson} />
              <CustomerInput inputMode="tel" label="Phone" value={phone} onChange={setPhone} />
              <CustomerInput inputMode="tel" label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
              <CustomerInput inputMode="email" label="Email" value={email} onChange={setEmail} />
            </div>
          </div>
          <div className="ol-form-band">
            <div className="ol-form-band-grid">
              <CustomerInput label="Billing address" value={billingAddress} onChange={setBillingAddress} />
              <CustomerInput label="Shipping address" value={shippingAddress} onChange={setShippingAddress} />
              <label className="ol-field">
                <span className="ol-field-label">Country</span>
                <select className="ol-select" disabled value={INDIA_COUNTRY.code}>
                  <option value={INDIA_COUNTRY.code}>{INDIA_COUNTRY.name}</option>
                </select>
                <span className="ol-field-helper">India is active for launch. Other country packs are upcoming.</span>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">State</span>
                <select className="ol-select" value={stateCode} onChange={(event) => updateState(event.target.value)}>
                  {INDIAN_STATES.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ol-field">
                <span className="ol-field-label">City</span>
                <select className="ol-select" value={city} onChange={(event) => setCity(event.target.value)}>
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
              <CustomerInput label="GSTIN" value={gstin} onChange={(value) => setGstin(value.toUpperCase())} />
              <CustomerInput label="PAN" value={pan} onChange={(value) => setPan(value.toUpperCase())} />
              <CustomerInput label="Payment terms" value={paymentTerms} onChange={setPaymentTerms} placeholder="Example: Net 15" />
              <CustomerInput inputMode="decimal" label="Credit limit" value={creditLimit} onChange={setCreditLimit} />
              <CustomerInput inputMode="decimal" label="Opening balance" value={openingBalance} onChange={setOpeningBalance} />
              <CustomerInput label="Tags" value={tags} onChange={setTags} placeholder="VIP, wholesale, follow-up" />
            </div>
          </div>
          <label className="ol-field">
            <span className="ol-field-label">Notes</span>
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
  inputMode,
  label,
  onChange,
  placeholder,
  value,
}: {
  inputMode?: 'decimal' | 'email' | 'tel';
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <input
        className={`ol-input${inputMode === 'decimal' ? ' ol-amount' : ''}`}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}
