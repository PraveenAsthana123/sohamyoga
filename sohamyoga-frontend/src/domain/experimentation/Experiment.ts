import { createHash } from 'node:crypto';

// Deterministic sticky bucketing: the same (experimentKey, subjectId) pair
// always hashes to the same 0-99 bucket, so a subject keeps the same variant
// for the life of the experiment without needing to look up a prior
// assignment first (the DB unique constraint on (experiment_id, subject_id)
// is still the source of truth once persisted — this is only for the first
// assignment decision).
export function bucketFor(experimentKey: string, subjectId: string): number {
  const digest = createHash('sha256').update(`${experimentKey}:${subjectId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export interface VariantAllocation { id: string; key: string; allocationPercent: number; }

// Maps a 0-99 bucket into one of the variants by cumulative allocation,
// ordered by key for determinism. Returns null if allocations don't sum to
// 100 and the bucket falls past the end — callers must not start an
// experiment whose variants don't sum to exactly 100 (enforced in the API).
export function pickVariant(bucket: number, variants: VariantAllocation[]): VariantAllocation | null {
  const sorted = [...variants].sort((a, b) => a.key.localeCompare(b.key));
  let cumulative = 0;
  for (const v of sorted) {
    cumulative += v.allocationPercent;
    if (bucket < cumulative) return v;
  }
  return null;
}

// Real two-proportion z-test (no fabricated significance) — standard normal
// approximation, valid once both groups have a reasonable sample size. With
// too little data this honestly returns null rather than a misleading
// p-value.
export function twoProportionZTest(conversionsA: number, sampleA: number, conversionsB: number, sampleB: number): { z: number; pValue: number } | null {
  if (sampleA < 30 || sampleB < 30) return null;
  const pA = conversionsA / sampleA;
  const pB = conversionsB / sampleB;
  const pPool = (conversionsA + conversionsB) / (sampleA + sampleB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / sampleA + 1 / sampleB));
  if (se === 0) return null;
  const z = (pB - pA) / se;
  // Standard normal CDF via the Abramowitz-Stegun erf approximation.
  const erf = (x: number) => {
    const sign = x < 0 ? -1 : 1;
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  };
  const cdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
  const pValue = 2 * (1 - cdf(Math.abs(z)));
  return { z, pValue };
}
