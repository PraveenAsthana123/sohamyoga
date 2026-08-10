# Wave 12 — Carousel / Slider Module: Integration Specification

## 1. Carousel Lifecycle State Machine

```
           ┌─────────┐
           │  draft  │◄─────────────────────────────────┐
           └────┬────┘                                  │
                │ publish()                             │
                ▼                                       │
           ┌─────────┐                                  │
      ┌───►│ active  │◄──── resume() ────┐              │
      │    └────┬────┘                   │              │
      │         │ pause()                │              │
      │         ▼                        │              │
      │    ┌─────────┐                   │              │
      │    │ paused  │───────────────────┘              │
      │    └────┬────┘                                  │
      │         │ archive()                             │
      │         ▼                                       │
      │    ┌──────────┐                                 │
      └────│ archived │  (terminal — no exit)           │
           └──────────┘                                 │
                                                        │
  Note: draft → active requires at least 1 active slide ┘
```

**State machine rules:**
| From       | Method    | To       | Guard                        |
|------------|-----------|----------|------------------------------|
| draft      | publish() | active   | publishedAt must be provided |
| active     | pause()   | paused   | —                            |
| paused     | resume()  | active   | —                            |
| active     | archive() | archived | —                            |
| paused     | archive() | archived | —                            |
| archived   | *         | *        | BLOCKED (terminal state)     |

---

## 2. Slide Lifecycle State Machine

```
  draft ──► active ──► inactive
              ▲
              │ schedule resolves
  ┌──────────►│
  │     scheduled ──► active (when activeFrom <= now < activeTo)
  │                ──► inactive (when activeTo <= now)
  └───────────────────────────────────────────────────────────┘
```

**Slide type + video policy matrix:**

| Type       | muted | poster  | controls | autoplay sound | Notes                           |
|------------|-------|---------|----------|----------------|---------------------------------|
| image      | n/a   | n/a     | n/a      | n/a            | Next.js Image, lazy+priority    |
| video_mp4  | TRUE  | REQUIRED| TRUE     | NEVER          | playsInline, preload="metadata" |
| youtube    | TRUE  | optional| TRUE     | NEVER          | privacy-enhanced embed          |
| vimeo      | TRUE  | optional| TRUE     | NEVER          | muted URL param required        |

**Video policy (mandatory):** All video slides are muted by default. `muted=TRUE` is a DB constraint (`CHECK video_muted`). The domain method `muteVideo()` throws if called on a non-video type. Browser controls are always shown alongside custom play/pause overlays. `autoplay` with sound is architecturally impossible.

---

## 3. Slide Scheduling Flow

```
1. Admin creates slide (status=draft)
2. Admin calls schedule_slide MCP tool → activeFrom, activeTo set
3. Slide status set to "scheduled"
4. Cron job or middleware checks active_slides view at request time:
   - active_from <= now() AND (active_to IS NULL OR active_to > now())
   - AND carousel.status = 'active'
   - AND slide.status IN ('active', 'scheduled')
5. v_active_slides view returns only currently-live slides
6. At activeTo, slide transitions to status='inactive' via background job
```

---

## 4. 12-Step Carousel Render Flow

```
 1. Page load → API call to GET /api/carousels?location=hero
 2. Server returns carousel + slides from v_active_slides view
 3. SwiperHero (or relevant component) mounts; videoRefs Map initialized
 4. First image slide: Next.js Image with priority=true (no lazy)
 5. Remaining image slides: lazy loaded (lazyLoad=true setting)
 6. Video slides: preload="metadata" — poster shown, src loaded lazily
 7. Autoplay starts (if enabled) after component mount + useEffect
 8. On slide change: active video paused, next video does NOT autoplay
 9. Hover/focus: autoplay paused (pauseOnHover=true by default)
10. Keyboard: ArrowLeft/ArrowRight change slide; Tab/Enter for CTA links
11. Analytics: carousel_viewed PostHog event on viewport entry (IntersectionObserver)
12. Click: slide_clicked event fires → carousel.recordClick() → analytics update
```

---

## 5. MCP Tool Catalogue (12 tools)

| Tool               | Tier              | Required Fields               | Safety Note                              |
|--------------------|-------------------|-------------------------------|------------------------------------------|
| list_carousels     | auto              | —                             | —                                        |
| get_carousel       | auto              | carouselId                    | —                                        |
| create_carousel    | staff             | name, location, createdBy     | —                                        |
| update_carousel    | staff             | carouselId, updatedBy         | —                                        |
| add_slide          | staff             | carouselId, type, src, createdBy | Videos must be muted with poster image  |
| update_slide       | staff             | slideId, updatedBy            | —                                        |
| reorder_slides     | staff             | carouselId, orderedSlideIds   | —                                        |
| get_analytics      | staff             | carouselId                    | —                                        |
| schedule_slide     | staff             | slideId, activeFrom, activeTo | activeTo must be after activeFrom        |
| publish_carousel   | staff_approval    | carouselId, confirmApprovalId | Requires manager approval                |
| archive_carousel   | staff_approval    | carouselId, confirmApprovalId | Content hidden from all users            |
| delete_carousel    | admin_destructive | carouselId, confirmText="DELETE_CAROUSEL", confirmApprovalId | Irreversible; cascades to all slides     |

---

## 6. Carousel Location → React Component Map

