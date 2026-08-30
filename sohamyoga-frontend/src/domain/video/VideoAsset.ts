export type VideoAssetStatus = 'draft' | 'published' | 'archived';
export type VideoAssetFormat = 'long_form' | 'reel';
// Script + faceless-render pipeline state, added to the existing catalog
// state model rather than a parallel table — a video's script and render
// state are just more facts about that one video row.
export type VideoScriptStatus = 'none' | 'draft' | 'approved';
export type VideoRenderStatus = 'none' | 'queued' | 'rendering' | 'complete' | 'failed';

export interface VideoAssetProps {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  durationSeconds?: number;
  thumbnailUrl?: string;
  sourceUrl: string;
  status: VideoAssetStatus;
  viewCount: number;
  socialVariantId?: string;
  publishedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  format: VideoAssetFormat;
  hashtags: string[];
  script?: string;
  hooks: string[];
  scriptStatus: VideoScriptStatus;
  scriptGeneratedAt?: Date;
  scriptApprovedAt?: Date;
  scriptApprovedBy?: string;
  renderStatus: VideoRenderStatus;
  renderError?: string;
  renderChecksum?: string;
  renderedAt?: Date;
}

function isValidUrl(url: string): boolean {
  if (url.startsWith('/')) return true; // root-relative, self-hosted (public/) asset — e.g. a completed render
  try { new URL(url); return true; } catch { return false; }
}

export class VideoAsset {
  private readonly props: VideoAssetProps;

  constructor(props: VideoAssetProps) {
    if (!props.title.trim()) throw new Error('title is required');
    if (!/^[a-z0-9-]+$/.test(props.slug)) throw new Error('slug must be lowercase letters, numbers, and hyphens');
    if (!isValidUrl(props.sourceUrl)) throw new Error('sourceUrl must be a valid absolute URL');
    if (props.durationSeconds !== undefined && props.durationSeconds <= 0) throw new Error('durationSeconds must be positive');
    if (props.viewCount < 0) throw new Error('viewCount cannot be negative');
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get slug() { return this.props.slug; }
  get title() { return this.props.title; }
  get status() { return this.props.status; }
  get viewCount() { return this.props.viewCount; }
  get format() { return this.props.format; }
  get hashtags() { return this.props.hashtags; }
  get script() { return this.props.script; }
  get hooks() { return this.props.hooks; }
  get scriptStatus() { return this.props.scriptStatus; }
  get renderStatus() { return this.props.renderStatus; }
  get renderError() { return this.props.renderError; }

  publish(): VideoAsset {
    if (this.props.status !== 'draft') throw new Error('Only a draft video can be published.');
    return new VideoAsset({ ...this.props, status: 'published', publishedAt: new Date(), updatedAt: new Date() });
  }

  archive(): VideoAsset {
    return new VideoAsset({ ...this.props, status: 'archived', updatedAt: new Date() });
  }

  recordView(): VideoAsset {
    return new VideoAsset({ ...this.props, viewCount: this.props.viewCount + 1, updatedAt: new Date() });
  }

  // ── Script + faceless-render pipeline ──────────────────────────────────
  // draft -> approved (human gate, never auto-approved) -> render
  // queued -> rendering -> complete|failed (retry re-enters queued).

  draftScript(script: string, hooks: string[], at: Date): VideoAsset {
    if (!script.trim()) throw new Error('script cannot be empty');
    if (hooks.length < 1) throw new Error('at least one hook line is required');
    if (this.props.renderStatus === 'rendering') throw new Error('Cannot regenerate a script while a render is in progress.');
    return new VideoAsset({
      ...this.props, script, hooks, scriptStatus: 'draft', scriptGeneratedAt: at,
      scriptApprovedAt: undefined, scriptApprovedBy: undefined, updatedAt: at,
    });
  }

  approveScript(approvedBy: string, at: Date): VideoAsset {
    if (this.props.scriptStatus !== 'draft') throw new Error('Only a drafted script can be approved.');
    if (!this.props.script?.trim()) throw new Error('No script to approve.');
    return new VideoAsset({
      ...this.props, scriptStatus: 'approved', scriptApprovedAt: at, scriptApprovedBy: approvedBy, updatedAt: at,
    });
  }

  queueRender(at: Date): VideoAsset {
    if (this.props.scriptStatus !== 'approved') throw new Error('Script must be approved before rendering.');
    if (this.props.renderStatus === 'queued' || this.props.renderStatus === 'rendering') {
      throw new Error('A render is already in progress.');
    }
    return new VideoAsset({ ...this.props, renderStatus: 'queued', renderError: undefined, updatedAt: at });
  }

  beginRendering(at: Date): VideoAsset {
    if (this.props.renderStatus !== 'queued') throw new Error('Render must be queued before it can start.');
    return new VideoAsset({ ...this.props, renderStatus: 'rendering', updatedAt: at });
  }

  completeRender(sourceUrl: string, durationSeconds: number, checksum: string, at: Date): VideoAsset {
    if (this.props.renderStatus !== 'rendering') throw new Error('No render is in progress.');
    return new VideoAsset({
      ...this.props, renderStatus: 'complete', sourceUrl, durationSeconds, renderChecksum: checksum,
      renderError: undefined, renderedAt: at, updatedAt: at,
    });
  }

  failRender(errorMessage: string, at: Date): VideoAsset {
    return new VideoAsset({
      ...this.props, renderStatus: 'failed', renderError: errorMessage.slice(0, 2000), updatedAt: at,
    });
  }

  toJSON(): VideoAssetProps {
    return { ...this.props };
  }
}
