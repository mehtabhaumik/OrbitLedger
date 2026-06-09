import { notFound } from 'next/navigation';

import PlatformAdminConsole, { type PlatformAdminConsoleSection } from '@/components/backoffice/platform-admin-console';

const PLATFORM_SECTIONS: PlatformAdminConsoleSection[] = [
  'overview',
  'users',
  'admins',
  'billing-offers',
  'documents',
  'safety-controls',
  'reports',
  'audit',
];

export default async function BackofficePlatformSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!PLATFORM_SECTIONS.includes(section as PlatformAdminConsoleSection)) {
    notFound();
  }

  return <PlatformAdminConsole section={section as PlatformAdminConsoleSection} />;
}
