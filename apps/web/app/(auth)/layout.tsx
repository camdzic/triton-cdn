import { Logo } from '@/components/logo';
import { GuestGate } from './guest-gate';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
      />
      <header className="relative flex items-center px-4 py-4 sm:px-6">
        <Logo />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:px-6">
        <GuestGate>{children}</GuestGate>
      </main>
    </div>
  );
}
