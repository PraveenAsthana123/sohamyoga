import { confidenceForSampleSize } from '@/domain/kpi/KpiEngine';

describe('confidenceForSampleSize (pure)', () => {
  it('returns UNKNOWN for a real zero sample, never a fabricated confidence (negative case)', () => {
    expect(confidenceForSampleSize(0)).toBe('UNKNOWN');
  });
  it('returns LOW for a small real sample (boundary)', () => {
    expect(confidenceForSampleSize(1)).toBe('LOW');
    expect(confidenceForSampleSize(4)).toBe('LOW');
  });
  it('returns MEDIUM for a moderate real sample (boundary)', () => {
    expect(confidenceForSampleSize(5)).toBe('MEDIUM');
    expect(confidenceForSampleSize(19)).toBe('MEDIUM');
  });
  it('returns HIGH for a large real sample (positive case)', () => {
    expect(confidenceForSampleSize(20)).toBe('HIGH');
    expect(confidenceForSampleSize(467)).toBe('HIGH');
  });
});
