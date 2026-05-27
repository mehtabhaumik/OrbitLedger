import { redirect } from 'next/navigation';

export default function LegacyOfficeOperationsPage() {
  redirect('/backoffice/operations/overview');
}
