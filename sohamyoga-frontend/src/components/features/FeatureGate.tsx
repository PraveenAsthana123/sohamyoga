"use client";
// FeatureGate — wraps any UI section; renders nothing when flag is disabled
// Usage: <FeatureGate flag="ai.coach"> ... </FeatureGate>

import { useFeature } from "@/hooks/useFeatureFlags";

interface FeatureGateProps {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeature(flag);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
