import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Service } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

interface ServicePageProps {
  params: { slug: string };
}

async function getService(slug: string): Promise<Service | null> {
  try {
    const res = await fetch(`${API_URL}/api/services/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAllServices(): Promise<Service[]> {
  try {
    const res = await fetch(`${API_URL}/api/services`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const service = await getService(params.slug);

  if (!service) {
    return { title: 'Service Not Found' };
  }

  return {
    title: `${service.title} - Services`,
    description: service.shortDescription,
    openGraph: {
      title: `${service.title} - SohamYoga`,
      description: service.shortDescription,
    },
  };
}

function parseFeatures(featuresString: string): string[] {
  if (!featuresString) return [];
  try {
    const parsed = JSON.parse(featuresString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If not valid JSON, try splitting by newlines or commas
    return featuresString.split(/[,\n]/).map((f) => f.trim()).filter(Boolean);
  }
  return [];
}

export default async function ServicePage({ params }: ServicePageProps) {
  const [service, allServices] = await Promise.all([
    getService(params.slug),
    getAllServices(),
  ]);

  if (!service) {
    notFound();
  }

  const features = parseFeatures(service.features);
  const relatedServices = allServices
    .filter((s) => s.slug !== service.slug && s.isActive)
    .slice(0, 4);

  return (
    <>
      {/* Hero Section */}
      <section className="gradient-bg pt-32 pb-20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent-400 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary-200 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-accent-500/20 text-accent-300 text-sm font-semibold rounded-full mb-4">
              {service.category}
            </span>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              {service.title}
            </h1>

            <p className="text-lg text-primary-200 leading-relaxed">
              {service.shortDescription}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/contact" className="btn-accent">
                Get Started
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all duration-300">
                Request a Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service Content */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-6">
                About This Service
              </h2>
              <SafeHtml html={service.fullDescription} className="prose-content text-dark-600 leading-relaxed" />

              {/* Features Section */}
              {features.length > 0 && (
                <div className="mt-12">
                  <h3 className="text-xl md:text-2xl font-bold text-dark-900 mb-6">
                    Key Features
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-4 bg-dark-50 rounded-lg border border-dark-100"
                      >
                        <div className="w-6 h-6 bg-accent-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3.5 h-3.5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-dark-700 text-sm leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Service Info Card */}
              <div className="bg-dark-50 rounded-xl p-6 border border-dark-100 mb-6 sticky top-24">
                <h3 className="text-lg font-bold text-dark-900 mb-4">Service Details</h3>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-dark-400 text-xs">Category</p>
                      <p className="font-medium text-dark-800">{service.category}</p>
                    </div>
                  </div>

                  {features.length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-dark-400 text-xs">Features</p>
                        <p className="font-medium text-dark-800">{features.length} key capabilities</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-dark-200">
                  <Link href="/contact" className="btn-primary w-full text-center text-sm">
                    Request a Consultation
                  </Link>
                  <p className="text-xs text-dark-400 text-center mt-3">
                    Free initial consultation for your project
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-primary-200 text-lg mb-8 max-w-2xl mx-auto">
            Let our experts help you leverage {service.title.toLowerCase()} to drive innovation and growth for your organization.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="btn-accent">
              Start Your Project
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all duration-300"
            >
              Schedule a Call
            </Link>
          </div>
        </div>
      </section>

      {/* Related Services */}
      {relatedServices.length > 0 && (
        <section className="py-16 bg-dark-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 text-center mb-4">
              Explore More Services
            </h2>
            <p className="text-dark-500 text-center mb-10 max-w-2xl mx-auto">
              Discover other classes SohamYoga offers.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedServices.map((s) => (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className="group bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-dark-100"
                >
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-600 transition-colors">
                    {s.iconSvg ? (
                      <SafeHtml html={s.iconSvg} className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" svg />
                    ) : (
                      <svg className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="font-semibold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {s.title}
                  </h3>
                  <p className="text-sm text-dark-500 line-clamp-2">{s.shortDescription}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
