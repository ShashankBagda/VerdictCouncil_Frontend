import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { Menu, LogOut, Home, FileText, Users, Settings, Database } from 'lucide-react';

export function RootLayout() {
  const navigate = useNavigate();
  const { logout, user, hasAnyRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const roleLabel = user?.role
    ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Authenticated User';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-navy-900 text-white transition-all duration-300 flex flex-col`}
        role="navigation"
        aria-label="Main Navigation"
      >
        {/* Logo area */}
        <div className="flex items-center justify-between p-4 border-b border-navy-700">
          <h1 className={`font-bold text-lg ${!sidebarOpen && 'hidden'}`}>
            VerdictCouncil
          </h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-navy-800 rounded"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-2">
          <NavItem
            icon={<Home size={20} />}
            label="Dashboard"
            onClick={() => navigate('/')}
            show={sidebarOpen}
          />
          <NavItem
            icon={<FileText size={20} />}
            label="Cases"
            onClick={() => navigate('/cases')}
            show={sidebarOpen}
          />
          <NavItem
            icon={<Users size={20} />}
            label="Escalated Cases"
            onClick={() => navigate('/escalated-cases')}
            show={sidebarOpen}
          />
          {hasAnyRole(['admin', 'senior_judge']) && (
            <NavItem
              icon={<Database size={20} />}
              label="Knowledge Base"
              onClick={() => navigate('/knowledge-base')}
              show={sidebarOpen}
            />
          )}
          <NavItem
            icon={<Settings size={20} />}
            label="Settings"
            onClick={() => {}}
            show={sidebarOpen}
          />
        </nav>

        {/* User profile */}
        <div className="border-t border-navy-700 p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-2 hover:bg-navy-800 rounded transition-colors"
            aria-label={`Logout ${user?.email || 'user'}`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 p-4 shadow-sm flex items-center justify-between" role="banner">
          <h1 className="text-2xl font-bold text-navy-900">VerdictCouncil</h1>
          <div className="text-sm text-gray-600 flex items-center gap-3" role="status">
            {user?.role && (
              <span className="px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
                {roleLabel}
              </span>
            )}
            {user?.email && (
              <span>
                Logged in as <strong>{user.email}</strong>
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-auto"
          role="main"
          id="main-content"
        >
          <div className="max-w-7xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, onClick, show }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-navy-800 transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-navy-900"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{icon}</span>
      {show && <span>{label}</span>}
    </button>
  );
}

export default RootLayout;
