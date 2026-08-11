'use client';
import Link from 'next/link';
import { useAnalyticsContext } from './AnalyticsProvider';

// A Next.js Link that also fires a structured click event before navigating.
// Client-island for the same reason as ViewTracker: lets server-component
// pages (services/[slug], industries/[slug]) attach real click tracking to
// their CTAs without becoming client components themselves.
export default function TrackedLink({
  href, eventName, properties, className, children,
}: {
  href: string; eventName: string; properties?: Record<string, unknown>;
  className?: string; children: React.ReactNode;
}) {
  const { track } = useAnalyticsContext();
  return (
    <Link href={href} className={className} onClick={() => track({ name: eventName, eventType: 'click', properties })}>
      {children}
    </Link>
  );
}
