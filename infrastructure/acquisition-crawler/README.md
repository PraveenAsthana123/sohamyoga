# Open-source acquisition crawler

Self-hosted Crawlee collector for public company websites. It extracts page metadata, public contact strings and linked social profiles into a local JSON dataset. It stays on the seed origin, obeys `robots.txt`, runs one request at a time, waits at least one second, and caps every run at 200 pages.

It does not scrape LinkedIn or private/authenticated pages, enrich personal identities, verify emails/phones, or send outreach. Those require separate lawful data sources, consent/compliance review and approval gates.

Run from the repository root:

```bash
./scripts/setup-open-source-acquisition.sh --url https://example.org --max-pages 25
```

Each run is written to its own timestamped directory under `data/crawlee/datasets/`.
