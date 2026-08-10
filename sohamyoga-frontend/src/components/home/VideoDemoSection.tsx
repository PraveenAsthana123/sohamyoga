'use client';

import { useState } from 'react';
import type { VideoDemo } from '@/lib/api';

interface VideoDemoSectionProps {
  videos: VideoDemo[];
}

function getEmbedUrl(videoUrl: string): string {
  // Convert YouTube watch URLs to embed
  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;

  // Convert Vimeo URLs to embed
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;

  return videoUrl;
}

function getThumbnail(videoUrl: string, thumbnailUrl?: string): string | null {
  if (thumbnailUrl) return thumbnailUrl;

  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;

  return null;
}

export default function VideoDemoSection({ videos }: VideoDemoSectionProps) {
  const [activeVideo, setActiveVideo] = useState<VideoDemo | null>(null);

  if (!videos || videos.length === 0) return null;

  return (
    <>
      <section className="py-20 bg-dark-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="section-title text-dark-900">
            Video <span className="text-primary-600">Demos</span>
          </h2>
          <p className="section-subtitle">
            Watch our solutions in action. See how we deliver real results through innovative technology.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video) => {
              const thumbnail = getThumbnail(video.videoUrl, video.thumbnailUrl);

              return (
                <button
                  key={video.id}
                  onClick={() => setActiveVideo(video)}
                  className="group text-left"
                  aria-label={`Play video: ${video.title}`}
                >
                  <div className="card border border-dark-100 p-0 overflow-hidden group-hover:-translate-y-1 transition-all duration-300">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-dark-200 overflow-hidden">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
                          <svg className="w-16 h-16 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}

                      {/* Play button overlay */}
                      <div className="absolute inset-0 bg-dark-900/30 group-hover:bg-dark-900/50 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-all duration-300">
                          <svg className="w-7 h-7 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>

                      {/* Duration badge */}
                      {video.duration && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 bg-dark-900/80 backdrop-blur-sm text-white text-xs font-medium rounded">
                          {video.duration}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Category */}
                      <span className="inline-block px-2 py-0.5 bg-primary-50 text-primary-600 text-xs font-medium rounded mb-2">
                        {video.category}
                      </span>

                      <h3 className="text-base font-semibold text-dark-900 mb-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {video.title}
                      </h3>

                      <p className="text-dark-500 text-sm leading-relaxed line-clamp-2">
                        {video.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Video modal */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-900/90 backdrop-blur-sm p-4"
          onClick={() => setActiveVideo(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Playing: ${activeVideo.title}`}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
              aria-label="Close video"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video iframe */}
            <div className="relative aspect-video bg-dark-900 rounded-xl overflow-hidden shadow-2xl">
              <iframe
                src={getEmbedUrl(activeVideo.videoUrl)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={activeVideo.title}
              />
            </div>

            {/* Video info */}
            <div className="mt-4 text-center">
              <h3 className="text-white text-lg font-semibold">{activeVideo.title}</h3>
              <p className="text-dark-400 text-sm mt-1">{activeVideo.description}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
