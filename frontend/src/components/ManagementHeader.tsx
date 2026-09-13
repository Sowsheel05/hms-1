import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, ChevronDown, RotateCw, Radio, Shield, QrCode } from 'lucide-react';
import { ManagementUser } from '../services/api';

interface ManagementHeaderProps {
  user: ManagementUser | null;
  onToggleMobileMenu: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isRealtimeConnected?: boolean;
  pageTitle?: string;
  pageSubtitle?: string;
}

export const ManagementHeader: React.FC<ManagementHeaderProps> = ({
  user,
  onToggleMobileMenu,
  onLogout,
  onRefresh,
  isRefreshing = false,
  isRealtimeConnected = true,
  pageTitle = 'Admin Dashboard',
  pageSubtitle = 'A concise operational overview of hostel activity.',
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isGirls = user?.role === 'CHIEF_WARDEN_GIRLS' || user?.blockName?.toLowerCase().includes('girls') || user?.name?.toLowerCase().includes('girls');
  const isBoys = user?.role === 'CHIEF_WARDEN_BOYS' || user?.blockName?.toLowerCase().includes('boys') || user?.name?.toLowerCase().includes('boys');

  const getInitials = () => {
    if (isGirls) return 'G';
    if (isBoys) return 'B';
    if (user?.role === 'ADMIN') return 'AD';
    if (!user?.name) return 'AD';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  };

  const getHeaderDisplayName = () => {
    if (isGirls) return 'Girls Hostel';
    if (isBoys) return 'Boys Hostel';
    return user?.name || 'Administrator';
  };

  const getHeaderRoleSubtitle = () => {
    if (user?.role === 'CHIEF_WARDEN_GIRLS' || user?.role === 'CHIEF_WARDEN_BOYS' || user?.role === 'CHIEF_WARDEN') {
      return 'Chief Warden';
    }
    if (user?.role === 'WARDEN') return 'Warden';
    if (user?.role === 'ADMIN') return 'Administrator';
    return formatRole(user?.role);
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Administrator';
    switch (role) {
      case 'ADMIN':
        return 'Administrator';
      case 'HOSTEL_ADMIN':
        return 'Hostel Administrator';
      case 'WARDEN':
        return 'Warden';
      case 'CHIEF_WARDEN':
        return 'Chief Warden';
      case 'CHIEF_WARDEN_BOYS':
        return 'Chief Warden (Boys)';
      case 'CHIEF_WARDEN_GIRLS':
        return 'Chief Warden (Girls)';
      case 'MAINTENANCE_STAFF':
        return 'Maintenance Staff';
      case 'MESS_STAFF':
        return 'Mess Staff';
      case 'STUDENT':
        return 'Student';
      default:
        return role.replace(/_/g, ' ');
    }
  };

  return (
    <header className="main-header management-header" aria-label="Admin Dashboard Top Bar">
      <div className="header-left-section">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="mobile-hamburger-btn"
          aria-label="Open management menu"
        >
          <Menu size={22} />
        </button>

        <div className="header-title-wrapper">
          <h1 className="header-page-title">{pageTitle}</h1>
          <p className="header-page-subtitle">{pageSubtitle}</p>
        </div>
      </div>

      <div className="header-right-section">
        {/* Real-time SSE Pulse Badge */}
        <div
          className={`realtime-badge ${isRealtimeConnected ? 'connected' : 'disconnected'}`}
          title={isRealtimeConnected ? 'Authoritative real-time SSE stream connected' : 'Connecting to real-time events...'}
        >
          <Radio size={13} className={isRealtimeConnected ? 'pulse-icon' : ''} />
          <span className="realtime-text">{isRealtimeConnected ? 'Live SSE' : 'Connecting'}</span>
        </div>

        {/* Sync / Refresh Button */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="sync-btn"
            title="Refresh dashboard metrics from PostgreSQL"
            aria-label="Refresh metrics"
          >
            <RotateCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="sync-btn-label">Sync</span>
          </button>
        )}

        {/* Biometric Quick-Scan Barcode Icon as seen in reference screenshots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            background: '#FFFFFF',
            color: '#475569',
            cursor: 'pointer',
          }}
          title="Biometric QR / Gate Scan Status"
          role="button"
          tabIndex={0}
          aria-label="Biometric Scanner Status"
        >
          <QrCode size={18} />
        </div>

        {/* Management User Profile Menu */}
        <div className="profile-dropdown-wrapper" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="profile-trigger-btn management-profile-trigger"
            aria-expanded={profileOpen}
            aria-haspopup="true"
            aria-label="Open administrator profile menu"
          >
            <div
              className="avatar-circle management-avatar-circle"
              style={{
                backgroundColor: isGirls ? '#4338CA' : isBoys ? '#2563EB' : '#151B54',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.95rem',
              }}
            >
              {getInitials()}
            </div>
            <div className="profile-text-desktop">
              <span className="profile-name" style={{ fontWeight: 600, color: '#0F172A' }}>
                {getHeaderDisplayName()}
              </span>
              <span className="profile-roll management-role-tag" style={{ color: '#64748B', fontSize: '0.78rem' }}>
                {getHeaderRoleSubtitle()}
              </span>
            </div>
            <ChevronDown size={14} className="profile-chevron" />
          </button>

          {profileOpen && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="dropdown-user-info">
                <div className="dropdown-user-name">{user?.name}</div>
                <div className="dropdown-user-email">{user?.jntuNo}</div>
                <div className={`dropdown-user-badge ${user?.role === 'WARDEN' || user?.role?.includes('CHIEF_WARDEN') ? 'role-badge-warden' : 'role-badge-admin'}`}>
                  <Shield size={12} style={{ marginRight: 4 }} />
                  {formatRole(user?.role)}
                </div>
                {user?.blockName && (
                  <div className="dropdown-user-sub">Assigned: {user.blockName}</div>
                )}
              </div>

              <div className="dropdown-menu-divider" />

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="dropdown-menu-item dropdown-logout-item"
                role="menuitem"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
