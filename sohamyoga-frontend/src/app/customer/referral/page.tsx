'use client';
// /customer/referral — self-service referral tools. Closes the previously
// explicit "no public customer-facing referral/share UI" boundary. Reads
// real data only: a real referral_code (yours, or issued for you by
// ReferralInvitationJob if you were flagged a strong advocacy candidate),
// the real active campaign's reward terms (if any), your real wallet
// balance, and your real referral history.

import { useEffect, useState } from 'react';

interface ReferralData {
  hasCode: boolean;
  code: { code: string; referralUrl: string; status: string; clickCount: number; usedCount: number; invitationDraft: string | null; invitationDraftedAt: string | null } | null;
  activeCampaign: { name: string; rewardType: string; referrerRewardValue: number; referreeRewardValue: number } | null;
  wallet: { balance: number; lifetimeEarned: number };
  history: { referreeEmail: string; status: string; createdAt: string }[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Pending', shared: 'Shared', clicked: 'Clicked', registered: 'Signed up',
  verified: 'Verified', membership_purchased: 'Joined!', reward_pending: 'Reward pending',
  reward_approved: 'Reward approved', reward_paid: 'Reward paid', reward_rejected: 'Not eligible', expired: 'Expired',
};

export default function CustomerReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => {
    fetch('/api/customer/referral', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  };

  useEffect(load, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/customer/referral/generate-code', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a referral code');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code.referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Refer a Friend</h1>
        <p className="text-sm text-gray-500 mt-1">Share your real referral link — every click and signup here is tracked for real.</p>
      </header>

      {!data.hasCode ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">You don't have a referral code yet.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Get My Referral Link'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Your referral link</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{data.code!.referralUrl}</code>
              <button onClick={handleCopy} className="shrink-0 px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex gap-4 text-sm text-gray-600">
            <span>{data.code!.clickCount} click{data.code!.clickCount === 1 ? '' : 's'}</span>
            <span>{data.code!.usedCount} signup{data.code!.usedCount === 1 ? '' : 's'}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${data.code!.invitationDraft ?? 'Come practice yoga with me!'} ${data.code!.referralUrl}`)}`}
               target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200">WhatsApp</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.code!.referralUrl)}`}
               target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">Facebook</a>
            <a href={`mailto:?subject=${encodeURIComponent('Join me at SohamYoga')}&body=${encodeURIComponent(`${data.code!.invitationDraft ?? ''} ${data.code!.referralUrl}`)}`}
               className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Email</a>
          </div>

          {data.code!.invitationDraft && (
            <div className="rounded-lg bg-primary-50 border border-primary-100 p-3">
              <p className="text-xs text-primary-700 font-medium mb-1">Suggested message</p>
              <p className="text-sm text-gray-700">{data.code!.invitationDraft}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Wallet Balance</p>
          <p className="text-2xl font-bold text-primary-700 mt-1">${data.wallet.balance.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">${data.wallet.lifetimeEarned.toLocaleString()} lifetime earned</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Current Reward</p>
          {data.activeCampaign ? (
            <>
              <p className="text-lg font-bold text-gray-800 mt-1">{data.activeCampaign.referrerRewardValue} {data.activeCampaign.rewardType.replace(/_/g, ' ')}</p>
              <p className="text-xs text-gray-400 mt-1">{data.activeCampaign.name}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">No active referral campaign right now — your link still works, sharing is tracked, but no reward is configured yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Your Referral History</h2>
        {data.history.length === 0 ? (
          <p className="text-sm text-gray-400">No referrals yet — share your link above to get started.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">{h.referreeEmail}</span>
                <span className="text-gray-500">{STATUS_LABEL[h.status] ?? h.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
