import { notFound } from 'next/navigation';

import OperationsConsole, { type OperationsConsoleSection } from '@/components/backoffice/operations-console';

const OPERATION_SECTIONS: OperationsConsoleSection[] = [
  'overview',
  'support-inbox',
  'assignments',
  'access-requests',
  'diagnostics-consent',
  'exports-reports',
  'audit',
];

export default async function BackofficeOperationsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!OPERATION_SECTIONS.includes(section as OperationsConsoleSection)) {
    notFound();
  }

  return <OperationsConsole section={section as OperationsConsoleSection} />;
}
