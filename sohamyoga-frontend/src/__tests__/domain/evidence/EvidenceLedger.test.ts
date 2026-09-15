import { isCurrent, findUnsupportedClaims, type EvidenceRecord } from '@/domain/evidence/EvidenceLedger';

function makeEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: 'e1', tenantId: 't1', subjectType: 'voice_of_customer_digest', subjectId: 'd1',
    evidenceType: 'INFERENCE', claim: 'Class availability appeared in 1 of 1 real customer messages this period',
    confidence: 'HIGH', sourceType: 'ollama_inference', sourceRef: 'voice_of_customer_digest:d1',
    collectedAt: new Date('2026-09-14'), validUntil: null, supersededBy: null, createdBy: 'VoiceOfCustomerJob',
    createdAt: new Date('2026-09-14'),
    ...overrides,
  };
}

describe('isCurrent (pure)', () => {
  it('treats null validUntil as always current (positive case)', () => {
    expect(isCurrent(makeEvidence({ validUntil: null }))).toBe(true);
  });
  it('treats a future validUntil as current (positive case)', () => {
    expect(isCurrent(makeEvidence({ validUntil: new Date('2099-01-01') }), new Date('2026-09-14'))).toBe(true);
  });
  it('treats a past validUntil as stale (negative case)', () => {
    expect(isCurrent(makeEvidence({ validUntil: new Date('2020-01-01') }), new Date('2026-09-14'))).toBe(false);
  });
  it('treats validUntil exactly equal to now as stale, not current (boundary)', () => {
    const now = new Date('2026-09-14T12:00:00Z');
    expect(isCurrent(makeEvidence({ validUntil: now }), now)).toBe(false);
  });
});

describe('findUnsupportedClaims (pure)', () => {
  it('returns claims with zero matching evidence (negative case)', () => {
    const evidence = [makeEvidence({ claim: 'Real backed claim' })];
    const result = findUnsupportedClaims(['Real backed claim', 'Fabricated unbacked claim'], evidence);
    expect(result).toEqual(['Fabricated unbacked claim']);
  });
  it('returns an empty array when every claim has real backing evidence (positive case)', () => {
    const evidence = [makeEvidence({ claim: 'A' }), makeEvidence({ claim: 'B' })];
    expect(findUnsupportedClaims(['A', 'B'], evidence)).toEqual([]);
  });
  it('returns an empty array for an empty claims list (boundary)', () => {
    expect(findUnsupportedClaims([], [])).toEqual([]);
  });
});
