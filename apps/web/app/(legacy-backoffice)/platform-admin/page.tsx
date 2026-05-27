import { redirect } from 'next/navigation';

export default function LegacyPlatformAdminPage() {
  redirect('/backoffice/platform/overview');
}
