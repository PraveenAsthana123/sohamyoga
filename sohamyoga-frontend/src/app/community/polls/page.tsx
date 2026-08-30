"use client";
// Was previously a hardcoded POLLS mock array with client-only useState vote
// counting (never persisted, resets on refresh). Now backed by real
// poll/poll_option/poll_vote tables with DB-level duplicate-vote prevention.
import { useEffect, useState, useCallback } from "react";

interface PollOption { id: string; text: string; votes: number }
interface PollData {
  id: string; question: string; status: string; endsAt: string | null;
  options: PollOption[]; hasVoted: boolean; votedOptionIds: string[]; showResultsBeforeClose: boolean;
}

export default function PollsPage() {
  const [polls, setPolls] = useState<PollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/community/polls', { cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) { setUnauthenticated(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => setPolls(d?.polls?.filter((p: PollData) => p.status === 'ACTIVE' || p.status === 'CLOSED') ?? []))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function vote(pollId: string, optionId: string) {
    const res = await fetch(`/api/community/polls/${pollId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }),
    });
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Vote failed.');
    }
  }

  function copyLink(pollId: string) {
    const link = `/community/polls/${pollId}`;
    navigator.clipboard?.writeText(`${window.location.origin}${link}`).catch(() => {});
    setCopied(pollId);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Community Polls</h1>
          <p className="text-gray-400 mt-1">Share your voice and shape the SohamYoga experience</p>
        </div>

        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {unauthenticated && <p className="text-gray-500 text-sm">Log in to view and vote on community polls.</p>}

        <div className="space-y-5">
          {polls.map(poll => {
            const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
            const showResults = poll.hasVoted || poll.status === 'CLOSED' || poll.showResultsBeforeClose;

            return (
              <div key={poll.id} className="bg-gray-900 rounded-2xl overflow-hidden">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-lg leading-snug">{poll.question}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${poll.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>{poll.status.toLowerCase()}</span>
                  </div>
                  {poll.endsAt && poll.status === 'ACTIVE' && <p className="text-xs text-gray-400">Closes {new Date(poll.endsAt).toLocaleDateString()}</p>}

                  <div className="space-y-2">
                    {poll.options.map(opt => {
                      const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                      const isVoted = poll.votedOptionIds.includes(opt.id);
                      return (
                        <button key={opt.id} disabled={poll.hasVoted || poll.status === 'CLOSED'} onClick={() => vote(poll.id, opt.id)}
                          className={`w-full text-left rounded-xl transition-all ${showResults ? 'cursor-default' : 'hover:bg-gray-800 cursor-pointer'}`}>
                          <div className={`relative overflow-hidden rounded-xl border ${isVoted ? 'border-green-500' : 'border-gray-700'} px-4 py-3`}>
                            {showResults && <div className={`absolute inset-0 ${isVoted ? 'bg-green-900/40' : 'bg-gray-800/60'} transition-all`} style={{ width: `${pct}%` }} />}
                            <div className="relative flex justify-between items-center">
                              <span className={`text-sm ${isVoted ? 'font-semibold text-green-300' : 'text-gray-200'}`}>{opt.text}</span>
                              {showResults && <span className="text-sm font-bold text-gray-300">{pct}%</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{totalVotes} votes</span>
                    <button onClick={() => copyLink(poll.id)} className="flex items-center gap-1 hover:text-gray-300 transition-colors">
                      {copied === poll.id ? '✓ Link copied!' : 'Share poll →'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && !unauthenticated && !polls.length && <p className="text-gray-500 text-sm">No polls yet.</p>}
        </div>
      </div>
    </div>
  );
}
