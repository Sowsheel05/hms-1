import React, { useState } from 'react';
import { User, AlertCircle } from 'lucide-react';
import { PasswordInput } from './PasswordInput';
import { useAuth } from '../context/AuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login } = useAuth();

  const [jntuNo, setJntuNo] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{ jntuNo?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJntuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJntuNo(e.target.value);
    if (fieldErrors.jntuNo) {
      setFieldErrors((prev) => ({ ...prev, jntuNo: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value); // Never trim password
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) setGeneralError(null);
  };

  const validateForm = () => {
    const errors: { jntuNo?: string; password?: string } = {};

    const trimmedJntu = jntuNo.trim();
    if (!trimmedJntu) {
      errors.jntuNo = 'Please enter your JNTU number.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleQuickLogin = async (targetJntuNo: string) => {
    setJntuNo(targetJntuNo);
    setPassword('Password@123');
    setFieldErrors({});
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const result = await login(targetJntuNo, 'Password@123');
      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setGeneralError(result.message || 'Invalid JNTU No. or password.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedJntu = jntuNo.trim();
      const result = await login(trimmedJntu, password);

      if (result.success) {
        if (onSuccess) onSuccess();
      } else {
        setGeneralError(result.message || 'Invalid JNTU No. or password.');
      }
    } catch {
      setGeneralError('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {/* Global error banner */}
      {generalError && (
        <div className="alert-banner error" role="alert" aria-live="polite">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{generalError}</span>
        </div>
      )}

      {/* 1-Click Test Student Sign In */}
      <div style={{ padding: '0.75rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>1-Click Test Student Sign In</span>
          <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 600, backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>Instant</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleQuickLogin('25331A05H7')}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #BFDBFE',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
            }}
            title="MANI MANASVI GAVARA (25331A05H7) - Allocated Student"
          >
            ⚡ MANASVI (25331A05H7)
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleQuickLogin('25331A05H8')}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #E9D5FF',
              backgroundColor: '#FAF5FF',
              color: '#6B21A8',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
            }}
            title="NAKKULLA RITHIKA (25331A05H8) - Roommate Student"
          >
            ⚡ RITHIKA (25331A05H8)
          </button>
        </div>
      </div>

      {/* JNTU No. Field */}
      <div className="form-group">
        <label htmlFor="jntuNo" className="form-label">
          JNTU No.
        </label>
        <div className="form-input-wrapper">
          <span className="input-icon-left" aria-hidden="true">
            <User size={18} />
          </span>
          <input
            id="jntuNo"
            name="jntuNo"
            type="text"
            value={jntuNo}
            onChange={handleJntuChange}
            placeholder="Enter your JNTU number"
            disabled={isSubmitting}
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
            className={`form-input ${fieldErrors.jntuNo ? 'has-error' : ''}`}
            aria-describedby={fieldErrors.jntuNo ? 'jntuNo-error' : undefined}
            aria-invalid={!!fieldErrors.jntuNo}
          />
        </div>
        {fieldErrors.jntuNo && (
          <div id="jntuNo-error" className="field-error-msg" role="alert">
            <AlertCircle size={14} />
            <span>{fieldErrors.jntuNo}</span>
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={handlePasswordChange}
          placeholder="Enter your password"
          disabled={isSubmitting}
          error={fieldErrors.password}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password && (
          <div id="password-error" className="field-error-msg" role="alert">
            <AlertCircle size={14} />
            <span>{fieldErrors.password}</span>
          </div>
        )}
      </div>

      {/* Primary Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-submit"
        aria-label={isSubmitting ? 'Signing in' : 'Login'}
      >
        {isSubmitting ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Signing in...</span>
          </>
        ) : (
          <span>Login</span>
        )}
      </button>
    </form>
  );
};
