"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";

interface ImageComparisonSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial handle position 0-100. Default 50. */
  initialPosition?: number;
  /** Orientation of the divider. Default "horizontal". */
  orientation?: "horizontal" | "vertical";
  /** Optional caption below */
  caption?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1" | "3/2";
}

const ASPECT_CLASSES: Record<string, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
  "3/2": "aspect-[3/2]",
};

export default function ImageComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeLabel = "Before",
  afterLabel = "After",
  initialPosition = 50,
  orientation = "horizontal",
  caption,
  aspectRatio = "16/9",
}: ImageComparisonSliderProps) {
  const [position, setPosition] = useState(Math.min(100, Math.max(0, initialPosition)));
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = orientation === "horizontal";

  const getPositionFromEvent = useCallback(
    (clientX: number, clientY: number): number => {
      const el = containerRef.current;
      if (!el) return position;
      const rect = el.getBoundingClientRect();
      if (isHorizontal) {
        return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
      }
      return Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    },
    [isHorizontal, position]
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition(getPositionFromEvent(e.clientX, e.clientY));
    },
    [isDragging, getPositionFromEvent]
  );

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      e.preventDefault();
      setPosition(getPositionFromEvent(e.touches[0].clientX, e.touches[0].clientY));
    },
    [isDragging, getPositionFromEvent]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp, onTouchMove]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    if (isHorizontal) {
      if (e.key === "ArrowLeft") setPosition(p => Math.max(0, p - step));
      if (e.key === "ArrowRight") setPosition(p => Math.min(100, p + step));
    } else {
      if (e.key === "ArrowUp") setPosition(p => Math.max(0, p - step));
      if (e.key === "ArrowDown") setPosition(p => Math.min(100, p + step));
    }
  };

  const onContainerClick = (e: React.MouseEvent) => {
    setPosition(getPositionFromEvent(e.clientX, e.clientY));
  };

  const clipBefore = isHorizontal
    ? `inset(0 ${100 - position}% 0 0)`
    : `inset(0 0 ${100 - position}% 0)`;

  const handleStyle: React.CSSProperties = isHorizontal
    ? { left: `${position}%`, top: 0, bottom: 0, width: "2px" }
    : { top: `${position}%`, left: 0, right: 0, height: "2px" };

  const knobStyle: React.CSSProperties = isHorizontal
    ? { left: `${position}%`, top: "50%", transform: "translate(-50%, -50%)" }
    : { top: `${position}%`, left: "50%", transform: "translate(-50%, -50%)" };

  const aspectClass = ASPECT_CLASSES[aspectRatio] ?? "aspect-video";

  return (
    <figure className="w-full">
      <div
        ref={containerRef}
        className={`relative ${aspectClass} overflow-hidden rounded-2xl cursor-col-resize select-none bg-gray-900 shadow-lg`}
        style={{ cursor: isHorizontal ? "col-resize" : "row-resize" }}
        onClick={onContainerClick}
        onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
        onTouchStart={e => { setIsDragging(true); }}
        role="slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Compare ${beforeLabel} and ${afterLabel}. Currently at ${Math.round(position)}%`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {/* AFTER (full, behind) */}
        <div className="absolute inset-0">
          <Image
            src={afterSrc}
            alt={afterAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 80vw"
            draggable={false}
          />
          {afterLabel && (
            <div className={`absolute bottom-3 ${isHorizontal ? "right-3" : "bottom-3 left-1/2 -translate-x-1/2"} bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full select-none pointer-events-none`}>
              {afterLabel}
            </div>
          )}
        </div>

        {/* BEFORE (clipped, on top) */}
        <div
          className="absolute inset-0"
          style={{ clipPath: clipBefore }}
        >
          <Image
            src={beforeSrc}
            alt={beforeAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 80vw"
            draggable={false}
          />
          {beforeLabel && (
            <div className={`absolute bottom-3 ${isHorizontal ? "left-3" : "top-3 left-1/2 -translate-x-1/2"} bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full select-none pointer-events-none`}>
              {beforeLabel}
            </div>
          )}
        </div>

        {/* Divider line */}
        <div
          className="absolute bg-white/80 pointer-events-none z-10"
          style={handleStyle}
        />

        {/* Drag knob */}
        <div
          className={`absolute z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border-2 border-white cursor-grab ${isDragging ? "cursor-grabbing scale-110" : ""} transition-transform duration-100 focus-visible:ring-4 focus-visible:ring-amber-400`}
          style={knobStyle}
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setIsDragging(true); }}
          onTouchStart={e => { e.stopPropagation(); setIsDragging(true); }}
          aria-hidden="true"
        >
          {isHorizontal ? (
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5l-5 7 5 7m8-14l5 7-5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 8l7-5 7 5m-14 8l7 5 7-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>

        {/* Position indicator */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm pointer-events-none select-none z-20 opacity-0 hover:opacity-100 transition-opacity">
          {Math.round(position)}%
        </div>
      </div>

      {caption && (
        <figcaption className="text-center text-sm text-gray-500 mt-3 italic">{caption}</figcaption>
      )}
    </figure>
  );
}
