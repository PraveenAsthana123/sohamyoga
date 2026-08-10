'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import Link from 'next/link';

const SLIDES = [
  {
    id: 1,
    tag: 'Morning Flow',
    heading: 'Find Your\nInner Peace',
    sub: 'Expert-led yoga classes for every level, from sunrise flows to evening restoratives.',
    cta: 'Start Your Journey',
    href: '/classes',
    bg: 'from-green-950 via-emerald-900 to-green-950',
    accent: 'text-green-300',
  },
  {
    id: 2,
    tag: 'Live Classes',
    heading: 'Practice\nAnywhere',
    sub: 'Join live virtual sessions or explore 200+ on-demand videos — your mat, your schedule.',
    cta: 'Browse Classes',
    href: '/classes',
    bg: 'from-teal-950 via-teal-900 to-slate-950',
    accent: 'text-teal-300',
  },
  {
    id: 3,
    tag: 'Expert Teachers',
    heading: 'Learn from\nthe Best',
    sub: 'Certified instructors with 500-hour training, mindfulness coaching, and 10+ years of practice.',
    cta: 'Meet Teachers',
    href: '/teachers',
    bg: 'from-slate-950 via-emerald-950 to-green-950',
    accent: 'text-emerald-300',
  },
];

interface SwiperHeroProps {
  className?: string;
}

export default function SwiperHero({ className = '' }: SwiperHeroProps) {
  return (
    <section className={`relative w-full overflow-hidden ${className}`} style={{ minHeight: '90vh' }}>
      <Swiper
        modules={[Autoplay, Pagination, Navigation, EffectFade]}
        effect="fade"
        autoplay={{ delay: 5500, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation
        loop
        className="swiper-yoga-hero h-full"
        style={{ minHeight: '90vh' }}
      >
        {SLIDES.map((slide) => (
          <SwiperSlide key={slide.id}>
            <div
              className={`relative flex items-center justify-center bg-gradient-to-br ${slide.bg}`}
              style={{ minHeight: '90vh' }}
            >
              {/* Subtle grid overlay */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '60px 60px',
                }}
              />

              {/* Content — glass panel */}
              <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
                <span
                  className={`yoga-tag bg-white/10 ${slide.accent} border border-white/20 mb-6 inline-block`}
                  data-aos="fade-down"
                  data-aos-duration="600"
                >
                  {slide.tag}
                </span>

                <h1
                  className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 whitespace-pre-line"
                  data-aos="fade-up"
                  data-aos-delay="100"
                >
                  {slide.heading}
                </h1>

                <p
                  className="text-lg md:text-xl text-white/75 mb-10 max-w-lg mx-auto leading-relaxed"
                  data-aos="fade-up"
                  data-aos-delay="200"
                >
                  {slide.sub}
                </p>

                <div
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                  data-aos="fade-up"
                  data-aos-delay="300"
                >
                  <Link
                    href={slide.href}
                    className="px-8 py-4 rounded-full bg-green-400 text-green-950 font-bold text-lg
                               hover:bg-green-300 transition-all duration-300 shadow-lg hover:shadow-green-400/30
                               hover:-translate-y-1"
                  >
                    {slide.cta}
                  </Link>
                  <Link
                    href="/pricing"
                    className="glass px-8 py-4 rounded-full text-white font-semibold text-lg
                               hover:bg-white/25 transition-all duration-300"
                  >
                    View Pricing
                  </Link>
                </div>
              </div>

              {/* Decorative breathing rings */}
              <div className="absolute top-1/4 left-10 w-64 h-64 rounded-full border border-white/5 breathing-ring hidden lg:block" style={{ animationDelay: '0s' }} />
              <div className="absolute bottom-1/4 right-10 w-48 h-48 rounded-full border border-white/8 breathing-ring hidden lg:block" style={{ animationDelay: '2s' }} />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
