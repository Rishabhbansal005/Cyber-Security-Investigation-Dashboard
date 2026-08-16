import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const EyeIcon = ({ open }: { open: boolean }) => open ? (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
    <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
    <circle cx="8" cy="8" r="2" />
    <path d="M2 2l12 12" strokeLinecap="round" />
  </svg>
) : (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
    <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);

export default function Register() {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '', fullName: '', role: 'investigator',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (session && success) navigate('/dashboard', { replace: true });
  }, [session, success, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signUp(form.email, form.password, form.fullName, form.role);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-bg-grid" />
        <div className="auth-card animate-in" style={{ textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--status-ok-bg)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="#22c55e" strokeWidth="2" width="24" height="24">
              <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{ color: 'var(--text-heading)', marginBottom: 8, fontSize: 18 }}>Account Created</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 13 }}>
            {session
              ? 'Logging you in…'
              : 'Check your email to confirm your account, then sign in.'}
          </p>
          {!session && <Link to="/login" className="btn btn-primary">Go to Sign In</Link>}
          {session && <div className="spinner-border" style={{ width: 24, height: 24, color: 'var(--accent)', borderWidth: 2 }} />}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />

      <div className="auth-card animate-in">
        {/* Logo */}
        <div className="auth-logo">
          <img
            src="/ccid-logo.png"
            alt="CCID — Cyber Crime Intelligence & Detection"
            className="auth-logo-img"
          />
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: 'var(--text-heading)' }}>Create Account</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 22 }}>
          Register for access to the investigation platform.
        </p>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px',
            background: 'var(--status-crit-bg)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius)', marginBottom: 18,
            fontSize: 13, color: 'var(--status-crit)',
          }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 5v3M8 10h.01" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="reg-fullname" className="form-label">Full Name</label>
            <input id="reg-fullname" name="fullName" type="text" className="form-control"
              placeholder="e.g. Detective John Smith"
              value={form.fullName} onChange={handleChange} required />
          </div>

          <div className="mb-3">
            <label htmlFor="reg-email" className="form-label">Email</label>
            <input id="reg-email" name="email" type="email" className="form-control"
              placeholder="investigator@agency.gov"
              value={form.email} onChange={handleChange} required />
          </div>

          <div className="mb-3">
            <label htmlFor="reg-role" className="form-label">Role</label>
            <select id="reg-role" name="role" className="form-select" value={form.role} onChange={handleChange}>
              <option value="investigator">Investigator</option>
              <option value="analyst">Analyst</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label htmlFor="reg-password" className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-password" name="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control" placeholder="Minimum 8 characters"
                value={form.password} onChange={handleChange} required minLength={8}
                style={{ paddingRight: 38 }} />
              <button type="button" onClick={() => setShowPassword((s) => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-4">
            <label htmlFor="reg-confirm" className="form-label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input id="reg-confirm" name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-control" placeholder="Repeat password"
                value={form.confirmPassword} onChange={handleChange} required
                style={{ paddingRight: 38 }} />
              <button type="button" onClick={() => setShowConfirmPassword((s) => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
          </div>

          <button id="btn-register" type="submit" className="btn btn-primary w-100"
            disabled={loading} style={{ height: 40, justifyContent: 'center' }}>
            {loading ? (
              <><span className="spinner-border spinner-border-sm" role="status" /> Creating account…</>
            ) : 'Create Account'}
          </button>
        </form>

        <div className="glow-line" style={{ margin: '22px 0' }} />

        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Already have access?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
