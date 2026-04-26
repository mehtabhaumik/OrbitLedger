'use client';

import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';

import {
  normalizePhoneForCountry,
  validateEmail,
  validateName,
  validatePhone,
} from '@/lib/form-validation';
import { INDIA_COUNTRY, INDIAN_STATES, getIndianStateName } from '@/lib/india';
import type { WorkspaceProfileInput } from '@/lib/workspaces';
import { useAuth } from '@/providers/auth-provider';
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

const workspaceCreateSteps = [
  'Creating your workspace profile',
  'Syncing customer and transaction modules',
  'Preparing invoice and statement capabilities',
  'Enabling backup, reports, and tax-ready setup',
] as const;

const workspaceCreateHighlights = [
  {
    title: 'Fast collections and dues tracking',
    copy: 'Record credits and payments quickly, then see clear receivable status in one place.',
  },
  {
    title: 'Invoice, statement, and PDF exports',
    copy: 'Generate business-ready documents you can review, share, and export from the same workspace.',
  },
  {
    title: 'Backup and trust controls',
    copy: 'Export full workspace backups and restore safely with preview checks when needed.',
  },
  {
    title: 'Tax, country, and compliance readiness',
    copy: 'Keep your ledger ready for local tax packs, country settings, and practical reporting workflows.',
  },
] as const;

