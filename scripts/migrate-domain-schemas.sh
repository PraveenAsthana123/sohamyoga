#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-sohamyoga-postgres}"
DB_USER="${POSTGRES_USER:-sohamyoga}"
DB_NAME="${POSTGRES_DB:-sohamyoga}"

schemas=(
  "001-core|sohamyoga-frontend/src/domain/core/db-foundation.sql"
  "010-identity|sohamyoga-frontend/src/domain/identity/db-schema.sql"
  "011-security|sohamyoga-frontend/src/domain/security/db-schema.sql"
  "012-mcp-observability|sohamyoga-frontend/src/domain/mcp/db-schema.sql"
  "013-mcp-gateway|sohamyoga-frontend/src/domain/mcp/gateway-db-schema.sql"
  "020-social|sohamyoga-frontend/src/domain/social/db-schema.sql"
  "021-marketing|sohamyoga-frontend/src/domain/marketing/db-schema.sql"
  "022-marketing-provider-status|sohamyoga-frontend/src/domain/marketing/db-schema-postiz-status.sql"
  "023-marketing-automation|sohamyoga-frontend/src/domain/marketing/automation-schema.sql"
  "024-lead-scoring|sohamyoga-frontend/src/domain/marketing/db-schema-lead-scoring.sql"
  "025-lifecycle-campaigns|sohamyoga-frontend/src/domain/marketing/db-schema-lifecycle-campaigns.sql"
  "026-coupon|sohamyoga-frontend/src/domain/coupon/db-schema.sql"
  "027-booking|sohamyoga-frontend/src/domain/yoga/db-schema-booking.sql"
  "028-marketing-personalization|sohamyoga-frontend/src/domain/marketing/db-schema-personalization.sql"
  "029-cart-recovery|sohamyoga-frontend/src/domain/ecommerce/db-schema-cart-recovery.sql"
  "030-sentiment|sohamyoga-frontend/src/domain/social/db-schema-sentiment.sql"
  "030-notification|sohamyoga-frontend/src/domain/notification/db-schema.sql"
  "031-analytics|sohamyoga-frontend/src/domain/analytics/db-schema.sql"
  "032-ads|sohamyoga-frontend/src/domain/ads/db-schema.sql"
  "033-carousel|sohamyoga-frontend/src/domain/carousel/db-schema.sql"
  "034-chat|sohamyoga-frontend/src/domain/chat/db-schema.sql"
  "040-customer|sohamyoga-frontend/src/domain/customer/db-schema.sql"
  "041-student|sohamyoga-frontend/src/domain/student/db-schema.sql"
  "042-teacher|sohamyoga-frontend/src/domain/teacher/db-schema.sql"
  "043-yoga|sohamyoga-frontend/src/domain/yoga/db-schema.sql"
  "044-wellness|sohamyoga-frontend/src/domain/wellness/db-schema.sql"
  "045-gamification|sohamyoga-frontend/src/domain/gamification/db-schema.sql"
  "046-journey|sohamyoga-frontend/src/domain/journey/db-schema.sql"
  "050-pricing|sohamyoga-frontend/src/domain/pricing/db-schema.sql"
  "051-ecommerce|sohamyoga-frontend/src/domain/ecommerce/db-schema.sql"
  "052-referral|sohamyoga-frontend/src/domain/referral/db-schema.sql"
  "053-survey|sohamyoga-frontend/src/domain/survey/db-schema.sql"
  "054-enterprise|sohamyoga-frontend/src/domain/enterprise/db-schema.sql"
  "060-platform-observability|sohamyoga-frontend/src/domain/observability/db-schema.sql"
  "061-platform-history-triggers|sohamyoga-frontend/src/domain/observability/history-triggers.sql"
  "062-module-assurance|sohamyoga-frontend/src/domain/assurance/db-schema.sql"
  "063-module-reporting-views|sohamyoga-frontend/src/domain/assurance/reporting-views.sql"
  "064-social-approval-hardening|sohamyoga-frontend/src/domain/social/approval-hardening.sql"
  "065-marketing-compliance|sohamyoga-frontend/src/domain/marketing/db-schema-compliance.sql"
  "066-ad-campaign-health|sohamyoga-frontend/src/domain/ads/db-schema-campaign-health.sql"
  "067-nps-pipeline|sohamyoga-frontend/src/domain/survey/db-schema-nps-pipeline.sql"
  "068-contact-capture|sohamyoga-frontend/src/domain/marketing/db-schema-contact-capture.sql"
  "069-student-status-default-fix|sohamyoga-frontend/src/domain/student/db-schema-status-default-fix.sql"
  "070-ai-recommendation|sohamyoga-frontend/src/domain/gamification/db-schema-ai-recommendation.sql"
  "071-feature-gap-report|sohamyoga-frontend/src/domain/assurance/db-schema-feature-gap.sql"
  "072-module-boundary-report|sohamyoga-frontend/src/domain/assurance/db-schema-boundary-quality.sql"
  "073-seo-report|sohamyoga-frontend/src/domain/marketing/db-schema-seo-report.sql"
  "074-voice-of-customer|sohamyoga-frontend/src/domain/marketing/db-schema-voice-of-customer.sql"
  "075-teacher-profile|sohamyoga-frontend/src/domain/teacher/db-schema-teacher-profile.sql"
  "076-complaint-alert|sohamyoga-frontend/src/domain/marketing/db-schema-complaint-alert.sql"
  "077-funnel-stage-engine|sohamyoga-frontend/src/domain/funnel/db-schema.sql"
  "078-advocacy-referral|sohamyoga-frontend/src/domain/funnel/db-schema-advocacy.sql"
  "079-viral-detection|sohamyoga-frontend/src/domain/social/db-schema-viral-signal.sql"
  "080-influencer|sohamyoga-frontend/src/domain/growth/db-schema-influencer.sql"
  "081-github-scout|sohamyoga-frontend/src/domain/growth/db-schema-github-scout.sql"
  "082-referral-invitation|sohamyoga-frontend/src/domain/referral/db-schema-invitation.sql"
  "083-social-platforms-extended|sohamyoga-frontend/src/domain/social/db-schema-platforms-extended.sql"
  "084-asana-library|sohamyoga-frontend/src/domain/yoga/db-schema-asana-library.sql"
  "085-market-research|sohamyoga-frontend/src/domain/marketresearch/db-schema.sql"
  "086-pricing-plan-seed|sohamyoga-frontend/src/domain/pricing/db-schema-plan-seed.sql"
  "087-social-provisioning|sohamyoga-frontend/src/domain/social/db-schema-provisioning.sql"
  "088-social-skyvern|sohamyoga-frontend/src/domain/social/db-schema-skyvern.sql"
  "089-social-platform-roadmap|sohamyoga-frontend/src/domain/social/db-schema-platform-roadmap.sql"
  "090-youtube-marketing|sohamyoga-frontend/src/domain/social/db-schema-youtube-marketing.sql"
  "091-advanced-marketing-operations|sohamyoga-frontend/src/domain/marketing/db-schema-advanced-operations.sql"
  "092-marketing-capability-baseline|sohamyoga-frontend/src/domain/marketing/db-schema-capability-baseline.sql"
  "093-workflow-orchestration|sohamyoga-frontend/src/domain/marketing/db-schema-workflow-orchestration.sql"
  "094-ingestion|sohamyoga-frontend/src/domain/ingestion/db-schema.sql"
  "095-ingestion-auth|sohamyoga-frontend/src/domain/ingestion/db-schema-auth.sql"
  "096-banner|sohamyoga-frontend/src/domain/banner/db-schema.sql"
  "097-cta|sohamyoga-frontend/src/domain/cta/db-schema.sql"
  "098-poll|sohamyoga-frontend/src/domain/community/db-schema-poll.sql"
  "099-landing-page|sohamyoga-frontend/src/domain/landingpage/db-schema.sql"
  "100-form|sohamyoga-frontend/src/domain/form/db-schema.sql"
  "101-event|sohamyoga-frontend/src/domain/event/db-schema.sql"
  "102-video|sohamyoga-frontend/src/domain/video/db-schema.sql"
  "103-survey-consent-quality|sohamyoga-frontend/src/domain/survey/db-schema-consent-quality.sql"
  "104-google-business-review|sohamyoga-frontend/src/domain/reputation/db-schema.sql"
  "105-video-reel-format|sohamyoga-frontend/src/domain/video/db-schema-format.sql"
  "106-competitor-price-tracker|sohamyoga-frontend/src/domain/competitor/db-schema.sql"
  "107-journey-touchpoint|sohamyoga-frontend/src/domain/funnel/db-schema-touchpoint.sql"
  "108-content-library|sohamyoga-frontend/src/domain/social/db-schema-content-library.sql"
  "109-service-review|sohamyoga-frontend/src/domain/reputation/db-schema-onsite.sql"
  "110-content-library-created-by-fix|sohamyoga-frontend/src/domain/social/db-schema-content-library-fix.sql"
  "111-video-production|sohamyoga-frontend/src/domain/video/db-schema-production.sql"
  "112-video-render-status-align|sohamyoga-frontend/src/domain/video/db-schema-render-status-align.sql"
  "113-audience-segment|sohamyoga-frontend/src/domain/campaign/db-schema-audience-segment.sql"
  "114-test-orchestration|sohamyoga-frontend/src/domain/assurance/db-schema-test-orchestration.sql"
  "115-test-scenarios|sohamyoga-frontend/src/domain/assurance/db-schema-test-scenarios.sql"
)

