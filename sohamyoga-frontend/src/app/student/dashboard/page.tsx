import { redirect } from 'next/navigation';

// Hardcoded mock (fake streak/points/badges/bookings), no backing table, no
// auth check, unlinked from primary nav. Real equivalent: /customer/journey.
export default function StudentDashboardRedirect() {
  redirect('/customer/journey');
}
