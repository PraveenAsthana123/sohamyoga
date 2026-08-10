'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimeCounterProps {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
  decimals?: number;
}

export default function AnimeCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
  className = '',
  decimals = 0,
}: AnimeCounterProps) {
  const [display, setDisplay] = useState('0');
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();
          runAnimation();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  function runAnimation() {
    const obj = { value: 0 };
    const startTime = performance.now();

    const easeOutExpo = (t: number) =>
      t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      obj.value = eased * target;
      setDisplay(obj.value.toFixed(decimals));
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(target.toFixed(decimals));
    };

    requestAnimationFrame(tick);
  }

  return (
    <span ref={containerRef} className={className}>
      {prefix}{display}{suffix}
    </span>
  );
}
