# Matomo · Web Analytics

OSS web analytics · GA-alternative · self-hosted · GDPR-compliant · privacy-first

License: GPL-3 · Port: 8080 · Env: MYSQL_HOST · MATOMO_DB_PASSWORD

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool matomo
```

Or per-tool:

```bash
./ai-agents/matomo/deep/scripts/install.sh
```

Or manually: `docker run -p 8080:80 matomo`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md)

## Composes with

§47 · §64.40 layer 10 (enterprise app integration) · §76 (RAI + GDPR for web analytics · marketing automation) · §82.7 (drift monitoring on KPIs) · §88 G18 · §90 · §91.
