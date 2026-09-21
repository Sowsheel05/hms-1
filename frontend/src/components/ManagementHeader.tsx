import React, { useState, useRef, useEffect } from 'react';
import { Menu, LogOut, ChevronDown, RotateCw, Radio, Shield, Building2, Check } from 'lucide-react';
import { ManagementUser, CollegeItem, managementApiService } from '../services/api';

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
  const [collegeDropdownOpen, setCollegeDropdownOpen] = useState(false);
  const [colleges, setColleges] = useState<CollegeItem[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<CollegeItem | null>(null);
  const [isCollegesLoading, setIsCollegesLoading] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const collegeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (collegeMenuRef.current && !collegeMenuRef.current.contains(e.target as Node)) {
        setCollegeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMultiCollegeUser = user?.role === 'SUPPORT_ADMIN' || user?.role === 'ADMIN' || user?.role === 'COLLEGE_DIRECTOR';

  useEffect(() => {
    if (!isMultiCollegeUser) return;
    let isMounted = true;
    setIsCollegesLoading(true);

    managementApiService
      .getColleges()
      .then((res) => {
        if (isMounted && res.success && res.colleges.length > 0) {
          setColleges(res.colleges);
          const savedCode = localStorage.getItem('hms_active_college_code');
          const matched = res.colleges.find((c) => c.code === savedCode);
          const primary = res.colleges.find((c) => c.isPrimary) || res.colleges[0];
          setSelectedCollege(matched || primary);
          if (!savedCode && primary) {
            localStorage.setItem('hms_active_college_code', primary.code);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load multi-college list:', err);
      })
      .finally(() => {
        if (isMounted) setIsCollegesLoading(false);
      });
  }, [isMultiCollegeUser]);

  const handleSelectCollege = (college: CollegeItem) => {
    setSelectedCollege(college);
    localStorage.setItem('hms_active_college_code', college.code);
    setCollegeDropdownOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hms_college_changed'));
    }
    if (onRefresh) onRefresh();
  };

  const isGirls = user?.role === 'CHIEF_WARDEN_GIRLS' || user?.blockName?.toLowerCase().includes('girls') || user?.name?.toLowerCase().includes('girls');
  const isBoys = user?.role === 'CHIEF_WARDEN_BOYS' || user?.blockName?.toLowerCase().includes('boys') || user?.name?.toLowerCase().includes('boys');

  const getInitials = () => {
    if (isGirls) return 'G';
    if (isBoys) return 'B';
    if (user?.role === 'SUPPORT_ADMIN') return 'SA';
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
    if (user?.role === 'SUPPORT_ADMIN') return 'Multi-College Support Admin';
    if (user?.role === 'CHIEF_WARDEN_GIRLS' || user?.role === 'CHIEF_WARDEN_BOYS' || user?.role === 'CHIEF_WARDEN') {
      return 'Chief Warden';
    }
    if (user?.role === 'WARDEN') return 'Warden';
    if (user?.role === 'ADMIN') return 'College Director / Administrator';
    return formatRole(user?.role);
  };

  const formatRole = (role?: string) => {
    if (!role) return 'College Director / Administrator';
    switch (role) {
      case 'SUPPORT_ADMIN':
        return 'Multi-College Tech Support Admin';
      case 'ADMIN':
        return 'College Director / Administrator';
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

        <div className="header-title-wrapper desktop-header-title">
          <h1 className="header-page-title">{pageTitle}</h1>
          <p className="header-page-subtitle">{pageSubtitle}</p>
        </div>
      </div>

      <div className="header-right-section" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Multi-College Selector Dropdown (for Support Admin & Administrators) */}
        {isMultiCollegeUser && (
          <div className="college-dropdown-wrapper" ref={collegeMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setCollegeDropdownOpen((prev) => !prev)}
              className="desktop-header-control"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.75rem',
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#1E293B',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              title="Switch active managed college campus in PostgreSQL"
            >
              <Building2 size={16} style={{ color: '#2563EB' }} />
              <span className="college-name-text" style={{ maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCollege ? selectedCollege.name : isCollegesLoading ? 'Loading Campus...' : 'All Campuses'}
              </span>
              <ChevronDown size={14} style={{ color: '#64748B' }} />
            </button>

            {collegeDropdownOpen && (
              <div
                className="college-dropdown-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  width: '295px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '0.5rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #E2E8F0',
                  padding: '0.5rem',
                  zIndex: 100,
                }}
              >
                <div style={{ padding: '0.375rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Managed PostgreSQL Campuses ({colleges.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                  {colleges.map((col) => {
                    const isSelected = selectedCollege?.id === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => handleSelectCollege(col)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '0.5rem 0.625rem',
                          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                          border: 'none',
                          borderRadius: '0.375rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1E40AF' : '#1E293B' }}>
                            {col.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            {col.code} • {col.location || 'Campus'}
                          </span>
                        </div>
                        {isSelected && <Check size={16} style={{ color: '#2563EB', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time SSE Pulse Badge */}
        <div
          className={`realtime-badge desktop-header-control ${isRealtimeConnected ? 'connected' : 'disconnected'}`}
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
            className="sync-btn desktop-header-control"
            title="Refresh dashboard metrics from PostgreSQL"
            aria-label="Refresh metrics"
          >
            <RotateCw size={16} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="sync-btn-label">Sync</span>
          </button>
        )}

        {/* Management User Profile Menu */}
        <div className="profile-dropdown-wrapper" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            className="profile-trigger-btn management-profile-trigger"
            aria-expanded={profileOpen}
            aria-haspopup="true"
            aria-label="Open profile menu"
          >
            <div
              className="avatar-circle management-avatar-circle"
              style={{
                backgroundColor: user?.role === 'SUPPORT_ADMIN' ? '#047857' : isGirls ? '#4338CA' : isBoys ? '#2563EB' : '#151B54',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.95rem',
                flexShrink: 0,
              }}
            >
              {getInitials()}
            </div>
            <div className="profile-text-desktop" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', justifyContent: 'center' }}>
              <span className="profile-name" style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.85rem', lineHeight: '1.2' }}>
                {getHeaderDisplayName()}
              </span>
              <span className="profile-roll management-role-tag" style={{ color: '#64748B', fontSize: '0.75rem', lineHeight: '1.2', marginTop: '2px' }}>
                {getHeaderRoleSubtitle()}
              </span>
            </div>
            <ChevronDown size={14} className="profile-chevron" style={{ marginLeft: '4px' }} />
          </button>

          {profileOpen && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="dropdown-user-info">
                <div className="dropdown-user-name" style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0F172A' }}>
                  {user?.name}
                </div>
                <div className="dropdown-user-email" style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                  {user?.jntuNo}
                </div>
                <div className={`dropdown-user-badge ${user?.role === 'SUPPORT_ADMIN' ? 'role-badge-admin' : user?.role === 'WARDEN' || user?.role?.includes('CHIEF_WARDEN') ? 'role-badge-warden' : 'role-badge-admin'}`}>
                  <Shield size={12} style={{ marginRight: 4 }} />
                  {formatRole(user?.role)}
                </div>
                {user?.blockName && (
                  <div className="dropdown-user-sub" style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
                    Assigned: {user.blockName}
                  </div>
                )}
              </div>

              <div className="dropdown-menu-divider" style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '0.5rem 0' }} />

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="dropdown-signout-btn"
                role="menuitem"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#DC2626',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
