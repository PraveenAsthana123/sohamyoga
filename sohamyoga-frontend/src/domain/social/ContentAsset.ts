export type ContentAssetType = 'image' | 'video' | 'copy_text';

export interface ContentAssetProps {
  id: string;
  title: string;
  assetType: ContentAssetType;
  fileUrl?: string;
  bodyText?: string;
  tags: string[];
  category?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export class ContentAsset {
  private readonly props: ContentAssetProps;

  constructor(props: ContentAssetProps) {
    if (!props.title.trim()) throw new Error('title is required');
    if (props.assetType === 'copy_text') {
      if (!props.bodyText?.trim()) throw new Error('bodyText is required for copy_text assets');
    } else {
      if (!props.fileUrl || !isValidUrl(props.fileUrl)) throw new Error('fileUrl must be a valid absolute URL for image/video assets');
    }
    this.props = { ...props };
  }

  get id() { return this.props.id; }
  get title() { return this.props.title; }
  get assetType() { return this.props.assetType; }
  get fileUrl() { return this.props.fileUrl; }
  get bodyText() { return this.props.bodyText; }
  get tags() { return this.props.tags; }

  toJSON(): ContentAssetProps {
    return { ...this.props };
  }
}
