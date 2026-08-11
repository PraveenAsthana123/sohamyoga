'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import { customerAuthApi } from '@/lib/api';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { num: 1 as Step, label: 'Identity'     },
  { num: 2 as Step, label: 'Yoga Goals'   },
  { num: 3 as Step, label: 'Membership'   },
  { num: 4 as Step, label: 'Consent'      },
  { num: 5 as Step, label: 'Confirm'      },
];

const GOALS = [
  { id: 'stress_relief',    label: 'Stress Relief',      icon: '🧘' },
  { id: 'weight_loss',      label: 'Weight Management',  icon: '⚖️' },
  { id: 'flexibility',      label: 'Flexibility',        icon: '🤸' },
  { id: 'strength',         label: 'Strength',           icon: '💪' },
  { id: 'meditation',       label: 'Meditation',         icon: '☮️' },
  { id: 'pregnancy',        label: 'Prenatal Yoga',      icon: '🌸' },
  { id: 'rehabilitation',   label: 'Rehabilitation',     icon: '🏥' },
  { id: 'general_fitness',  label: 'General Fitness',    icon: '🌟' },
];

const MEMBERSHIPS = [
  { id: 'trial',    label: 'Free Trial',     price: '$0',   desc: '1 class, no credit card',            color: 'border-gray-300 text-gray-700' },
  { id: 'dropin',   label: 'Drop-In',        price: '$22',  desc: 'Pay per class, no commitment',       color: 'border-teal-300 text-teal-700'  },
  { id: 'silver',   label: 'Silver',         price: '$89/mo', desc: '8 classes/month + 1 live',        color: 'border-green-400 text-green-800' },
  { id: 'gold',     label: 'Gold',           price: '$149/mo', desc: 'Unlimited + live + recordings',  color: 'border-amber-400 text-amber-800', badge: 'Popular' },
  { id: 'platinum', label: 'Platinum',       price: '$199/mo', desc: 'All Gold + 1:1 coaching',       color: 'border-purple-400 text-purple-800' },
];

