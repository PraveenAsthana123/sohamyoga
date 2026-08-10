'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface HeroSlide {
  title: string;
  subtitle: string;
  description: string;
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  gradient: string;
}

const slides: HeroSlide[] = [
  {
    title: 'Find Your Inner Balance',
    subtitle: 'Premium Yoga Collection',
    description:
      'Discover our curated selection of high-quality yoga mats, props, and accessories designed to deepen your practice and bring harmony to your daily routine.',
    cta: { label: 'Browse Products', href: '/products' },
    secondaryCta: { label: 'Our Story', href: '/about' },
    gradient: 'from-primary-900 via-primary-800 to-dark-900',
  },
  {
    title: 'Elevate Your Practice',
    subtitle: 'Eco-Friendly Materials',
    description:
      'Our sustainably sourced yoga gear is crafted from natural and recycled materials, so you can feel good about every pose and every purchase.',
    cta: { label: 'Shop Now', href: '/products' },
    secondaryCta: { label: 'Learn More', href: '/about' },
    gradient: 'from-dark-900 via-primary-900 to-primary-800',
  },
  {
    title: 'Mind, Body & Soul',
    subtitle: 'Complete Wellness',
    description:
      'From meditation cushions and incense to bolsters and essential oils, explore everything you need for a holistic wellness journey.',
    cta: { label: 'Explore Collection', href: '/categories' },
    secondaryCta: { label: 'Wellness Blog', href: '/blog' },
    gradient: 'from-primary-800 via-dark-900 to-primary-900',
  },
  {
    title: 'Begin Your Journey',
    subtitle: 'For Every Yogi',
    description:
      'Whether you are a beginner or an advanced practitioner, our thoughtfully designed products support every stage of your yoga journey.',
    cta: { label: 'New Arrivals', href: '/products' },
    secondaryCta: { label: 'Contact Us', href: '/contact' },
    gradient: 'from-dark-900 via-primary-800 to-dark-900',
  },
];

export default function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  return (
    <section
      className="relative w-full h-[90vh] min-h-[600px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Hero carousel"
    >
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`hero-slide bg-gradient-to-br ${slide.gradient}`}
          aria-hidden={index !== currentSlide}
          style={{ opacity: index === currentSlide ? 1 : 0 }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 left-10 w-72 h-72 bg-accent-400 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary-400 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500 rounded-full blur-3xl opacity-30" />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          {/* Content */}
          <div className="relative h-full flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-3xl">
                <span
                  className={`inline-block text-accent-400 text-sm font-semibold tracking-wider uppercase mb-4 transition-all duration-700 ${
                    index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                  }`}
                >
                  {slide.subtitle}
                </span>
                <h1
                  className={`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6 transition-all duration-700 delay-100 ${
                    index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                  }`}
                >
                  {slide.title}
                </h1>
                <p
                  className={`text-lg sm:text-xl text-dark-300 leading-relaxed mb-8 max-w-2xl transition-all duration-700 delay-200 ${
                    index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                  }`}
                >
                  {slide.description}
                </p>
                <div
                  className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 delay-300 ${
                    index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                  }`}
                >
                  <Link href={slide.cta.href} className="btn-accent text-base px-8 py-4">
                    {slide.cta.label}
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                  {slide.secondaryCta && (
                    <Link
                      href={slide.secondaryCta.href}
                      className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-all duration-300"
                    >
                      {slide.secondaryCta.label}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 rounded-full ${
              index === currentSlide
                ? 'w-10 h-3 bg-accent-400'
                : 'w-3 h-3 bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-8 z-10 hidden lg:block">
        <div className="flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs tracking-widest uppercase rotate-90 origin-center translate-y-6">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent mt-8" />
        </div>
      </div>
    </section>
  );
}
