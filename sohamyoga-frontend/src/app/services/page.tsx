import { Metadata } from 'next';
import Link from 'next/link';
import type { Service } from '@/lib/api';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Yoga Classes & Services',
  description: 'Explore real yoga classes at Soham Yoga — Hatha, Vinyasa, Ashtanga, Yin, and more, taught by certified instructors for every level.',
  openGraph: {
    title: 'Yoga Classes & Services - Soham Yoga',
    description: 'Explore our real yoga class offerings and find the right practice for you.',
  },
};

async function getServices(): Promise<Service[]> {
  try {
    const res = await fetch(`${API_URL}/api/services`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function parseFeatures(features: string): string[] {
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function ServicesPage() {
  const services = await getServices();
  const active = services.filter(s => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden bg-gradient-to-br from-accent-700 via-accent-600 to-primary-600">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-20 w-72 h-72 bg-primary-300 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-white/20 text-white text-sm font-semibold rounded-full mb-4">
              Our Classes
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Find the Right <span className="text-primary-200">Practice</span> for You
            </h1>
            <p className="text-lg text-accent-100 leading-relaxed">
              Every class is taught by a certified instructor. Whether you're brand new to yoga or deepening an
              established practice, there's a real class here for you.
            </p>
          </div>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {active.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Our class catalog is being updated — check back soon, or{' '}
              <Link href="/contact" className="text-accent-600 font-semibold hover:underline">contact us</Link> for the current schedule.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {active.map(s => (
                <div key={s.id} className="rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-bold text-primary-900">{s.title}</h2>
                    {s.isFeatured && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">Popular</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{s.shortDescription}</p>
                  <p className="text-sm text-gray-500 mb-4">{s.fullDescription}</p>
                  {parseFeatures(s.features).length > 0 && (
                    <ul className="space-y-1 mb-4">
                      {parseFeatures(s.features).map((f, i) => (
                        <li key={i} className="text-xs text-accent-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/booking" className="text-sm font-semibold text-primary-700 hover:text-primary-900">
                    Book a class →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-50">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-primary-900 mb-3">New to Soham Yoga?</h2>
          <p className="text-gray-600 mb-6">Your first class is free — no experience or equipment required.</p>
          <Link href="/contact" className="inline-flex items-center px-6 py-3 bg-accent-600 hover:bg-accent-700 text-white font-semibold rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </section>
    </>
  );
}
