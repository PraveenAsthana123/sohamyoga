'use client';

import { useEffect, useRef } from 'react';

interface PlyrVideoProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
}

export default function PlyrVideo({
  src,
  poster,
  title,
  className = '',
  autoplay = false,
}: PlyrVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<unknown>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const isHls = src.includes('.m3u8');
    let hlsInstance: unknown = null;

    const init = async () => {
      // Dynamic imports keep Plyr/hls.js out of the SSR bundle
      const [{ default: Plyr }, PlyrCSS] = await Promise.all([
        import('plyr'),
        import('plyr/dist/plyr.css' as string),
      ]);

      void PlyrCSS; // CSS side-effect import

      if (isHls) {
        const { default: Hls } = await import('hls.js');
        if (Hls.isSupported() && videoRef.current) {
          const hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(videoRef.current);
          hlsInstance = hls;
        } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
          videoRef.current.src = src;
        }
      } else if (videoRef.current) {
        videoRef.current.src = src;
      }

      if (videoRef.current) {
        // title isn't a Plyr Options property (checked @types/plyr) — set
        // it as a real HTML attribute on the underlying <video> element,
        // which is the standard accessible-name mechanism Plyr itself reads.
        videoRef.current.title = title ?? '';
        playerRef.current = new Plyr(videoRef.current, {
          controls: [
            'play-large', 'play', 'progress', 'current-time',
            'mute', 'volume', 'captions', 'settings', 'fullscreen',
          ],
          autoplay,
        });
      }
    };

    init();

    return () => {
      if (playerRef.current && typeof (playerRef.current as { destroy?: () => void }).destroy === 'function') {
        (playerRef.current as { destroy: () => void }).destroy();
      }
      if (hlsInstance && typeof (hlsInstance as { destroy?: () => void }).destroy === 'function') {
        (hlsInstance as { destroy: () => void }).destroy();
      }
    };
  }, [src, autoplay, title]);

  return (
    <div className={`plyr-yoga-card ${className}`}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        crossOrigin="anonymous"
      />
    </div>
  );
}
