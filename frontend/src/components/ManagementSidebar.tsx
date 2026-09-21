import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Building,
  BedDouble,
  UtensilsCrossed,
  Footprints,
  Wrench,
  History,
  ClipboardList,
  Users,
  Receipt,
  FileText,
  Bell,
  CreditCard,
  Landmark,
  LogOut,
  X,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useManagementAuth } from '../context/ManagementAuthContext';
import { APP_BRANDING } from '../config/branding';

export interface ManagementNavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isAvailable: boolean;
}

export const MANAGEMENT_NAV_ITEMS: ManagementNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/management/dashboard', icon: LayoutDashboard, isAvailable: true },
  { id: 'hostel-applications', label: 'Hostel Applications', path: '/management/hostel-applications', icon: ClipboardList, isAvailable: true },
  { id: 'blocks', label: 'Block Management', path: '/management/blocks', icon: Building, isAvailable: true },
  { id: 'rooms', label: 'Room Allocation', path: '/management/rooms', icon: BedDouble, isAvailable: true },
  { id: 'mess', label: 'Mess Management', path: '/management/mess', icon: UtensilsCrossed, isAvailable: true },
  { id: 'outings', label: 'Outing Approvals', path: '/management/outings', icon: Footprints, isAvailable: true },
  { id: 'leaves', label: 'Leaves & Suspension', path: '/management/leaves', icon: FileText, isAvailable: true },
  { id: 'complaints', label: 'Complaints & Maintenance', path: '/management/complaints', icon: Wrench, isAvailable: true },
  { id: 'logs', label: 'Log History', path: '/management/log-history', icon: History, isAvailable: true },
  { id: 'outing-logs', label: 'Outing Log History', path: '/management/outing-logs', icon: ClipboardList, isAvailable: true },
  { id: 'users', label: 'User Management', path: '/management/users', icon: Users, isAvailable: true },
  { id: 'billing', label: 'Guest Billing', path: '/management/guest-billing', icon: Receipt, isAvailable: true },
  { id: 'fee-management', label: 'Fee Management', path: '/management/fee-management', icon: CreditCard, isAvailable: true },
  { id: 'fee-collection', label: 'Fee Collection', path: '/management/fee-collection', icon: Landmark, isAvailable: true },
  { id: 'notifications', label: 'Notifications', path: '/management/notifications', icon: Bell, isAvailable: true },
];

interface ManagementSidebarProps {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onDisabledNotice?: (label: string) => void;
}

export const ManagementSidebar: React.FC<ManagementSidebarProps> = ({
  currentPath,
  isOpen,
  onClose,
  onNavigate,
  onLogout,
  onDisabledNotice,
}) => {
  const { user } = useManagementAuth();
  const isOfficeStaff = user?.role === 'OFFICE_STAFF' || user?.role === 'FINANCE_OFFICER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPPORT_ADMIN' || user?.role === 'HOSTEL_ADMIN' || user?.role === 'COLLEGE_DIRECTOR';
  const isWarden = !isAdmin && (user?.role === 'WARDEN' || user?.role === 'CHIEF_WARDEN' || user?.role === 'CHIEF_WARDEN_BOYS' || user?.role === 'CHIEF_WARDEN_GIRLS' || user?.role === 'WARDEN_BOYS' || user?.role === 'WARDEN_GIRLS');

  const visibleNavItems = MANAGEMENT_NAV_ITEMS.filter((item) => {
    if (isOfficeStaff) {
      return ['dashboard', 'fee-management', 'fee-collection', 'billing'].includes(item.id);
    }
    if (isWarden) {
      // Remove admin-only system config modules for wardens
      return !['fee-management', 'fee-collection', 'users'].includes(item.id);
    }
    return true;
  });

  const getPortalBadgeText = () => {
    if (isOfficeStaff) return 'OFFICE FEE CONSOLE';
    if (user?.role === 'CHIEF_WARDEN_BOYS' || user?.role === 'WARDEN_BOYS') return 'BOYS WARDEN PORTAL';
    if (user?.role === 'CHIEF_WARDEN_GIRLS' || user?.role === 'WARDEN_GIRLS') return 'GIRLS WARDEN PORTAL';
    if (isWarden) return 'WARDEN PORTAL';
    if (user?.role === 'SUPPORT_ADMIN') return 'TECH SUPPORT PORTAL';
    if (user?.role === 'HOSTEL_ADMIN' || user?.role === 'COLLEGE_DIRECTOR') return 'DIRECTOR PORTAL';
    return 'ADMIN PORTAL';
  };

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

  const handleItemClick = (item: ManagementNavItem) => {
    if (!item.isAvailable) {
      if (onDisabledNotice) {
        onDisabledNotice(item.label);
      }
      return;
    }
    onNavigate(item.path);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`dashboard-sidebar management-sidebar ${isOpen ? 'drawer-open' : ''}`}
        aria-label="Admin Navigation"
      >
        {/* Sidebar Header with Institutional Branding */}
        <div className="sidebar-header management-sidebar-header">
          <div className="sidebar-brand-group">
            <div className="sidebar-brand-icon management-brand-icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">{APP_BRANDING.appName}</span>
              <span className="sidebar-brand-sub management-portal-badge">
                {getPortalBadgeText()}
              </span>
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

        {/* 13 Admin Navigation Items */}
        <nav className="sidebar-nav management-sidebar-nav" aria-label="Admin Modules">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.isAvailable && (
              currentPath === item.path ||
              (item.path === '/management/dashboard' && currentPath === '/management') ||
              (item.id === 'outing-logs' && (currentPath === '/management/outing-logs' || currentPath === '/management/outing-log-history'))
            );

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`sidebar-nav-item management-nav-item ${isActive ? 'active' : ''} ${!item.isAvailable ? 'disabled-nav-item' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={!item.isAvailable}
                title={!item.isAvailable ? `${item.label} (Scheduled for future module)` : item.label}
              >
                <span className="nav-item-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="nav-item-label">{item.label}</span>
                {!item.isAvailable && (
                  <span className="nav-item-badge disabled-pill">
                    <Lock size={10} style={{ marginRight: 2 }} />
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Admin Logout */}
        <div className="sidebar-footer management-sidebar-footer">
          <button
            type="button"
            onClick={onLogout}
            className="sidebar-logout-btn management-logout-btn"
            aria-label="Log out of admin portal"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
