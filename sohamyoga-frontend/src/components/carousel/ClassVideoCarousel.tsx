"use client";
import { useState, useRef, useEffect } from "react";

export interface ClassVideo {
  id: string;
  title: string;
  instructor?: string;
  duration?: string;
  level?: "Beginner" | "Intermediate" | "Advanced" | "All Levels";
  style?: string;
  src: string;
  poster: string;
  description?: string;
}

interface ClassVideoCarouselProps {
  videos: ClassVideo[];
  slidesPerView?: 1 | 2 | 3;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-amber-100 text-amber-700",
  Advanced: "bg-red-100 text-red-700",
  "All Levels": "bg-blue-100 text-blue-700",
};

function VideoCard({ video }: { video: ClassVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setIsPlaying(true); }
    else { el.pause(); setIsPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    setProgress((el.currentTime / el.duration) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  };

  const handleEnded = () => { setIsPlaying(false); setProgress(0); };

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow">
      {/* Video area */}
      <div className="relative aspect-video bg-gray-900">
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          muted
          playsInline
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          className="w-full h-full object-cover"
          aria-label={`${video.title} yoga class video`}
        />

        {/* Play/Pause overlay */}
        <button
          onClick={toggle}
          className="absolute inset-0 flex items-center justify-center group/btn"
          aria-label={isPlaying ? `Pause ${video.title}` : `Play ${video.title}`}
        >
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <svg className="w-7 h-7 text-amber-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          {isPlaying && (
            <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/btn:opacity-100 transition-opacity">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </div>
          )}
        </button>

        {/* Muted badge */}
        <div className="absolute top-3 right-3 bg-black/60 text-white/80 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
          Muted
        </div>

        {/* Duration */}
        {video.duration && (
          <div className="absolute bottom-10 right-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            {video.duration}
          </div>
        )}

        {/* Progress bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 cursor-pointer"
          onClick={handleSeek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={`${video.title} playback position`}
        >
          <div className="h-full bg-amber-400 transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{video.title}</h3>
          {video.level && (
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${LEVEL_COLORS[video.level] ?? "bg-gray-100 text-gray-600"}`}>
              {video.level}
            </span>
          )}
        </div>

        {video.instructor && (
          <p className="text-xs text-gray-400 mb-2">with {video.instructor}</p>
        )}

        {video.style && (
          <p className="text-xs text-amber-600 font-medium">{video.style}</p>
        )}

        {video.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{video.description}</p>
        )}
      </div>
    </article>
  );
}

export default function ClassVideoCarousel({
  videos,
  slidesPerView = 3,
  autoplay = false,
  autoplayDelay = 8000,
  pauseOnHover = true,
  showArrows = true,
  showDots = true,
}: ClassVideoCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = videos.length;
  const step = Math.min(slidesPerView, count);

  const next = () => { if (count > step) setCurrent(c => (c + 1) % count); };
  const prev = () => { if (count > step) setCurrent(c => (c - 1 + count) % count); };

  useEffect(() => {
    if (!autoplay || isPaused || count <= step) return;
    const id = setInterval(next, autoplayDelay);
    return () => clearInterval(id);
  }, [current, isPaused, autoplay, count, step, autoplayDelay]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current]);

  const visible = Array.from({ length: step }, (_, i) => videos[(current + i) % count]);

  if (!videos || videos.length === 0) return null;

  return (
    <div
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      aria-label="Yoga class videos"
      aria-roledescription="carousel"
    >
      <div className={`grid gap-5 ${step === 1 ? "grid-cols-1" : step === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {visible.map((video, i) => (
          <div key={`${video.id}-${current}-${i}`} role="group" aria-roledescription="slide">
            <VideoCard video={video} />
          </div>
        ))}
      </div>

      {count > step && (
        <div className="flex items-center justify-center gap-4 mt-8">
          {showArrows && (
            <button onClick={prev} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Previous videos">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {showDots && (
            <div className="flex gap-2" role="tablist">
              {videos.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === current}
                  onClick={() => setCurrent(i)}
                  className={`transition-all duration-300 rounded-full focus-visible:ring-2 focus-visible:ring-amber-400 ${i === current ? "w-8 h-2.5 bg-amber-400" : "w-2.5 h-2.5 bg-gray-200"}`}
                  aria-label={`Go to video ${i + 1}`}
                />
              ))}
            </div>
          )}
          {showArrows && (
            <button onClick={next} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-600 text-gray-400 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Next videos">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
