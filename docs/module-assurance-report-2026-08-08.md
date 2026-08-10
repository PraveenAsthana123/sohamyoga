# Module assurance report — 2026-08-08

The live, filterable matrix is `/admin/module-assurance`.

## Inventory

| Area | Discovered | Verified state |
|---|---:|---|
| Domain modules | 36 | 36 registered and enabled |
| Admin features/pages | 71 | Left-side admin navigation present |
| Customer self-service features/pages | 7 | Left-side customer navigation present |
| Public/customer-sales features/pages | 34 | Public sales navigation and PWA shell present |
| UI route tests | 112 | 102 passed; 10 dynamic routes require fixture IDs; 0 HTTP failures |
| Integration records | 26 | 3 installed/configured/working; 23 downloaded only and stopped |
| Ollama models installed | 39 | Synchronized to `ai_model_master`; none resident when idle |
| Runtime components | 8 | TypeScript 1, .NET 1, Node 2, Python 3, shell 1 |
| PostgreSQL tables | 296 | 296 primary keys and 317 foreign keys |

## Integration truth table

Working: Ollama Director, OpenClaw and Paperclip.

Downloaded but not verified/configured/running: Authentik, Cal.com, Chatwoot, Flowable, Frappe, Jitsi, Keycloak, LibreBooking, LimeSurvey, Medusa, Metabase, Moodle, Nextcloud, Novu, OfferKit, Paperless, Penpot, PhotoPrism, PostHog, Postiz, Rocket.Chat, Strapi and Wiki.js. Most require credentials, ports, storage and product-specific onboarding; folder presence is not treated as integration success.

## Database coverage

All discovered database objects have primary keys. Twelve code modules currently have no dedicated authoritative SQL schema assignment: banner, booking, campaign, community, coupon, documents, features, HR, membership, pose, scheduling and teaching. Some use shared/core tables or .NET SQLite entities; the matrix keeps this visible instead of inventing duplicate tables.

## UI consistency

- Admin and customer self-service use persistent left-side menus.
- Customer active/loading states now use the shared Tailwind `primary` palette used by the sales/admin design system.
- PWA manifest and service worker are live; sales shell routes are cached for offline fallback.
- Full screenshot-level visual regression across 112 pages is not yet present. HTTP/render compilation is verified, but pixel consistency still needs Playwright screenshot baselines.

## Synthetic data

Assurance results are stored in `module_test_run` with `is_synthetic=TRUE`. Each generated reporting batch is recorded in `synthetic_dataset_run` with tag `SYNTHETIC_DATA` and an expiry timestamp. No synthetic customer, payment or publication record is mixed with production business data.
