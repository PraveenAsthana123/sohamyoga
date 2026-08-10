'use client';

import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function CustomerLoginPage() {
  return (
    <main className="min-h-screen bg-yoga-hero flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative breathing rings */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/6  w-80 h-80 rounded-full border border-white/4 breathing-ring" />
        <div className="absolute bottom-1/4 right-1/6 w-56 h-56 rounded-full border border-white/6 breathing-ring" style={{ animationDelay: '2s' }} />
        <div className="absolute top-3/4 left-1/2  w-40 h-40 rounded-full border border-white/3 breathing-ring" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-5xl">🧘</span>
            <span className="text-3xl font-black text-white">Soham Yoga</span>
            <span className="text-green-400 text-xs font-semibold tracking-widest uppercase">
              Student Portal
            </span>
          </Link>
        </div>

        {/* Multi-method login card */}
        <LoginForm redirectTo="/student/dashboard" />

        <div className="mt-6 text-center space-y-2">
          <p className="text-white/40 text-sm">
            New to Soham?{' '}
            <Link href="/customer/register" className="text-green-400 hover:text-green-300 font-semibold transition-colors">
              Create your free account
            </Link>
          </p>
          <p className="text-white/25 text-xs">
            Teacher or admin?{' '}
            <Link href="/auth/login" className="text-white/45 hover:text-white/70 transition-colors">
              Staff sign-in →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
