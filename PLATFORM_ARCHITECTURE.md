# SohamYoga — Enterprise Platform Architecture

## Overview

Full-stack yoga + wellness platform combining computer vision AI, booking,
membership, payments, CRM, and marketing automation.

---

## Architecture Layers

```
Customer (Web / Mobile App)
        │
        ▼
  ┌─────────────────────────────────┐
  │  Next.js Frontend (sohamyoga-frontend)│
  │  · Auth  · Booking  · Payments  │
  │  · Student Portal  · Teacher    │
  │  · Community  · Shop            │
  └─────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────┐
  │  .NET / Node API (SohamYoga/)   │
  │  · REST/GraphQL  · Auth JWT     │
  │  · Membership  · Subscriptions  │
  │  · Webhooks  · Stripe/Razorpay  │
  └─────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────┐
  │  AI Layer (agentic-ollama-plat) │
  │  · Pose Detection  · AI Coach   │
  │  · Chatbot  · Voice Guide       │
  │  · Recommendation Engine        │
  │  · Progress Analytics           │
  └─────────────────────────────────┘
        │
        ▼
  ┌─────────────────────────────────┐
  │  Data & Integrations            │
  │  · PostgreSQL / SQLite          │
  │  · Redis (sessions/cache)       │
  │  · S3 / Cloudflare R2 (media)   │
  │  · PostHog (analytics)          │
  │  · n8n (automation)             │
  │  · WhatsApp / Email             │
  └─────────────────────────────────┘
```

---

## Module Registry

### 1. Authentication & Identity
| Component | Source | Status |
|-----------|--------|--------|
| User login/register | `sohamyoga-frontend/src/app/auth/` | Exists |
| JWT / session | `SohamYoga.Web` .NET Identity | Exists |
| OAuth (Google, Apple) | NextAuth.js | TODO |
| Role management | Teacher / Student / Admin | Partial |

### 2. Booking & Scheduling
| Component | Source | Status |
|-----------|--------|--------|
| Class booking UI | calcom/cal.com components | TODO |
| Teacher availability | Build on cal.com embed | TODO |
| Recurring bookings | Build | TODO |
| Waitlist | Build | TODO |
| iCal export | cal.com | TODO |

**Repo:** https://github.com/calcom/cal.com (score 50)

### 3. Payments & Membership
| Component | Source | Status |
|-----------|--------|--------|
| Stripe integration | @stripe/stripe-js | TODO |
| Subscription plans | medusajs or custom | TODO |
| Membership tiers | Free / Monthly / Annual | TODO |
| Coupons & promos | Build | TODO |
| Referral program | Build | TODO |
| Invoice generation | invoiceninja or custom | TODO |

**Repos:** https://github.com/medusajs/medusa

### 4. CRM & Customer Management
| Component | Source | Status |
|-----------|--------|--------|
| Contact management | twentyhq/twenty | TODO |
| Lead pipeline | twenty CRM | TODO |
| Student profiles | Build on twenty | TODO |
| Attendance tracking | Build | TODO |
| Notes / follow-up | twenty CRM | TODO |

**Repo:** https://github.com/twentyhq/twenty (score 60)

### 5. WhatsApp & Notifications
| Component | Source | Status |
|-----------|--------|--------|
| WhatsApp messages | WhiskeySockets/Baileys | TODO |
| Booking reminders | n8n automation | TODO |
| Email campaigns | Mautic / Listmonk | TODO |
| Push notifications | Build | TODO |
| SMS | Twilio (optional) | TODO |

**Repos:** Baileys, n8n, mautic

### 6. AI Pose Detection
| Component | Source | Status |
|-----------|--------|--------|
| Webcam pose capture | MediaPipe / TF.js | TODO |
| Pose classification | Pawandeep-prog/yoga | TODO |
| Real-time correction | bourbonbourbon/yoga-pose | TODO |
| Angle analysis | Custom | TODO |
| Score & feedback | Build | TODO |
| Voice guidance | TTS (Coqui / Web Speech) | TODO |

**Repos:** PosePilot, yoga-pose-detection-correction, Pawandeep/yoga

### 7. AI Coach & Recommendations
| Component | Source | Status |
|-----------|--------|--------|
| Personalized flows | Ollama (qwen2.5-coder) | TODO |
| Progress analysis | Local agentic platform | TODO |
| Chatbot | FlowiseAI/Flowise | TODO |
| Voice assistant | Coqui TTS + Whisper | TODO |
| Sequence builder | Build + AI generation | TODO |
| Health dashboard | PostHog + custom | TODO |

