import type { Metadata } from 'next';
import { InvitesPage } from '@/components/invites/invites-page';

export const metadata: Metadata = { title: 'Invites' };

export default function Page() {
  return <InvitesPage />;
}
