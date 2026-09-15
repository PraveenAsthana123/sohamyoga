import { rankDemand } from '@/domain/diagnostic/BusinessDiagnostic';

describe('rankDemand (pure)', () => {
  it('sorts by real booking count descending (positive case)', () => {
    const result = rankDemand([
      { className: 'A', realBookings: 2, realCheckedIn: 1 },
      { className: 'B', realBookings: 10, realCheckedIn: 8 },
    ]);
    expect(result.map((r) => r.className)).toEqual(['B', 'A']);
  });
  it('keeps a real zero-demand class visible, never hidden (negative case)', () => {
    const result = rankDemand([{ className: 'Empty', realBookings: 0, realCheckedIn: 0 }]);
    expect(result).toHaveLength(1);
    expect(result[0].realBookings).toBe(0);
  });
});
