"use client";
import { useState, useEffect, useCallback } from "react";

export interface TestimonialSlide {
  id: string;
  authorName: string;
  authorTitle?: string;
  company?: string;
  quote: string;
  rating: number;
  initials?: string;
  avatarSrc?: string;
  yogaStyle?: string;
}

interface TestimonialCarouselProps {
  testimonials: TestimonialSlide[];
  slidesPerView?: 1 | 2 | 3;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} className={`w-4 h-4 ${n <= rating ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ t, featured = false }: { t: TestimonialSlide; featured?: boolean }) {
  const initials = t.initials || t.authorName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <article
      className={`bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 ${featured ? "border-amber-300 shadow-amber-50 shadow-md" : "border-gray-100 hover:shadow-md"}`}
      aria-label={`Testimonial from ${t.authorName}`}
    >
      <div className="flex items-center justify-between mb-4">
        <Stars rating={t.rating} />
        {t.yogaStyle && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t.yogaStyle}</span>
        )}
      </div>

      {/* Quote icon */}
      <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center mb-3">
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H0z" />
        </svg>
      </div>

      <blockquote className="text-gray-700 text-sm leading-relaxed italic mb-5">
        &ldquo;{t.quote}&rdquo;
      </blockquote>

      <footer className="flex items-center gap-3 border-t border-gray-50 pt-4">
        {t.avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.avatarSrc} alt={t.authorName} className="w-11 h-11 rounded-full object-cover" loading="lazy" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 text-sm">{t.authorName}</p>
          {(t.authorTitle || t.company) && (
            <p className="text-gray-400 text-xs">{[t.authorTitle, t.company].filter(Boolean).join(", ")}</p>
          )}
        </div>
      </footer>
    </article>
  );
}

export default function TestimonialCarousel({
  testimonials,
  slidesPerView = 3,
  autoplay = true,
  autoplayDelay = 5000,
  pauseOnHover = true,
  showArrows = true,
  showDots = true,
}: TestimonialCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = testimonials.length;
  const step = Math.min(slidesPerView, count);

  const next = useCallback(() => {
    if (count <= step) return;
    setCurrent(c => (c + 1) % count);
  }, [count, step]);

  const prev = useCallback(() => {
    if (count <= step) return;
    setCurrent(c => (c - 1 + count) % count);
  }, [count, step]);

  useEffect(() => {
    if (!autoplay || isPaused || count <= step) return;
    const id = setInterval(next, autoplayDelay);
    return () => clearInterval(id);
  }, [autoplay, isPaused, next, count, step, autoplayDelay]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const visible = Array.from({ length: step }, (_, i) => testimonials[(current + i) % count]);

  if (!testimonials || testimonials.length === 0) return null;

  return (
    <div
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      aria-label="Testimonials"
      aria-roledescription="carousel"
    >
      <div className={`grid gap-6 ${step === 1 ? "grid-cols-1" : step === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {visible.map((t, i) => (
          <div key={`${t.id}-${current}-${i}`} role="group" aria-roledescription="slide">
            <TestimonialCard t={t} featured={i === Math.floor(step / 2)} />
          </div>
        ))}
      </div>

      {count > step && (
        <div className="flex items-center justify-center gap-4 mt-8">
          {showArrows && (
            <button onClick={prev} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Previous testimonials">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {showDots && (
            <div className="flex gap-2" role="tablist">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === current}
                  onClick={() => setCurrent(i)}
                  className={`transition-all duration-300 rounded-full focus-visible:ring-2 focus-visible:ring-amber-400 ${i === current ? "w-8 h-2.5 bg-amber-400" : "w-2.5 h-2.5 bg-gray-200 hover:bg-gray-300"}`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
          )}
          {showArrows && (
            <button onClick={next} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Next testimonials">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
