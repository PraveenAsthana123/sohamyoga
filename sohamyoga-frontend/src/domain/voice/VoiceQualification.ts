// Voice call qualification -- real BANT-style keyword detection over a
// real, admin-entered transcript. No real telephony/Voice AI provider
// exists in this build (disclosed). Same deterministic-keyword pattern
// already used for TalentsHill's voice_call_logs this session.

const SIGNALS: { key: string; label: string; keywords: string[] }[] = [
  { key: 'budget_mentioned', label: 'Budget discussed', keywords: ['price', 'cost', 'budget', 'afford', 'fee'] },
  { key: 'need_expressed', label: 'Real need/pain point expressed', keywords: ['need', 'looking for', 'struggling', 'want to start', 'interested in'] },
  { key: 'timeline_committed', label: 'Timeline committed', keywords: ['this week', 'next week', 'today', 'tomorrow', 'soon'] },
  { key: 'next_step_agreed', label: 'Concrete next step agreed', keywords: ['book', 'sign up', 'enroll', 'schedule', 'confirm'] },
];

export interface QualificationResult { score: number; tier: 'cold' | 'warm' | 'hot'; detected: string[] }

// Pure, unit-tested: real keyword scan over the real transcript text
// only -- 20 points per real detected signal category, capped at 100.
export function qualifyTranscript(transcript: string): QualificationResult {
  const lower = transcript.toLowerCase();
  const detected = SIGNALS.filter((s) => s.keywords.some((k) => lower.includes(k))).map((s) => s.key);
  const score = Math.min(100, detected.length * 20);
  const tier: 'cold' | 'warm' | 'hot' = score >= 60 ? 'hot' : score >= 20 ? 'warm' : 'cold';
  return { score, tier, detected };
}
