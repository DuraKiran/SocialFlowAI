'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getNotifications } from '@/lib/store';
import { workspaceName } from '@/lib/workspace';
import type { Notification } from '@/lib/types';
import {
  LayoutDashboard,
  UploadCloud,
  Files,
  CalendarRange,
  Sparkles,
  Scissors,
  Calendar,
  FolderOpen,
  Send,
  BarChart3,
  Link2,
  Bell,
  Settings,
  Zap,
  LogOut,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/publish', label: 'Publish Video', icon: UploadCloud },
  { href: '/dashboard/bulk-upload', label: 'Bulk Upload', icon: Files },
  { href: '/dashboard/scheduler', label: 'Bulk Scheduler', icon: CalendarRange },
  { href: '/dashboard/ai-studio', label: 'AI Content Studio', icon: Sparkles },
  { href: '/dashboard/clips', label: 'Clip Studio', icon: Scissors },
  { href: '/dashboard/calendar', label: 'Content Calendar', icon: Calendar },
  { href: '/dashboard/library', label: 'Media Library', icon: FolderOpen },
  { href: '/dashboard/posts', label: 'Published Posts', icon: Send },
  { href: '/dashboard/analytics', label: 'Video Analytics', icon: BarChart3 },
  { href: '/dashboard/accounts', label: 'Connected Accounts', icon: Link2 },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [wsName, setWsName] = useState('');

  useEffect(() => {
    if (!loading && !session) router.replace('/auth');
  }, [loading, session, router]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const refresh = async () => {
      const items = (await getNotifications(session.userId)) as Notification[];
      if (active) setUnread(items.filter((n) => !n.read).length);
      setWsName(await workspaceName(session.workspaceId));
    };
    void refresh();
    const t = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [session, pathname]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-800/60 bg-slate-900/50 md:flex">
          <div className="flex h-16 items-center gap-2 border-b border-slate-800/60 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Zap className="h-4 w-4 text-cyan-400" />
            </div>
            <span className="font-semibold">SocialFlow AI</span>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV.map((item) => {
              const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.label === 'Notifications' && unread > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 rounded-full bg-cyan-500 px-1 text-[10px] text-slate-950">
                      {unread > 99 ? '99+' : unread}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-800/60 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800/60">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-semibold text-cyan-300">
                    {session.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{session.name}</div>
                    <div className="truncate text-xs text-slate-500">{wsName || 'Workspace'}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>{session.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:pl-60">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800/60 bg-slate-950/80 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-3 md:hidden">
              <Zap className="h-5 w-5 text-cyan-400" />
              <span className="font-semibold">SocialFlow</span>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link href="/dashboard/notifications">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-400" />
                  )}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="md:hidden" onClick={signOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-slate-800/60 bg-slate-950/95 px-2 py-1 backdrop-blur md:hidden">
        {NAV.slice(0, 6).map((item) => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-[64px] flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px]',
                active ? 'text-cyan-300' : 'text-slate-500'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}
