"use client";
import { useState, useEffect, createContext, useContext } from "react";

interface FlagEntry {
  key: string;
  name: string;
  category: string;
  scope: string;
  enabled: boolean;
  rolloutPercent: number;
}

interface FeatureFlagsContextValue {
  flags: Record<string, boolean>;
  isEnabled: (key: string) => boolean;
  loading: boolean;
}

// Cache flags in module scope — avoids re-fetching on every hook call
let _cachedFlags: Record<string, boolean> = {};
let _fetched = false;

async function loadFlags(scope?: string): Promise<Record<string, boolean>> {
  if (_fetched) return _cachedFlags;
  try {
    const qs = scope ? `?scope=${scope}` : "";
    const res = await fetch(`/api/features${qs}`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, boolean> = {};
    (data.flags as FlagEntry[]).forEach(f => { map[f.key] = f.enabled; });
    _cachedFlags = map;
    _fetched = true;
    return map;
  } catch {
    return {};
  }
}

export function useFeatureFlags(scope?: string): FeatureFlagsContextValue {
  const [flags, setFlags] = useState<Record<string, boolean>>(_cachedFlags);
  const [loading, setLoading] = useState(!_fetched);

  useEffect(() => {
    loadFlags(scope).then(f => {
      setFlags(f);
      setLoading(false);
    });
  }, [scope]);

  return {
    flags,
    loading,
    isEnabled: (key: string) => flags[key] ?? false,
  };
}

export function useFeature(key: string): boolean {
  const { flags } = useFeatureFlags();
  return flags[key] ?? false;
}

// Invalidate cache (call after admin toggles a flag)
export function invalidateFeatureCache(): void {
  _fetched = false;
  _cachedFlags = {};
}
