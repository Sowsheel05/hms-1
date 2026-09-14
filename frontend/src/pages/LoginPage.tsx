import React from 'react';
import { Building2, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';
import { LoginForm } from '../components/LoginForm';
import { APP_BRANDING } from '../config/branding';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToRegister?: () => void;
  onNavigateToManagement?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onNavigateToRegister, onNavigateToManagement }) => {
  return (
    <main className="auth-viewport">
      <div className="auth-container">
        {/* Left / Primary Panel: Institutional Showcase (Desktop & Tablet) */}
        <section className="auth-branding-panel" aria-label="Institution Branding">
          <div className="brand-badge">
            <div className="brand-logo-icon" aria-hidden="true">
              <Building2 size={24} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name">{APP_BRANDING.appName}</span>
              <span className="brand-subtitle">{APP_BRANDING.portalName}</span>
            </div>
          </div>

          <div className="brand-hero">
            <h1 className="brand-hero-title">
              Residential Student Portal
            </h1>
            <p className="brand-hero-desc">
              Access your hostel services, room allocation records, attendance logs, and academic residency securely.
            </p>

            <div className="brand-features">
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <CheckCircle2 size={14} />
                </span>
                <span>Verified JNTU Institutional Authentication</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <CheckCircle2 size={14} />
                </span>
                <span>Encrypted Session & Access Protection</span>
              </div>
              <div className="brand-feature-item">
                <span className="feature-check-icon" aria-hidden="true">
                  <CheckCircle2 size={14} />
                </span>
                <span>24/7 Residential Services & Gate Pass Requests</span>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Authorized Student Residency Portal</span>
          </div>
        </section>

        {/* Right Section: Student Login Form */}
        <section className="auth-form-panel" aria-label="Student Login Form">
          {/* Mobile-Only Branding Header */}
          <div className="mobile-brand-header">
            <div className="mobile-logo-icon" aria-hidden="true">
              <Building2 size={20} />
            </div>
            <div className="brand-logo-text">
              <span className="brand-name" style={{ color: 'var(--primary-navy)', fontSize: '1.1rem' }}>
                {APP_BRANDING.appName}
              </span>
              <span className="brand-subtitle" style={{ color: 'var(--text-muted)' }}>
                {APP_BRANDING.portalName}
              </span>
            </div>
          </div>

          <div className="form-header">
            <h2 className="form-title">Student Login</h2>
            <p className="form-subtitle">{APP_BRANDING.welcomeSubtitle}</p>
          </div>

          <LoginForm onSuccess={onLoginSuccess} />

          {/* New Student Registration Option */}
          {onNavigateToRegister && (
            <div style={{
              marginTop: '1.25rem',
              padding: '0.875rem 1rem',
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.84rem', color: '#64748B' }}>
                New student applying for hostel residency?
              </p>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  padding: '0.5rem 1rem',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: 'var(--primary-navy)',
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}
              >
                REGISTER
              </button>
            </div>
          )}

          {onNavigateToManagement && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={onNavigateToManagement}
                className="btn-link"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                  color: 'var(--primary-navy)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'underline',
                  padding: '4px 8px',
                }}
              >
                Hostel Staff / Administrator? Sign in to Admin Portal &rarr;
              </button>
            </div>
          )}

          <div className="auth-security-note">
            <Lock size={13} aria-hidden="true" />
            <span>Secure Student Authentication • Role: STUDENT</span>
          </div>
        </section>
      </div>
    </main>
  );
};

