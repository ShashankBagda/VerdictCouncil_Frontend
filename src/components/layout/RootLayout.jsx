import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Scale,
  Shield,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '../../hooks';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', exact: true, roles: ['judge', 'admin'] },
  { icon: FolderOpen, label: 'Cases', path: '/cases', roles: ['judge', 'admin'] },
  { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base', roles: ['judge'] },
  { icon: Inbox, label: 'Senior Inbox', path: '/senior-inbox', roles: ['senior_judge', 'admin'] },
  { icon: Shield, label: 'Domain Management', path: '/admin/domains', roles: ['admin'] },
];

function pageTitle(pathname) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/cases/intake')) return 'New Case';
  if (pathname.startsWith('/cases')) return 'Case Docket';
  if (pathname.startsWith('/case/')) return 'Case Workspace';
  if (pathname.startsWith('/knowledge-base')) return 'Knowledge Base';
  if (pathname.startsWith('/admin/domains')) return 'Domain Management';
  return 'VerdictCouncil';
}

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, isAuthenticated, isAuthResolved } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const userRole = user?.role || '';
  const isAdmin = userRole === 'admin';
  const roleLabel = userRole
    ? userRole.charAt(0).toUpperCase() + userRole.slice(1).replace('_', ' ')
    : null;
  const userInitials = user?.email ? user.email.split('@')[0].slice(0, 2).toUpperCase() : 'VC';
  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const title = pageTitle(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path, exact) => (exact ? location.pathname === path : location.pathname.startsWith(path));

  if (!isAuthResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex w-80 flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      <aside
        className={cn(
          'hidden shrink-0 border-r bg-background md:flex md:flex-col',
          sidebarOpen ? 'w-64' : 'w-[72px]',
        )}
        role="navigation"
        aria-label="Main Navigation"
      >
        <div className="flex h-14 items-center gap-3 px-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-card">
            <img src="/logo.png" alt="VerdictCouncil" className="size-7 object-contain" />
          </div>
          {sidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">VerdictCouncil</p>
              <p className="truncate text-xs text-muted-foreground">Judicial AI support</p>
            </div>
          )}
        </div>

        <Separator />

        <nav className="flex flex-1 flex-col gap-1 p-2">
          {allowedNav.map(({ icon: Icon, label, path, exact }) => {
            const active = isActive(path, exact);
            const button = (
              <Button
                key={path}
                type="button"
                variant={active ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start', !sidebarOpen && 'justify-center px-0')}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(path)}
              >
                {React.createElement(Icon, { 'data-icon': sidebarOpen ? 'inline-start' : undefined })}
                {sidebarOpen && <span className="truncate">{label}</span>}
              </Button>
            );

            if (sidebarOpen) return button;

            return (
              <Tooltip key={path}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <Separator />

        <div className="flex items-center gap-2 p-2">
          <Avatar size="sm">
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.email}</p>
              {roleLabel && <p className="text-xs text-muted-foreground">{roleLabel}</p>}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarOpen((value) => !value)}
          >
            {sidebarOpen ? <ChevronsLeft /> : <ChevronsRight />}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-3">
            <Scale className="hidden text-muted-foreground sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                Court operations workbench
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden gap-1.5 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-primary" />
              System live
            </Badge>
            {roleLabel && (
              <Badge variant={isAdmin ? 'secondary' : 'outline'} className="hidden sm:inline-flex">
                {roleLabel}
              </Badge>
            )}
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Notifications">
              <Bell />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="User menu"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate text-foreground">{user?.email}</span>
                  {roleLabel && <span className="block text-muted-foreground">{roleLabel}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => navigate('/')}>
                    <LayoutDashboard />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/cases')}>
                    <Database />
                    Case docket
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto" role="main" id="main-content">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default RootLayout;
