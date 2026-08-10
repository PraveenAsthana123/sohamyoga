"use client";
import { useState } from "react";

interface PollOption { id: string; text: string; votes: number }
interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  status: "active" | "closed";
  endsAt?: string;
  totalVotes: number;
  userVotedOption?: string;
  shareLink: string;
}

const POLLS: Poll[] = [
  {
    id: "p1",
    question: "Which new class style would you like us to add?",
    options: [
      { id: "o1", text: "Aerial Yoga", votes: 42 },
      { id: "o2", text: "Yoga Nidra", votes: 38 },
      { id: "o3", text: "Acro Yoga", votes: 27 },
      { id: "o4", text: "Hot Yoga", votes: 53 },
    ],
    status: "active",
    endsAt: "2026-08-10",
    totalVotes: 160,
    shareLink: "/community/polls/p1",
  },
  {
    id: "p2",
    question: "What time works best for an evening class?",
    options: [
      { id: "o1", text: "6:00 PM", votes: 89 },
      { id: "o2", text: "7:00 PM", votes: 104 },
      { id: "o3", text: "7:30 PM", votes: 61 },
    ],
    status: "active",
    endsAt: "2026-08-08",
    totalVotes: 254,
    shareLink: "/community/polls/p2",
  },
  {
    id: "p3",
    question: "How satisfied are you with the AI pose coach?",
    options: [
      { id: "o1", text: "Very satisfied", votes: 78 },
      { id: "o2", text: "Satisfied", votes: 45 },
      { id: "o3", text: "Neutral", votes: 19 },
      { id: "o4", text: "Could be better", votes: 12 },
    ],
    status: "closed",
    totalVotes: 154,
    shareLink: "/community/polls/p3",
  },
];

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>(POLLS.map(p => ({ ...p })));
  const [copied, setCopied] = useState<string | null>(null);

  function vote(pollId: string, optionId: string) {
    setPolls(prev => prev.map(p => {
      if (p.id !== pollId || p.userVotedOption || p.status === "closed") return p;
      return {
        ...p,
        userVotedOption: optionId,
        totalVotes: p.totalVotes + 1,
        options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o),
      };
    }));
  }

  function copyLink(pollId: string, link: string) {
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

        {/* One row per poll */}
        <div className="space-y-5">
          {polls.map(poll => {
            const hasVoted = !!poll.userVotedOption;
            const showResults = hasVoted || poll.status === "closed";

            return (
              <div key={poll.id} className="bg-gray-900 rounded-2xl overflow-hidden">
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-semibold text-lg leading-snug">{poll.question}</h3>
                    <div className="flex gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        poll.status === "active" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"
                      }`}>{poll.status}</span>
                    </div>
                  </div>
                  {poll.endsAt && poll.status === "active" && (
                    <p className="text-xs text-gray-400">Closes {poll.endsAt}</p>
                  )}

                  {/* Options */}
                  <div className="space-y-2">
                    {poll.options.map(opt => {
                      const pct = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                      const isVoted = poll.userVotedOption === opt.id;

                      return (
                        <button key={opt.id}
                          disabled={hasVoted || poll.status === "closed"}
                          onClick={() => vote(poll.id, opt.id)}
                          className={`w-full text-left rounded-xl transition-all ${
                            showResults ? "cursor-default" : "hover:bg-gray-800 cursor-pointer"
                          }`}>
                          <div className={`relative overflow-hidden rounded-xl border ${
                            isVoted ? "border-green-500" : "border-gray-700"
                          } px-4 py-3`}>
                            {showResults && (
                              <div className={`absolute inset-0 ${isVoted ? "bg-green-900/40" : "bg-gray-800/60"} transition-all`}
                                   style={{ width: `${pct}%` }} />
                            )}
                            <div className="relative flex justify-between items-center">
                              <span className={`text-sm ${isVoted ? "font-semibold text-green-300" : "text-gray-200"}`}>{opt.text}</span>
                              {showResults && <span className="text-sm font-bold text-gray-300">{pct}%</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{poll.totalVotes} votes</span>
                    <button onClick={() => copyLink(poll.id, poll.shareLink)}
                      className="flex items-center gap-1 hover:text-gray-300 transition-colors">
                      {copied === poll.id ? "✓ Link copied!" : "Share poll →"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
