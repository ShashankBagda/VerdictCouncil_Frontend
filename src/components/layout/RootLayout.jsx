import React from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  FolderOpen,
  Database,
  Shield,
  Scale,
  Bell,
  BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', exact: true, roles: ['judge', 'admin'] },
  { icon: FolderOpen, label: 'Cases', path: '/cases', roles: ['judge', 'admin'] },
  { icon: BookOpen, label: 'Knowledge Base', path: '/knowledge-base', roles: ['judge'] },
  { icon: Shield, label: 'Domain Management', path: '/admin/domains', roles: ['admin'] },
];

export function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, isAuthenticated, isAuthResolved } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const userRole = user?.role || '';
  const isAdmin = userRole === 'admin';
  const roleLabel = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1).replace('_', ' ') : null;

  const userInitials = user?.email
    ? user.email.split('@')[0].slice(0, 2).toUpperCase()
    : 'VC';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path, exact) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  if (!isAuthResolved) {
    return (
      <div className="flex h-screen items-center justify-center animated-gradient-bg">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-teal-500/30 animate-ping-slow" />
            <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
          </div>
          <p className="text-white/70 font-medium">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-[72px]'} shrink-0 flex flex-col transition-all duration-300 ease-in-out relative`}
        style={{
          background: 'linear-gradient(180deg, #0d1520 0%, #1a2332 50%, #0e2a3a 100%)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
        }}
        role="navigation"
        aria-label="Main Navigation"
      >
        {/* Decorative glow line */}
        <div className="absolute top-0 right-0 w-px h-full bg-linear-to-b from-transparent via-teal-500/30 to-transparent" />

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-5 min-h-[80px]">
          <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-white shadow-glow-teal">
            <img src="/logo.png" alt="VerdictCouncil" className="w-full h-full object-contain" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="font-bold text-white text-base leading-tight tracking-wide">VerdictCouncil</h1>
              <p className="text-teal-400/70 text-xs">AI Judicial Platform</p>
            </div>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-[76px] w-6 h-6 rounded-full bg-navy-800 border border-navy-600 flex items-center justify-center text-white/60 hover:text-white hover:border-teal-500 transition-all duration-200 z-10 shadow-lg"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-hidden">
          {sidebarOpen && (
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-3 pb-2 animate-fade-in">
              Navigation
            </p>
          )}
          {allowedNav.map(({ icon: Icon, label, path, exact }) => {
            const active = isActive(path, exact);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                title={!sidebarOpen ? label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  active
                    ? 'bg-linear-to-r from-teal-600/30 to-teal-500/10 text-white border border-teal-500/30'
                    : 'text-white/50 hover:bg-white/8 hover:text-white/90'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-linear-to-b from-teal-400 to-cyan-300 rounded-r-full" />
                )}
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${active ? 'text-teal-400' : 'text-white/40 group-hover:text-white/80'}`}
                />
                {sidebarOpen && (
                  <span className="text-sm font-medium truncate animate-fade-in">{label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div className="px-3 pb-5 pt-2 border-t border-white/8 space-y-1">
          {/* User avatar row */}
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 mb-1 animate-fade-in">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow">
                {userInitials}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-semibold truncate">{user?.email}</p>
                {roleLabel && (
                  <p className="text-teal-400/70 text-[10px] font-medium">{roleLabel}</p>
                )}
              </div>
            </div>
          ) : (
            <div title={user?.email} className="flex items-center justify-center mb-1">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow">
                {userInitials}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title="Logout"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 group"
          >
            <LogOut size={17} className="shrink-0 group-hover:scale-110 transition-transform" />
            {sidebarOpen && <span className="text-sm font-medium animate-fade-in">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header
          className="shrink-0 flex items-center justify-between px-6 py-3 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10"
          style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
          role="banner"
        >
          {/* Breadcrumb / page title */}
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-teal-600" />
            <span className="text-navy-900 font-semibold text-sm">
              {location.pathname === '/' ? 'Dashboard' :
               location.pathname.startsWith('/cases/intake') ? 'New Case' :
               location.pathname.startsWith('/cases') ? 'Case Docket' :
               location.pathname.startsWith('/case/') ? 'Case Workspace' :
               location.pathname.startsWith('/knowledge-base') ? 'Knowledge Base' :
               location.pathname.startsWith('/admin/domains') ? 'Domain Management' :
               'VerdictCouncil'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 text-xs font-semibold">System Live</span>
            </div>

            {/* Role badge */}
            {roleLabel && (
              <span
                className={`hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                  isAdmin
                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                    : 'bg-teal-50 text-teal-700 border-teal-200'
                }`}
              >
                {roleLabel}
              </span>
            )}

            {/* Notification bell */}
            <button className="relative p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <Bell size={17} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-teal-500" />
            </button>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-auto"
          role="main"
          id="main-content"
        >
          <div className="max-w-7xl mx-auto px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default RootLayout;
