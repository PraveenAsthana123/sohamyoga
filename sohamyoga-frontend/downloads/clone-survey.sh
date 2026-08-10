#!/usr/bin/env bash
# Wave 11 — Survey / Questionnaire / Form / Feedback Module
# Clone open-source survey tools to ~/sohamyoga-clones/survey/
set -euo pipefail

CLONE_DIR="${HOME}/sohamyoga-clones/survey"
mkdir -p "$CLONE_DIR"
cd "$CLONE_DIR"

echo "==> Wave 11: Cloning Survey / Form / Feedback tools to $CLONE_DIR"

# --- 1. Formbricks — Open-source survey & experience platform
# Used as: core survey engine; self-hosted Next.js + Prisma
if [ ! -d "formbricks" ]; then
  git clone --depth 1 https://github.com/formbricks/formbricks.git formbricks
  echo "[OK] formbricks"
else
  echo "[SKIP] formbricks (already cloned)"
fi

# --- 2. SurveyJS — JavaScript survey library (MIT renderer)
# Used as: client-side JSON-driven question renderer
if [ ! -d "survey-library" ]; then
  git clone --depth 1 https://github.com/surveyjs/survey-library.git survey-library
  echo "[OK] survey-library (SurveyJS)"
else
  echo "[SKIP] survey-library (already cloned)"
fi

# --- 3. LimeSurvey — Enterprise survey platform for IRB/research
# Used as: IRB/IEC questionnaire import baseline; SPSS export reference
if [ ! -d "LimeSurvey" ]; then
  git clone --depth 1 https://github.com/LimeSurvey/LimeSurvey.git LimeSurvey
  echo "[OK] LimeSurvey"
else
  echo "[SKIP] LimeSurvey (already cloned)"
fi

# --- 4. OhMyForm — Open-source form builder (NodeJS)
# Used as: lightweight intake form reference
if [ ! -d "ohmyform" ]; then
  git clone --depth 1 https://github.com/ohmyform/ohmyform.git ohmyform
  echo "[OK] ohmyform"
else
  echo "[SKIP] ohmyform (already cloned)"
fi

# --- 5. Novu — Notification infrastructure (email invitations)
# Used as: send survey invitations, completion confirmations, export-ready alerts
if [ ! -d "novu" ]; then
  git clone --depth 1 https://github.com/novuhq/novu.git novu
  echo "[OK] novu"
else
  echo "[SKIP] novu (already cloned)"
fi

# --- 6. PostHog — Product analytics (response funnels, NPS trends)
# Used as: drop-off analysis, response events, NPS trend over time
if [ ! -d "posthog" ]; then
  git clone --depth 1 https://github.com/PostHog/posthog.git posthog
  echo "[OK] posthog"
else
  echo "[SKIP] posthog (already cloned)"
fi

# --- 7. n8n — Workflow automation (post-submission triggers)
# Used as: trigger post-submission workflows (e.g. follow-up booking after NPS)
if [ ! -d "n8n" ]; then
  git clone --depth 1 https://github.com/n8n-io/n8n.git n8n
  echo "[OK] n8n"
else
  echo "[SKIP] n8n (already cloned)"
fi

# --- 8. Teable — AirTable-like relational DB for survey response storage
# Used as: visual response table for non-technical admins
if [ ! -d "teable" ]; then
  git clone --depth 1 https://github.com/teableio/teable.git teable
  echo "[OK] teable"
else
  echo "[SKIP] teable (already cloned)"
fi

echo ""
echo "==> Wave 11 clones complete: $CLONE_DIR"
ls -1 "$CLONE_DIR"
