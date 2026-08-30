// Real public long-form video page — Module 15. Server component: fetches the
// published video by slug, increments a real view_count on every hit, embeds
// the source (self-hosted MP4 or YouTube/external URL).
import { notFound } from 'next/navigation';
import { databaseConfigured, query } from '@/lib/postgres';

export const dynamic = 'force-dynamic';

interface VideoRow {
  title: string; description: string; tags: string[]; thumbnail_url: string | null;
  source_url: string; status: string; view_count: number;
}

function isYouTubeUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return m ? m[1] : null;
}

async function getVideo(slug: string): Promise<VideoRow | null> {
  if (!databaseConfigured()) return null;
  const result = await query<VideoRow>(
    `SELECT title, description, tags, thumbnail_url, source_url, status::text, view_count FROM video_asset WHERE slug = $1`,
    [slug],
  );
  if (!result.rows.length || result.rows[0].status !== 'published') return null;
  await query(`UPDATE video_asset SET view_count = view_count + 1 WHERE slug = $1`, [slug]);
  return result.rows[0];
}

export default async function VideoPage({ params }: { params: { slug: string } }) {
  const video = await getVideo(params.slug);
  if (!video || video.status !== 'published') notFound();

  const ytId = isYouTubeUrl(video.source_url);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">{video.title}</h1>
        <p className="mt-1 text-sm text-gray-400">{video.view_count} view{video.view_count === 1 ? '' : 's'}</p>

        <div className="mt-6 aspect-video bg-black rounded-lg overflow-hidden">
          {ytId ? (
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} title={video.title} allowFullScreen />
          ) : (
            <video className="w-full h-full" src={video.source_url} poster={video.thumbnail_url ?? undefined} controls />
          )}
        </div>

        {video.description && <p className="mt-6 whitespace-pre-wrap text-gray-700">{video.description}</p>}
        {video.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {video.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">#{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
