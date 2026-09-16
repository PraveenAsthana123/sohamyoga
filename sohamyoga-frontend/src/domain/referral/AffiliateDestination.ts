/** Validate before storing and again before redirecting legacy data. */
export function affiliateDestination(path: unknown, base: string): URL | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  // URL parsers normalize backslashes and strip control characters.
  if (/[\\\u0000-\u0020\u007f]/.test(path)) return null;
  try {
    const origin = new URL(base);
    const destination = new URL(path, origin);
    if (destination.origin !== origin.origin) return null;
    return destination;
  } catch {
    return null;
  }
}
