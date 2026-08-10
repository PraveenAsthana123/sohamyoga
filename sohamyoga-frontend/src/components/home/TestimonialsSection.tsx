'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Testimonial } from '@/lib/api';

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? 'text-yellow-400' : 'text-dark-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const itemsToShow = testimonials.length >= 3 ? 3 : testimonials.length;

  const nextSlide = useCallback(() => {
    if (testimonials.length <= itemsToShow) return;
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length, itemsToShow]);

  const prevSlide = () => {
    if (testimonials.length <= itemsToShow) return;
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    if (isPaused || testimonials.length <= itemsToShow) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, testimonials.length, itemsToShow]);

  if (!testimonials || testimonials.length === 0) return null;

  // For the carousel, get visible items with wrapping
  const getVisibleTestimonials = () => {
    const visible = [];
    for (let i = 0; i < Math.min(itemsToShow, testimonials.length); i++) {
      visible.push(testimonials[(currentIndex + i) % testimonials.length]);
    }
    return visible;
  };

  const visibleTestimonials = getVisibleTestimonials();

  return (
    <section
      className="py-20 bg-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="section-title text-dark-900">
          What Our <span className="text-primary-600">Clients Say</span>
        </h2>
        <p className="section-subtitle">
          Trusted by leading organizations across industries to deliver exceptional technology solutions.
        </p>

        <div className="relative">
          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {visibleTestimonials.map((testimonial, index) => (
              <div
                key={`${testimonial.id}-${index}`}
                className="card border border-dark-100 relative animate-fade-in"
              >
                {/* Quote mark */}
                <div className="absolute -top-3 left-6">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H0z" />
                    </svg>
                  </div>
                </div>

                <div className="pt-6">
                  <StarRating rating={testimonial.rating} />

                  <blockquote className="mt-4 text-dark-600 text-sm leading-relaxed italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  <div className="mt-6 flex items-center gap-3 pt-4 border-t border-dark-100">
                    {/* Avatar with initials */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {testimonial.initials || testimonial.authorName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-dark-900 text-sm">
                        {testimonial.authorName}
                      </div>
                      <div className="text-dark-500 text-xs">
                        {testimonial.authorTitle}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation arrows */}
          {testimonials.length > itemsToShow && (
            <div className="flex justify-center gap-4 mt-10">
              <button
                onClick={prevSlide}
                className="w-12 h-12 rounded-full border-2 border-dark-200 flex items-center justify-center text-dark-500 hover:border-primary-600 hover:text-primary-600 transition-colors"
                aria-label="Previous testimonials"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextSlide}
                className="w-12 h-12 rounded-full border-2 border-dark-200 flex items-center justify-center text-dark-500 hover:border-primary-600 hover:text-primary-600 transition-colors"
                aria-label="Next testimonials"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
