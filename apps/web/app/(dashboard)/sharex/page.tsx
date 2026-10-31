import type { Metadata } from 'next';
import { SharexPage } from '@/components/sharex/sharex-page';

export const metadata: Metadata = { title: 'ShareX' };

export default function Page() {
  return <SharexPage />;
}
