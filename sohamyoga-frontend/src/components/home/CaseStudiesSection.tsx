import Link from 'next/link';
import type { CaseStudy } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';

interface CaseStudiesSectionProps {
  caseStudies: CaseStudy[];
}

export default function CaseStudiesSection({ caseStudies }: CaseStudiesSectionProps) {
  if (!caseStudies || caseStudies.length === 0) return null;

  return (
    <section id="case-studies" className="py-20 bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title text-white">
          Case <span className="text-accent-400">Studies</span>
        </h2>
        <p className="section-subtitle text-dark-400">
          Real-world success stories demonstrating how we help organizations achieve measurable results through technology.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {caseStudies.map((study) => (
            <Link
              key={study.id}
              href={`/services/${study.slug}`}
              className="group block"
            >
              <div
                className="relative rounded-xl p-6 h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${study.gradientFrom || '#4f46e5'}, ${study.gradientTo || '#7c3aed'})`,
                }}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                </div>

                <div className="relative z-10">
                  {/* Tag */}
                  <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full mb-4">
                    {study.tag}
                  </span>

                  {/* Icon */}
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-5">
                    {study.iconSvg ? (
                      <SafeHtml html={study.iconSvg} className="w-6 h-6 text-white [&>svg]:w-full [&>svg]:h-full" svg />
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-3">
                    {study.title}
                  </h3>

                  {/* Description */}
                  <p className="text-white/80 text-sm leading-relaxed mb-6 line-clamp-3">
                    {study.description}
                  </p>

                  {/* Read more */}
                  <div className="flex items-center text-white text-sm font-medium group-hover:gap-3 gap-2 transition-all duration-300">
                    Read Case Study
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
