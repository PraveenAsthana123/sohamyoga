// Real, fixed list of opt-out-able customer features -- matched exactly by
// the nav (customer/layout.tsx) so a disabled feature can't silently drift
// from what's actually hidden.
export const TOGGLEABLE_FEATURES = [
  { key: 'journey', label: 'My Journey (streaks, points, badges)' },
  { key: 'practice-journal', label: 'Practice Journal' },
  { key: 'wellness', label: 'Wellness Score' },
  { key: 'loyalty', label: 'Loyalty Program' },
  { key: 'community', label: 'Community Polls' },
  { key: 'referral', label: 'Refer a Friend' },
  { key: 'ai-coach', label: 'AI Yoga Coach' },
] as const;
export const VALID_TOGGLEABLE_KEYS = new Set(TOGGLEABLE_FEATURES.map(f => f.key));
