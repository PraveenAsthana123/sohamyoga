#!/usr/bin/env bash
set -euo pipefail
echo "Installing SurveyJS ..."
echo "  $ npm install survey-core survey-react-ui"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
npm install survey-core survey-react-ui
echo "✓ SurveyJS installed"
if [ "none" != "none" ]; then
  echo ""
  echo "Setup required: none"
fi
