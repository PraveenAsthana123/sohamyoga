import { computeMentionRate } from '@/domain/geo/GeoVisibility';

describe('computeMentionRate (pure)', () => {
  it('returns null (not a fabricated 0%) with zero real observations (negative case)', () => {
    expect(computeMentionRate(0, 0)).toBeNull();
  });
  it('computes a real percentage over real observations (positive case)', () => {
    expect(computeMentionRate(4, 3)).toBe(75);
  });
  it('returns 0 for a real zero-mention rate, distinct from no-data (boundary)', () => {
    expect(computeMentionRate(5, 0)).toBe(0);
  });
});
