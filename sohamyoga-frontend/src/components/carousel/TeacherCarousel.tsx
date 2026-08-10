"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

export interface TeacherSlide {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoSrc?: string;
  specialties?: string[];
  experience?: string;
  rating?: number;
  classCount?: number;
  profileUrl?: string;
  introVideoSrc?: string;
  introPoster?: string;
}

interface TeacherCarouselProps {
  teachers: TeacherSlide[];
  slidesPerView?: 1 | 2 | 3 | 4;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
}

function TeacherCard({ teacher, isActive }: { teacher: TeacherSlide; isActive: boolean }) {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoToggle = () => {
    setShowVideo(v => !v);
    if (!showVideo && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current?.pause();
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 ${isActive ? "ring-2 ring-amber-400 shadow-amber-100" : "hover:shadow-lg"}`}>
      {/* Photo / Video area */}
      <div className="relative h-64 bg-gray-100">
        {showVideo && teacher.introVideoSrc ? (
          <video
            ref={videoRef}
            src={teacher.introVideoSrc}
            poster={teacher.introPoster ?? teacher.photoSrc}
            muted
            playsInline
            controls
            className="w-full h-full object-cover"
            aria-label={`${teacher.name} introduction video`}
          />
        ) : (
          <>
            {teacher.photoSrc ? (
              <Image src={teacher.photoSrc} alt={`${teacher.name}, ${teacher.role}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                <div className="w-24 h-24 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-3xl font-bold">
                  {teacher.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
              </div>
            )}
            {/* Video preview button */}
            {teacher.introVideoSrc && (
              <button
                onClick={handleVideoToggle}
                className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-white flex items-center justify-center shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Play ${teacher.name}'s intro video`}
              >
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </button>
            )}
          </>
        )}
        {showVideo && (
          <button onClick={handleVideoToggle} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label="Stop video">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-lg">{teacher.name}</h3>
        <p className="text-amber-600 text-sm font-medium">{teacher.role}</p>

        {teacher.experience && (
          <p className="text-gray-400 text-xs mt-1">{teacher.experience}</p>
        )}

        {teacher.bio && (
          <p className="text-gray-600 text-sm mt-3 line-clamp-3">{teacher.bio}</p>
        )}

        {teacher.specialties && teacher.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {teacher.specialties.slice(0, 4).map(s => (
              <span key={s} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">{s}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          {teacher.rating !== undefined && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{teacher.rating.toFixed(1)}</span>
            </div>
          )}
          {teacher.classCount !== undefined && (
            <span className="text-xs text-gray-400">{teacher.classCount} classes</span>
          )}
          {teacher.profileUrl && (
            <Link href={teacher.profileUrl} className="text-xs text-amber-600 hover:text-amber-700 font-medium">View profile →</Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherCarousel({
  teachers,
  slidesPerView = 3,
  autoplay = true,
  autoplayDelay = 5000,
  pauseOnHover = true,
  showArrows = true,
  showDots = true,
}: TeacherCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const count = teachers.length;
  const step = slidesPerView;

  const next = () => setCurrent(c => (c + step) % count);
  const prev = () => setCurrent(c => (c - step + count) % count);

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

  const visible = Array.from({ length: step }, (_, i) => teachers[(current + i) % count]);

  if (!teachers || teachers.length === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => pauseOnHover && setIsPaused(true)}
      onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      aria-label="Teacher profiles carousel"
      aria-roledescription="carousel"
    >
      <div className={`grid gap-6 ${step === 1 ? "grid-cols-1" : step === 2 ? "grid-cols-1 md:grid-cols-2" : step === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
        {visible.map((teacher, i) => (
          <div key={`${teacher.id}-${i}`} role="group" aria-roledescription="slide">
            <TeacherCard teacher={teacher} isActive={i === 0} />
          </div>
        ))}
      </div>

      {/* Navigation */}
      {count > step && (
        <div className="flex items-center justify-center gap-4 mt-8">
          {showArrows && (
            <button onClick={prev} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-500 text-gray-500 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Previous teachers">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          {showDots && (
            <div className="flex gap-2" role="tablist">
              {Array.from({ length: Math.ceil(count / step) }, (_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={Math.floor(current / step) === i}
                  onClick={() => setCurrent(i * step)}
                  className={`transition-all duration-300 rounded-full focus-visible:ring-2 focus-visible:ring-amber-400 ${Math.floor(current / step) === i ? "w-8 h-2.5 bg-amber-400" : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"}`}
                  aria-label={`Go to group ${i + 1}`}
                />
              ))}
            </div>
          )}
          {showArrows && (
            <button onClick={next} className="w-12 h-12 rounded-full border-2 border-gray-200 hover:border-amber-400 hover:text-amber-500 text-gray-500 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-amber-400" aria-label="Next teachers">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
