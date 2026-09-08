import { redirect } from 'next/navigation';

// This page was a hardcoded CATALOG array of classes, entirely separate
// from the real class_session-backed booking flow at /booking. Redirecting
// to the real one rather than maintaining two divergent class lists.
export default function CatalogRedirect() {
  redirect('/booking');
}
