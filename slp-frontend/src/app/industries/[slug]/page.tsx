import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { IndustrySolution } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';
import { SERVER_API_URL as API_URL } from '@/lib/server-api';

interface IndustryPageProps {
  params: { slug: string };
}

async function getIndustry(slug: string): Promise<IndustrySolution | null> {
  try {
    const res = await fetch(`${API_URL}/api/industries/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAllIndustries(): Promise<IndustrySolution[]> {
  try {
    const res = await fetch(`${API_URL}/api/industries`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: IndustryPageProps): Promise<Metadata> {
  const industry = await getIndustry(params.slug);

  if (!industry) {
    return { title: 'Industry Not Found' };
  }

  return {
    title: `${industry.title} - Industry Solutions`,
    description: industry.shortDescription,
    openGraph: {
      title: `${industry.title} Solutions - SohamYoga`,
      description: industry.shortDescription,
    },
  };
}

function parseJsonList(jsonString: string): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return jsonString.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export default async function IndustryPage({ params }: IndustryPageProps) {
  const [industry, allIndustries] = await Promise.all([
    getIndustry(params.slug),
    getAllIndustries(),
  ]);

  if (!industry) {
    notFound();
  }

  const challenges = parseJsonList(industry.challenges);
  const solutions = parseJsonList(industry.solutions);
  const otherIndustries = allIndustries
    .filter((ind) => ind.slug !== industry.slug && ind.isActive)
    .slice(0, 4);

  return (
    <>
      {/* Hero Section */}
      <section className="bg-dark-900 pt-32 pb-20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-900/50 via-dark-900 to-accent-900/30" />
          <div className="absolute top-20 right-10 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-dark-400 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="flex flex-col lg:flex-row items-start gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                {industry.iconSvg && (
                  <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center">
                    <SafeHtml html={industry.iconSvg} className="w-8 h-8 text-primary-400" svg />
                  </div>
                )}
                <span className="px-3 py-1 bg-accent-500/20 text-accent-400 text-sm font-semibold rounded-full">
                  Industry Solution
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {industry.title}
              </h1>

              <p className="text-lg text-dark-300 leading-relaxed max-w-2xl">
                {industry.shortDescription}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/contact" className="btn-accent">
                  Discuss Your Needs
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link href="/contact" className="inline-flex items-center justify-center px-6 py-3 border-2 border-dark-600 text-white font-semibold rounded-lg hover:bg-dark-800 transition-all duration-300">
                  Learn More
                </Link>
              </div>
            </div>

            {/* Stats highlight */}
            <div className="grid grid-cols-2 gap-4 lg:mt-10">
              {challenges.length > 0 && (
                <div className="glass-card p-5 text-center">
                  <p className="text-3xl font-bold text-accent-400">{challenges.length}</p>
                  <p className="text-sm text-dark-300 mt-1">Key Challenges</p>
                </div>
              )}
              {solutions.length > 0 && (
                <div className="glass-card p-5 text-center">
                  <p className="text-3xl font-bold text-primary-400">{solutions.length}</p>
                  <p className="text-sm text-dark-300 mt-1">Our Solutions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Full Description */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-8">
            Industry Overview
          </h2>
          <SafeHtml html={industry.fullDescription} className="prose-content text-dark-600 leading-relaxed" />
        </div>
      </section>

      {/* Challenges & Solutions */}
      {(challenges.length > 0 || solutions.length > 0) && (
        <section className="py-16 bg-dark-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Challenges */}
              {challenges.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-dark-900">Industry Challenges</h2>
                  </div>

                  <div className="space-y-4">
                    {challenges.map((challenge, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 p-4 bg-white rounded-lg border border-dark-100 shadow-sm"
                      >
                        <span className="w-8 h-8 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <p className="text-dark-700 text-sm leading-relaxed pt-1">{challenge}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Solutions */}
              {solutions.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-dark-900">Our Solutions</h2>
                  </div>

                  <div className="space-y-4">
                    {solutions.map((solution, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 p-4 bg-white rounded-lg border border-dark-100 shadow-sm"
                      >
                        <span className="w-8 h-8 bg-accent-50 text-accent-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                        <p className="text-dark-700 text-sm leading-relaxed pt-1">{solution}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-dark-900 via-primary-900 to-dark-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Solve Your {industry.title} Challenges?
          </h2>
          <p className="text-dark-300 text-lg mb-8 max-w-2xl mx-auto">
            Our team of experts understands the unique demands of the {industry.title.toLowerCase()} sector.
            Let us help you build solutions that drive real results.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact" className="btn-accent">
              Get in Touch
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-dark-600 text-white font-semibold rounded-lg hover:bg-dark-800 transition-all duration-300"
            >
              Learn About Us
            </Link>
          </div>
        </div>
      </section>

      {/* Other Industries */}
      {otherIndustries.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 text-center mb-4">
              Other Industries We Serve
            </h2>
            <p className="text-dark-500 text-center mb-10 max-w-2xl mx-auto">
              We bring specialized expertise across multiple sectors to deliver industry-specific solutions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {otherIndustries.map((ind) => (
                <Link
                  key={ind.id}
                  href={`/industries/${ind.slug}`}
                  className="group bg-dark-50 rounded-xl p-6 hover:bg-white hover:shadow-xl transition-all duration-300 border border-dark-100"
                >
                  {ind.iconSvg && (
                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-600 transition-colors">
                      <SafeHtml html={ind.iconSvg} className="w-6 h-6 text-primary-600 group-hover:text-white transition-colors" svg />
                    </div>
                  )}
                  <h3 className="font-semibold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {ind.title}
                  </h3>
                  <p className="text-sm text-dark-500 line-clamp-2">{ind.shortDescription}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
