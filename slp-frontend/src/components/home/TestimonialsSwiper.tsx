'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import GlassCard from '@/components/ui/GlassCard';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Ananya Krishnan',
    role: 'Graphic Designer · 3 years student',
    stars: 5,
    quote:
      "Soham Yoga completely transformed how I manage stress. After 6 months of morning Vinyasa, my anxiety dropped dramatically and I sleep better than I have in a decade.",
    avatar: 'AK',
    style: 'Vinyasa',
  },
  {
    id: 2,
    name: 'Ravi Mehta',
    role: 'Software Engineer · 1 year student',
    stars: 5,
    quote:
      "The live virtual classes fit perfectly into my remote-work schedule. Priya's Hatha sessions have fixed my chronic lower-back pain from sitting all day.",
    avatar: 'RM',
    style: 'Hatha',
  },
  {
    id: 3,
    name: 'Sunita Bose',
    role: 'Retired Teacher · 2 years student',
    stars: 5,
    quote:
      "At 64, I was nervous about starting yoga. Meera's Restorative classes gave me confidence, flexibility, and a community I truly cherish.",
    avatar: 'SB',
    style: 'Restorative',
  },
  {
    id: 4,
    name: 'Pradeep Nair',
    role: 'Entrepreneur · 4 years student',
    stars: 5,
    quote:
      "I've tried many studios. Soham's quality — the sequencing, the attention to alignment, the post-class meditations — is simply unmatched anywhere online.",
    avatar: 'PN',
    style: 'Ashtanga',
  },
  {
    id: 5,
    name: 'Deepa Iyer',
    role: 'New Mother · Prenatal student',
    stars: 5,
    quote:
      "Kavya's Prenatal classes were a lifeline throughout my pregnancy. I felt safe, supported, and strong right up to my due date.",
    avatar: 'DI',
    style: 'Prenatal',
  },
];

const STARS = '★★★★★';

export default function TestimonialsSwiper() {
  return (
    <section className="py-24 bg-yoga-hero overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
        <span
          className="yoga-tag bg-green-400/10 text-green-400 border border-green-400/20 mb-4"
          data-aos="fade-down"
        >
          Student Stories
        </span>
        <h2
          className="text-4xl md:text-5xl font-black text-white mb-4"
          data-aos="fade-up"
          data-aos-delay="50"
        >
          Real Transformations
        </h2>
        <p
          className="text-white/60 text-lg max-w-xl mx-auto"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          Over 1,200 students have found peace, strength, and community at Soham.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6" data-aos="fade-up" data-aos-delay="150">
        <Swiper
          modules={[Autoplay, Pagination]}
          breakpoints={{
            0:    { slidesPerView: 1,   spaceBetween: 16 },
            768:  { slidesPerView: 2,   spaceBetween: 24 },
            1024: { slidesPerView: 3,   spaceBetween: 24 },
          }}
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="pb-14"
        >
          {TESTIMONIALS.map((t) => (
            <SwiperSlide key={t.id}>
              <GlassCard
                variant="dark"
                padding="p-7"
                className="hover-lift h-full flex flex-col gap-4"
              >
                {/* Stars */}
                <div className="text-green-400 text-lg tracking-widest">{STARS}</div>

                {/* Quote */}
                <blockquote className="text-white/85 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                {/* Style tag */}
                <span className="yoga-tag bg-green-400/15 text-green-300 self-start">
                  {t.style}
                </span>

                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-700
                                  flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{t.name}</div>
                    <div className="text-white/45 text-xs">{t.role}</div>
                  </div>
                </div>
              </GlassCard>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
