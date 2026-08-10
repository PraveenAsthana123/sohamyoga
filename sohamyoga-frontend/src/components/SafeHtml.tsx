'use client';

import React from 'react';
import { sanitizeHtml, sanitizeSvg } from '@/lib/sanitize';

interface SafeHtmlProps {
  html: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  svg?: boolean;
}

/**
 * Renders sanitized HTML content safely. Prevents XSS attacks by running
 * content through DOMPurify before rendering.
 */
export default function SafeHtml({ html, className, as: Tag = 'div', svg = false }: SafeHtmlProps) {
  const clean = svg ? sanitizeSvg(html) : sanitizeHtml(html);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
