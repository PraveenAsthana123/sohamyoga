"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export interface HeroSlide {
  id: string;
  type: "image" | "video_mp4" | "gradient";
  src?: string;
  alt?: string;
  poster?: string;
  /** CSS gradient Tailwind class used when type="gradient" */
  gradientClass?: string;
  heading: string;
  subheading?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  secondaryCtaText?: string;
  secondaryCtaUrl?: string;
  overlay?: string; // Tailwind gradient class
}

interface SwiperHeroProps {
  slides: HeroSlide[];
  autoplayDelay?: number;
  loop?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  pauseOnHover?: boolean;
  onSlideClick?: (slideId: string) => void;
}

export default function SwiperHero({
  slides,
  autoplayDelay = 6000,
  loop = true,
  showDots = true,
  showArrows = true,
  pauseOnHover = true,
  onSlideClick,
}: SwiperHeroProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = slides.length;

  const goTo = (index: number, skipTransition = false) => {
    if (index === current) return;
    if (!skipTransition) setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setIsTransitioning(false);
    }, skipTransition ? 0 : 50);
  };

  const next = () => goTo(loop ? (current + 1) % count : Math.min(current + 1, count - 1));
  const prev = () => goTo(loop ? (current - 1 + count) % count : Math.max(current - 1, 0));

  // Autoplay
  useEffect(() => {
    if (count <= 1 || isPaused) return;
    intervalRef.current = setInterval(next, autoplayDelay);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [current, isPaused, count, autoplayDelay]);

  // Pause/play video on slide change
  useEffect(() => {
    videoRefs.current.forEach((el, idx) => {
      if (idx === current) {
        el.currentTime = 0;
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  }, [current]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current]);

  if (!slides || slides.length === 0) return null;

  return (
    <section
      className="relative w-full h-[90vh] min-h-[600px] overflow-hidden bg-gray-900 focus-visible:outline-none"
      aria-label="Hero slideshow"
      aria-roledescription="carousel"
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      tabIndex={0}
    >
      {/* Slides */}
      {slides.map((slide, idx) => (
        <div
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${idx + 1} of ${count}: ${slide.heading}`}
          aria-hidden={idx !== current}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
          onClick={() => onSlideClick?.(slide.id)}
        >
          {/* Background — gradient, video, or image */}
          {slide.type === "gradient" ? (
            <div className={`absolute inset-0 ${slide.gradientClass ?? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"}`} />
          ) : slide.type === "video_mp4" ? (
            <video
              ref={el => { if (el) videoRefs.current.set(idx, el); else videoRefs.current.delete(idx); }}
              src={slide.src}
              poster={slide.poster}
              muted
              playsInline
              loop
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
              aria-label={slide.alt || slide.heading}
            />
          ) : (
            <Image
              src={slide.src!}
              alt={slide.alt || slide.heading}
              fill
              className="object-cover"
              priority={idx === 0}
              sizes="100vw"
            />
          )}

          {/* Dark overlay */}
          <div className={`absolute inset-0 ${slide.overlay ?? "bg-gradient-to-br from-gray-900/70 via-gray-800/50 to-gray-900/60"}`} />

          {/* Content */}
          <div className="relative h-full flex items-center z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-3xl">
                {slide.subheading && (
                  <span
                    className={`inline-block text-amber-400 text-sm font-semibold tracking-wider uppercase mb-4 transition-all duration-700 delay-100 ${
                      idx === current && !isTransitioning ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                    }`}
                  >
                    {slide.subheading}
                  </span>
                )}
                <h1
                  className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 transition-all duration-700 delay-150 ${
                    idx === current && !isTransitioning ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                  }`}
                >
                  {slide.heading}
                </h1>
                {slide.description && (
                  <p
                    className={`text-lg text-white/80 leading-relaxed mb-8 max-w-xl transition-all duration-700 delay-200 ${
                      idx === current && !isTransitioning ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                    }`}
                  >
                    {slide.description}
                  </p>
                )}
                <div
                  className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 delay-300 ${
                    idx === current && !isTransitioning ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                  }`}
                >
                  {slide.ctaText && slide.ctaUrl && (
                    <Link href={slide.ctaUrl} className="inline-flex items-center justify-center px-8 py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 font-bold rounded-xl transition-colors text-base">
                      {slide.ctaText}
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  )}
                  {slide.secondaryCtaText && slide.secondaryCtaUrl && (
                    <Link href={slide.secondaryCtaUrl} className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/40 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors text-base">
                      {slide.secondaryCtaText}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Arrow controls */}
      {showArrows && count > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dot navigation */}
      {showDots && count > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3" role="tablist" aria-label="Slide navigation">
          {slides.map((_, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={idx === current}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => goTo(idx)}
              className={`transition-all duration-300 rounded-full focus-visible:ring-2 focus-visible:ring-amber-400 ${
                idx === current ? "w-10 h-3 bg-amber-400" : "w-3 h-3 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}

      {/* Slide counter */}
      <div className="absolute top-4 right-4 z-20 bg-black/40 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm" aria-live="polite" aria-atomic>
        {current + 1} / {count}
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 left-4 z-20 bg-black/40 text-white/70 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
          ⏸ Paused
        </div>
      )}
    </section>
  );
}
