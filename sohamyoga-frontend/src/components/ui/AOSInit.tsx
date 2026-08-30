'use client';

import { useEffect } from 'react';

interface AOSInitProps {
  duration?: number;
  easing?: string;
  once?: boolean;
  offset?: number;
}

/**
 * Drop this once anywhere in your layout (e.g. in layout.tsx body).
 * It runs AOS.init() in a useEffect so it only fires client-side.
 *
 * Usage on elements:
 *   data-aos="fade-up"
 *   data-aos="yoga-fade-up"
 *   data-aos="fade-right"
 *   data-aos="zoom-in"
 *   data-aos-delay="100"
 *   data-aos-duration="600"
 *   data-aos-offset="80"
 */
export default function AOSInit({
  duration = 700,
  easing = 'ease-out-cubic',
  once = true,
  offset = 80,
}: AOSInitProps) {
  useEffect(() => {
    const init = async () => {
      const [{ default: AOS }, AOSCss] = await Promise.all([
        import('aos'),
        import('aos/dist/aos.css' as string),
      ]);
      void AOSCss;
      // easing is a loose string prop on this component by design (callers
      // pass raw data-aos-easing-style values); @types/aos's easingOptions
      // union is stricter than AOS actually enforces at runtime.
      AOS.init({ duration, easing: easing as import('aos').easingOptions, once, offset });
    };
    init();
  }, [duration, easing, once, offset]);

  return null;
}
