import Link from 'next/link';
import type { IndustrySolution } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';

interface IndustriesSectionProps {
  industries: IndustrySolution[];
}

const industryColors = [
  { bg: 'bg-blue-50', iconBg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-100 hover:border-blue-200' },
  { bg: 'bg-amber-50', iconBg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-100 hover:border-amber-200' },
  { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-100 hover:border-emerald-200' },
  { bg: 'bg-purple-50', iconBg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-100 hover:border-purple-200' },
];

export default function IndustriesSection({ industries }: IndustriesSectionProps) {
  if (!industries || industries.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title text-dark-900">
          Industries <span className="text-primary-600">We Serve</span>
        </h2>
        <p className="section-subtitle">
          Deep domain expertise across key industries, delivering tailored solutions that address sector-specific challenges.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.slice(0, 4).map((industry, index) => {
            const color = industryColors[index % industryColors.length];
            return (
              <Link
                key={industry.id}
                href={`/industries/${industry.slug}`}
                className="group block"
              >
                <div className={`card border ${color.border} h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl`}>
                  {/* Icon */}
                  <div className={`w-14 h-14 ${color.iconBg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    {industry.iconSvg ? (
                      <SafeHtml html={industry.iconSvg} className={`w-7 h-7 ${color.text} [&>svg]:w-full [&>svg]:h-full`} svg />
                    ) : (
                      <svg className={`w-7 h-7 ${color.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {industry.title}
                  </h3>

                  {/* Description */}
                  <p className="text-dark-500 text-sm leading-relaxed mb-4 line-clamp-3">
                    {industry.shortDescription}
                  </p>

                  {/* Link indicator */}
                  <div className={`flex items-center ${color.text} text-sm font-medium`}>
                    Learn more
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
