import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Receipt,
  GraduationCap,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';


interface UnifiedLoginPageProps {
  onLoginSuccess: (userRole: string, token: string) => void;
  onNavigateToRegister: () => void;
}

interface DemoCredential {
  roleLabel: string;
  roleBadge: string;
  username: string;
  passwordHint: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color: string;
  bgLight: string;
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    roleLabel: 'Student Portal',
    roleBadge: 'STUDENT',
    username: '25331A05H7',
    passwordHint: 'Password@123',
    description: 'Girls Block B (Room 119) — MANI MANASVI GAVARA',
    icon: GraduationCap,
    color: '#2563EB',
    bgLight: '#EFF6FF',
  },
  {
    roleLabel: 'Warden (Boys)',
    roleBadge: 'WARDEN_BOYS',
    username: 'WARDEN_BOYS',
    passwordHint: 'Password@123',
    description: 'Boys Hostel — Outings, Leaves & Block Management',
    icon: Building2,
    color: '#0D9488',
    bgLight: '#CCFBF1',
  },
  {
    roleLabel: 'Warden (Girls)',
    roleBadge: 'WARDEN_GIRLS',
    username: 'WARDEN_GIRLS',
    passwordHint: 'Password@123',
    description: 'Girls Hostel — Outings, Leaves & Block Management',
    icon: Building2,
    color: '#DB2777',
    bgLight: '#FCE7F3',
  },
  {
    roleLabel: 'Main Admin',
    roleBadge: 'ADMIN',
    username: 'ADMIN_MAIN',
    passwordHint: 'Password@123',
    description: 'Chief Warden — Full Management Portal Control',
    icon: ShieldCheck,
    color: '#4F46E5',
    bgLight: '#EEF2FF',
  },
  {
    roleLabel: 'Office Staff (Fees)',
    roleBadge: 'OFFICE_STAFF',
    username: 'OFFICE_STAFF',
    passwordHint: 'Password@123',
    description: 'Finance Office — Fee Structure & Fee Collection Only',
    icon: Receipt,
    color: '#D97706',
    bgLight: '#FEF3C7',
  },
];

