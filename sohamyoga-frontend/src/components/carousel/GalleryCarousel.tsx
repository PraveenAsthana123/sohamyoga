"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

export interface GalleryItem {
  id: string;
  type: "image" | "video_mp4";
  src: string;
  thumbnail?: string;
  alt: string;
  caption?: string;
  category?: string;
}

interface GalleryCarouselProps {
  items: GalleryItem[];
  columns?: 2 | 3 | 4;
  showLightbox?: boolean;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
}

function VideoThumbnail({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <div className="relative w-full h-full">
      <video ref={ref} src={src} poster={poster} muted playsInline preload="metadata" className="w-full h-full object-cover" aria-label={alt} />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Lightbox({ items, startIndex, onClose }: { items: GalleryItem[]; startIndex: number; onClose: () => void }) {
  const [current, setCurrent] = useState(startIndex);
  const count = items.length;
  const item = items[current];

  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, next, prev]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      role="dialog"
      aria-modal
      aria-label="Image lightbox"
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl max-h-screen p-4" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
          aria-label="Close lightbox"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Media */}
        <div className="flex items-center justify-center" style={{ height: "70vh" }}>
          {item.type === "video_mp4" ? (
            <video
              key={item.id}
              src={item.src}
              poster={item.thumbnail}
              muted
              controls
              playsInline
              autoPlay
              className="max-h-full max-w-full rounded-lg"
              aria-label={item.alt}
            />
          ) : (
            <div className="relative max-h-full max-w-full" style={{ height: "70vh", width: "100%" }}>
              <Image src={item.src} alt={item.alt} fill className="object-contain rounded-lg" sizes="90vw" />
            </div>
          )}
        </div>

        {/* Caption */}
        {item.caption && <p className="text-center text-white/70 mt-4 text-sm">{item.caption}</p>}

        {/* Counter */}
        <p className="text-center text-white/50 text-xs mt-2">{current + 1} / {count}</p>

        {/* Arrows */}
        {count > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors" aria-label="Previous">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors" aria-label="Next">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GalleryCarousel({
  items,
  columns = 3,
  showLightbox = true,
  autoplay = false,
  autoplayDelay = 4000,
  pauseOnHover = true,
}: GalleryCarouselProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const visibleCount = columns;
  const canScroll = items.length > visibleCount;

  useEffect(() => {
    if (!autoplay || !canScroll || isPaused) return;
    const id = setInterval(() => setCurrent(c => (c + 1) % items.length), autoplayDelay);
    return () => clearInterval(id);
  }, [autoplay, canScroll, isPaused, items.length, autoplayDelay]);

  const gridCols = { 2: "grid-cols-2", 3: "grid-cols-2 md:grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" }[columns];

  if (!items || items.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
    >
      <div className={`grid ${gridCols} gap-3`}>
        {items.map((item, idx) => (
          <button
            key={item.id}
            className="relative overflow-hidden rounded-xl group aspect-square focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
            onClick={() => showLightbox && setLightboxIndex(idx)}
            aria-label={`View ${item.alt}${item.caption ? `: ${item.caption}` : ""}`}
          >
            <div className="absolute inset-0">
              {item.type === "video_mp4" ? (
                <VideoThumbnail src={item.src} poster={item.thumbnail} alt={item.alt} />
              ) : (
                <Image
                  src={item.thumbnail ?? item.src}
                  alt={item.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes={`(max-width: 768px) 50vw, ${Math.round(100 / columns)}vw`}
                  loading="lazy"
                />
              )}
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end p-3">
              {item.caption && (
                <p className="text-white text-xs translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 line-clamp-2">
                  {item.caption}
                </p>
              )}
            </div>
            {/* Category badge */}
            {item.category && (
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
                {item.category}
              </div>
            )}
            {/* Video badge */}
            {item.type === "video_mp4" && (
              <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                VIDEO
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {showLightbox && lightboxIndex !== null && (
        <Lightbox items={items} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
