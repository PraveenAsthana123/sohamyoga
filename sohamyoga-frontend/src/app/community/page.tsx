import { redirect } from 'next/navigation';

// This page was a hardcoded wall of fabricated posts -- invented customer
// names, invented testimonials, invented like/comment counts. Real
// community features (polls) live at /community/polls; redirecting there
// rather than displaying fabricated people and quotes.
export default function CommunityRedirect() {
  redirect('/community/polls');
}
