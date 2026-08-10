'use client';

import Link from 'next/link';
import type { Service } from '@/lib/api';
import SafeHtml from '@/components/SafeHtml';

interface ServiceCarouselProps {
  services: Service[];
}

export default function ServiceCarousel({ services }: ServiceCarouselProps) {
  if (!services || services.length === 0) return null;

  // Duplicate the list for seamless infinite scroll
  const duplicatedServices = [...services, ...services];

  return (
    <section className="py-20 bg-dark-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <h2 className="section-title text-dark-900">
          Our <span className="text-primary-600">Services</span>
        </h2>
        <p className="section-subtitle">
          Comprehensive technology solutions designed to accelerate your business growth and digital transformation journey.
        </p>
      </div>

      {/* Carousel track */}
      <div className="relative">
        {/* Gradient fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-dark-50 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-dark-50 to-transparent z-10 pointer-events-none" />

        <div className="service-carousel">
          {duplicatedServices.map((service, index) => (
            <Link
              key={`${service.id}-${index}`}
              href={`/services/${service.slug}`}
              className="flex-shrink-0 w-80 mx-3 group"
            >
              <div className="card h-full border border-dark-100 group-hover:border-primary-200 group-hover:-translate-y-1 transition-all duration-300">
                {/* Icon */}
                <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary-100 transition-colors duration-300">
                  {service.iconSvg ? (
                    <SafeHtml html={service.iconSvg} className="w-7 h-7 text-primary-600 [&>svg]:w-full [&>svg]:h-full" svg />
                  ) : (
                    <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {service.title}
                </h3>

                {/* Description */}
                <p className="text-dark-500 text-sm leading-relaxed line-clamp-3">
                  {service.shortDescription}
                </p>

                {/* Arrow link */}
                <div className="mt-4 flex items-center text-primary-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Learn more
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* View all link */}
      <div className="text-center mt-12">
        <Link href="/services/generative-ai" className="btn-primary">
          View All Services
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
