import { redirect } from 'next/navigation';

// This page was a hardcoded SESSIONS array (fake pose scores, fake dates)
// with no backing table. Real practice tracking now lives at
// /customer/practice-journal (real practice_journal table, student-authored
// entries) -- redirecting rather than maintaining two competing "progress"
// concepts.
export default function ProgressRedirect() {
  redirect('/customer/practice-journal');
}
