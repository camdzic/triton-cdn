import { DashboardShell } from '@/components/shell/dashboard-shell';

export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return <DashboardShell>{children}</DashboardShell>;
}
