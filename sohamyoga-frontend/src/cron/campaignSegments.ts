// Shared segment definitions for personalized campaign generation.
// Keys match the segment identifiers already surfaced in /admin/crm's
// Segmentation tab (src/app/api/crm/segments/route.ts) so a campaign's
// target_segments line up with real, queryable audience definitions —
// not an arbitrary second taxonomy.

export interface SegmentDef { key: string; label: string; toneGuidance: string }

export const CAMPAIGN_SEGMENTS: SegmentDef[] = [
  {
    key: 'high_value',
    label: 'High-Value Members',
    toneGuidance: 'Warm, appreciative, VIP-treatment tone. They already spend and engage — reward loyalty, do not hard-sell.',
  },
  {
    key: 'at_risk',
    label: 'At-Risk Members',
    toneGuidance: 'Empathetic, low-pressure re-engagement tone. Acknowledge they have been away without guilt-tripping; make returning easy.',
  },
  {
    key: 'win_back',
    label: 'Win-Back Candidates',
    toneGuidance: 'We-miss-you tone with a genuine, time-bound reason to return. Do not invent a discount amount not provided in the offer.',
  },
  {
    key: 'new_lead',
    label: 'New Leads',
    toneGuidance: 'Friendly first-touch welcome. Introduce the studio and value proposition; no assumed familiarity.',
  },
];

export function segmentLabel(key: string): string {
  return CAMPAIGN_SEGMENTS.find(s => s.key === key)?.label ?? key;
}
