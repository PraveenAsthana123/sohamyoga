'use client';

import { useState } from 'react';
import Link from 'next/link';
import SocialLoginButtons from './SocialLoginButtons';

type LoginTab = 'password' | 'otp' | 'passkey' | 'qr';

const TABS: { id: LoginTab; label: string; icon: string }[] = [
  { id: 'password', label: 'Password',  icon: '🔑' },
  { id: 'otp',      label: 'One-Time Code', icon: '📱' },
  { id: 'passkey',  label: 'Passkey',   icon: '🔐' },
  { id: 'qr',       label: 'QR Login',  icon: '📷' },
];

interface LoginFormProps {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo = '/student/dashboard' }: LoginFormProps) {
  const [tab, setTab] = useState<LoginTab>('password');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // TODO: wire to Keycloak token endpoint
      await new Promise((r) => setTimeout(r, 800));
      window.location.href = redirectTo;
    } catch {
      setError('Sign-in failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email && !mobile) { setError('Enter your email or mobile number first'); return; }
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 600));
    setOtpSent(true);
    setLoading(false);
  };

  const passkeyLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // TODO: navigator.credentials.get({ publicKey: ... }) via WebAuthn API
      await new Promise((r) => setTimeout(r, 800));
      window.location.href = redirectTo;
    } catch {
      setError('Passkey authentication failed. Try another sign-in method.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-dark p-8 rounded-2xl w-full">
      <h1 className="text-2xl font-black text-white mb-6 text-center">Welcome Back</h1>

      {/* Social login buttons */}
      <SocialLoginButtons redirectTo={redirectTo} />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/35 text-xs font-medium">or sign in with</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Method tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              tab === t.id
                ? 'bg-green-400 text-green-950'
                : 'text-white/60 hover:text-white/90'
            }`}
          >
            <span className="block text-base leading-none mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ── Password tab ─────────────────────────────────── */}
      {tab === 'password' && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium text-white/70">Password</label>
              <Link href="/auth/forgot-password" className="text-xs text-green-400 hover:text-green-300">Forgot?</Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30
                         focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 text-sm"
            />
          </div>
          <SubmitBtn loading={loading} label="Sign In" />
        </form>
      )}

      {/* ── OTP tab ──────────────────────────────────────── */}
      {tab === 'otp' && (
        <form onSubmit={submit} className="space-y-4">
          {!otpSent ? (
            <>
              <Field label="Email or Mobile" type="text" value={email || mobile}
                onChange={(v) => (v.includes('@') ? setEmail(v) : setMobile(v))}
                placeholder="email or +1 416..." autoComplete="email" />
              <button type="button" onClick={sendOtp} disabled={loading}
                className="w-full py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300
                           transition-colors disabled:opacity-50">
                {loading ? 'Sending…' : 'Send One-Time Code'}
              </button>
            </>
          ) : (
            <>
              <p className="text-green-300 text-sm text-center">Code sent! Check your inbox or messages.</p>
              <Field label="Enter Code" type="text" value={otp} onChange={setOtp}
                placeholder="6-digit code" autoComplete="one-time-code" />
              <SubmitBtn loading={loading} label="Verify & Sign In" />
              <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }}
                className="w-full text-center text-white/45 text-xs hover:text-white/70 transition-colors">
                Resend code
              </button>
            </>
          )}
        </form>
      )}

      {/* ── Passkey tab ───────────────────────────────────── */}
      {tab === 'passkey' && (
        <div className="space-y-5 text-center">
          <div className="text-6xl">🔐</div>
          <p className="text-white/70 text-sm leading-relaxed">
            Use your device fingerprint, face ID, or hardware security key.
            No password required.
          </p>
          <button
            type="button"
            onClick={passkeyLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300
                       transition-colors disabled:opacity-50"
          >
            {loading ? 'Authenticating…' : 'Sign In with Passkey'}
          </button>
          <p className="text-white/35 text-xs">
            First time?{' '}
            <Link href="/customer/register" className="text-green-400 hover:text-green-300">
              Register a passkey
            </Link>
          </p>
        </div>
      )}

      {/* ── QR kiosk tab ─────────────────────────────────── */}
      {tab === 'qr' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl">📷</div>
          <p className="text-white/70 text-sm leading-relaxed">
            Already logged in on your phone? The kiosk will display a QR code.
            Scan it with your authenticated Soham app to sign in here.
          </p>
          <Link
            href="/auth/qr-login"
            className="block w-full py-3 rounded-xl bg-green-400 text-green-950 font-bold
                       hover:bg-green-300 transition-colors text-center"
          >
            Open QR Kiosk Login
          </Link>
          <p className="text-white/35 text-xs">QR code expires in 60 seconds · One-time use</p>
        </div>
      )}
    </div>
  );
}

/* ── Small reusable field ───────────────────────────────────────────────── */
function Field({ label, type, value, onChange, placeholder, autoComplete }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30
                   focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 text-sm"
      />
    </div>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300
                 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {loading && <span className="w-4 h-4 border-2 border-green-950/40 border-t-green-950 rounded-full animate-spin" />}
      {loading ? 'Signing in…' : label}
    </button>
  );
}
