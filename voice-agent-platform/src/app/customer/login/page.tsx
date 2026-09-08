'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Login failed.');
        return;
      }
      router.push('/customer/dashboard');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-black/10 dark:border-white/10 rounded-lg p-6 space-y-4">
        <h1 className="text-lg font-semibold">Business Portal — Login</h1>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded bg-black text-white dark:bg-white dark:text-black py-2 text-sm font-medium disabled:opacity-50">
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-center opacity-70">No account yet? <Link href="/customer/register" className="underline">Register your business</Link></p>
      </form>
    </div>
  );
}
