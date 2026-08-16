import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const REMEMBER_KEY = 'ccid-remember-email';

export default function Login() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  useEffect(() => {
    if (session) navigate('/dashboard', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="login-stage">
      <div className="login-india" aria-hidden="true">INDIA</div>
      <div className="login-radar" aria-hidden="true" />
      <div className="login-glow login-glow-a" />
      <div className="login-glow login-glow-b" />

      <div className="login-wrap">
        <header className="login-top">
          <img
            src="/ccid-logo.png"
            alt="CCID — Cyber Crime Intelligence & Detection"
            className="login-logo-img"
          />
        </header>

        <main className="login-main">
          <section className="login-hero">
            <div className="login-eyebrow">
              <span className="login-dot" />
              National Digital Intelligence Network
            </div>
            <h1>
              <span className="login-l-white">You can</span>
              <span className="login-l-red">lie.</span>
              <span className="login-l-white">But your</span>
              <span className="login-l-white">digital</span>
              <span className="login-l-white">footprint</span>
              <span className="login-l-red">won’t.</span>
            </h1>
            <p className="login-tag">
              Every trace. Every connection.{' '}
              <span>Every clue.</span>
            </p>
          </section>

          <section className="login-card-shell">
            <div className="login-card">
              <div className="login-card-head">
                <img src="/ccid-logo.png" alt="" className="login-mini-img" />
                <div>
                  <div className="login-welcome">Secure Access</div>
                  <div className="login-welcome-sub">Enter your authorized CCID credentials</div>
                </div>
              </div>

              {error && <div className="login-error" role="alert">{error}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <label htmlFor="login-email" className="login-label">Officer ID / Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="login-input"
                  placeholder="officer@ccid.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />

                <label htmlFor="login-password" className="login-label">Password</label>
                <div className="login-pw-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((s) => !s)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                      {showPassword ? (
                        <>
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                          <path d="M2 2l12 12" strokeLinecap="round" />
                        </>
                      ) : (
                        <>
                          <path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" />
                          <circle cx="8" cy="8" r="2" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>

                <div className="login-row">
                  <label className="login-remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember this device
                  </label>
                  <button
                    type="button"
                    className="login-forgot"
                    onClick={() => setError('Contact your administrator to reset your password.')}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  className="login-submit"
                  disabled={loading || !email || !password}
                >
                  {loading ? 'Authenticating…' : 'Access Command Center →'}
                </button>
              </form>

              <div className="login-status">
                <span>Encrypted connection</span>
                <span className="login-sys">
                  <span className="login-dot login-dot-ok" />
                  System secure
                </span>
              </div>

              <p className="login-foot">
                Need access? <Link to="/register">Request an account</Link>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
