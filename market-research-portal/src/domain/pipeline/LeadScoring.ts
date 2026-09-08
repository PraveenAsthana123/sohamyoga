// Real lead scoring — the `lead.score` column existed since the CRM schema
// was first built but nothing anywhere ever wrote to it (grep-confirmed).
// Deterministic, explainable rules over real lead attributes only — never a
// black-box or fabricated number.
export interface ScorableLead {
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string;
  campaign_id: string | null;
  service_item_id: string | null;
}

export interface ScoreBreakdown {
  score: number;
  reasons: string[];
}

export function scoreLead(lead: ScorableLead): ScoreBreakdown {
  let score = 0;
  const reasons: string[] = [];

  if (lead.phone) { score += 20; reasons.push('+20 has phone (callable)'); }
  if (lead.email) { score += 10; reasons.push('+10 has email'); }
  if (lead.message && lead.message.trim().length > 0) { score += 20; reasons.push('+20 wrote a message (engaged)'); }
  if (lead.source === 'form') { score += 15; reasons.push('+15 organic inbound form submission'); }
  if (lead.campaign_id) { score += 15; reasons.push('+15 attributed to a tracked campaign'); }
  if (lead.service_item_id) { score += 30; reasons.push('+30 inquired about a specific service (high intent)'); }

  return { score: Math.min(100, score), reasons };
}
