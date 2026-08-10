import AOSInit from '@/components/ui/AOSInit';
import GlassCard from '@/components/ui/GlassCard';
import AnimeCounter from '@/components/ui/AnimeCounter';
import SwiperHero from '@/components/home/SwiperHero';
import YogaStylesSwiper from '@/components/home/YogaStylesSwiper';
import TeacherSwiper from '@/components/home/TeacherSwiper';
import TestimonialsSwiper from '@/components/home/TestimonialsSwiper';
import LottieBreathingSection from '@/components/home/LottieBreathingSection';
import PlyrVideo from '@/components/ui/PlyrVideo';

export const metadata = {
  title: 'Visual Showcase · Soham Yoga',
  description: 'Demonstration of all visual components — Swiper, Plyr, AOS, Glassmorphism, Lottie, AnimeCounter.',
};

const COUNTER_DEMOS = [
  { label: 'Students',   target: 1200, suffix: '+' },
  { label: 'Classes',    target: 4500, suffix: '+' },
  { label: 'Teachers',   target: 24,   suffix: ''  },
  { label: 'Avg Rating', target: 4.9,  suffix: '★', decimals: 1 },
];

export default function ShowcasePage() {
  return (
    <>
      <AOSInit duration={700} easing="ease-out-cubic" once offset={80} />

      {/* ── 1. Swiper Hero ─────────────────────────────────────────────── */}
      <SwiperHero />

      {/* ── 2. AnimeCounter stats bar ──────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2
            className="text-3xl font-black text-center text-green-950 mb-12"
            data-aos="fade-up"
          >
            Animated Counters (AnimeCounter)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {COUNTER_DEMOS.map((c) => (
              <div
                key={c.label}
                className="text-center"
                data-aos="zoom-in"
                data-aos-delay={COUNTER_DEMOS.indexOf(c) * 80}
              >
                <div className="text-5xl font-black text-green-700 mb-2">
                  <AnimeCounter
                    target={c.target}
                    suffix={c.suffix}
                    decimals={c.decimals ?? 0}
                    duration={2000}
                  />
                </div>
                <div className="text-gray-500 font-medium">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Glass card variants ─────────────────────────────────────── */}
      <section className="py-20 bg-yoga-dark">
        <div className="max-w-5xl mx-auto px-6">
          <h2
            className="text-3xl font-black text-center text-white mb-12"
            data-aos="fade-up"
          >
            Glassmorphism Cards (GlassCard)
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {([
              { variant: 'light',         label: 'Light Glass',         sub: 'bg rgba(255,255,255,0.16) blur(18px)' },
              { variant: 'dark',          label: 'Dark Glass',          sub: 'bg rgba(10,20,10,0.55) blur(20px)' },
              { variant: 'green',         label: 'Green Glass',         sub: 'bg rgba(16,80,32,0.45) blur(16px)' },
              { variant: 'pricing',       label: 'Pricing Glass',       sub: 'light + green-400 border accent' },
              { variant: 'video-overlay', label: 'Video Overlay Glass', sub: 'dark + rounded-2xl' },
            ] as const).map((g) => (
              <GlassCard
                key={g.variant}
                variant={g.variant}
                hoverLift
                data-aos="yoga-scale-in"
              >
                <div className="text-white font-bold text-lg mb-1">{g.label}</div>
                <div className="text-white/60 text-sm">{g.sub}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. Yoga Styles Swiper (coverflow) ─────────────────────────── */}
      <YogaStylesSwiper />

      {/* ── 5. Teacher Swiper ──────────────────────────────────────────── */}
      <TeacherSwiper />

      {/* ── 6. Plyr Video player ───────────────────────────────────────── */}
      <section className="py-20 bg-yoga-section">
        <div className="max-w-3xl mx-auto px-6">
          <h2
            className="text-3xl font-black text-center text-green-950 mb-4"
            data-aos="fade-up"
          >
            Plyr Video Player
          </h2>
          <p
            className="text-gray-500 text-center mb-10"
            data-aos="fade-up"
            data-aos-delay="50"
          >
            Supports MP4, HLS (.m3u8), YouTube, and Vimeo. Green-tinted yoga skin.
            Pass any src — HLS is detected automatically.
          </p>
          <div data-aos="zoom-in" data-aos-delay="100">
            {/* Demo uses a freely licensed sample video */}
            <PlyrVideo
              src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4"
              poster=""
              title="Morning Yoga Class Sample"
            />
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">
            Replace src with your MediaCMS / Bunny CDN / HLS .m3u8 URL.
          </p>
        </div>
      </section>

      {/* ── 7. Lottie Breathing Section ────────────────────────────────── */}
      <LottieBreathingSection />

      {/* ── 8. Testimonials Swiper ─────────────────────────────────────── */}
      <TestimonialsSwiper />

      {/* ── 9. AOS animation classes demo ─────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <h2
            className="text-3xl font-black text-center text-green-950 mb-12"
            data-aos="fade-up"
          >
            AOS Scroll-Reveal Animations
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {([
              { animation: 'fade-up',         delay: 0,   color: 'bg-green-50  border-green-200' },
              { animation: 'fade-right',      delay: 100, color: 'bg-teal-50   border-teal-200'  },
              { animation: 'zoom-in',         delay: 200, color: 'bg-emerald-50 border-emerald-200' },
              { animation: 'yoga-scale-in',   delay: 300, color: 'bg-lime-50   border-lime-200'  },
              { animation: 'yoga-fade-up',    delay: 0,   color: 'bg-green-100 border-green-300' },
              { animation: 'flip-up',         delay: 100, color: 'bg-cyan-50   border-cyan-200'  },
            ]).map((item) => (
              <div
                key={item.animation}
                className={`${item.color} border rounded-2xl p-6`}
                data-aos={item.animation}
                data-aos-delay={item.delay}
              >
                <code className="text-green-800 font-mono font-bold">{`data-aos="${item.animation}"`}</code>
                {item.delay > 0 && (
                  <span className="ml-2 text-xs text-gray-400">{`delay=${item.delay}ms`}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. CSS utilities demo ─────────────────────────────────────── */}
      <section className="py-20 bg-yoga-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2
            className="text-3xl font-black text-white mb-4"
            data-aos="fade-up"
          >
            <span className="text-shimmer">Text Shimmer · Hover Lift · Yoga Tags</span>
          </h2>
          <p className="text-white/60 mb-10" data-aos="fade-up" data-aos-delay="50">
            Reusable CSS utility classes from globals.css
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12" data-aos="fade-up" data-aos-delay="100">
            {['Hatha', 'Vinyasa', 'Yin', 'Power', 'Ashtanga', 'Kundalini', 'Restorative', 'Prenatal'].map((tag) => (
              <span key={tag} className="yoga-tag bg-green-400/15 text-green-300 border border-green-400/20">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-6" data-aos="fade-up" data-aos-delay="150">
            {['light', 'dark', 'green'].map((v) => (
              <GlassCard key={v} variant={v as 'light' | 'dark' | 'green'} hoverLift padding="px-8 py-5">
                <span className="text-white font-semibold">hover-lift</span>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