### 8. Teacher Portal
| Component | Source | Status |
|-----------|--------|--------|
| Class management | Build | TODO |
| Student roster | Build | TODO |
| Session analytics | PostHog | TODO |
| Content upload | Cloudflare R2 | TODO |
| Earnings report | Build | TODO |

### 9. Student Portal
| Component | Source | Status |
|-----------|--------|--------|
| Dashboard | `sohamyoga-frontend/src/app/customer/` | Partial |
| Class history | Build | TODO |
| Progress charts | Build | TODO |
| Pose archive | Build | TODO |
| Challenges | Build | TODO |
| Community feed | Build | TODO |

### 10. Marketing & Growth
| Component | Source | Status |
|-----------|--------|--------|
| SEO | Next.js metadata + Lighthouse | Partial |
| Analytics | PostHog (score 68) | TODO |
| A/B testing | GrowthBook (score 60) | TODO |
| Email automation | Mautic / n8n | TODO |
| Blog | Ghost / existing blog | Partial |
| Social sharing | Build | TODO |

### 11. Admin Dashboard
| Component | Source | Status |
|-----------|--------|--------|
| User management | `sohamyoga-frontend/src/app/admin/users/` | Exists |
| Analytics | `sohamyoga-frontend/src/app/admin/` | Partial |
| Content management | Existing admin | Partial |
| API monitoring | Existing monitoring page | Exists |
| Reports | agentic platform `oll report` | Exists |

---

## Integration Priority (build order)

```
Phase 1 — Core Business (Weeks 1-4)
  ✓ Auth (exists)
  □ Stripe payments + subscription plans
  □ Booking system (cal.com embed or custom)
  □ Membership tiers + coupon codes

Phase 2 — AI Features (Weeks 5-8)
  □ Pose detection (MediaPipe + yoga classifier)
  □ AI chatbot (Flowise or Dify)
  □ Personalized flow generator (Ollama)
  □ Progress dashboard

Phase 3 — CRM & Marketing (Weeks 9-12)
  □ CRM (Twenty)
  □ WhatsApp reminders (Baileys + n8n)
  □ Email automation (Mautic)
  □ PostHog analytics
  □ Referral program

Phase 4 — Mobile & Scale (Weeks 13-16)
  □ React Native / Expo mobile app
  □ Multi-language (i18n)
  □ CDN for video (Cloudflare Stream)
  □ A/B testing (GrowthBook)
```

---

## Top 10 Repos to Integrate

| # | Repo | Score | Module |
|---|------|-------|--------|
| 1 | langgenius/dify | 68 | AI chatbot + recommendations |
| 2 | PostHog/posthog | 68 | Analytics + funnels |
| 3 | FlowiseAI/Flowise | 60 | Visual AI chatbot builder |
| 4 | n8n-io/n8n | 60 | WhatsApp + email automation |
| 5 | activepieces/activepieces | 60 | No-code automation |
| 6 | twentyhq/twenty | 60 | CRM + student management |
| 7 | umami-software/umami | 60 | Lightweight analytics |
| 8 | growthbook/growthbook | 60 | A/B testing |
| 9 | Pawandeep-prog/yoga | 59 | Pose detection |
| 10 | calcom/cal.com | 50 | Booking + scheduling |

---

## Missing Features Build Plan

### Priority 1 — Payments (Stripe)
```
sohamyoga-frontend/src/app/
  └── payments/
      ├── page.tsx         ← pricing plans
      ├── checkout/page.tsx
      └── success/page.tsx
backend/stripe/
  ├── webhooks.py
  └── subscription.py
```

### Priority 2 — Booking
```
sohamyoga-frontend/src/app/
  └── booking/
      ├── page.tsx          ← class calendar
      ├── [classId]/page.tsx
      └── confirmation/page.tsx
```

### Priority 3 — Pose Detection
```
sohamyoga-frontend/src/app/
  └── ai/
      ├── pose/page.tsx     ← webcam + MediaPipe
      ├── coach/page.tsx    ← AI flow generator
      └── progress/page.tsx ← charts + history
```

### Priority 4 — Teacher & Student Portals
```
sohamyoga-frontend/src/app/
  ├── teacher/
  │   ├── dashboard/page.tsx
  │   ├── classes/page.tsx
  │   └── students/page.tsx
  └── student/
      ├── dashboard/page.tsx
      ├── history/page.tsx
      └── challenges/page.tsx
```
