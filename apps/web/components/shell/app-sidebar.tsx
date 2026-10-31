'use client';

import type { Account } from '@triton/shared';
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  ShieldIcon,
  UploadIcon,
  UserIcon
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentAccount } from '@/components/account-context';
import { Logo } from '@/components/logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUploads } from '@/components/uploads/upload-context';
import { UserAvatar } from '@/components/user-avatar';
import { formatBytes, plural } from '@/lib/format';
import { activeItem, NAV_ITEMS } from './navigation';
import { useSignOut } from './use-sign-out';

function UserPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
    >
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <span className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-14" />
      </span>
    </div>
  );
}

function UserMenu({ account }: { account: Account }) {
  const router = useRouter();
  const signOut = useSignOut();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            className="data-popup-open:bg-sidebar-accent"
          />
        }
      >
        <UserAvatar username={account.user.username} />
        <span className="grid flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">
            {account.user.username}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {account.user.role === 'admin' ? 'Admin' : 'Member'}
          </span>
        </span>
        <ChevronsUpDownIcon className="text-muted-foreground ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? 'top' : 'right'}
        align="end"
        className="w-60"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-muted-foreground font-normal">
            {plural(account.usage.files, 'file')} ·{' '}
            {formatBytes(account.usage.bytes)}
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              setOpenMobile(false);
              router.push('/account');
            }}
          >
            <UserIcon />
            Account
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const account = useCurrentAccount();
  const pathname = usePathname();
  const { pick } = useUploads();
  const { setOpenMobile } = useSidebar();
  const active = activeItem(pathname);
  const admin = account !== null && account.user.role === 'admin';

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              onClick={() => setOpenMobile(false)}
            >
              <Logo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Upload"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  onClick={() => {
                    setOpenMobile(false);
                    pick();
                  }}
                >
                  <UploadIcon />
                  <span>Upload files</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) =>
                item.adminOnly && account === null ? (
                  <SidebarMenuItem key={item.href} aria-hidden="true">
                    <div className="flex h-8 items-center gap-2 px-2">
                      <Skeleton className="size-4 rounded-md" />
                      <Skeleton className="h-4 w-16 group-data-[collapsible=icon]:hidden" />
                    </div>
                  </SidebarMenuItem>
                ) : item.adminOnly && !admin ? null : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={active === item}
                      render={<Link href={item.href} />}
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      {item.adminOnly ? (
                        <ShieldIcon className="text-muted-foreground ml-auto size-3.5" />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {account === null ? (
              <UserPlaceholder />
            ) : (
              <UserMenu account={account} />
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
