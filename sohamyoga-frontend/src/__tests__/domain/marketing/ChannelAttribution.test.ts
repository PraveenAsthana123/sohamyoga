import { computeConversionRate } from '@/domain/marketing/ChannelAttribution';

describe('computeConversionRate (pure)', () => {
  it('returns null (not fabricated 0) for zero real leads (negative case)', () => {
    expect(computeConversionRate(0, 0)).toBeNull();
  });
  it('computes a real percentage (positive case)', () => {
    expect(computeConversionRate(10, 3)).toBe(30);
  });
});
