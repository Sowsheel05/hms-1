import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  User,
  GraduationCap,
  Users,
  Home,
  Send,
  Clock,
} from 'lucide-react';
import { apiService, StudentRegistrationResponse } from '../services/api';
import { APP_BRANDING } from '../config/branding';

interface StudentRegistrationPageProps {
  onNavigateToLogin: () => void;
}

export const StudentRegistrationPage: React.FC<StudentRegistrationPageProps> = ({
  onNavigateToLogin,
}) => {
  // Available blocks from backend
  const [blocks, setBlocks] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Form Fields
  // Personal Info
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Academic Info
  const [jntuNo, setJntuNo] = useState('');
  const [branch, setBranch] = useState('Computer Science & Engineering (CSE)');
  const [yearOfStudy, setYearOfStudy] = useState('1st Year');
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState('Semester 1');

  // Guardian Info
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');

  // Hostel Preferences
  const [preferredBlock, setPreferredBlock] = useState('');
  const [preferredRoomType, setPreferredRoomType] = useState('Non-AC Room (2 Sharing)');
  const [preferredFloor, setPreferredFloor] = useState('1');
  const [stayDuration, setStayDuration] = useState('Full Academic Year');
  const [foodPreference, setFoodPreference] = useState('VEG');
  const [medicalConditions, setMedicalConditions] = useState('');

  const [agreeTerms, setAgreeTerms] = useState(false);
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
        setBlocks([
          { id: '1', name: 'Boys Hostel Block A', code: 'BH-A' },
          { id: '2', name: 'Girls Hostel Block B', code: 'GH-B' },
          { id: '3', name: 'Main Campus Hostel Block C', code: 'CH-C' },
        ]);
        setPreferredBlock('Boys Hostel Block A');
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!agreeTerms) {
      setErrorMessage('Please accept the declaration terms before submitting.');
      return;
    }

    if (!jntuNo.trim() || jntuNo.trim().length < 8) {
      setErrorMessage('Student ID / Roll Number must be at least 8 alphanumeric characters.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
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

  // SUCCESS VIEW: matches section 7 of specifications
  if (submittedResult) {
    return (
      <main className="auth-viewport" style={{ padding: '2rem 1rem', background: '#F8FAFC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem 2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <CheckCircle2 size={36} />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0F172A', marginBottom: '0.5rem' }}>
            Registration Submitted Successfully
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
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', fontWeight: '600' }}
          >
            Return to Login
          </button>
        </div>
      </main>
    );
  }

  // REGISTRATION FORM
  return (
    <main className="auth-viewport" style={{ padding: '2rem 1rem', background: '#F8FAFC', minHeight: '100vh' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        {/* Top bar with back to login */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="btn-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: '#475569', fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500' }}
          >
            <ArrowLeft size={16} /> Back to Student Login
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={20} color="#2563EB" />
            <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '1rem' }}>
              {APP_BRANDING.appName}
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="card" style={{ padding: '2rem', background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              Student Registration & Hostel Application
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginTop: '0.35rem' }}>
              Submit your academic and personal profile to apply for residential quarters. Applications are verified by hostel administration before access is granted.
            </p>
          </div>

          {errorMessage && (
            <div style={{ padding: '0.875rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Section 1: Personal Information */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1E293B' }}>
                <User size={18} color="#2563EB" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Personal Information</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Kumar"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Gender *
                  </label>
                  <select
                    className="form-input"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Create Password * (min 6 characters)
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Used for Student Portal login"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Academic Information */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1E293B' }}>
                <GraduationCap size={18} color="#2563EB" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Academic Information</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Student ID / JNTU Roll Number * (8-12 alphanumeric)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={jntuNo}
                    onChange={(e) => setJntuNo(e.target.value.toUpperCase())}
                    placeholder="e.g. 25331A05H7"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Department / Branch *
                  </label>
                  <select
                    className="form-input"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="Computer Science & Engineering (CSE)">Computer Science & Engineering (CSE)</option>
                    <option value="Artificial Intelligence & ML (AIML)">Artificial Intelligence & ML (AIML)</option>
                    <option value="Electronics & Communication (ECE)">Electronics & Communication (ECE)</option>
                    <option value="Electrical & Electronics (EEE)">Electrical & Electronics (EEE)</option>
                    <option value="Mechanical Engineering (MECH)">Mechanical Engineering (MECH)</option>
                    <option value="Civil Engineering (CIVIL)">Civil Engineering (CIVIL)</option>
                    <option value="Information Technology (IT)">Information Technology (IT)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Year of Study *
                  </label>
                  <select
                    className="form-input"
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Section
                  </label>
                  <select
                    className="form-input"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Semester
                  </label>
                  <select
                    className="form-input"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Parent / Guardian */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1E293B' }}>
                <Users size={18} color="#2563EB" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Parent / Guardian Details</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Parent / Guardian Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Relationship *
                  </label>
                  <select
                    className="form-input"
                    value={guardianRelation}
                    onChange={(e) => setGuardianRelation(e.target.value)}
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sibling">Sibling</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Parent Phone Number *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="Primary contact"
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Emergency Contact Number *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Alternate emergency phone"
                    required
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Permanent Address *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Door / Street / Town / City / District / PIN"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Hostel Information */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#1E293B' }}>
                <Home size={18} color="#2563EB" />
                <h2 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Hostel Preferences</h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Preferred Hostel / Block
                  </label>
                  <select
                    className="form-input"
                    value={preferredBlock}
                    onChange={(e) => setPreferredBlock(e.target.value)}
                    required
                  >
                    {blocks.map((b) => (
                      <option key={b.id} value={b.name}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Preferred Room Type
                  </label>
                  <select
                    className="form-input"
                    value={preferredRoomType}
                    onChange={(e) => setPreferredRoomType(e.target.value)}
                  >
                    <option value="Non-AC Room (2 Sharing)">Non-AC Room (2 Sharing)</option>
                    <option value="Non-AC Room (3 Sharing)">Non-AC Room (3 Sharing)</option>
                    <option value="AC Room (2 Sharing)">AC Room (2 Sharing)</option>
                    <option value="AC Room (3 Sharing)">AC Room (3 Sharing)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Floor Preference
                  </label>
                  <select
                    className="form-input"
                    value={preferredFloor}
                    onChange={(e) => setPreferredFloor(e.target.value)}
                  >
                    <option value="1">1st Floor / Ground</option>
                    <option value="2">2nd Floor</option>
                    <option value="3">3rd Floor</option>
                    <option value="4">4th Floor</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Stay Duration
                  </label>
                  <select
                    className="form-input"
                    value={stayDuration}
                    onChange={(e) => setStayDuration(e.target.value)}
                  >
                    <option value="Full Academic Year">Full Academic Year (10 Months)</option>
                    <option value="Single Semester">Single Semester (5 Months)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Food & Mess Preference
                  </label>
                  <select
                    className="form-input"
                    value={foodPreference}
                    onChange={(e) => setFoodPreference(e.target.value)}
                  >
                    <option value="VEG">Vegetarian</option>
                    <option value="NON_VEG">Non-Vegetarian</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8125rem', fontWeight: '500' }}>
                    Medical Conditions / Special Dietary Needs (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder="e.g. Asthma, allergies, or None"
                  />
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  style={{ marginTop: '0.15rem' }}
                />
                <span>
                  I declare that all submitted information is correct. I understand that submitting this application places my registration in <strong>PENDING</strong> status subject to Admin verification. Specific room and bed allocation will be determined by the hostel administration.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onNavigateToLogin}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !agreeTerms}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px', justifyContent: 'center' }}
              >
                <Send size={15} />
                {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
};
