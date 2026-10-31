import type { Metadata } from 'next';
import { EmbedsPage } from '@/components/embeds/embeds-page';

export const metadata: Metadata = { title: 'Embeds' };

export default function Page() {
  return <EmbedsPage />;
}
