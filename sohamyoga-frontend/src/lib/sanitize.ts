import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe HTML tags (formatting, links, images) but strips scripts and event handlers.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') {
    // Server-side: strip all HTML tags as a safe fallback
    return dirty.replace(/<[^>]*>/g, '');
  }
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span', 'div',
      'figure', 'figcaption', 'mark', 'sub', 'sup', 'del', 'ins',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id',
      'width', 'height', 'style', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize SVG content — only allow safe SVG elements and attributes.
 */
export function sanitizeSvg(dirty: string): string {
  if (typeof window === 'undefined') {
    return dirty.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  }
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ALLOW_DATA_ATTR: false,
  });
}
