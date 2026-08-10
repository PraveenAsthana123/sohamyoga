'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectCoverflow } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import Link from 'next/link';

const STYLES = [
  {
    name: 'Hatha',
    level: 'All Levels',
    duration: '60–75 min',
    description: 'Classic foundational postures with breath awareness. Perfect for building strength, flexibility, and mindful presence.',
    color: 'from-green-800 to-emerald-950',
    accent: 'bg-green-400/20 text-green-300',
    emoji: '🌿',
  },
  {
    name: 'Vinyasa',
    level: 'Intermediate',
    duration: '60 min',
    description: 'Dynamic flowing sequences synchronized with breath. Builds heat, endurance, and graceful mind–body coordination.',
    color: 'from-teal-800 to-cyan-950',
    accent: 'bg-teal-400/20 text-teal-300',
    emoji: '🌊',
  },
  {
    name: 'Yin',
    level: 'All Levels',
    duration: '75–90 min',
    description: 'Deep, slow holds of 3–5 minutes targeting connective tissue. Profound release, deep relaxation, meditative stillness.',
    color: 'from-indigo-800 to-slate-950',
    accent: 'bg-indigo-400/20 text-indigo-300',
    emoji: '🌙',
  },
  {
    name: 'Power',
    level: 'Advanced',
    duration: '60 min',
    description: 'Athletic, strength-focused practice derived from Ashtanga. Builds muscle, burns calories, and elevates mental focus.',
    color: 'from-orange-900 to-red-950',
    accent: 'bg-orange-400/20 text-orange-300',
    emoji: '🔥',
  },
  {
    name: 'Ashtanga',
    level: 'Advanced',
    duration: '90 min',
    description: 'Traditional fixed sequence with ujjayi breath and bandhas. The original power yoga — structured, progressive, transformative.',
    color: 'from-amber-800 to-yellow-950',
    accent: 'bg-amber-400/20 text-amber-300',
    emoji: '☀️',
  },
  {
    name: 'Kundalini',
    level: 'All Levels',
    duration: '75 min',
    description: 'Kriyas, pranayama, mantra, and meditation. Awakens dormant energy and expands consciousness beyond the physical.',
    color: 'from-purple-800 to-violet-950',
    accent: 'bg-purple-400/20 text-purple-300',
    emoji: '✨',
  },
  {
    name: 'Restorative',
    level: 'All Levels',
    duration: '75 min',
    description: 'Fully supported poses held for 10–20 minutes. Activates parasympathetic nervous system for deep healing and rest.',
    color: 'from-sky-800 to-blue-950',
    accent: 'bg-sky-400/20 text-sky-300',
    emoji: '💧',
  },
  {
    name: 'Prenatal',
    level: 'Beginners',
    duration: '60 min',
    description: 'Safe, nurturing practice for every trimester. Builds strength for labour, relieves discomfort, calms the nervous system.',
    color: 'from-rose-800 to-pink-950',
    accent: 'bg-rose-400/20 text-rose-300',
    emoji: '🌸',
  },
];

export default function YogaStylesSwiper() {
  return (
    <section className="py-24 bg-yoga-dark overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-12 text-center">
        <span
          className="yoga-tag bg-green-400/10 text-green-400 border border-green-400/20 mb-4"
          data-aos="fade-down"
        >
          All Traditions
        </span>
        <h2
          className="text-4xl md:text-5xl font-black text-white mb-4"
          data-aos="fade-up"
          data-aos-delay="50"
        >
          Explore Every Style
        </h2>
        <p
          className="text-white/60 text-lg max-w-xl mx-auto"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          From energising flows to deep restorative holds — find the practice that fits your body today.
        </p>
      </div>

      <div data-aos="fade-up" data-aos-delay="150">
        <Swiper
          modules={[Autoplay, Pagination, EffectCoverflow]}
          effect="coverflow"
          centeredSlides
          slidesPerView="auto"
          coverflowEffect={{
            rotate: 40,
            stretch: 0,
            depth: 120,
            modifier: 1,
            slideShadows: false,
          }}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="swiper-coverflow pb-14"
        >
          {STYLES.map((style) => (
            <SwiperSlide key={style.name} style={{ width: '320px' }}>
              <div
                className={`hover-lift rounded-2xl overflow-hidden bg-gradient-to-br ${style.color} h-[420px] flex flex-col`}
              >
                {/* Top decoration */}
                <div className="p-8 flex-1">
                  <div className="text-5xl mb-4">{style.emoji}</div>
                  <span className={`yoga-tag ${style.accent} mb-3`}>
                    {style.level} · {style.duration}
                  </span>
                  <h3 className="text-2xl font-black text-white mb-3">{style.name} Yoga</h3>
                  <p className="text-white/65 text-sm leading-relaxed">{style.description}</p>
                </div>
                {/* Footer */}
                <div className="p-6 pt-0">
                  <Link
                    href="/classes"
                    className="block w-full text-center py-3 rounded-xl glass text-white font-semibold
                               hover:bg-white/25 transition-all duration-300 text-sm"
                  >
                    Explore {style.name} →
                  </Link>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
