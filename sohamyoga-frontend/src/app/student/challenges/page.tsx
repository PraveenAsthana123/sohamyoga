import { redirect } from 'next/navigation';

// Hardcoded mock, no backing table. Real equivalent: /customer/journey
// (active challenges section, backed by the real challenge_participation table).
export default function StudentChallengesRedirect() {
  redirect('/customer/journey');
}
