import { qualifyTranscript } from '@/domain/voice/VoiceQualification';

describe('qualifyTranscript (pure)', () => {
  it('scores cold for a real transcript with no detected signals (negative case)', () => {
    const result = qualifyTranscript('Just calling to ask what time you open.');
    expect(result.tier).toBe('cold');
    expect(result.detected).toEqual([]);
  });
  it('scores hot for a real transcript with 3+ detected signals (positive case)', () => {
    const result = qualifyTranscript('I need a yoga class, what is the price, can I book this week?');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.tier).toBe('hot');
  });
  it('caps the real score at 100 even if every signal matches (boundary)', () => {
    const result = qualifyTranscript('I need help, what is the cost, can I sign up this week?');
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
