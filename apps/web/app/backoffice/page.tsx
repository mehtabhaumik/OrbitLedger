import { redirect } from 'next/navigation';

export default function BackofficeIndexPage() {
  redirect('/backoffice/operations/overview');
}
