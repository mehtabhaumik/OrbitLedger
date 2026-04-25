'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useState } from 'react';

import type { WorkspaceProfileInput } from '@/lib/workspaces';
import { useWorkspace } from '@/providers/workspace-provider';

const defaultValues: WorkspaceProfileInput = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  address: '',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
};

export function WorkspaceSetupCard() {
  const { createFirstWorkspace } = useWorkspace();
  const [values, setValues] = useState(defaultValues);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      await createFirstWorkspace(values);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Workspace could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={styles.card}>
      <div style={styles.heading}>Create your synced business</div>
      <div style={styles.subheading}>
        Web access always uses a signed-in workspace. Start with the business profile here.
      </div>
      <div style={styles.grid}>
        <Field label="Business name" value={values.businessName} onChange={(businessName) => setValues({ ...values, businessName })} />
        <Field label="Owner name" value={values.ownerName} onChange={(ownerName) => setValues({ ...values, ownerName })} />
        <Field label="Phone" value={values.phone} onChange={(phone) => setValues({ ...values, phone })} />
        <Field label="Email" value={values.email} onChange={(email) => setValues({ ...values, email })} />
        <Field label="Address" value={values.address} onChange={(address) => setValues({ ...values, address })} />
        <div style={styles.row}>
          <Field label="Currency" value={values.currency} onChange={(currency) => setValues({ ...values, currency })} />
          <Field label="Country" value={values.countryCode} onChange={(countryCode) => setValues({ ...values, countryCode })} />
          <Field label="State" value={values.stateCode} onChange={(stateCode) => setValues({ ...values, stateCode })} />
        </div>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
      <button disabled={isSaving} style={styles.button} type="submit">
        {isSaving ? 'Creating workspace...' : 'Create workspace'}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input style={styles.input} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    maxWidth: 760,
    background: '#fff',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow)',
    padding: 24,
    display: 'grid',
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 900,
  },
  subheading: {
    color: 'var(--text-muted)',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gap: 14,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
  },
  field: {
    display: 'grid',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    minHeight: 46,
    borderRadius: 8,
    border: '1px solid var(--border)',
    padding: '0 14px',
    background: '#fff',
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    fontWeight: 800,
  },
  error: {
    color: 'var(--danger)',
    fontSize: 14,
  },
};
