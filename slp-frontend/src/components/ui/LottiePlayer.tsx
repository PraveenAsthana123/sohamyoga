'use client';

import { useEffect, useRef } from 'react';

interface LottiePlayerProps {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  width?: number | string;
  height?: number | string;
  renderer?: 'svg' | 'canvas' | 'html';
}

export default function LottiePlayer({
  src,
  loop = true,
  autoplay = true,
  className = '',
  width = '100%',
  height = '100%',
  renderer = 'svg',
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    const init = async () => {
      const { default: lottie } = await import('lottie-web');
      if (cancelled || !containerRef.current) return;

      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer,
        loop,
        autoplay,
        path: src,
      });
    };

    init();

    return () => {
      cancelled = true;
      if (animRef.current) {
        (animRef.current as { destroy: () => void }).destroy();
      }
    };
  }, [src, loop, autoplay, renderer]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
