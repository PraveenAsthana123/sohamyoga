// Wave 19: Yoga Library — MeditationSession entity
// Covers: guided meditation, yoga nidra, mantra, body scan, chakra
// Table-driven: style codes → ref_meditation_style

export type MeditationStyle  = 'mindfulness' | 'guided_visualization' | 'yoga_nidra'
  | 'mantra' | 'breathing' | 'body_scan' | 'loving_kindness' | 'chakra' | 'movement';
export type SessionStatus    = 'draft' | 'published' | 'archived';
export type DoshaType        = 'vata' | 'pitta' | 'kapha';
export type DifficultyLevel  = 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
export type SessionGoal      = 'stress_relief' | 'flexibility' | 'strength' | 'balance'
  | 'energy' | 'sleep' | 'injury_recovery' | 'mindfulness';

const LANG_RE = /^[a-z]{2}$/;

export interface MeditationSessionProps {
  id:              string;
  tenantId:        string;
  title:           string;
  style:           MeditationStyle;
  durationMinutes: number;      // >= 1
  description:     string;
  audioUrl?:       string;
  videoUrl?:       string;
  transcript?:     string;
  instructor?:     string;
  language:        string;      // ISO 639-1 two-char code, e.g. 'en'
  tags:            string[];
  sessionGoals:    SessionGoal[];
  doshaBalance:    DoshaType[];
  difficultyLevel: DifficultyLevel;
  status:          SessionStatus;
  playCount:       number;      // >= 0, incremented by application
  createdAt:       Date;
  updatedAt:       Date;
}

export class MeditationSession {
  private readonly props: Readonly<MeditationSessionProps>;

  constructor(props: MeditationSessionProps) {
    if (!props.id?.trim())      throw new Error('id is required');
    if (!props.tenantId?.trim())throw new Error('tenantId is required');
    if (!props.title?.trim())   throw new Error('title is required');
    if (props.durationMinutes < 1)
      throw new Error('durationMinutes must be at least 1');
    if (!LANG_RE.test(props.language))
      throw new Error('language must be a 2-character ISO 639-1 code (e.g. "en")');
    if (props.playCount < 0)
      throw new Error('playCount must be >= 0');

    this.props = {
      ...props,
      tags:         [...props.tags],
      sessionGoals: [...props.sessionGoals],
      doshaBalance: [...props.doshaBalance],
    };
  }

  get id()              { return this.props.id; }
  get tenantId()        { return this.props.tenantId; }
  get title()           { return this.props.title; }
  get style()           { return this.props.style; }
  get durationMinutes() { return this.props.durationMinutes; }
  get description()     { return this.props.description; }
  get audioUrl()        { return this.props.audioUrl; }
  get videoUrl()        { return this.props.videoUrl; }
  get transcript()      { return this.props.transcript; }
  get instructor()      { return this.props.instructor; }
  get language()        { return this.props.language; }
  get tags()            { return [...this.props.tags]; }
  get sessionGoals()    { return [...this.props.sessionGoals]; }
  get doshaBalance()    { return [...this.props.doshaBalance]; }
  get difficultyLevel() { return this.props.difficultyLevel; }
  get status()          { return this.props.status; }
  get playCount()       { return this.props.playCount; }
  get createdAt()       { return this.props.createdAt; }
  get updatedAt()       { return this.props.updatedAt; }

  isDraft()     { return this.props.status === 'draft'; }
  isPublished() { return this.props.status === 'published'; }
  isArchived()  { return this.props.status === 'archived'; }

  private clone(patch: Partial<MeditationSessionProps>): MeditationSession {
    return new MeditationSession({ ...this.props, ...patch });
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  addTag(tag: string, now: Date): MeditationSession {
    if (!tag?.trim()) throw new Error('tag is required');
    if (this.props.tags.includes(tag))
      throw new Error(`tag "${tag}" already added`);
    return this.clone({ tags: [...this.props.tags, tag], updatedAt: now });
  }

  removeTag(tag: string, now: Date): MeditationSession {
    if (!this.props.tags.includes(tag))
      throw new Error(`tag "${tag}" not found`);
    return this.clone({ tags: this.props.tags.filter(t => t !== tag), updatedAt: now });
  }

  // ── Goals ──────────────────────────────────────────────────────────────────

  addGoal(goal: SessionGoal, now: Date): MeditationSession {
    if (this.props.sessionGoals.includes(goal))
      throw new Error(`goal "${goal}" already added`);
    return this.clone({ sessionGoals: [...this.props.sessionGoals, goal], updatedAt: now });
  }

  removeGoal(goal: SessionGoal, now: Date): MeditationSession {
    if (!this.props.sessionGoals.includes(goal))
      throw new Error(`goal "${goal}" not found`);
    return this.clone({ sessionGoals: this.props.sessionGoals.filter(g => g !== goal), updatedAt: now });
  }

  // ── Media ──────────────────────────────────────────────────────────────────

  setAudioUrl(url: string, now: Date): MeditationSession {
    if (!url?.trim()) throw new Error('audioUrl is required');
    return this.clone({ audioUrl: url, updatedAt: now });
  }

  setVideoUrl(url: string, now: Date): MeditationSession {
    if (!url?.trim()) throw new Error('videoUrl is required');
    return this.clone({ videoUrl: url, updatedAt: now });
  }

  // ── Play Count ─────────────────────────────────────────────────────────────

  incrementPlayCount(): MeditationSession {
    return this.clone({ playCount: this.props.playCount + 1 });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  publish(now: Date): MeditationSession {
    if (this.props.status !== 'draft')
      throw new Error('can only publish a draft meditation session');
    return this.clone({ status: 'published', updatedAt: now });
  }

  archive(now: Date): MeditationSession {
    if (this.props.status !== 'published')
      throw new Error('can only archive a published meditation session');
    return this.clone({ status: 'archived', updatedAt: now });
  }
}