export const UnifiedLoginPage: React.FC<UnifiedLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDemoRole, setSelectedDemoRole] = useState<string | null>(null);

  const handleSelectDemo = (cred: DemoCredential) => {
    setIdentifier(cred.username);
    setPassword(cred.passwordHint);
    setSelectedDemoRole(cred.roleBadge);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your Username or JNTU No.');
      return;
    }
    if (!password) {
      setError('Please enter your Password.');
      return;
    }

    setLoading(true);
    setError(null);

    const safeParseJson = async (res: Response) => {
      try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    };

    try {
      // First attempt authentication via management endpoint (for staff/wardens/admin)
      let response = await fetch('/api/management/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password }),
      }).catch(() => null);

      if (!response) {
        throw new Error('Backend server connection failed. Please ensure the backend server is running on port 5001.');
      }

      let data = await safeParseJson(response);

      // If management login returned 403 (student attempting management login) or invalid management response, try student login
      if (!response.ok || !data || (data.message && (data.message.includes('Student accounts') || data.message.includes('Invalid management')))) {
        const studentRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jntuNo: identifier, password }),
        }).catch(() => null);

        if (studentRes) {
          const studentData = await safeParseJson(studentRes);
          if (studentRes.ok && studentData?.success) {
            response = studentRes;
            data = studentData;
          } else if (studentData?.message) {
            data = studentData;
            response = studentRes;
          }
        }
      }

      if (!response.ok || !data || !data.success) {
        throw new Error(data?.message || 'Invalid credentials. Please verify your login ID and password.');
      }

      const token = data.token;
      const user = data.user;
      const role = user.role || 'STUDENT';

      // Store authoritative token in appropriate storage key
      if (role === 'STUDENT') {
        localStorage.setItem('hms_student_auth_token', token);
      } else {
        localStorage.setItem('hms_management_auth_token', token);
      }

      onLoginSuccess(role, token);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to the authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campusstay-login-wrapper" style={{
      display: 'flex',
      width: '100%',
      minHeight: '100vh',
      background: '#FFFFFF',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* ─── LEFT: Form Panel ───────────────────────────────────── */}
      <div className="campusstay-form-panel" style={{
        flex: '0 0 50%',
        maxWidth: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '3rem 2.5rem 1.5rem',
        background: '#FFFFFF',
        overflowY: 'auto',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* Brand Wordmark */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#1A1A2E', lineHeight: 1 }}>
              Campus<span style={{ color: '#F97316' }}>ly</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', fontWeight: 500, marginTop: '0.25rem', letterSpacing: '0.02em' }}>
              ALLIANCE COLLEGE OF MANAGEMENT - HOSTEL SYSTEM
            </div>
          </div>

          {/* Welcome Label */}
          <div style={{ fontSize: '1.15rem', fontWeight: 600, color: '#5B4FCF', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Hi, Welcome back!</span>
            <span style={{ display: 'inline-block', transformOrigin: '70% 70%', animation: 'wave 2s ease-in-out infinite' }}>👋</span>
          </div>

          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginBottom: '0.5rem' }}>
            Login to your Account
          </h1>
          <p style={{ fontSize: '0.825rem', color: '#6B7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Access your personalized Campusly portal dashboard using your credentials.
          </p>

          {/* Error Banner */}
          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.82rem',
              color: '#DC2626',
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                Roll No. / Student ID / Username
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={18} color="#9CA3AF" style={{ position: 'absolute', left: '0.9rem', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter Roll No, Student ID, or Staff Username"
                  style={{
                    width: '100%',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    padding: '0.7rem 0.9rem 0.7rem 2.6rem',
                    fontSize: '0.85rem',
                    color: '#111827',
                    background: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#5B4FCF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91, 79, 207, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem' }}>
                Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} color="#9CA3AF" style={{ position: 'absolute', left: '0.9rem', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: '100%',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    padding: '0.7rem 2.6rem 0.7rem 2.6rem',
                    fontSize: '0.85rem',
                    color: '#111827',
                    background: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    fontFamily: "'Poppins', sans-serif",
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#5B4FCF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91, 79, 207, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.9rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Pill Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.85rem',
                background: 'linear-gradient(135deg, #5B4FCF 0%, #7C3AED 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '30px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                fontFamily: "'Poppins', sans-serif",
                letterSpacing: '0.01em',
                marginTop: '0.4rem',
              }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Campusly</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Selector Chips */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Sparkles size={15} color="#5B4FCF" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5B4FCF', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Quick Demo Accounts
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
              {DEMO_CREDENTIALS.map((cred) => {
                const isSelected = selectedDemoRole === cred.roleBadge;
                return (
                  <button
                    key={cred.roleBadge}
                    type="button"
                    onClick={() => handleSelectDemo(cred)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: isSelected ? '1.5px solid #5B4FCF' : '1px solid #E5E7EB',
                      background: isSelected ? '#F5F3FF' : '#F9FAFB',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#111827' }}>{cred.roleLabel}</div>
                    <div style={{ color: '#6B7280', fontSize: '0.7rem' }}>{cred.username}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Registration Link */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#6B7280' }}>
            New student?{' '}
            <button
              type="button"
              onClick={onNavigateToRegister}
              style={{ background: 'none', border: 'none', color: '#5B4FCF', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}
            >
              Apply for Hostel Accommodation
            </button>
          </div>
        </div>

        {/* Form Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #F0F0F0', fontSize: '0.7rem', color: '#9CA3AF' }}>
          <span>© 2026 Campusly</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D1D5DB' }} />
          <span>Alliance College of Management Hostels</span>
        </div>
      </div>

      {/* ─── RIGHT: CampusStay Illustration Panel ──────────────────────────── */}
      <div className="campusstay-illustration-panel" style={{
        flex: '0 0 50%',
        maxWidth: '50%',
        background: 'linear-gradient(145deg, #E8E4FF 0%, #D4C8FF 30%, #C0AAFF 60%, #B8A4F5 100%)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}>
        {/* Top Tenant Bar */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '1.5rem 2rem',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(91, 79, 207, 0.2)',
          }}>
            <Building2 size={24} color="#5B4FCF" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3730A3', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              ALLIANCE COLLEGE OF MANAGEMENT
            </div>
            <div style={{ fontSize: '0.68rem', color: '#5B4FCF', fontWeight: 500, marginTop: '0.1rem' }}>
              Residential Campus Oversight & Management Portal
            </div>
          </div>
        </div>

        {/* Center CampusStay Banner */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          padding: '3rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '1.25rem',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 1rem',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(6px)',
            color: '#3730A3',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}>
            <ShieldCheck size={16} color="#5B4FCF" />
            <span>Official University Residential System</span>
          </div>

          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1E1B4B', lineHeight: 1.2, margin: 0 }}>
            Modern, Smart Hostel Management & Services
          </h2>

          <p style={{ fontSize: '0.95rem', color: '#4338CA', lineHeight: 1.6, maxWidth: '460px', margin: 0 }}>
            Automated room allocation, mess token booking, leave approvals, fee collection, and administrative oversight for Alliance College of Management students and staff.
          </p>
        </div>

        {/* Glassmorphism Bottom Panel Footer */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 2rem',
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.4)',
          fontSize: '0.72rem',
          color: '#4338CA',
          fontWeight: 500,
        }}>
          <span>Campusly Platform v2.0</span>
          <span>Technical Education Space</span>
        </div>
      </div>
    </div>
  );
};

export default UnifiedLoginPage;


