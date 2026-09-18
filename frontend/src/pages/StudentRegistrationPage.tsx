import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  User,
  GraduationCap,
  Users,
  Home,
  Send,
  Clock,
  Check,
} from 'lucide-react';
import { apiService, StudentRegistrationResponse } from '../services/api';
import { APP_BRANDING } from '../config/branding';

interface StudentRegistrationPageProps {
  onNavigateToLogin: () => void;
}

export const StudentRegistrationPage: React.FC<StudentRegistrationPageProps> = ({
  onNavigateToLogin,
}) => {
  // Current active step (1 to 4)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Available blocks from backend
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Form Fields State (Preserved across step navigation)
  // Step 1: Personal Info
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Academic Info
  const [jntuNo, setJntuNo] = useState('');
  const [branch, setBranch] = useState('Computer Science & Engineering (CSE)');
  const [yearOfStudy, setYearOfStudy] = useState('1st Year');
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState('Semester 1');

  // Step 3: Guardian Info
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');

  // Step 4: Hostel Preferences
  const [preferredBlock, setPreferredBlock] = useState('');
  const [preferredRoomType, setPreferredRoomType] = useState('Non-AC Room (2 Sharing)');
  const [preferredFloor, setPreferredFloor] = useState('1');
  const [stayDuration, setStayDuration] = useState('Full Academic Year');
  const [foodPreference, setFoodPreference] = useState('VEG');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state after submission
  const [submittedResult, setSubmittedResult] = useState<StudentRegistrationResponse | null>(null);

  useEffect(() => {
    apiService
      .getRegistrationBlocks()
      .then((res) => {
        if (res.blocks?.length > 0) {
          setBlocks(res.blocks);
          setPreferredBlock(res.blocks[0].name);
        }
      })
      .catch(() => {
        // Fallback default blocks
        const fallback = [
          { id: '1', name: 'Boys Hostel Block A', code: 'BH-A' },
          { id: '2', name: 'Girls Hostel Block B', code: 'GH-B' },
          { id: '3', name: 'Main Campus Hostel Block C', code: 'CH-C' },
        ];
        setBlocks(fallback);
        setPreferredBlock(fallback[0].name);
      });
  }, []);

  // Helper to clear error for a specific field when edited
  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!name.trim()) {
      stepErrors.name = 'Full Name is required.';
    }

    if (!dob.trim()) {
      stepErrors.dob = 'Date of Birth is required.';
    }

    if (!gender.trim()) {
      stepErrors.gender = 'Gender is required.';
    }

    const cleanPhone = phone.trim().replace(/[-\s]/g, '');
    if (!cleanPhone) {
      stepErrors.phone = 'Phone Number is required.';
    } else if (!/^\d{10}$/.test(cleanPhone)) {
      stepErrors.phone = 'Enter a valid 10-digit phone number.';
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      stepErrors.email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      stepErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      stepErrors.password = 'Password is required.';
    } else if (password.length < 6) {
      stepErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const stepErrors: Record<string, string> = {};
    const cleanJntu = jntuNo.trim();

    if (!cleanJntu) {
      stepErrors.jntuNo = 'Student ID / JNTU Roll Number is required.';
    } else if (!/^[A-Za-z0-9]{8,12}$/.test(cleanJntu)) {
      stepErrors.jntuNo = 'Student ID must be 8-12 alphanumeric characters.';
    }

    if (!branch.trim()) {
      stepErrors.branch = 'Department / Branch is required.';
    }

    if (!yearOfStudy.trim()) {
      stepErrors.yearOfStudy = 'Year of Study is required.';
    }

    if (!section.trim()) {
      stepErrors.section = 'Section is required.';
    }

    if (!semester.trim()) {
      stepErrors.semester = 'Semester is required.';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = (): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!guardianName.trim()) {
      stepErrors.guardianName = 'Parent / Guardian Name is required.';
    }

    if (!guardianRelation.trim()) {
      stepErrors.guardianRelation = 'Relationship is required.';
    }

    const cleanParentPhone = guardianPhone.trim().replace(/[-\s]/g, '');
    if (!cleanParentPhone) {
      stepErrors.guardianPhone = 'Parent Phone Number is required.';
    } else if (!/^\d{10}$/.test(cleanParentPhone)) {
      stepErrors.guardianPhone = 'Enter a valid 10-digit phone number.';
    }

    const cleanEmergency = emergencyContact.trim().replace(/[-\s]/g, '');
    if (!cleanEmergency) {
      stepErrors.emergencyContact = 'Emergency Contact Number is required.';
    } else if (!/^\d{10}$/.test(cleanEmergency)) {
      stepErrors.emergencyContact = 'Enter a valid 10-digit contact number.';
    }

    if (!address.trim()) {
      stepErrors.address = 'Permanent Address is required.';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Step 4 Validation
  const validateStep4 = (): boolean => {
    const stepErrors: Record<string, string> = {};

    if (!preferredBlock.trim()) {
      stepErrors.preferredBlock = 'Preferred Hostel / Block is required.';
    }

    if (!agreeTerms) {
      stepErrors.agreeTerms = 'You must accept the declaration to submit.';
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  // Navigation handlers
  const handleNext = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (validateStep1()) {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (validateStep2()) {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      if (validateStep3()) {
        setCurrentStep(4);
      }
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    setErrors({});
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate current step (Step 4)
    if (!validateStep4()) {
      return;
    }

    // Comprehensive validation checks before final submission
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) {
      setErrorMessage('Please ensure all required fields in each step are completed correctly.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiService.registerStudent({
        name: name.trim(),
        dob: dob.trim(),
        gender,
        phone: phone.trim(),
        email: email.trim(),
        password,
        jntuNo: jntuNo.trim().toUpperCase(),
        branch,
        yearOfStudy,
        section,
        semester,
        guardianName: guardianName.trim(),
        guardianRelation,
        guardianPhone: guardianPhone.trim(),
        emergencyContact: emergencyContact.trim(),
        address: address.trim(),
        preferredBlock,
        preferredRoomType,
        preferredFloor: preferredFloor ? Number(preferredFloor) : undefined,
        stayDuration,
        foodPreference,
        medicalConditions: medicalConditions.trim(),
      });

      setSubmittedResult(response);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step definitions for top progress indicator
  const steps = [
    { number: 1, title: 'Personal', description: 'Personal Details', icon: User },
    { number: 2, title: 'Academic', description: 'Academic Details', icon: GraduationCap },
    { number: 3, title: 'Parent/Guardian', description: 'Guardian Details', icon: Users },
    { number: 4, title: 'Hostel', description: 'Preferences & Declaration', icon: Home },
  ];

  // Helper for input error styling
  const getInputStyle = (fieldName: string): React.CSSProperties => {
    const hasError = !!errors[fieldName];
    return {
      width: '100%',
      height: '46px',
      padding: '0 14px',
      fontSize: '0.9375rem',
      color: '#0F172A',
      backgroundColor: hasError ? '#FEF2F2' : '#FFFFFF',
      border: hasError ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
      borderRadius: '10px',
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
    };
  };

  // SUCCESS VIEW: exactly matches section 7 of specifications
  if (submittedResult) {
    return (
      <main className="auth-viewport" style={{ padding: '2rem 1rem', background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem 2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0F172A', marginBottom: '0.5rem' }}>
            Application Submitted
          </h1>

          <p style={{ fontSize: '0.9375rem', color: '#64748B', marginBottom: '1.5rem' }}>
            Your student registration has been submitted for Admin verification.
          </p>

          <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '1.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Application ID:</span>
              <strong style={{ color: '#0F172A', fontSize: '0.9375rem', fontFamily: 'monospace' }}>
                {submittedResult.applicationId}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Applicant Name:</span>
              <strong style={{ color: '#0F172A', fontSize: '0.9375rem' }}>
                {submittedResult.student?.name || name}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Student ID / JNTU:</span>
              <strong style={{ color: '#0F172A', fontSize: '0.9375rem', fontFamily: 'monospace' }}>
                {submittedResult.student?.jntuNo || jntuNo.toUpperCase()}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Application Status:</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#FEF3C7', color: '#B45309', padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.8125rem', fontWeight: '600' }}>
                <Clock size={14} /> PENDING
              </span>
            </div>
          </div>

          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '1rem', color: '#1E40AF', fontSize: '0.875rem', marginBottom: '1.75rem', textAlign: 'left' }}>
            <strong>Important Notice:</strong> You will be able to access the Student Portal after your application is approved and a hostel room bed is assigned by the administration.
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onNavigateToLogin}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', fontWeight: '600', backgroundColor: '#151B54', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
          >
            Return to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-viewport" style={{ padding: '2rem 1rem', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* Responsive Inline CSS */}
      <style>{`
        .reg-wizard-card {
          padding: 2rem;
          background: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        }
        .reg-wizard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.15rem;
        }
        .wizard-step-title {
          display: block;
          font-size: 0.8125rem;
          line-height: 1.2;
        }
        @media (max-width: 640px) {
          .reg-wizard-card {
            padding: 1.25rem 1rem !important;
            border-radius: 12px !important;
          }
          .reg-wizard-grid {
            grid-template-columns: 1fr !important;
            gap: 0.9rem !important;
          }
          .wizard-step-node {
            min-width: 48px !important;
          }
          .wizard-step-circle {
            width: 30px !important;
            height: 30px !important;
            font-size: 0.75rem !important;
          }
          .wizard-step-title {
            font-size: 0.7rem !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '820px', margin: '0 auto', width: '100%' }}>
        {/* Top Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="btn-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#475569', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Student Login
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={20} color="#151B54" />
            <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '1rem' }}>
              {APP_BRANDING.appName}
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="reg-wizard-card">
          {/* Card Title */}
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              Student Registration & Hostel Application
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.35rem', marginBottom: 0 }}>
              Complete the 4-step wizard to register your student profile and request residential accommodation.
            </p>
          </div>

          {/* TOP PROGRESS INDICATOR */}
          <div
            aria-label="Registration Progress"
            style={{
              marginBottom: '2rem',
              padding: '1.25rem 0.75rem',
              background: '#F8FAFC',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
                width: '100%',
              }}
            >
              {steps.map((step, index) => {
                const isActive = step.number === currentStep;
                const isCompleted = step.number < currentStep;

                return (
                  <React.Fragment key={step.number}>
                    {/* Step Node */}
                    <div
                      className="wizard-step-node"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 2,
                        minWidth: '60px',
                        textAlign: 'center',
                      }}
                    >
                      {/* Step Badge / Circle */}
                      <div
                        className="wizard-step-circle"
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '700',
                          transition: 'all 0.25s ease',
                          backgroundColor: isCompleted
                            ? '#16A34A'
                            : isActive
                            ? '#151B54'
                            : '#FFFFFF',
                          color: isCompleted || isActive ? '#FFFFFF' : '#64748B',
                          border: isCompleted
                            ? '2px solid #16A34A'
                            : isActive
                            ? '2px solid #151B54'
                            : '2px solid #CBD5E1',
                          boxShadow: isActive
                            ? '0 0 0 4px rgba(21, 27, 84, 0.15)'
                            : 'none',
                        }}
                      >
                        {isCompleted ? <Check size={18} strokeWidth={2.5} /> : step.number}
                      </div>

                      {/* Step Label */}
                      <div style={{ marginTop: '0.45rem' }}>
                        <span
                          className="wizard-step-title"
                          style={{
                            fontWeight: isActive ? '700' : isCompleted ? '600' : '500',
                            color: isActive
                              ? '#151B54'
                              : isCompleted
                              ? '#1E293B'
                              : '#94A3B8',
                          }}
                        >
                          {step.title}
                        </span>
                      </div>
                    </div>

                    {/* Connecting Line between steps */}
                    {index < steps.length - 1 && (
                      <div
                        style={{
                          flex: 1,
                          height: '3px',
                          margin: '0 4px',
                          position: 'relative',
                          top: '-12px',
                          backgroundColor: isCompleted ? '#16A34A' : '#E2E8F0',
                          transition: 'background-color 0.25s ease',
                          zIndex: 1,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div style={{ padding: '0.875rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* REGISTRATION FORM — ONLY ONE STEP VISIBLE AT A TIME */}
          <form onSubmit={handleSubmit} noValidate>
            {/* STEP 1: PERSONAL DETAILS */}
            {currentStep === 1 && (
              <section aria-label="Step 1: Personal Details">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#1E293B' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#151B54' }}>
                    <User size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#0F172A' }}>
                      Step 1: Personal Details
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                      Provide your official identity and login credentials
                    </p>
                  </div>
                </div>

                <div className="reg-wizard-grid">
                  {/* Full Name */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      style={getInputStyle('name')}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        clearFieldError('name');
                      }}
                      placeholder="e.g. Rahul Kumar"
                      required
                    />
                    {errors.name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.name}
                      </div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      style={getInputStyle('dob')}
                      value={dob}
                      onChange={(e) => {
                        setDob(e.target.value);
                        clearFieldError('dob');
                      }}
                      required
                    />
                    {errors.dob && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.dob}
                      </div>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Gender *
                    </label>
                    <select
                      style={getInputStyle('gender')}
                      value={gender}
                      onChange={(e) => {
                        setGender(e.target.value);
                        clearFieldError('gender');
                      }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.gender && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.gender}
                      </div>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      style={getInputStyle('phone')}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        clearFieldError('phone');
                      }}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      required
                    />
                    {errors.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.phone}
                      </div>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      style={getInputStyle('email')}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      placeholder="student@example.com"
                      required
                    />
                    {errors.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.email}
                      </div>
                    )}
                  </div>

                  {/* Create Password */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Create Password * (min 6 characters)
                    </label>
                    <input
                      type="password"
                      style={getInputStyle('password')}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      placeholder="Used for Student Portal login"
                      required
                    />
                    {errors.password && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.password}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 1 Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    style={{
                      padding: '0.65rem 1.25rem',
                      background: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.5rem',
                      backgroundColor: '#151B54',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(21, 27, 84, 0.15)',
                    }}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2: ACADEMIC DETAILS */}
            {currentStep === 2 && (
              <section aria-label="Step 2: Academic Details">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#1E293B' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#151B54' }}>
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#0F172A' }}>
                      Step 2: Academic Details
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                      Specify your college enrollment, branch, and class division
                    </p>
                  </div>
                </div>

                <div className="reg-wizard-grid">
                  {/* Student ID / JNTU Roll Number */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Student ID / JNTU Roll Number * (8-12 alphanumeric)
                    </label>
                    <input
                      type="text"
                      style={getInputStyle('jntuNo')}
                      value={jntuNo}
                      onChange={(e) => {
                        setJntuNo(e.target.value.toUpperCase());
                        clearFieldError('jntuNo');
                      }}
                      placeholder="e.g. 25331A05H7"
                      maxLength={12}
                      required
                    />
                    {errors.jntuNo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.jntuNo}
                      </div>
                    )}
                  </div>

                  {/* Department / Branch */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Department / Branch *
                    </label>
                    <select
                      style={getInputStyle('branch')}
                      value={branch}
                      onChange={(e) => {
                        setBranch(e.target.value);
                        clearFieldError('branch');
                      }}
                    >
                      <option value="Computer Science & Engineering (CSE)">Computer Science & Engineering (CSE)</option>
                      <option value="Artificial Intelligence & ML (AIML)">Artificial Intelligence & ML (AIML)</option>
                      <option value="Electronics & Communication (ECE)">Electronics & Communication (ECE)</option>
                      <option value="Electrical & Electronics (EEE)">Electrical & Electronics (EEE)</option>
                      <option value="Mechanical Engineering (MECH)">Mechanical Engineering (MECH)</option>
                      <option value="Civil Engineering (CIVIL)">Civil Engineering (CIVIL)</option>
                      <option value="Information Technology (IT)">Information Technology (IT)</option>
                    </select>
                    {errors.branch && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.branch}
                      </div>
                    )}
                  </div>

                  {/* Year of Study */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Year of Study *
                    </label>
                    <select
                      style={getInputStyle('yearOfStudy')}
                      value={yearOfStudy}
                      onChange={(e) => {
                        setYearOfStudy(e.target.value);
                        clearFieldError('yearOfStudy');
                      }}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                    {errors.yearOfStudy && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.yearOfStudy}
                      </div>
                    )}
                  </div>

                  {/* Section */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Section *
                    </label>
                    <select
                      style={getInputStyle('section')}
                      value={section}
                      onChange={(e) => {
                        setSection(e.target.value);
                        clearFieldError('section');
                      }}
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                    </select>
                    {errors.section && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.section}
                      </div>
                    )}
                  </div>

                  {/* Semester */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Semester *
                    </label>
                    <select
                      style={getInputStyle('semester')}
                      value={semester}
                      onChange={(e) => {
                        setSemester(e.target.value);
                        clearFieldError('semester');
                      }}
                    >
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                    {errors.semester && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.semester}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2 Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.25rem',
                      background: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.5rem',
                      backgroundColor: '#151B54',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(21, 27, 84, 0.15)',
                    }}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 3: PARENT / GUARDIAN DETAILS */}
            {currentStep === 3 && (
              <section aria-label="Step 3: Parent / Guardian Details">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#1E293B' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#151B54' }}>
                    <Users size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#0F172A' }}>
                      Step 3: Parent / Guardian Details
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                      Emergency contact information and permanent address
                    </p>
                  </div>
                </div>

                <div className="reg-wizard-grid">
                  {/* Parent / Guardian Name */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Parent / Guardian Name *
                    </label>
                    <input
                      type="text"
                      style={getInputStyle('guardianName')}
                      value={guardianName}
                      onChange={(e) => {
                        setGuardianName(e.target.value);
                        clearFieldError('guardianName');
                      }}
                      placeholder="Full name"
                      required
                    />
                    {errors.guardianName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.guardianName}
                      </div>
                    )}
                  </div>

                  {/* Relationship */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Relationship *
                    </label>
                    <select
                      style={getInputStyle('guardianRelation')}
                      value={guardianRelation}
                      onChange={(e) => {
                        setGuardianRelation(e.target.value);
                        clearFieldError('guardianRelation');
                      }}
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Sibling">Sibling</option>
                    </select>
                    {errors.guardianRelation && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.guardianRelation}
                      </div>
                    )}
                  </div>

                  {/* Parent Phone Number */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Parent Phone Number *
                    </label>
                    <input
                      type="tel"
                      style={getInputStyle('guardianPhone')}
                      value={guardianPhone}
                      onChange={(e) => {
                        setGuardianPhone(e.target.value);
                        clearFieldError('guardianPhone');
                      }}
                      placeholder="10-digit primary phone"
                      maxLength={10}
                      required
                    />
                    {errors.guardianPhone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.guardianPhone}
                      </div>
                    )}
                  </div>

                  {/* Emergency Contact Number */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Emergency Contact Number *
                    </label>
                    <input
                      type="tel"
                      style={getInputStyle('emergencyContact')}
                      value={emergencyContact}
                      onChange={(e) => {
                        setEmergencyContact(e.target.value);
                        clearFieldError('emergencyContact');
                      }}
                      placeholder="10-digit emergency contact"
                      maxLength={10}
                      required
                    />
                    {errors.emergencyContact && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.emergencyContact}
                      </div>
                    )}
                  </div>

                  {/* Permanent Address */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Permanent Address *
                    </label>
                    <input
                      type="text"
                      style={getInputStyle('address')}
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        clearFieldError('address');
                      }}
                      placeholder="Door / Street / Town / City / District / PIN"
                      required
                    />
                    {errors.address && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3 Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.25rem',
                      background: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.5rem',
                      backgroundColor: '#151B54',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(21, 27, 84, 0.15)',
                    }}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: HOSTEL PREFERENCES & DECLARATION */}
            {currentStep === 4 && (
              <section aria-label="Step 4: Hostel Preferences & Declaration">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', color: '#1E293B' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#151B54' }}>
                    <Home size={18} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, color: '#0F172A' }}>
                      Step 4: Hostel Preferences & Declaration
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748B' }}>
                      Select boarding options and confirm your application
                    </p>
                  </div>
                </div>

                <div className="reg-wizard-grid">
                  {/* Preferred Hostel / Block */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Preferred Hostel / Block *
                    </label>
                    <select
                      style={getInputStyle('preferredBlock')}
                      value={preferredBlock}
                      onChange={(e) => {
                        setPreferredBlock(e.target.value);
                        clearFieldError('preferredBlock');
                      }}
                      required
                    >
                      {blocks.map((b) => (
                        <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                    {errors.preferredBlock && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={13} /> {errors.preferredBlock}
                      </div>
                    )}
                  </div>

                  {/* Preferred Room Type */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Preferred Room Type
                    </label>
                    <select
                      style={getInputStyle('preferredRoomType')}
                      value={preferredRoomType}
                      onChange={(e) => setPreferredRoomType(e.target.value)}
                    >
                      <option value="Non-AC Room (2 Sharing)">Non-AC Room (2 Sharing)</option>
                      <option value="Non-AC Room (3 Sharing)">Non-AC Room (3 Sharing)</option>
                      <option value="AC Room (2 Sharing)">AC Room (2 Sharing)</option>
                      <option value="AC Room (3 Sharing)">AC Room (3 Sharing)</option>
                    </select>
                  </div>

                  {/* Floor Preference */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Floor Preference
                    </label>
                    <select
                      style={getInputStyle('preferredFloor')}
                      value={preferredFloor}
                      onChange={(e) => setPreferredFloor(e.target.value)}
                    >
                      <option value="1">1st Floor / Ground</option>
                      <option value="2">2nd Floor</option>
                      <option value="3">3rd Floor</option>
                      <option value="4">4th Floor</option>
                    </select>
                  </div>

                  {/* Stay Duration */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Stay Duration
                    </label>
                    <select
                      style={getInputStyle('stayDuration')}
                      value={stayDuration}
                      onChange={(e) => setStayDuration(e.target.value)}
                    >
                      <option value="Full Academic Year">Full Academic Year (10 Months)</option>
                      <option value="Single Semester">Single Semester (5 Months)</option>
                    </select>
                  </div>

                  {/* Food & Mess Preference */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Food & Mess Preference
                    </label>
                    <select
                      style={getInputStyle('foodPreference')}
                      value={foodPreference}
                      onChange={(e) => setFoodPreference(e.target.value)}
                    >
                      <option value="VEG">Vegetarian</option>
                      <option value="NON_VEG">Non-Vegetarian</option>
                    </select>
                  </div>

                  {/* Medical Conditions / Special Dietary Needs */}
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8125rem', fontWeight: '600', color: '#1E293B' }}>
                      Medical Conditions / Special Dietary Needs (Optional)
                    </label>
                    <input
                      type="text"
                      style={getInputStyle('medicalConditions')}
                      value={medicalConditions}
                      onChange={(e) => setMedicalConditions(e.target.value)}
                      placeholder="e.g. Asthma, allergies, or None"
                    />
                  </div>
                </div>

                {/* Declaration Checkbox */}
                <div
                  style={{
                    background: errors.agreeTerms ? '#FEF2F2' : '#F8FAFC',
                    padding: '1.15rem',
                    borderRadius: '10px',
                    border: errors.agreeTerms ? '1.5px solid #EF4444' : '1px solid #E2E8F0',
                    marginTop: '1.5rem',
                    marginBottom: '1rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        clearFieldError('agreeTerms');
                      }}
                      style={{ marginTop: '0.2rem', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>
                      I declare that all submitted information is correct. I understand that submitting this application places my registration in <strong>PENDING</strong> status subject to Admin verification. Specific room and bed allocation will be determined by the hostel administration.
                    </span>
                  </label>
                  {errors.agreeTerms && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#DC2626', fontSize: '0.75rem', marginTop: '0.5rem', marginLeft: '1.65rem' }}>
                      <AlertCircle size={13} /> {errors.agreeTerms}
                    </div>
                  )}
                </div>

                {/* Step 4 Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9' }}>
                  <button
                    type="button"
                    onClick={handleBack}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.65rem 1.25rem',
                      background: '#F1F5F9',
                      color: '#475569',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.7rem 1.75rem',
                      backgroundColor: '#151B54',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.75 : 1,
                      boxShadow: '0 2px 8px rgba(21, 27, 84, 0.2)',
                    }}
                  >
                    <Send size={15} />
                    {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
                  </button>
                </div>
              </section>
            )}
          </form>
        </div>
      </div>
    </main>
  );
};
