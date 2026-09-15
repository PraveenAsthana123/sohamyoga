import { canPublish } from '@/domain/casestudy/CaseStudy';

describe('canPublish (pure)', () => {
  it('refuses to publish a case study with zero real cited evidence (negative case)', () => {
    expect(canPublish([])).toBe(false);
  });
  it('allows publishing when at least one real evidence id is cited (positive case)', () => {
    expect(canPublish(['e1'])).toBe(true);
  });
});
