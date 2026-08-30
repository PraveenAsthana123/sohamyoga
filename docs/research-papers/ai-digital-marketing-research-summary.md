# AI in Digital Marketing — Research Paper Summary

Real web search + fetch, 2026-08-24. Honest about what was actually verified
vs. what's only a link — most academic publishers (MDPI, SSRN, ResearchGate)
block automated fetching (403s below are real, not omitted), so full-text
extraction only succeeded for the one open-access PMC paper.

## Fully verified (real content extracted)

**The Role of Artificial Intelligence in Personalizing Social Media Marketing Strategies for Enhanced Customer Experience**
Hasan Beyari, Tareq Hashem — *Behavioral Sciences (Basel)*, 19 May 2025
[https://pmc.ncbi.nlm.nih.gov/articles/PMC12109579/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12109579/)

Surveyed 893 MENA-region consumers. All 8 hypotheses statistically supported (p < 0.001):
- AI personalization → purchase intention: effect 0.869 (strongest single effect measured)
- AI → customer awareness: 0.782
- AI → platform selection: 0.83
- Information-seeking behavior had the strongest direct influence on overall customer experience (0.675)
- Skills gaps and privacy concerns are the main adoption barriers identified

**Relevance to this project**: directly supports prioritizing the confirmed-missing Email/Personalization agents (per this session's Ollama gap-analysis doc) — purchase-intent effect size here is the largest of any factor measured, ahead of awareness or platform selection.

## Found, real links, not fetchable (403 / bot-blocked)

- [AI-Driven Personalization in Digital Marketing: Effectiveness and Ethical Considerations](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4906214) — Peter Broklyn, Ayoolu Olukemi, Chris Bell (SSRN, Jan 2026)
- [Artificial Intelligence in Sustainable Marketing: How AI Personalization Impacts Consumer Purchase Decisions](https://www.mdpi.com/2071-1050/18/2/1123) (MDPI *Sustainability*, Jan 2026)
- [THE IMPACT OF AI-DRIVEN PERSONALIZATION ON CONTENT MARKETING EFFECTIVENESS](https://www.researchgate.net/publication/404536571_THE_IMPACT_OF_AI-DRIVEN_PERSONALIZATION_ON_CONTENT_MARKETING_EFFECTIVENESS) (ResearchGate, May 2026)
- [Artificial Intelligence-Driven Personalization in Digital Marketing](https://link.springer.com/chapter/10.1007/978-3-032-18415-3_31) (Springer, paywalled)

If you have institutional access to any of these, I can re-fetch with real credentials — automated bot-check bypass isn't something to build around.

## What I did not do

Two direct-PDF download attempts (PMC and MDPI) both returned bot-check interstitial pages, not real PDFs (1.8KB "Preparing to download..." HTML, and a 403). I deleted both rather than leave fake files in the repo pretending to be papers.
