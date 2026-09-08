'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CLINIC_SERVICE_TYPES } from '@/domain/script/CallScript';

const SERVICE_TYPES: string[] = CLINIC_SERVICE_TYPES;

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [serviceType, setServiceType] = useState('yoga');
  const [servicesDescription, setServicesDescription] = useState('');
  const [pricingInfo, setPricingInfo] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [holidaysClosures, setHolidaysClosures] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, businessName, serviceType, servicesDescription, pricingInfo, businessHours, holidaysClosures }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Registration failed.');
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
      <form onSubmit={handleSubmit} className="w-full max-w-lg border border-black/10 dark:border-white/10 rounded-lg p-6 space-y-4">
        <h1 className="text-lg font-semibold">Register Your Business</h1>
        <p className="text-sm opacity-60">This information grounds your outbound-call assistant — never fabricated, always what you enter here.</p>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Password *</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Business name *</label>
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Service type *</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent capitalize">
              {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">What services do you offer?</label>
          <textarea value={servicesDescription} onChange={(e) => setServicesDescription(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Pricing</label>
          <textarea value={pricingInfo} onChange={(e) => setPricingInfo(e.target.value)} rows={2} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Business hours</label>
            <input value={businessHours} onChange={(e) => setBusinessHours(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Holidays / closures</label>
            <input value={holidaysClosures} onChange={(e) => setHolidaysClosures(e.target.value)} className="w-full border border-black/20 dark:border-white/20 rounded px-3 py-2 bg-transparent" />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded bg-black text-white dark:bg-white dark:text-black py-2 text-sm font-medium disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
