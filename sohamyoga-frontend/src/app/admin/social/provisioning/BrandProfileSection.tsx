'use client';
// The one real, tenant-level brand profile (drafted by BrandProfileDraftJob),
// with an explicit human approve/reject action. This component never
// auto-approves anything — that decision belongs to a real person reviewing
// real drafted copy before it's used anywhere.
import { useEffect, useState, useCallback } from 'react';

interface Profile {
  brand_name: string; tagline: string; bio_80: string; bio_150: string; bio_255: string;
  description_1000: string; keywords: string[]; default_hashtags: string[]; approval_status: string;
}
interface PlatformBio { platform: string; bio_tier: string; bio_text: string; status: string }

export default function BrandProfileSection() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bios, setBios] = useState<PlatformBio[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/social/brand-profile', { cache: 'no-store' })
      .then(r => r.json()).then(d => { setProfile(d.profile); setBios(d.platformBios ?? []); });
  }, []);
  useEffect(() => { load() }, [load]);

  async function decide(action: 'approve' | 'reject') {
    setMessage('Saving…');
    const r = await fetch('/api/admin/social/brand-profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    const b = await r.json();
    setMessage(r.ok ? `Profile ${b.profile.approval_status}.` : b.error);
    if (r.ok) load();
  }

  if (!profile) {
    return (
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Brand profile</h2>
        <p className="mt-1 text-sm text-gray-500">No draft exists yet — run the brand-profile-draft job.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Brand profile</h2>
        <span className={`rounded px-2 py-1 text-xs ${profile.approval_status === 'approved' ? 'bg-green-100 text-green-800' : profile.approval_status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{profile.approval_status}</span>
      </div>
      <p className="mt-2 text-sm text-gray-500">Drafted by Ollama from verified tenant facts only. Review before approving — no bio derives to any of the 35 platforms until this is approved.</p>
      <div className="mt-3 space-y-2 text-sm">
        <div><span className="font-medium">Tagline:</span> {profile.tagline}</div>
        <div><span className="font-medium">Bio (80):</span> {profile.bio_80}</div>
        <div><span className="font-medium">Bio (150):</span> {profile.bio_150}</div>
        <div><span className="font-medium">Bio (255):</span> {profile.bio_255}</div>
        <div><span className="font-medium">Description:</span> {profile.description_1000}</div>
        <div><span className="font-medium">Keywords:</span> {profile.keywords?.join(', ')}</div>
      </div>
      {profile.approval_status === 'draft' && (
        <div className="mt-4 flex gap-2">
          <button className="rounded bg-green-600 px-4 py-2 text-sm text-white" onClick={() => decide('approve')}>Approve</button>
          <button className="rounded border border-red-300 px-4 py-2 text-sm text-red-700" onClick={() => decide('reject')}>Reject</button>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-gray-500">{message}</p>}

      {bios.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-600">Derived platform bios ({bios.length})</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {bios.map(b => (
              <div key={b.platform} className="rounded border p-2 text-xs">
                <span className="font-medium capitalize">{b.platform.replaceAll('_', ' ')}</span> ({b.bio_tier}): {b.bio_text}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
