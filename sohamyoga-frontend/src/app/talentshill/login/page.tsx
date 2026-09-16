'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TalentsHillLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('th_client_email', email);
        }
        router.push('/talentshill/dashboard');
      } else {
        const data = (await res.json()) as { error?: string; message?: string };
        setError(data.error ?? data.message ?? 'Invalid credentials. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Blur orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/talentshill">
            <span className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
              TalentsHill
            </span>
          </Link>
          <p className="text-white/50 mt-2 text-sm">Sign in to your client portal</p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl shadow-xl p-8">
          <h1 className="text-xl font-bold text-white mb-6 text-center">Welcome back</h1>

          {error && (
            <div className="backdrop-blur-md bg-red-500/20 border border-red-400/30 rounded-xl p-3 mb-5 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 focus:bg-white/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-3 w-full backdrop-blur-sm focus:outline-none focus:border-blue-400/60 focus:bg-white/15 transition-all"
              />
            </div>
            <div className="flex justify-end">
              <a href="#" className="text-blue-400 text-sm hover:text-cyan-400 transition-colors">
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white rounded-xl px-6 py-3 font-semibold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white/40 text-xs">or continue with</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Social auth */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white/80 hover:bg-white/20 hover:text-white transition-all text-sm font-medium"
            >
              <span>🔵</span> Google
            </a>
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2 backdrop-blur-md bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white/80 hover:bg-white/20 hover:text-white transition-all text-sm font-medium"
            >
              <span>⚫</span> GitHub
            </a>
          </div>

          {/* Sign-up link */}
          <p className="text-center text-white/50 text-sm mt-6">
            {"Don't have an account? "}
            <Link
              href="/talentshill/signup"
              className="text-blue-400 hover:text-cyan-400 transition-colors font-medium"
            >
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
