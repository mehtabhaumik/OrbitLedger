'use client';

import { useMemo, useState } from 'react';

import { INDIA_COUNTRY, INDIAN_STATES, getIndianStateName } from '@/lib/india';
import type { WorkspaceProfileInput } from '@/lib/workspaces';
import { useWorkspace } from '@/providers/workspace-provider';

const defaultValues: WorkspaceProfileInput = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  address: '',
  currency: INDIA_COUNTRY.currency,
  countryCode: INDIA_COUNTRY.code,
  stateCode: 'GJ',
};

const stepMeta = [
  {
    key: 'identity',
    label: 'Identity',
    title: 'Start with the business owner',
    copy: 'This becomes the main identity of the synced workspace across web and signed-in devices.',
  },
  {
    key: 'location',
    label: 'Location',
    title: 'Lock the workspace to India for now',
    copy: 'Country stays fixed while the web workspace is India-first. State is used for tax and business context.',
  },
  {
    key: 'review',
    label: 'Review',
    title: 'Review before you create the workspace',
    copy: 'Orbit Ledger will create the synced business profile and prepare the workspace shell around it.',
  },
] as const;

const capabilityHighlights = [
  {
    tone: 'primary',
    title: 'Receivables command center',
    copy: 'Track who owes you, what needs follow-up, and what changed this month.',
  },
  {
    tone: 'tax',
    title: 'Tax and document ready',
    copy: 'Use invoices, statements, reports, and tax-aware workflows from the same workspace.',
  },
  {
    tone: 'success',
    title: 'Cloud + local browser layer',
    copy: 'Stay signed in for the synced workspace while keeping the browser layer warm for fast repeat use.',
  },
] as const;

