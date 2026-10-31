import {
  FolderIcon,
  type LucideIcon,
  TicketIcon,
  UserIcon,
  WandSparklesIcon
} from 'lucide-react';
import type { Route } from 'next';

export interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Files', icon: FolderIcon, adminOnly: false },
  { href: '/invites', label: 'Invites', icon: TicketIcon, adminOnly: true },
  {
    href: '/sharex',
    label: 'ShareX',
    icon: WandSparklesIcon,
    adminOnly: false
  },
  { href: '/account', label: 'Account', icon: UserIcon, adminOnly: false }
];

export function activeItem(pathname: string) {
  return NAV_ITEMS.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  );
}
