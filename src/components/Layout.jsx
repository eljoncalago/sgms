import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  PenTool,
  FileText,
  Printer,
  QrCode,
  Link2,
  Upload,
  Settings as SettingsIcon,
  History,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Sidebar navigation — matches Plan Part 3 §3 (Sidebar.tsx) specification.
 * Plan requires: Dashboard, Students, Activities, Scores, Reports, Print Reports,
 * Audit Log, Import/Export, Settings.
 * Also includes QR Codes and QR Pairing from the QR system spec.
 *
 * FIX (original): /qr-pairing was missing from menuItems.
 * ADDED: /print-reports and /import-export per plan Pages 10 & 12.
 */
const menuItems = [
  { path: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { path: '/students',      label: 'Students',        icon: Users },
  { path: '/activities',    label: 'Activities',      icon: ClipboardList },
  { path: '/scores',        label: 'Score Entry',     icon: PenTool },
  { path: '/reports',       label: 'Reports',         icon: FileText },
  { path: '/print-reports', label: 'Print Reports',   icon: Printer },
  { path: '/qr-generate',   label: 'QR Codes',        icon: QrCode },
  { path: '/qr-pairing',    label: 'QR Pairing',      icon: Link2 },
  { path: '/import-export', label: 'Import / Export', icon: Upload },
  { path: '/audit',         label: 'Audit Log',       icon: History },
  { path: '/settings',      label: 'Settings',        icon: SettingsIcon },
];

const NavLinks = ({ onClose }) => {
  const location = useLocation();
  return (
    <>
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
              isActive
                ? 'bg-blue-50 text-blue-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
};

const Layout = () => {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar – Desktop ── */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-5 border-b border-gray-200 flex items-center gap-3">
          <div className="p-1.5 bg-blue-600 rounded-lg flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-600 leading-none">SGMS</h1>
            <p className="text-xs text-gray-400 leading-none mt-0.5">Grade Management</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-2 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {admin?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-gray-900 truncate">{admin?.name}</p>
              <p className="text-xs text-gray-400">Administrator</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Mobile Sidebar ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white flex flex-col shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-blue-600 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-blue-600">SGMS</h1>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="p-1">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              <NavLinks onClose={() => setMobileMenuOpen(false)} />
            </nav>

            <div className="p-3 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2 mb-2 px-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                  {admin?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{admin?.name}</p>
                  <p className="text-xs text-gray-400">Administrator</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Top Bar – Mobile */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="p-1">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-600 rounded-md">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-blue-600">SGMS</h1>
          </div>
          <div className="w-7" />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