export function WorkspaceSetupCard() {
  const { createFirstWorkspace } = useWorkspace();
  const [values, setValues] = useState(defaultValues);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewRows = useMemo(
    () => [
      { label: 'Business', value: values.businessName || 'Not set yet' },
      { label: 'Owner', value: values.ownerName || 'Not set yet' },
      { label: 'Phone', value: values.phone || 'Optional for now' },
      { label: 'Email', value: values.email || 'Optional for now' },
      { label: 'Address', value: values.address || 'Optional for now' },
      {
        label: 'Location',
        value: `${INDIA_COUNTRY.name} · ${getIndianStateName(values.stateCode || 'GJ')}`,
      },
    ],
    [values]
  );

  function validateStep(index: number) {
    if (index === 0) {
      if (!values.businessName.trim()) {
        setError('Enter the business name before continuing.');
        return false;
      }
      if (!values.ownerName.trim()) {
        setError('Enter the owner name before continuing.');
        return false;
      }
      if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        setError('Enter a valid email address or leave it blank for now.');
        return false;
      }
    }

    if (index === 1 && !values.stateCode.trim()) {
      setError('Choose the state where this business operates.');
      return false;
    }

    setError(null);
    return true;
  }

  async function handleContinue() {
    if (!validateStep(step)) {
      return;
    }

    setStep((current) => Math.min(current + 1, stepMeta.length - 1));
  }

  async function handleCreate() {
    if (!validateStep(0) || !validateStep(1)) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createFirstWorkspace({
        ...values,
        businessName: values.businessName.trim(),
        ownerName: values.ownerName.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        address: values.address.trim(),
        currency: INDIA_COUNTRY.currency,
        countryCode: INDIA_COUNTRY.code,
        stateCode: values.stateCode,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Workspace could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="ol-onboarding-shell">
      <div className="ol-brand-header">
        <img
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-transparent.png"
          style={{ height: '1.6rem', width: 'auto' }}
        />
        <span className="ol-brand-header-copy">Workspace setup</span>
      </div>

      <div className="ol-onboarding-grid">
        <aside className="ol-onboarding-showcase">
          <div className="ol-chip-row">
            <span className="ol-chip ol-chip--premium">Synced workspace</span>
            <span className="ol-chip ol-chip--success">India-first</span>
          </div>
          <div className="ol-onboarding-headline">Create your synced business</div>
          <p className="ol-auth-showcase-copy">
            This is the first-run workspace setup for the web app. It should feel guided,
            trustworthy, and closer to a premium SaaS onboarding than a plain admin form.
          </p>

          <div className="ol-showcase-stack">
            {capabilityHighlights.map((card) => (
              <article className="ol-showcase-card" key={card.title}>
                <div className={`ol-chip ol-chip--${card.tone}`}>{card.title}</div>
                <div className="ol-showcase-card-copy">{card.copy}</div>
              </article>
            ))}
          </div>
        </aside>

        <div className="ol-auth-panel">
          <div>
            <div className="ol-panel-title">{stepMeta[step].title}</div>
            <p className="ol-panel-copy">{stepMeta[step].copy}</p>
          </div>

          <div className="ol-onboarding-stepper">
            {stepMeta.map((item, index) => (
              <div
                className={`ol-onboarding-step${index === step ? ' is-active' : ''}${index < step ? ' is-complete' : ''}`}
                key={item.key}
              >
                <span className="ol-onboarding-step-number">{index + 1}</span>
                {item.label}
              </div>
            ))}
          </div>

          {step === 0 ? (
            <div className="ol-form-grid">
              <div className="ol-form-row ol-form-row--3">
                <Field
                  label="Business name"
                  placeholder="Orbit Ledger Services"
                  value={values.businessName}
                  onChange={(businessName) => setValues({ ...values, businessName })}
                />
                <Field
                  label="Owner name"
                  placeholder="Bhaumik Mehta"
                  value={values.ownerName}
                  onChange={(ownerName) => setValues({ ...values, ownerName })}
                />
                <Field
                  label="Phone"
                  placeholder="+91 98765 43210"
                  value={values.phone}
                  onChange={(phone) => setValues({ ...values, phone })}
                />
              </div>
              <div className="ol-form-row ol-form-row--3">
                <Field
                  label="Email"
                  placeholder="owner@example.com"
                  type="email"
                  value={values.email}
                  onChange={(email) => setValues({ ...values, email })}
                />
                <div className="ol-panel-glass" style={{ padding: 16, display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>Why this step first?</strong>
                  <span className="ol-muted" style={{ lineHeight: 1.6, fontSize: 13 }}>
                    The synced workspace identity is what later appears in the dashboard, reports,
                    document headers, and settings.
                  </span>
                </div>
                <div className="ol-panel-glass" style={{ padding: 16, display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>What happens next?</strong>
                  <span className="ol-muted" style={{ lineHeight: 1.6, fontSize: 13 }}>
                    Orbit Ledger uses this profile to prepare invoices, statements, backup naming,
                    and workspace-level trust messaging.
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="ol-form-grid">
              <Field
                label="Business address"
                placeholder="12 Market Road, Ahmedabad, Gujarat"
                value={values.address}
                onChange={(address) => setValues({ ...values, address })}
              />
              <div className="ol-form-row ol-form-row--3">
                <SelectField
                  disabled
                  label="Country"
                  value={INDIA_COUNTRY.code}
                  options={[INDIA_COUNTRY]}
                  onChange={() => undefined}
                />
                <SelectField
                  disabled
                  label="Currency"
                  value={INDIA_COUNTRY.currency}
                  options={[{ code: INDIA_COUNTRY.currency, name: INDIA_COUNTRY.currency }]}
                  onChange={() => undefined}
                />
                <SelectField
                  label="State"
                  value={values.stateCode}
                  options={INDIAN_STATES}
                  onChange={(stateCode) => setValues({ ...values, stateCode })}
                />
              </div>
              <div className="ol-note">
                <strong>India-first web workspace</strong>
                <span>
                  Country stays fixed for now so tax, currency, and business copy remain coherent.
                  The state selection is still important for tax-aware setup and reporting context.
                </span>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="ol-onboarding-summary">
              <div className="ol-review-grid">
                {reviewRows.map((item) => (
                  <div className="ol-review-item" key={item.label}>
                    <span className="ol-review-label">{item.label}</span>
                    <span className="ol-review-value">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="ol-panel-glass" style={{ padding: 18, display: 'grid', gap: 10 }}>
                <strong style={{ fontSize: 14 }}>What this creates</strong>
                <span className="ol-muted" style={{ lineHeight: 1.65 }}>
                  A signed-in cloud workspace for customers, transactions, invoices, reports, and
                  backup flows. This is the web-only synced path, not a local-only browser setup.
                </span>
              </div>
            </div>
          ) : null}

          {error ? <div className="ol-message ol-message--danger">{error}</div> : null}

          <div className="ol-actions">
            {step > 0 ? (
              <button
                className="ol-button-secondary"
                disabled={isSaving}
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((current) => Math.max(current - 1, 0));
                }}
              >
                Back
              </button>
            ) : null}

            {step < stepMeta.length - 1 ? (
              <button className="ol-button" disabled={isSaving} type="button" onClick={() => void handleContinue()}>
                Continue
              </button>
            ) : (
              <button className="ol-button" disabled={isSaving} type="button" onClick={() => void handleCreate()}>
                {isSaving ? 'Creating workspace...' : 'Create workspace'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <input
        className="ol-input"
        placeholder={placeholder}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  options: ReadonlyArray<{ code: string; name: string }>;
  onChange(value: string): void;
}) {
  return (
    <label className="ol-field">
      <span className="ol-field-label">{label}</span>
      <select
        className="ol-select"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