| Location     | Component             | Use Case                                   |
|--------------|-----------------------|--------------------------------------------|
| hero         | SwiperHero            | Full-height homepage hero with overlay CTA |
| testimonials | TestimonialCarousel   | 3-up student reviews with stars            |
| gallery      | GalleryCarousel       | Class photo grid with lightbox             |
| teachers     | TeacherCarousel       | Teacher cards with muted intro video       |
| services     | CSS marquee           | Infinite scroll — services list            |
| promotions   | SwiperHero (compact)  | Countdown-overlay promotional banners      |
| classes      | ClassVideoCarousel    | Class video previews with progress bar     |
| partners     | CSS marquee           | Partner logo continuous scroll             |
| videos       | ClassVideoCarousel    | Full yoga video library                    |
| products     | TeacherCarousel (mode)| Yoga props / mat product cards             |

---

## 7. CarouselEffect → Swiper API Mapping

| CarouselEffect | Swiper Module     | Notes                                  |
|----------------|-------------------|----------------------------------------|
| slide          | default           | Standard horizontal/vertical slide     |
| fade           | EffectFade        | Opacity crossfade — best for hero      |
| coverflow      | EffectCoverflow   | 3D depth cards — teacher profiles      |
| cube           | EffectCube        | Cube rotation — testimonials variation |
| flip           | EffectFlip        | Card flip — promotions                 |

**Current implementation:** Components use custom CSS transitions (useRef + useEffect pattern) for SSR compatibility. Swiper v14 npm package installed; future migration to Swiper JSX API (EffectFade, EffectCoverflow) is additive — no domain changes required.

---

## 8. Overlay Position Grid

```
  ┌──────────────────────────────────────┐
  │ top-left    top-center    top-right  │
  │                                      │
  │ center-left   center   center-right  │
  │                                      │
  │ bottom-left bottom-center bottom-right│
  └──────────────────────────────────────┘
```

Text color options: `white` (on dark/image backgrounds) or `dark` (on light backgrounds).

---

## 9. CarouselSettings Breakpoints Schema

```typescript
// Optional responsive overrides (Swiper-compatible format)
breakpoints?: {
  [width: number]: {
    slidesPerView?: number;
    spaceBetween?: number;
    showArrows?: boolean;
    showDots?: boolean;
  }
}
// Example:
// { 640: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }
```

---

## 10. CTR Calculation

```
CTR (%) = (click_count / view_count) × 100

view_count increments on: IntersectionObserver entry (≥50% visible)
click_count increments on: slide CTA link click OR slide image/video click

Carousel.ctr() domain method:
  if (this._viewCount === 0) return 0;
  return Math.round((this._clickCount / this._viewCount) * 10000) / 100;
```

---

## 11. Database Constraints Summary

| Constraint            | Table           | Rule                                          |
|-----------------------|-----------------|-----------------------------------------------|
| slide_date_order      | carousel_slide  | active_to > active_from (if both set)         |
| video_muted           | carousel_slide  | video types must have muted=TRUE              |
| autoplay_delay check  | carousel        | autoplay_delay >= 500 ms                      |
| slides_per_view check | carousel        | slides_per_view >= 1                          |
| schedule_date_order   | carousel_schedule | active_to > active_from                     |

---

## 12. Cross-Wave Integration Map

| Wave | Module         | Carousel Integration                                          |
|------|----------------|---------------------------------------------------------------|
| W1   | Core/Auth      | created_by/updated_by = authenticated user ID from JWT        |
| W3   | Services       | services location carousel shows service card slides          |
| W4   | Team/Teachers  | teachers location carousel powered by TeacherCarousel         |
| W5   | Blog/Content   | promotions carousel can link to blog posts (link_url)         |
| W6   | Testimonials   | testimonials carousel → TestimonialCarousel component         |
| W7   | Classes/Events | classes location → ClassVideoCarousel with class video links  |
| W8   | Gallery/Media  | gallery location → GalleryCarousel; media from MinIO/S3       |
| W10  | Feature Flags  | carousel.* flags gate effects, lazyload, scheduling, analytics |
| W11  | Survey         | carousel CTA can link to survey (link_url → /surveys/:slug)   |

---

## 13. External Systems

| System      | Role                                             | Integration Point              |
|-------------|--------------------------------------------------|--------------------------------|
| MinIO / S3  | Slide image + MP4 video storage                  | src/poster URLs in carousel_slide |
| PostHog     | carousel_viewed, slide_clicked, video_played events | IntersectionObserver + onClick |
| Novu        | Admin notifications on publish/archive/slide_add | carousel_notification table    |
| GrowthBook  | A/B test autoplay delay, effect, slidesPerView   | carousel.* feature flags       |
| n8n         | Schedule activation/deactivation of slides       | carousel_schedule poll workflow |
| Keycloak    | Auth for MCP tools (staff/admin tiers)           | JWT claims checked by gateway  |

---

## 14. Accessibility (WCAG 2.1 AA) Checklist

| Requirement                     | Implementation                                           |
|---------------------------------|----------------------------------------------------------|
| Carousel landmark               | aria-roledescription="carousel"                          |
| Slide group                     | role="group" aria-roledescription="slide"                |
| Hidden inactive slides          | aria-hidden="true" on non-visible slides                 |
| Dot navigation                  | role="tablist" / role="tab" aria-selected               |
| Arrow buttons                   | aria-label="Previous/Next [context]"                     |
| Pause on hover/focus            | pauseOnHover=true default                                |
| Keyboard navigation             | ArrowLeft/ArrowRight + Tab/Enter for CTAs                |
| Video play button               | aria-label="Play/Pause [title]"                          |
| Video controls visible          | showControls=true always for video slides                |
| Alt text enforced               | alt field, enforced non-empty for image slides in app    |
| Reduced motion                  | CSS @media (prefers-reduced-motion) stops autoplay       |
| Focus ring                      | focus-visible:ring-2 focus-visible:ring-amber-400        |
