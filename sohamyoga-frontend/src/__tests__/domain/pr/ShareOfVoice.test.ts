import { computePositiveShare } from '@/domain/pr/ShareOfVoice';

describe('computePositiveShare (pure)', () => {
  it('returns null (not fabricated 0%) with zero real mentions (negative case)', () => {
    expect(computePositiveShare(0, 0)).toBeNull();
  });
  it('computes a real percentage (positive case)', () => {
    expect(computePositiveShare(3, 4)).toBe(75);
  });
});
