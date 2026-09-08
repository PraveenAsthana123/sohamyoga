// Two-proportion z-test for comparing hook completion rates. Deliberately
// tiny and self-contained rather than importing sohamyoga-frontend's
// experimentation domain — the two apps run against separate databases with
// no shared runtime, so the ~20 lines of real statistics are duplicated
// rather than faked as a cross-app dependency.
const MIN_SAMPLE_PER_ARM = 30;

function normalCdf(z: number): number {
  // Abramowitz-Stegun approximation of the standard normal CDF.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export interface ZTestResult {
  hasEnoughData: boolean;
  rateA: number | null;
  rateB: number | null;
  z: number | null;
  pValue: number | null;
  significant: boolean;
  winner: 'a' | 'b' | null;
}

export function twoProportionZTest(completionsA: number, viewsA: number, completionsB: number, viewsB: number): ZTestResult {
  if (viewsA < MIN_SAMPLE_PER_ARM || viewsB < MIN_SAMPLE_PER_ARM) {
    return {
      hasEnoughData: false,
      rateA: viewsA > 0 ? completionsA / viewsA : null,
      rateB: viewsB > 0 ? completionsB / viewsB : null,
      z: null, pValue: null, significant: false, winner: null,
    };
  }
  const p1 = completionsA / viewsA;
  const p2 = completionsB / viewsB;
  const pooled = (completionsA + completionsB) / (viewsA + viewsB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / viewsA + 1 / viewsB));
  const z = se === 0 ? 0 : (p1 - p2) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const significant = pValue < 0.05;
  return {
    hasEnoughData: true,
    rateA: p1, rateB: p2, z, pValue, significant,
    winner: significant ? (p1 > p2 ? 'a' : 'b') : null,
  };
}