psql_cmd=(docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME")

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || {
  echo "Database container '$DB_CONTAINER' does not exist." >&2
  exit 1
}

"${psql_cmd[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migration (
  migration_key TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# The current Compose initialization applied these files before migration
# tracking existed. Record them only when their representative tables exist.
"${psql_cmd[@]}" <<'SQL'
INSERT INTO schema_migration(migration_key, source_path)
SELECT '001-core','sohamyoga-frontend/src/domain/core/db-foundation.sql'
WHERE to_regclass('public.tenant') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO schema_migration(migration_key, source_path)
SELECT '020-social','sohamyoga-frontend/src/domain/social/db-schema.sql'
WHERE to_regclass('public.social_account') IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO schema_migration(migration_key, source_path)
SELECT '023-marketing-automation','sohamyoga-frontend/src/domain/marketing/automation-schema.sql'
WHERE to_regclass('public.marketing_automation_request') IS NOT NULL ON CONFLICT DO NOTHING;
SQL

for entry in "${schemas[@]}"; do
  key="${entry%%|*}"
  relative="${entry#*|}"
  file="$PROJECT_ROOT/$relative"
  [[ -f "$file" ]] || { echo "Missing schema: $relative" >&2; exit 1; }

  applied="$(docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -Atc \
    "SELECT 1 FROM schema_migration WHERE migration_key='${key}'")"
  if [[ "$applied" == "1" ]]; then
    echo "SKIP  $key"
    continue
  fi

  echo "APPLY $key  ($relative)"
  {
    printf 'BEGIN;\n'
    sed -e 's/^[[:space:]]*BEGIN;[[:space:]]*$//' -e 's/^[[:space:]]*COMMIT;[[:space:]]*$//' "$file"
    printf "\nINSERT INTO schema_migration(migration_key,source_path) VALUES ('%s','%s');\nCOMMIT;\n" "$key" "$relative"
  } | "${psql_cmd[@]}"
done

echo
echo "Applied migrations:"
docker exec "$DB_CONTAINER" psql -X -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT migration_key, applied_at FROM schema_migration ORDER BY migration_key"
