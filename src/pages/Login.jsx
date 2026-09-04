import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Eye, EyeOff, Shield } from 'lucide-react';

function GoldInput({ type, placeholder, value, onChange, id, rightElement }) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={type === 'password' ? 'current-password' : 'email'}
        className="w-full px-4 py-3.5 rounded-lg text-base font-rajdhani outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1.5px solid rgba(255,215,0,0.35)',
          color: '#f0f0f0',
          fontFamily: 'var(--font-rajdhani)',
        }}
        onFocus={e => e.target.style.borderColor = '#FFD700'}
        onBlur={e => e.target.style.borderColor = 'rgba(255,215,0,0.35)'}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
      )}
    </div>
  );
}

function PasswordInput({ placeholder, value, onChange, id, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <GoldInput
      id={id}
      type={show ? 'text' : 'password'}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          style={{ color: '#FFD700', opacity: 0.7, minHeight: 'unset' }}
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}

function Logo() {
  return (
    <div className="flex flex-col items-center gap-2 mb-8">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl mb-1" style={{ background: 'rgba(255,215,0,0.1)', border: '1.5px solid rgba(255,215,0,0.3)' }}>
        <Shield className="w-8 h-8" style={{ color: '#FFD700' }} />
      </div>
      <h1 className="text-3xl font-orbitron font-bold tracking-widest" style={{ color: '#FFD700', letterSpacing: '0.15em' }}>
        MILLION<span style={{ color: '#fff' }}>TSP</span>
      </h1>
      <p className="text-sm font-rajdhani" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
        TSP Tracking for Federal Employees
      </p>
    </div>
  );
}

// ─── Login Screen ───────────────────────────────────────────────────────────
function LoginScreen({ onGoSignup, onGoForgot, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      const result = await base44.auth.loginViaEmailPassword(email, password);
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      onSuccess();
    } catch (err) {
      const msg = err?.data?.message || err?.message || '';
      if (/not found|no user|email/i.test(msg)) setError('No account found with that email.');
      else if (/password|invalid|wrong|incorrect/i.test(msg)) setError('Incorrect password. Please try again.');
      else setError(msg || 'Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <GoldInput id="email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <PasswordInput id="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

      {error && <p className="text-sm font-rajdhani text-center" style={{ color: '#ff4444' }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-lg text-base font-bold font-rajdhani tracking-widest transition-all disabled:opacity-50"
        style={{ background: '#FFD700', color: '#080800', minHeight: 50 }}
      >
        {loading ? 'SIGNING IN...' : 'SIGN IN'}
      </button>

      <div className="text-center">
        <button type="button" onClick={onGoForgot} className="text-sm font-rajdhani" style={{ color: '#FFD700', minHeight: 'unset' }}>
          Forgot Password?
        </button>
      </div>

      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.15)' }} />
        <span className="text-xs font-rajdhani" style={{ color: 'rgba(255,255,255,0.3)' }}>OR</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.15)' }} />
      </div>

      <p className="text-center text-sm font-rajdhani" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Don't have an account?{' '}
        <button type="button" onClick={onGoSignup} className="font-bold" style={{ color: '#FFD700', minHeight: 'unset' }}>
          Sign Up
        </button>
      </p>
    </form>
  );
}

// ─── Signup Screen ───────────────────────────────────────────────────────────
function SignupScreen({ onGoLogin, onVerify }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!validateEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password, full_name: fullName.trim() });
      onVerify(email);
    } catch (err) {
      const msg = err?.data?.message || err?.message || '';
      if (/exists|already|taken/i.test(msg)) setError('An account with this email already exists.');
      else setError(msg || 'Sign up failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <GoldInput id="name" type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
      <GoldInput id="email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
      <PasswordInput id="password" placeholder="Password (min. 8 characters)" value={password} onChange={e => setPassword(e.target.value)} />
      <PasswordInput id="confirm" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />

      {error && <p className="text-sm font-rajdhani text-center" style={{ color: '#ff4444' }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-lg text-base font-bold font-rajdhani tracking-widest transition-all disabled:opacity-50"
        style={{ background: '#FFD700', color: '#080800', minHeight: 50 }}
      >
        {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
      </button>

      <p className="text-center text-xs font-rajdhani" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {/* TODO: change back to 3-day once the app is approved */}
        Start your 30-day free trial. No credit card required.
      </p>

      <p className="text-center text-sm font-rajdhani" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Already have an account?{' '}
        <button type="button" onClick={onGoLogin} className="font-bold" style={{ color: '#FFD700', minHeight: 'unset' }}>
          Sign In
        </button>
      </p>
    </form>
  );
}

// ─── Verify Email Screen ─────────────────────────────────────────────────────
function VerifyScreen({ email, onGoLogin, onSuccess }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      await base44.auth.verifyEmail(email, code);
      onSuccess();
    } catch (err) {
      setError('Invalid code. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResent(false);
    try {
      await base44.auth.resendVerificationCode(email);
      setResent(true);
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    }
  };

  return (
    <form onSubmit={handleVerify} className="w-full space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-orbitron font-bold" style={{ color: '#FFD700' }}>Check Your Email</h2>
        <p className="text-sm font-rajdhani" style={{ color: 'rgba(255,255,255,0.55)' }}>
          We sent a 6-digit verification code to<br />
          <span style={{ color: 'rgba(255,255,255,0.8)' }}>{email}</span>
        </p>
      </div>

      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          placeholder="000000"
          value={code}
          maxLength={6}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full px-4 py-4 rounded-lg text-center text-2xl font-bold font-orbitron tracking-[0.4em] outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1.5px solid rgba(255,215,0,0.35)',
            color: '#FFD700',
          }}
          onFocus={e => e.target.style.borderColor = '#FFD700'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,215,0,0.35)'}
        />
      </div>

      {error && <p className="text-sm font-rajdhani text-center" style={{ color: '#ff4444' }}>{error}</p>}
      {resent && !error && <p className="text-sm font-rajdhani text-center" style={{ color: '#4CAF50' }}>Code resent!</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-lg text-base font-bold font-rajdhani tracking-widest transition-all disabled:opacity-50"
        style={{ background: '#FFD700', color: '#080800', minHeight: 50 }}
      >
        {loading ? 'VERIFYING...' : 'VERIFY'}
      </button>

      <div className="text-center">
        <button type="button" onClick={handleResend} className="text-sm font-rajdhani" style={{ color: '#FFD700', minHeight: 'unset' }}>
          Resend Code
        </button>
      </div>

      <div className="text-center">
        <button type="button" onClick={onGoLogin} className="text-sm font-rajdhani" style={{ color: 'rgba(255,255,255,0.45)', minHeight: 'unset' }}>
          ← Back to Sign In
        </button>
      </div>
    </form>
  );
}

// ─── Forgot Password Screen ──────────────────────────────────────────────────
function ForgotPasswordScreen({ onGoLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
      setSent(true);
    } catch (err) {
      const msg = err?.data?.message || err?.message || '';
      setError(msg || 'Failed to send reset link. Please try again.');
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="w-full text-center space-y-4">
        <div className="p-4 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <p className="text-sm font-rajdhani" style={{ color: '#FFD700' }}>Reset link sent! Check your email inbox.</p>
        </div>
        <button type="button" onClick={onGoLogin} className="text-sm font-rajdhani" style={{ color: '#FFD700', minHeight: 'unset' }}>
          ← Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <p className="text-sm font-rajdhani text-center mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
        Enter your email and we'll send you a password reset link.
      </p>
      <GoldInput id="reset-email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />

      {error && <p className="text-sm font-rajdhani text-center" style={{ color: '#ff4444' }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-lg text-base font-bold font-rajdhani tracking-widest transition-all disabled:opacity-50"
        style={{ background: '#FFD700', color: '#080800', minHeight: 50 }}
      >
        {loading ? 'SENDING...' : 'SEND RESET LINK'}
      </button>

      <div className="text-center">
        <button type="button" onClick={onGoLogin} className="text-sm font-rajdhani" style={{ color: '#FFD700', minHeight: 'unset' }}>
          ← Back to Sign In
        </button>
      </div>
    </form>
  );
}

// ─── Main Login Page ─────────────────────────────────────────────────────────
export default function Login() {
  const [screen, setScreen] = useState('login'); // 'login' | 'signup' | 'forgot' | 'verify'
  const [verifyEmail, setVerifyEmail] = useState('');
  const { checkUserAuth } = useAuth();

  // Re-check the (now-established) Supabase session and let AuthContext flip
  // isAuthenticated - this swaps straight to the app in place. A hard
  // `window.location.href` reload here would re-fetch the whole site from
  // the network, which inside the native WebView feels like being bounced
  // out to the website instead of just landing on the dashboard.
  const handleAuthSuccess = () => {
    checkUserAuth();
  };

  const handleGoVerify = (email) => {
    setVerifyEmail(email);
    setScreen('verify');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8" style={{ background: '#080800' }}>
      <div className="w-full max-w-sm">
        <Logo />

        {(screen === 'login' || screen === 'signup') && (
          // Matches the trial length in OnboardingFlow.jsx — temporarily 30
          // days for App Store review. TODO: change both back to 3 once approved.
          <p className="text-center text-xs font-rajdhani -mt-5 mb-6" style={{ color: 'rgba(255,215,0,0.6)' }}>
            Free 30-day trial. No credit card required.
          </p>
        )}

        {screen === 'login' && (
          <LoginScreen
            onGoSignup={() => setScreen('signup')}
            onGoForgot={() => setScreen('forgot')}
            onSuccess={handleAuthSuccess}
          />
        )}
        {screen === 'signup' && (
          <SignupScreen
            onGoLogin={() => setScreen('login')}
            onVerify={handleGoVerify}
          />
        )}
        {screen === 'forgot' && (
          <ForgotPasswordScreen
            onGoLogin={() => setScreen('login')}
          />
        )}
        {screen === 'verify' && (
          <VerifyScreen
            email={verifyEmail}
            onGoLogin={() => setScreen('login')}
            onSuccess={handleAuthSuccess}
          />
        )}
      </div>
    </div>
  );
}