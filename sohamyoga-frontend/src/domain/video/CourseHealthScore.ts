// Course Health Score -- real completeness metric: what fraction of a
// course's lessons have a linked video_asset that has actually been scripted
// and rendered, vs. lessons that are still just a title with no video work
// done. Deterministic, not an AI opinion.
export interface LessonHealthInput {
  hasVideo: boolean;
  scriptStatus: string | null;
  renderStatus: string | null;
}

export function computeCourseHealth(lessons: LessonHealthInput[]): { score: number; readyLessons: number; totalLessons: number } {
  if (lessons.length === 0) return { score: 0, readyLessons: 0, totalLessons: 0 };
  const readyLessons = lessons.filter(l => l.hasVideo && l.scriptStatus === 'approved' && l.renderStatus === 'complete').length;
  return { score: Math.round((readyLessons / lessons.length) * 100), readyLessons, totalLessons: lessons.length };
}
