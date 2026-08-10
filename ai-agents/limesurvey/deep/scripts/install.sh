#!/usr/bin/env bash
set -euo pipefail
echo "Installing LimeSurvey ..."
echo "  $ docker run -p 8080:8080 -e DBENGINE=MyISAM adamzammit/limesurvey"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "  (DRY-RUN)"
  exit 0
fi
docker run -p 8080:8080 -e DBENGINE=MyISAM adamzammit/limesurvey
echo "✓ LimeSurvey installed"
if [ "DB creds" != "none" ]; then
  echo ""
  echo "Setup required: DB creds"
fi
