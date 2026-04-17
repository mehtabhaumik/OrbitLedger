import type { ReactNode } from 'react';

import { Card } from './Card';
import { Section } from './Section';

type FormSectionProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'tax' | 'premium';
};

export function FormSection({ title, subtitle, action, children, accent }: FormSectionProps) {
  return (
    <Section title={title} subtitle={subtitle} action={action}>
      <Card accent={accent}>{children}</Card>
    </Section>
  );
}