export function WorkspaceSetupCard() {
  const { user } = useAuth();
  const { createFirstWorkspace } = useWorkspace();
  const [values, setValues] = useState(defaultValues);
  const emailAutofillAppliedRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName: string | null;
    ownerName: string | null;
    phone: string | null;
    email: string | null;
    stateCode: string | null;
  }>({
    businessName: null,
    ownerName: null,
    phone: null,
    email: null,
    stateCode: null,
  });
  const [touched, setTouched] = useState<{
    businessName: boolean;
    ownerName: boolean;
    phone: boolean;
    email: boolean;
    stateCode: boolean;
  }>({
    businessName: false,
    ownerName: false,
    phone: false,
    email: false,
    stateCode: false,
  });
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCreateStep, setActiveCreateStep] = useState(0);
  const [activeCreateHighlight, setActiveCreateHighlight] = useState(0);

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
  const createProgress = useMemo(
    () => `${((activeCreateStep + 1) / workspaceCreateSteps.length) * 100}%`,
    [activeCreateStep]
  );
  const activeHighlight = workspaceCreateHighlights[activeCreateHighlight];

  useEffect(() => {
    if (emailAutofillAppliedRef.current) {
      return;
    }
    const signedInEmail = user?.email?.trim();
    if (!signedInEmail) {
      return;
    }
    if (values.email.trim()) {
      emailAutofillAppliedRef.current = true;
      return;
    }
    setValues((current) => ({ ...current, email: signedInEmail }));
    emailAutofillAppliedRef.current = true;
  }, [user?.email, values.email]);

  useEffect(() => {
    if (!isSaving) {
      setActiveCreateStep(0);
      setActiveCreateHighlight(0);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setActiveCreateStep((current) => (current + 1) % workspaceCreateSteps.length);
    }, 1700);

    const highlightTimer = window.setInterval(() => {
      setActiveCreateHighlight((current) => (current + 1) % workspaceCreateHighlights.length);
    }, 3000);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(highlightTimer);
    };
  }, [isSaving]);

  function validateField(field: keyof typeof fieldErrors, nextValues = values) {
    if (field === 'businessName') {
      return validateName(nextValues.businessName, 'Business name', true);
    }
    if (field === 'ownerName') {
      return validateName(nextValues.ownerName, 'Owner name', true);
    }
    if (field === 'email') {
      return validateEmail(nextValues.email, false);
    }
    if (field === 'phone') {
      return validatePhone(nextValues.phone, INDIA_COUNTRY.code, false);
    }
    if (field === 'stateCode') {
      return nextValues.stateCode.trim() ? null : 'Choose the state where this business operates.';
    }
    return null;
  }

  function handleFieldChange(field: keyof typeof fieldErrors, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setError(null);

    if (!touched[field]) {
      return;
    }

    const nextError = validateField(field, nextValues);
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function handleFieldBlur(field: keyof typeof fieldErrors) {
    setTouched((current) => ({ ...current, [field]: true }));
    let nextValues = values;
    if (field === 'phone') {
      const formatted = normalizePhoneForCountry(INDIA_COUNTRY.code, values.phone);
      if (formatted) {
        nextValues = { ...values, phone: formatted };
        setValues(nextValues);
      }
    }

    const nextError = validateField(field, nextValues);
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function validateStep(index: number) {
    if (index === 0) {
      const identityErrors = {
        businessName: validateField('businessName'),
        ownerName: validateField('ownerName'),
        phone: validateField('phone'),
        email: validateField('email'),
      };
      setTouched((current) => ({
        ...current,
        businessName: true,
        ownerName: true,
        phone: true,
        email: true,
      }));
      setFieldErrors((current) => ({ ...current, ...identityErrors }));
      if (
        identityErrors.businessName ||
        identityErrors.ownerName ||
        identityErrors.phone ||
        identityErrors.email
      ) {
        setError('Fix highlighted fields before continuing.');
        return false;
      }
    }

    if (index === 1) {
      const stateError = validateField('stateCode');
      setTouched((current) => ({ ...current, stateCode: true }));
      setFieldErrors((current) => ({ ...current, stateCode: stateError }));
      if (stateError) {
        setError('Fix highlighted fields before continuing.');
        return false;
      }
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
          className="ol-brand-logo"
          alt="Orbit Ledger"
          src="/branding/orbit-ledger-logo-transparent.png"
        />
        <span className="ol-brand-header-copy">Workspace setup</span>
      </div>

      <div className="ol-onboarding-grid">
        <aside className="ol-onboarding-showcase">
          <div className="ol-showcase-badge-row">
            <span className="ol-showcase-badge ol-showcase-badge--premium">Synced workspace</span>
            <span className="ol-showcase-badge ol-showcase-badge--success">India-first</span>
          </div>
          <div className="ol-onboarding-headline">Create your synced business</div>
          <p className="ol-auth-showcase-copy">
            This is the first-run workspace setup for the web app. It should feel guided,
            trustworthy, and closer to a premium SaaS onboarding than a plain admin form.
          </p>

          <div className="ol-showcase-stack">
            {capabilityHighlights.map((card) => (
              <article className="ol-showcase-card" data-tone={card.tone} key={card.title}>
                <div className="ol-showcase-card-kicker">{card.title}</div>
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
            <div className="ol-onboarding-step-content ol-onboarding-step-content--identity">
              <div className="ol-onboarding-identity-fields">
                <div className="ol-form-row ol-form-row--3">
                  <Field
                    autoComplete="organization"
                    error={fieldErrors.businessName}
                    label="Business name"
                    value={values.businessName}
                    onBlur={() => handleFieldBlur('businessName')}
                    onChange={(businessName) => handleFieldChange('businessName', businessName)}
                  />
                  <Field
                    autoComplete="name"
                    error={fieldErrors.ownerName}
                    label="Owner name"
                    value={values.ownerName}
                    onBlur={() => handleFieldBlur('ownerName')}
                    onChange={(ownerName) => handleFieldChange('ownerName', ownerName)}
                  />
                  <Field
                    autoComplete="tel"
                    error={fieldErrors.phone}
                    inputMode="tel"
                    label="Phone"
                    value={values.phone}
                    onBlur={() => handleFieldBlur('phone')}
                    onChange={(phone) => handleFieldChange('phone', phone)}
                  />
                </div>
                <Field
                  autoComplete="email"
                  error={fieldErrors.email}
                  help="Used for workspace alerts and password recovery."
                  label="Email"
                  type="email"
                  value={values.email}
                  onBlur={() => handleFieldBlur('email')}
                  onChange={(email) => handleFieldChange('email', email)}
                />
              </div>
              <aside className="ol-onboarding-insights">
                <InfoCard
                  copy="The synced workspace identity is what later appears in the dashboard, reports, document headers, and settings."
                  title="Why this step first?"
                />
                <InfoCard
                  copy="Orbit Ledger uses this profile to prepare invoices, statements, backup naming, and workspace-level trust messaging."
                  title="What happens next?"
                />
              </aside>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="ol-form-grid">
              <Field
                label="Business address"
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
                  error={fieldErrors.stateCode}
                  label="State"
                  value={values.stateCode}
                  options={INDIAN_STATES}
                  onBlur={() => handleFieldBlur('stateCode')}
                  onChange={(stateCode) => handleFieldChange('stateCode', stateCode)}
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
      {isSaving ? (
        <div className="ol-creating-backdrop" role="status" aria-live="polite">
          <section className="ol-creating-modal">
            <div className="ol-creating-header">
              <img
                className="ol-brand-logo"
                alt="Orbit Ledger"
                src="/branding/orbit-ledger-logo-transparent.png"
              />
              <span className="ol-brand-header-copy">Preparing workspace</span>
            </div>

            <div className="ol-creating-grid">
              <section className="ol-creating-main">
                <div className="ol-loading-top">
                  <div>
                    <div className="ol-panel-title">Creating your workspace</div>
                    <p className="ol-panel-copy" style={{ maxWidth: 520 }}>
                      Orbit Ledger is setting up your business profile and enabling the core
                      modules so you can start recording entries immediately.
                    </p>
                  </div>
                  <div className="ol-loader-cluster" aria-hidden="true">
                    <div className="ol-loader-ring" />
                    <div className="ol-loader-core" />
                  </div>
                </div>

                <div className="ol-loading-progress" aria-hidden="true">
                  <span style={{ width: createProgress }} />
                </div>

                <div className="ol-loading-steps">
                  {workspaceCreateSteps.map((createStep, index) => (
                    <div
                      className={`ol-loading-step${index === activeCreateStep ? ' is-active' : ''}`}
                      key={createStep}
                    >
                      <span className="ol-chip ol-chip--primary" style={{ minWidth: 84, justifyContent: 'center' }}>
                        Step {index + 1}
                      </span>
                      <span>{createStep}</span>
                      <span
                        className="ol-dot"
                        style={{
                          marginLeft: 'auto',
                          color:
                            index <= activeCreateStep
                              ? 'var(--primary)'
                              : 'rgba(125, 139, 160, 0.45)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <aside className="ol-creating-side">
                <div className="ol-chip-row">
                  <span className="ol-chip ol-chip--tax">
                    <span className="ol-dot" />
                    Business-ready
                  </span>
                  <span className="ol-chip ol-chip--success">
                    <span className="ol-dot" />
                    India-first
                  </span>
                </div>

                <div className="ol-creating-side-title">What you can do with Orbit Ledger</div>
                <article className="ol-creating-tip" key={activeHighlight.title}>
                  <div className="ol-creating-tip-title">{activeHighlight.title}</div>
                  <div className="ol-creating-tip-copy">{activeHighlight.copy}</div>
                </article>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  autoComplete,
  error,
  help,
  inputMode,
  label,
  onBlur,
  onChange,
  type = 'text',
  value,
}: {
  label: string;
  value: string;
  error?: string | null;
  type?: string;
  autoComplete?: string;
  help?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  onBlur?(): void;
  onChange(value: string): void;
}) {
  return (
    <label className={`ol-field${error ? ' is-invalid' : ''}`}>
      <span className="ol-field-label">{label}</span>
      <input
        autoComplete={autoComplete}
        className="ol-input"
        inputMode={inputMode}
        type={type}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="ol-field-error">{error}</span> : null}
      {help ? <span className="ol-field-help">{help}</span> : null}
    </label>
  );
}

function SelectField({
  disabled,
  error,
  label,
  onBlur,
  onChange,
  options,
  value,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  error?: string | null;
  options: ReadonlyArray<{ code: string; name: string }>;
  onBlur?(): void;
  onChange(value: string): void;
}) {
  return (
    <label className={`ol-field${error ? ' is-invalid' : ''}`}>
      <span className="ol-field-label">{label}</span>
      <select
        className="ol-select"
        disabled={disabled}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? <span className="ol-field-error">{error}</span> : null}
    </label>
  );
}

function InfoCard({ copy, title }: { title: string; copy: string }) {
  return (
    <div className="ol-onboarding-info-card">
      <strong>{title}</strong>
      <span>{copy}</span>
    </div>
  );
}
