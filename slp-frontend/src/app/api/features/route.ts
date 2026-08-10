"use server";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_FEATURE_FLAGS } from "@/domain/features/FeatureFlag";

// In production: read from DB. Here: in-memory with env overrides.
const flagStore = new Map(
  DEFAULT_FEATURE_FLAGS.map(f => [f.key, { ...f, enabled: f.enabled, updatedBy: "system", updatedAt: new Date() }])
);

// Load env overrides: FEATURE_<KEY>=true/false e.g. FEATURE_AI_POSE_DETECTION=true
if (typeof process !== "undefined") {
  Object.entries(process.env).forEach(([k, v]) => {
    if (k.startsWith("FEATURE_")) {
      const key = k.replace("FEATURE_", "").toLowerCase().replace(/_/g, ".");
      const existing = flagStore.get(key);
      if (existing) flagStore.set(key, { ...existing, enabled: v === "true" });
    }
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const category = searchParams.get("category");

  let flags = Array.from(flagStore.values());
  if (scope) flags = flags.filter(f => f.scope === scope || f.scope === "all");
  if (category) flags = flags.filter(f => f.category === category);

  // Strip sensitive fields for non-admin
  const safe = flags.map(f => ({
    key: f.key,
    name: f.name,
    category: f.category,
    scope: f.scope,
    enabled: f.enabled,
    rolloutPercent: f.rolloutPercent,
  }));

  return NextResponse.json({ flags: safe });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { key, enabled, rolloutPercent, updatedBy = "admin" } = body;

  if (!key || !flagStore.has(key)) {
    return NextResponse.json({ error: "Feature key not found" }, { status: 404 });
  }

  const existing = flagStore.get(key)!;
  const updated = {
    ...existing,
    ...(enabled !== undefined && { enabled: Boolean(enabled) }),
    ...(rolloutPercent !== undefined && { rolloutPercent: Number(rolloutPercent) }),
    updatedBy,
    updatedAt: new Date(),
  };
  flagStore.set(key, updated);

  return NextResponse.json({ flag: updated });
}
