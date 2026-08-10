"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export interface MarqueeItem {
  id: string;
  label: string;
  logoSrc?: string;
  icon?: string;
  description?: string;
  href?: string;
  badge?: string;
}

interface InfiniteMarqueeProps {
  items: MarqueeItem[];
  /** Full-cycle duration in seconds. Lower = faster. Default 30. */
  speed?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  /** Gap between cards in px */
  gap?: number;
  /** Render mode: "logo" | "service" | "text" */
  variant?: "logo" | "service" | "text";
  title?: string;
  subtitle?: string;
}

function LogoCard({ item }: { item: MarqueeItem }) {
  const inner = (
    <div className="flex items-center justify-center px-8 py-4 h-16 min-w-max bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200 select-none">
      {item.logoSrc ? (
        <div className="relative h-8 w-28">
          <Image src={item.logoSrc} alt={item.label} fill className="object-contain" sizes="112px" />
        </div>
      ) : (
        <span className="text-gray-500 font-medium text-sm whitespace-nowrap">{item.label}</span>
      )}
    </div>
  );
  return item.href ? <Link href={item.href} aria-label={item.label}>{inner}</Link> : <div>{inner}</div>;
}

function ServiceCard({ item }: { item: MarqueeItem }) {
  const inner = (
    <div className="flex flex-col items-center gap-2 px-6 py-5 min-w-[160px] bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-300 hover:-translate-y-0.5 transition-all duration-200 select-none group">
      {item.icon && (
        <span className="text-3xl">{item.icon}</span>
      )}
      {item.logoSrc && (
        <div className="relative w-10 h-10 rounded-full overflow-hidden bg-amber-50">
          <Image src={item.logoSrc} alt={item.label} fill className="object-cover" sizes="40px" />
        </div>
      )}
      <p className="font-semibold text-gray-900 text-sm text-center leading-tight whitespace-nowrap">{item.label}</p>
      {item.description && (
        <p className="text-gray-400 text-xs text-center line-clamp-2 max-w-[140px]">{item.description}</p>
      )}
      {item.badge && (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{item.badge}</span>
      )}
    </div>
  );
  return item.href ? <Link href={item.href} aria-label={item.label}>{inner}</Link> : <div>{inner}</div>;
}

function TextPill({ item }: { item: MarqueeItem }) {
  const inner = (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors select-none whitespace-nowrap">
      {item.icon && <span className="text-base">{item.icon}</span>}
      <span className="text-sm font-medium text-amber-800">{item.label}</span>
    </div>
  );
  return item.href ? <Link href={item.href}>{inner}</Link> : <div>{inner}</div>;
}

export default function InfiniteMarquee({
  items,
  speed = 30,
  direction = "left",
  pauseOnHover = true,
  gap = 16,
  variant = "service",
  title,
  subtitle,
}: InfiniteMarqueeProps) {
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  // Duplicate items so the -50% translateX scroll loops perfectly
  const doubled = [...items, ...items];

  const animStyle: React.CSSProperties = {
    animationDuration: `${speed}s`,
    animationDirection: direction === "right" ? "reverse" : "normal",
    animationPlayState: paused ? "paused" : "running",
    gap: `${gap}px`,
  };

  const CardComponent = variant === "logo" ? LogoCard : variant === "text" ? TextPill : ServiceCard;

  return (
    <section
      className="w-full overflow-hidden"
      aria-label={title ?? "Marquee"}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
      onFocus={() => pauseOnHover && setPaused(true)}
      onBlur={() => pauseOnHover && setPaused(false)}
    >
      {(title || subtitle) && (
        <div className="text-center mb-8 px-4">
          {title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>}
          {subtitle && <p className="text-gray-500 mt-2">{subtitle}</p>}
        </div>
      )}

      {/* Gradient fade edges */}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-white to-transparent" />

        {/* The scrolling track */}
        <div
          ref={trackRef}
          className="flex animate-scroll will-change-transform"
          style={animStyle}
          aria-hidden="true"
        >
          {doubled.map((item, i) => (
            <div key={`${item.id}-${i}`} className="flex-shrink-0">
              <CardComponent item={item} />
            </div>
          ))}
        </div>
      </div>

      {/* Screen-reader only static list — the animated track is aria-hidden */}
      <ul className="sr-only" aria-label={title ?? "Items"}>
        {items.map(item => (
          <li key={item.id}>
            {item.href ? <a href={item.href}>{item.label}</a> : item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
