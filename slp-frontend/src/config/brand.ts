/**
 * Central brand configuration — change values HERE and they propagate everywhere.
 * Import as: import { BRAND } from "@/config/brand"
 */

export const BRAND = {
  name:         "SohamYoga",
  shortName:    "SohamYoga",
  tagline:      "Find Your Inner Peace",
  description:  "Premium yoga classes, AI coaching, and wellness programs — online and in-studio.",
  domain:       process.env.NEXT_PUBLIC_DOMAIN       || "sohamyoga.com",
  url:          process.env.NEXT_PUBLIC_APP_URL       || "https://sohamyoga.com",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@sohamyoga.com",
  phone:        process.env.NEXT_PUBLIC_PHONE         || "+1 (800) 867-YOGA",
  address:      process.env.NEXT_PUBLIC_ADDRESS       || "Vancouver, BC, Canada",

  /** Social links */
  social: {
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM || "https://instagram.com/sohamyoga",
    facebook:  process.env.NEXT_PUBLIC_FACEBOOK  || "https://facebook.com/sohamyoga",
    youtube:   process.env.NEXT_PUBLIC_YOUTUBE   || "https://youtube.com/@sohamyoga",
    whatsapp:  process.env.NEXT_PUBLIC_WHATSAPP  || "https://wa.me/18008679642",
  },

  /** Brand colours (Tailwind class names or hex) */
  colors: {
    primary:    "#16a34a",   // green-600
    secondary:  "#7c3aed",  // violet-700
    accent:     "#f59e0b",  // amber-500
  },

  /** Platform feature flags */
  features: {
    poseDetection:  process.env.NEXT_PUBLIC_POSE_DETECTION  !== "false",
    aiCoach:        process.env.NEXT_PUBLIC_AI_COACH        !== "false",
    payments:       process.env.NEXT_PUBLIC_PAYMENTS        !== "false",
    whatsapp:       process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== "false",
    community:      process.env.NEXT_PUBLIC_COMMUNITY       !== "false",
  },

  /** API endpoints */
  api: {
    base:       process.env.NEXT_PUBLIC_API_URL          || "/api",
    ai:         process.env.NEXT_PUBLIC_AI_API_URL        || "http://localhost:8091",
    posthog:    process.env.NEXT_PUBLIC_POSTHOG_KEY       || "",
    growthbook: process.env.NEXT_PUBLIC_GROWTHBOOK_KEY    || "",
    stripe:     process.env.NEXT_PUBLIC_STRIPE_PK         || "",
  },
} as const;

export type BrandConfig = typeof BRAND;
