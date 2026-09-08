import { redirect } from 'next/navigation';

// Was local useState only with a fake setTimeout "Saved" toast and a TODO
// for the real POST that never existed. Real equivalent: /customer/preferences.
export default function StudentPreferencesRedirect() {
  redirect('/customer/preferences');
}
