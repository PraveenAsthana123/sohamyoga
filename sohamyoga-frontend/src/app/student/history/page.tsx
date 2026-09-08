import { redirect } from 'next/navigation';

// Hardcoded mock, no backing table. Real equivalent: /customer/bookings
// (past section) and /customer/practice-journal for logged practice detail.
export default function StudentHistoryRedirect() {
  redirect('/customer/bookings');
}
