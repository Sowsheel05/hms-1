import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, User, ArrowLeft, Shield } from 'lucide-react';
import { PasswordInput } from '../components/PasswordInput';
import { useManagementAuth } from '../context/ManagementAuthContext';
import { APP_BRANDING } from '../config/branding';

interface ManagementLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToStudent: () => void;
}

export const ManagementLoginPage: React.FC<ManagementLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToStudent,
}) => {
  const { login } = useManagementAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value);
    if (fieldErrors.identifier) {
      setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const validateForm = () => {
    const errors: { identifier?: string; password?: string } = {};

    const trimmed = identifier.trim();
    if (!trimmed) {
      errors.identifier = 'Please enter your administrator ID or username.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleQuickLogin = async (testId: string) => {
    setIdentifier(testId);
    setPassword('Password@123');
    setFieldErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const result = await login(testId, 'Password@123');
      if (result.success) {
        onLoginSuccess();
      } else {
        setGeneralError(result.message || 'Invalid credentials or unauthorized role.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please verify server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const result = await login(identifier.trim(), password);

      if (result.success) {
        onLoginSuccess();
      } else {
        setGeneralError(result.message || 'Invalid credentials or unauthorized role.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please verify server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-viewport management-auth-viewport">
      <div className="auth-container">
        {/* Left / Primary Panel: Admin Administrative Showcase */}
        <section className="auth-branding-panel management-branding-panel" aria-label="Admin Branding">
          <div className="brand-badge">
            <div className="brand-logo-icon management-badge-icon" aria-hidden="true">
              <Shield size={24} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name">{APP_BRANDING.appName}</span>
              <span className="brand-subtitle management-hero-badge">Hostel Administration & Oversight</span>
            </div>
          </div>

          <div className="brand-hero">
            <h1 className="brand-hero-title">
              Admin Portal
            </h1>
            <p className="brand-hero-desc">
              Authoritative operational console for hostel administration and oversight. Monitor residential presence, room occupancy, and actionable requests.
            </p>

            <div className="brand-features">
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Server-Side RBAC Enforcement (Admin / Staff)</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Real-Time Biometric & Presence Intelligence</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <ShieldCheck size={14} />
                </span>
                <span>Authoritative Audit & Request Workflow Management</span>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Strict Server-Verified Administrative Access</span>
          </div>
        </section>

        {/* Right Section: Admin Login Form */}
        <section className="auth-form-panel" aria-label="Admin Login Form">
          <div className="mobile-brand-header">
            <div className="mobile-logo-icon management-mobile-icon" aria-hidden="true">
              <Shield size={20} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name" style={{ color: 'var(--primary-navy)', fontSize: '1.1rem' }}>
                {APP_BRANDING.appName}
              </span>
              <span className="brand-subtitle" style={{ color: 'var(--text-muted)' }}>
                Admin Console
              </span>
            </div>
          </div>

          <div className="form-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="role-badge-admin" style={{ fontSize: '0.75rem' }}>
                ADMINISTRATOR
              </span>
            </div>
            <h2 className="form-title">Admin Portal Sign In</h2>
            <p className="form-subtitle">Enter your official administrator credentials to access operational controls.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {generalError && (
              <div className="alert-banner error" role="alert" aria-live="polite">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{generalError}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="management-identifier" className="form-label">
                Admin ID / Username
              </label>
              <div className="form-input-wrapper">
                <span className="input-icon-left" aria-hidden="true">
                  <User size={18} />
                </span>
                <input
                  id="management-identifier"
                  name="identifier"
                  type="text"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="e.g. ADMIN01"
                  disabled={isSubmitting}
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck="false"
                  className={`form-input ${fieldErrors.identifier ? 'has-error' : ''}`}
                  aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
                  aria-invalid={!!fieldErrors.identifier}
                />
              </div>
              {fieldErrors.identifier && (
                <div id="identifier-error" className="field-error-msg" role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.identifier}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="management-password" className="form-label">
                Password
              </label>
              <PasswordInput
                id="management-password"
                name="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Enter administrator password"
                disabled={isSubmitting}
                error={fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'mgmt-password-error' : undefined}
              />
              {fieldErrors.password && (
                <div id="mgmt-password-error" className="field-error-msg" role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-submit management-btn-submit"
              aria-label={isSubmitting ? 'Signing in' : 'Sign In to Admin Portal'}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Admin Console</span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Website-Specific Testing (1-Click Auto Login) */}
          <div style={{ marginTop: '1.25rem', padding: '0.875rem', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} style={{ color: '#2563EB' }} />
                <span>1-Click Test Role Quick Sign In</span>
              </div>
              <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 600, backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>Instant Login</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin('ADMIN01')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: '1px solid #94A3B8',
                  backgroundColor: '#1E293B',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="System Administrator: Full campus oversight (1-Click Login)"
              >
                ⚡ Admin
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin('CW_BOYS')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: '1px solid #93C5FD',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Chief Warden (Boys Hostel): Blocks A, B, C, D (1-Click Login)"
              >
                ⚡ CW Boys
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin('CW_GIRLS')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: '1px solid #F0ABFC',
                  backgroundColor: '#FDF4FF',
                  color: '#86198F',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Chief Warden (Girls Hostel): Blocks A, B (1-Click Login)"
              >
                ⚡ CW Girls
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin('WARDEN01')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: '1px solid #FDBA74',
                  backgroundColor: '#FFF7ED',
                  color: '#C2410C',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Hostel Warden: Block operations (1-Click Login)"
              >
                ⚡ Warden
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleQuickLogin('MAINT01')}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  gridColumn: 'span 2',
                  transition: 'all 0.15s ease',
                }}
                title="Maintenance Technician: Service requests (1-Click Login)"
              >
                ⚡ Maintenance Staff
              </button>
            </div>
            <div style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '8px', textAlign: 'center' }}>
              Click any role above to automatically sign in with test credentials.
            </div>
          </div>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={onNavigateToStudent}
              className="btn-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                color: 'var(--primary-navy)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                padding: '4px 8px',
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Student Portal</span>
            </button>
          </div>

          <div className="auth-security-note">
            <Lock size={13} aria-hidden="true" />
            <span>Server-Authorized Access Only • Students Prohibited (403)</span>
          </div>
        </section>
      </div>
    </main>
  );
};