export default function CustomerRegisterPage() {
  const [step,     setStep]    = useState<Step>(1);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');

  // Step 1
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [mobile,      setMobile]      = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmed,   setConfirmed]   = useState('');
  const [otpSent,     setOtpSent]     = useState(false);
  const [otp,         setOtp]         = useState('');
  const [usePassword, setUsePassword] = useState(true);

  // Step 2
  const [goal,       setGoal]      = useState('');
  const [level,      setLevel]     = useState('');
  const [stylesPref, setStylesPref]= useState('');
  const [days,       setDays]      = useState<string[]>([]);

  // Step 3
  const [plan,   setPlan]   = useState('');
  const [coupon, setCoupon] = useState('');
  const [ref,    setRef]    = useState('');

  // Step 4 consents
  const [termsOk,    setTermsOk]    = useState(false);
  const [privacyOk,  setPrivacyOk]  = useState(false);
  const [marketingOk,setMarketingOk]= useState(false);

  // A referral link (/r/[code]) redirects here with ?ref=CODE — capture it
  // into the same field the manual "Referral Code" input writes to, so a
  // real click flows through to a real registered referral either way.
  useEffect(() => {
    const refParam = new URLSearchParams(window.location.search).get('ref');
    if (refParam) setRef(refParam.toUpperCase());
  }, []);

  const next = async () => {
    setError('');
    if (step < 5) setStep((step + 1) as Step);
    else await submit();
  };

  const submit = async () => {
    setLoading(true);
    try {
      await customerAuthApi.register({ name, email, password });
      // Real account + session now exist (ASP.NET Identity, via the .NET
      // backend proxy) but no Postgres customer row yet — that, and real
      // referral attribution if a code was entered, happens here.
      await fetch('/api/customer/complete-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, marketingOptIn: marketingOk, referralCode: ref || undefined }),
      });
      window.location.href = '/customer/dashboard';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email && !mobile) { setError('Enter email or mobile first'); return; }
    await new Promise((r) => setTimeout(r, 500));
    setOtpSent(true);
  };

  const toggleDay = (d: string) =>
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const canProceed = () => {
    if (step === 1) return usePassword ? (name && email && password && confirmed && otp) : (name && email && otp);
    if (step === 2) return goal && level;
    if (step === 3) return !!plan;
    if (step === 4) return termsOk && privacyOk;
    return true;
  };

  const fieldCls = 'w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50';
  const labelCls = 'block text-sm font-medium text-white/70 mb-1';

  return (
    <main className="min-h-screen bg-yoga-hero py-12 px-4">
      {/* Rings */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full border border-white/4 breathing-ring" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full border border-white/5 breathing-ring" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 max-w-xl mx-auto">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-4xl">🧘</span>
            <span className="text-2xl font-black text-white">Soham Yoga</span>
          </Link>
          <p className="text-white/50 text-sm mt-1">Create your student account</p>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s.num < step  ? 'bg-green-500 text-white' :
                  s.num === step ? 'bg-green-400 text-green-950' :
                  'bg-white/10 text-white/40'
                }`}>
                  {s.num < step ? '✓' : s.num}
                </div>
                <span className={`text-[9px] hidden sm:block transition-colors ${s.num === step ? 'text-green-400' : 'text-white/30'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 transition-colors ${s.num < step ? 'bg-green-500' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-dark p-8 rounded-2xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 1: Identity ──────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-white font-black text-xl mb-2">Create Your Identity</h2>
              <p className="text-white/50 text-sm mb-4">Sign up with Google, Facebook, or Apple in one tap.</p>
              <SocialLoginButtons redirectTo="/customer/register?step=2" />
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-xs">or create manually</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div>
                <label className={labelCls}>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className={fieldCls} placeholder="Your name" autoComplete="name" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className={fieldCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div>
                <label className={labelCls}>Mobile (recommended)</label>
                <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)}
                  className={fieldCls} placeholder="+1 416…" autoComplete="tel" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setUsePassword(true)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    usePassword ? 'bg-green-400/20 border-green-400/50 text-green-300' : 'border-white/10 text-white/40'
                  }`}>
                  Password
                </button>
                <button type="button" onClick={() => setUsePassword(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    !usePassword ? 'bg-green-400/20 border-green-400/50 text-green-300' : 'border-white/10 text-white/40'
                  }`}>
                  Passwordless
                </button>
              </div>
              {usePassword && (
                <>
                  <div>
                    <label className={labelCls}>Password</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className={fieldCls} placeholder="8+ characters" autoComplete="new-password" />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm Password</label>
                    <input type="password" value={confirmed} onChange={(e) => setConfirmed(e.target.value)}
                      className={fieldCls} placeholder="••••••••" />
                  </div>
                </>
              )}
              {!otpSent ? (
                <button type="button" onClick={sendOtp}
                  className="w-full py-2 rounded-xl glass text-white/70 text-sm hover:text-white transition-colors">
                  Send Email Verification Code
                </button>
              ) : (
                <div>
                  <label className={labelCls}>Verification Code</label>
                  <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                    className={fieldCls} placeholder="6-digit code" autoComplete="one-time-code" />
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Yoga Goals ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-white font-black text-xl">Your Yoga Goals</h2>
              <div>
                <label className={labelCls}>Primary Goal</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {GOALS.map((g) => (
                    <button key={g.id} type="button" onClick={() => setGoal(g.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                        goal === g.id
                          ? 'bg-green-400/20 border-green-400/50 text-green-300'
                          : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white/80'
                      }`}>
                      <span>{g.icon}</span> {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Experience Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['beginner', 'intermediate', 'advanced'].map((l) => (
                    <button key={l} type="button" onClick={() => setLevel(l)}
                      className={`py-2 rounded-xl border text-sm capitalize font-medium transition-all ${
                        level === l
                          ? 'bg-green-400/20 border-green-400/50 text-green-300'
                          : 'border-white/10 text-white/60 hover:text-white/80'
                      }`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Preferred Days (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
                        days.includes(d)
                          ? 'bg-green-400/20 border-green-400/50 text-green-300'
                          : 'border-white/10 text-white/40'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Preferred Style (optional)</label>
                <input type="text" value={stylesPref} onChange={(e) => setStylesPref(e.target.value)}
                  className={fieldCls} placeholder="Hatha, Vinyasa, Yin…" />
              </div>
            </div>
          )}

          {/* ── Step 3: Membership ───────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-white font-black text-xl">Choose Your Plan</h2>
              <div className="space-y-2">
                {MEMBERSHIPS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setPlan(m.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      plan === m.id
                        ? 'border-green-400 bg-green-400/15'
                        : 'border-white/10 hover:border-white/25'
                    }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${plan === m.id ? 'text-green-300' : 'text-white'}`}>
                          {m.label}
                        </span>
                        {m.badge && (
                          <span className="yoga-tag bg-amber-400/20 text-amber-300 text-[9px]">{m.badge}</span>
                        )}
                      </div>
                      <div className="text-white/50 text-xs mt-0.5">{m.desc}</div>
                    </div>
                    <div className={`font-black text-base ${plan === m.id ? 'text-green-400' : 'text-white/70'}`}>
                      {m.price}
                    </div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Coupon Code</label>
                  <input type="text" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    className={fieldCls} placeholder="SUMMER25" />
                </div>
                <div>
                  <label className={labelCls}>Referral Code</label>
                  <input type="text" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())}
                    className={fieldCls} placeholder="AARAV2026" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Consent ──────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-white font-black text-xl">Your Consent</h2>
              <p className="text-white/50 text-sm">We need your agreement to proceed. Marketing consent is separate and optional.</p>
              {[
                { state: termsOk,    set: setTermsOk,    label: 'I accept the Terms of Service', required: true,  href: '/legal/terms' },
                { state: privacyOk,  set: setPrivacyOk,  label: 'I accept the Privacy Policy',   required: true,  href: '/legal/privacy' },
                { state: marketingOk,set: setMarketingOk,label: 'I agree to receive marketing emails and SMS (optional)', required: false, href: null },
              ].map(({ state, set, label, required: req, href }) => (
                <label key={label} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={state} onChange={(e) => set(e.target.checked)}
                    className="mt-0.5 w-5 h-5 rounded border-2 border-white/25 bg-white/8 accent-green-400
                               checked:border-green-400 checked:bg-green-400/20 flex-shrink-0" />
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors leading-relaxed">
                    {label}
                    {req && <span className="text-red-400"> *</span>}
                    {href && (
                      <Link href={href} target="_blank" className="text-green-400 hover:text-green-300 ml-1 underline text-xs">
                        Read
                      </Link>
                    )}
                  </span>
                </label>
              ))}
              <div className="glass rounded-xl p-4 text-xs text-white/45 leading-relaxed">
                By registering, you consent to data processing as described in our Privacy Policy under PIPEDA (Canada),
                GDPR (if applicable), and ICMR guidelines. Your yoga health data is stored separately and is never sold.
              </div>
            </div>
          )}

          {/* ── Step 5: Confirm ──────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-white font-black text-xl">Almost Done!</h2>
              <div className="glass rounded-xl p-5 space-y-3 text-sm">
                {[
                  { label: 'Name',       value: name },
                  { label: 'Email',      value: email },
                  { label: 'Mobile',     value: mobile || '—' },
                  { label: 'Goal',       value: GOALS.find((g) => g.id === goal)?.label ?? goal },
                  { label: 'Level',      value: level },
                  { label: 'Plan',       value: MEMBERSHIPS.find((m) => m.id === plan)?.label ?? plan },
                  { label: 'Coupon',     value: coupon || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-white/50">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
              <div className="glass-dark rounded-xl p-4">
                <p className="text-white/60 text-xs leading-relaxed">
                  ✓ Your unique check-in QR code will be issued immediately after registration.<br />
                  ✓ You can add it to Apple Wallet or Google Wallet from your dashboard.<br />
                  ✓ The QR code is for attendance only — never used as a password.
                </p>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button type="button" onClick={() => setStep((step - 1) as Step)}
                className="flex-1 py-3 rounded-xl glass text-white/70 font-semibold hover:text-white transition-colors">
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!canProceed() || loading}
              className="flex-1 py-3 rounded-xl bg-green-400 text-green-950 font-bold hover:bg-green-300
                         transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-green-950/30 border-t-green-950 rounded-full animate-spin" />}
              {step < 5 ? 'Continue →' : loading ? 'Creating account…' : 'Create Account 🎉'}
            </button>
          </div>
        </div>

        <p className="text-center text-white/35 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/customer/login" className="text-green-400 hover:text-green-300 font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
