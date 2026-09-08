import { redirect } from 'next/navigation';

// Hardcoded mock, no backing table. Real equivalent: /customer/bookings.
export default function StudentCalendarRedirect() {
  redirect('/customer/bookings');
}
