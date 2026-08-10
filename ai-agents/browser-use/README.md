# Browser-Use · Playwright + LLM browser automation

MIT licensed · drop-in alternative to raw CDP for ~80% of use cases.

| File | Purpose |
|---|---|
| `deep/docs/setup.md` | Install + first task |
| `deep/examples/` | Multi-step browser tasks |
| `deep/scripts/install.sh` | One-cmd install + Playwright chromium |
| `deep/backend/` | Drop-in adapter that conforms to CDP manager interface |

## Install (via universal installer)
`./scripts/setup_ai_agent_stack.sh --tool browser-use`

Or manually:
```bash
pip install browser-use playwright
playwright install chromium
```
