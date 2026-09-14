import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Bed,
  UtensilsCrossed,
  Footprints,
  AlertCircle,
  FileText,
  Bell,
  LogOut,
  X,
  Building2,
} from 'lucide-react';
import { APP_BRANDING } from '../config/branding';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { id: 'room', label: 'My Room', path: '/my-room', icon: Bed },
  { id: 'hostel-application', label: 'Hostel Application', path: '/hostel-application', icon: Building2 },
  { id: 'mess', label: 'Mess Tokens', path: '/mess-tokens', icon: UtensilsCrossed },
  { id: 'outings', label: 'Outing Requests', path: '/outing-requests', icon: Footprints },
  { id: 'complaints', label: 'Complaints', path: '/complaints', icon: AlertCircle },
  { id: 'leaves', label: 'Leaves & Suspension', path: '/leaves', icon: FileText },
  { id: 'notifications', label: 'Notifications', path: '/notifications', icon: Bell },
];

interface SidebarProps {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  isOpen,
  onClose,
  onNavigate,
  onLogout,
}) => {
  // Lock body scroll on mobile when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleItemClick = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`dashboard-sidebar ${isOpen ? 'drawer-open' : ''}`}
        aria-label="Hostel Navigation"
      >
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-group">
            <div className="sidebar-brand-icon" aria-hidden="true">
              <Building2 size={20} />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">{APP_BRANDING.appName}</span>
              <span className="sidebar-brand-sub student-portal-badge">STUDENT PORTAL</span>
            </div>
          </div>

          <button
            className="mobile-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.path)}
                className={`sidebar-nav-item nav-item-${item.id} ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`nav-item-icon nav-icon-${item.id}`} aria-hidden="true">
                  <Icon size={19} />
                </span>
                <span className="nav-item-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with Logout */}
        <div className="sidebar-footer">
          <button
            type="button"
            onClick={onLogout}
            className="sidebar-logout-btn"
            aria-label="Log out"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};
