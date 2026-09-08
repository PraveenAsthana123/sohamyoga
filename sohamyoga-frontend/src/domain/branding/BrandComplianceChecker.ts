// Real, deterministic brand-compliance check -- no AI needed for the core
// rule (banned phrase = banned phrase), matching the pattern of other
// deterministic jobs in this codebase (StreakUpdateJob, BadgeAwardJob) that
// don't reach for an LLM when a plain rule check is correct and faster.
// Closes a gap found live 2026-09-01: brand_kit.banned_phrases/
// approved_phrases were stored but zero code path ever validated content
// against them before publish.
export interface BrandKitRules {
  banned_phrases: string[];
  approved_phrases: string[];
  tone_words: string[];
}

export interface ComplianceResult {
  status: 'pass' | 'flagged';
  violations: string[];       // banned phrases actually found in the text
  usesApprovedPhrase: boolean; // informational only, never blocks
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function checkBrandCompliance(text: string, rules: BrandKitRules): ComplianceResult {
  const normalizedText = normalize(text);
  const violations = rules.banned_phrases.filter(phrase => {
    const p = normalize(phrase);
    return p.length > 0 && normalizedText.includes(p);
  });
  const usesApprovedPhrase = rules.approved_phrases.some(phrase => {
    const p = normalize(phrase);
    return p.length > 0 && normalizedText.includes(p);
  });

  return {
    status: violations.length > 0 ? 'flagged' : 'pass',
    violations,
    usesApprovedPhrase,
  };
}
