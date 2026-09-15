// Research-Depth Router — backlog item #15. Real, free, rule-based
// pre-filter deciding whether a real lead is worth a real (costed)
// Ollama diagnostic call, before LeadNurturingJob (#6) spends one. No
// new schema -- pure computation over real, existing campaign_lead
// fields. For this single-tenant instance, "prospect scoring" (scoring
// OTHER businesses as sales targets) has no real subject -- this
// instead governs research cost for the studio's own real leads.

export interface LeadSignals { hasEmail: boolean; hasPhone: boolean; daysSinceCapture: number; funnelStage: string }
export type ResearchTier = 'skip' | 'quick_scan' | 'ai_diagnostic';

// Pure, unit-tested: real, disclosed rule -- a lead with neither real
// contact method is not worth any research spend; a stale lead (90+
// real days, matching LeadNurturingJob's own real 90-day window) is
// also skipped; everything else gets the free quick_scan, and only
// leads with a real email (the channel LeadNurturingJob/Mautic actually
// needs) escalate to a real costed ai_diagnostic call.
export function computeResearchTier(signals: LeadSignals): ResearchTier {
  if (!signals.hasEmail && !signals.hasPhone) return 'skip';
  if (signals.daysSinceCapture > 90) return 'skip';
  if (signals.funnelStage === 'converted' || signals.funnelStage === 'disqualified') return 'skip';
  if (!signals.hasEmail) return 'quick_scan';
  return 'ai_diagnostic';
}
