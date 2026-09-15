import { renderPositioningStatement } from '@/domain/positioning/Positioning';

describe('renderPositioningStatement (pure)', () => {
  it('assembles the real template fields in the correct order (positive case)', () => {
    const result = renderPositioningStatement({
      targetCustomer: 'busy professionals', problem: 'want a real wellness routine', category: 'yoga studio',
      outcome: 'builds real strength and calm', alternative: 'generic fitness apps', proof: 'real certified instructors and real small class sizes',
    });
    expect(result).toBe('For busy professionals who want a real wellness routine, this is a yoga studio that builds real strength and calm, unlike generic fitness apps, because real certified instructors and real small class sizes.');
  });
});
