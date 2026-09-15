import { computeResearchTier } from '@/domain/marketing/ResearchDepthRouter';

describe('computeResearchTier (pure)', () => {
  it('skips a real lead with no contact method (negative case)', () => {
    expect(computeResearchTier({ hasEmail: false, hasPhone: false, daysSinceCapture: 1, funnelStage: 'new' })).toBe('skip');
  });
  it('skips a real stale lead beyond the 90-day window (boundary)', () => {
    expect(computeResearchTier({ hasEmail: true, hasPhone: true, daysSinceCapture: 91, funnelStage: 'new' })).toBe('skip');
  });
  it('skips an already-converted or disqualified real lead (negative case)', () => {
    expect(computeResearchTier({ hasEmail: true, hasPhone: true, daysSinceCapture: 1, funnelStage: 'converted' })).toBe('skip');
  });
  it('routes a real lead with only a phone to a free quick_scan, not a costed call (positive case)', () => {
    expect(computeResearchTier({ hasEmail: false, hasPhone: true, daysSinceCapture: 1, funnelStage: 'new' })).toBe('quick_scan');
  });
  it('routes a real lead with an email to the real costed ai_diagnostic tier (positive case)', () => {
    expect(computeResearchTier({ hasEmail: true, hasPhone: false, daysSinceCapture: 1, funnelStage: 'new' })).toBe('ai_diagnostic');
  });
});
