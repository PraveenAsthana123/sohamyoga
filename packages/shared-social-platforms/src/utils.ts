// Utility functions for the shared social platforms package.
// Pure TypeScript — no React, no Next.js, no fetch.

import type { ContentType, ImplementationStatus, Priority } from './types';
import { PLATFORM_REGISTRY } from './platform-registry';

/**
 * Get the emoji for a platform key.
 * Falls back to 🌐 for unknown platforms.
 */
export function platformEmoji(platform: string): string {
  return PLATFORM_REGISTRY[platform]?.emoji ?? '🌐';
}

// Note: platformDisplayName is exported from platform-tab-config.ts (the canonical version).

/**
 * Format a rate limit for display.
 */
export function formatRateLimit(calls?: number, window?: string): string {
  if (!calls || !window) return 'Not documented';
  return `${calls.toLocaleString()} calls / ${window}`;
}

/**
 * Convert a ContentType key to a human-readable label.
 */
export function getContentTypeLabel(ct: ContentType): string {
  return ct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get a hex color for a Priority value (for UI badge coloring).
 */
export function priorityColor(priority: Priority): string {
  const map: Record<Priority, string> = {
    high: '#EF4444',
    medium: '#F97316',
    low: '#EAB308',
  };
  return map[priority] ?? '#6B7280';
}

/**
 * Get a hex color for an ImplementationStatus value.
 */
export function implementationStatusColor(status: ImplementationStatus): string {
  const map: Record<ImplementationStatus, string> = {
    not_built: '#6B7280',
    stub: '#9CA3AF',
    partial: '#F59E0B',
    built: '#10B981',
    verified: '#059669',
    deprecated: '#EF4444',
  };
  return map[status] ?? '#6B7280';
}

/**
 * Get a human-readable label for an ImplementationStatus.
 */
export function implementationStatusLabel(status: ImplementationStatus): string {
  const map: Record<ImplementationStatus, string> = {
    not_built: 'Not Built',
    stub: 'Stub',
    partial: 'Partial',
    built: 'Built',
    verified: 'Verified',
    deprecated: 'Deprecated',
  };
  return map[status] ?? status;
}

/**
 * Truncate text to a maximum length, appending '...' if truncated.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Check whether a given string is a valid PlatformKey.
 */
export function isValidPlatformKey(key: string): boolean {
  return key in PLATFORM_REGISTRY;
}

/**
 * Sort platforms — high priority first, then medium, then low.
 * Within each priority group, sort alphabetically by displayName.
 */
export function sortPlatformsByPriority(keys: string[]): string[] {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...keys].sort((a, b) => {
    const ma = PLATFORM_REGISTRY[a];
    const mb = PLATFORM_REGISTRY[b];
    if (!ma || !mb) return 0;
    const po = (order[ma.priority] ?? 3) - (order[mb.priority] ?? 3);
    if (po !== 0) return po;
    return ma.displayName.localeCompare(mb.displayName);
  });
}
