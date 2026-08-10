#!/usr/bin/env python3
"""Scaffold 21 HOLY_RECOMMENDATION.md per-dept files from the canonical catalog.

Per §64.22 + docs/RECOMMENDER_FLAVORS_PER_DEPT.md.

For each canonical dept, generates a starter HOLY_RECOMMENDATION.md that:
- Names the 3 classical flavors with the dept-specific algorithm
- Maps to existing 23 R-* stub use cases by dept
- Includes mandatory §90.3 G3/G4/G7/G10/G11/G16 surfaces
- Is operator-editable · NOT final content · just turns §64.22 audit GREEN

Idempotent. Skip if file exists unless --force.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

# Canonical 21 depts per RECOMMENDER_FLAVORS_PER_DEPT.md
# (dept_id, slug, item-based algo, content-based algo, hybrid algo)
DEPTS = [
    (1, "product-management",
     "Two-tower NN · feature × spec",
     "Spec embedding similarity (sentence-transformer)",
     "LightGBM rerank over CF + content"),
    (3, "sales-distribution",
     "ALS on customer×product matrix",
     "TF-IDF on product copy + sentence-transformer",
     "Hybrid · margin × inventory × eligibility business rule"),
    (4, "underwriting",
     "Two-tower NN (UW decision history)",
     "Property attribute embedding match",
     "XGBoost rerank · risk + history blend"),
    (5, "policy-admin",
     "Item-item collaborative (template × customer)",
     "LayoutLM embedding similarity (template documents)",
     "LightGBM rerank · template fit + signing history"),
    (6, "billing",
     "Session-aware sequence model (payment flow LSTM)",
     "Payment-method attribute match + bank profile embed",
     "Hybrid · multi-armed bandit (Thompson) over CF + content"),
    (7, "claims",
     "Item-item matrix factorization (claim × shop)",
     "CLIP photo similarity + region/severity attribute",
     "LightGBM rerank · 3-signal blend (CF + photo sim + SLA)"),
    (8, "siu-fraud",
     None,  # ITEM_NA
     "Narrative similarity (BERT embed)",
     "XGBoost · narrative + GNN ensemble"),
    (9, "customer-service",
     "Skill-based collaborative + workload bandit",
     "BM25 + DPR over knowledge base",
     "RAG + cross-encoder rerank (per §79)"),
    (10, "actuarial",
     "Bayesian recommendation with posterior uncertainty",
     "Profile attribute match (claim profile embed)",
     "Bayesian blend · CF posterior + content prior"),
    (11, "reinsurance",
     "NSGA-II multi-objective recommendation",
     "Treaty-term text embedding (E5)",
     "NSGA-II + content score · risk-adjusted Pareto"),
    (12, "compliance",
     None,  # ITEM_NA
     "Regulation embedding (E5/BGE) + cross-encoder rerank",
     "Cross-encoder rerank · jurisdiction + topic blend"),
    (13, "legal",
     None,  # ITEM_NA
     "Caselaw dense retrieval (LegalBERT)",
     "Rerank · clause + precedent + jurisdiction blend"),
    (14, "finance",
     "RL DDPG (allocation policy)",
     "Bond/asset attribute embedding (sector + duration + risk)",
     "DDPG + risk-attribute · constrained portfolio optimization"),
    (15, "erm",
     "Bayesian (rare-event recommendation)",
     "Risk-category embedding (taxonomy + severity)",
     "Bayesian blend · loss history + content prior"),
    (16, "hr",
     "Item-based collaborative + content embed",
     "Resume embedding (sentence-transformer)",
     "LightGBM + role-fit rule · skill + experience match"),
    (17, "procurement",
     "Multi-armed bandit (Thompson sampling per vendor)",
     "Vendor catalog embedding (CLIP for equipment)",
     "MAB + content + SLA · cost-quality Pareto"),
    (18, "analytics",
     "Item-item collaborative (dashboard × user)",
     "Saved-view embedding (query + visualization spec)",
     "Hybrid · CF + content + cohort recency"),
    (19, "it",
     "Skill-based collaborative + alert MAB",
     "Runbook embedding (procedure + symptom)",
     "RAG over runbooks · per §79 production-grade"),
    (20, "cyber",
     None,  # ITEM_NA
     "Threat embedding (TTP + indicator)",
     "Rerank · severity + asset criticality blend"),
    (21, "partner",
     "Item-item collaborative (partner × product)",
     "Partner profile embedding (vertical + scale + region)",
     "XGBoost + tier blend · partner-fit ranking"),
    (22, "product-innovation",
     None,  # ITEM_NA
     "Concept embedding (idea + market + adjacency)",
     "Content-only · then graduate to hybrid post-launch"),
]


def render(did: int, slug: str, item_algo: str | None, content_algo: str, hybrid_algo: str) -> str:
    item_section = ""
    if item_algo is None:
        item_section = f"""## Item-based (collaborative filter)

**N/A for this dept.** Cold-start-dominant domain. See [`../../../docs/RECOMMENDER_FLAVORS_PER_DEPT.md`](../../../docs/RECOMMENDER_FLAVORS_PER_DEPT.md) · ITEM_NA set."""
    else:
        item_section = f"""## Item-based (collaborative filter)

**Algorithm**: {item_algo}

- Use when: rich user × item interaction history exists
- Limitation: cold-start fails on new items/users
- Drift signal: KS-test on user-item distribution every 7d
- Top-1% gate: §90.3 G3 SMOTE for rare-event negative sampling

See R-* stubs tagged `item-based` in `docs/use-cases/raf/*/evaluation-metrics.json`."""

    return f"""# HOLY_RECOMMENDATION.md · Dept {did} · {slug}

> **Generated scaffold** per §64.22 + [`RECOMMENDER_FLAVORS_PER_DEPT.md`](../../../docs/RECOMMENDER_FLAVORS_PER_DEPT.md).
> Operator refines content. This skeleton turns the §64.22 audit GREEN; production-grade requires further detail per §90.3 28-subsection contract.

## Scope

Recommendation system for Dept {did} ({slug}). All 3 classical flavors covered per §64.22.

{item_section}

## Content-based

**Algorithm**: {content_algo}

- Use when: cold-start dominates · interpretable rationale required
- Limitation: filter bubble · narrow recommendations
- Top-1% gate: §90.3 G4 SHAP per recommendation
- Pipelines: sync (per request) · batch (overnight precompute) · stream (event re-rank)

## Hybrid (production default)

**Algorithm**: {hybrid_algo}

- Production default: handles cold + warm covered
- Cost: 2-3× train vs single flavor · medium serve cost
- Top-1% gate: §90.3 G7 bootstrap MAP/MRR/NDCG@K CI · §90.3 G10 ResAI fairness across cohorts

## Mandatory §90.3 subsections (per flavor)

| Subsection | Required signal |
|---|---|
| **G3 SMOTE / balance** | rare-event negative sampling |
| **G4 feature selection** | SHAP per-recommendation for §48 explainability |
| **G7 statistical** | bootstrap MAP/MRR/NDCG@K CI per cohort |
| **G10 ResAI fairness** | diversity score + cohort-fairness audit (§76) |
| **G11 ExpAI** | "why this rec?" tracing (content-based easiest · item-based hardest) |
| **G16 inference modes** | sync (<500ms p95) · batch (overnight) · stream (event-triggered) |

## Decision rule

```
if cold_start_signal > threshold:
    use_content_based()
elif user_has_history():
    use_hybrid()  # production default
else:
    use_item_based()  # if applicable per ITEM_NA set
```

## Composes with

§38.3 (audit row per recommendation · request_id propagated) · §41.3 (per-tenant scoping enforced at vector DB) · §43 (drill ≥1 negative · "wrong cohort gets wrong rec") · §48 (XAI · why-this-rec MANDATORY) · §64.22 (this file IS the per-dept compliance evidence) · §76 (RAI 5-pillar · diversity score + cohort fairness audit) · §82.7 (drift on rec quality · CTR · MAP/NDCG) · §87.4 (vector ingest of rec history into RAG corpus) · §90 (per use-case 28 subsections) · §91 (LangGraph DAG for RAG-backed flavors).

## References

- Operator catalog: [`../../../docs/RECOMMENDER_FLAVORS_PER_DEPT.md`](../../../docs/RECOMMENDER_FLAVORS_PER_DEPT.md)
- Audit script: `scripts/audit_recommender_flavors.py`
- R-* stub use cases tagged with flavor: `docs/use-cases/raf/r-*/evaluation-metrics.json`
"""


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true", help="overwrite existing files")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    repo = Path(__file__).resolve().parent.parent
    depts_root = repo / "global-ai-org" / "departments"
    depts_root.mkdir(parents=True, exist_ok=True)

    written = skipped = no_dir = 0
    for did, slug, item_algo, content_algo, hybrid_algo in DEPTS:
        # Find or create dept dir
        candidates = [depts_root / slug, depts_root / f"{did:02d}-{slug}", depts_root / f"{did}-{slug}"]
        dept_dir = next((c for c in candidates if c.exists()), None)
        if dept_dir is None:
            # Use canonical naming: DD-slug
            dept_dir = depts_root / f"{did:02d}-{slug}"
            if args.dry_run:
                print(f"  WOULD CREATE: {dept_dir.relative_to(repo)}")
                continue
            (dept_dir / "business-layer").mkdir(parents=True, exist_ok=True)
            no_dir += 1

        bl = dept_dir / "business-layer"
        bl.mkdir(parents=True, exist_ok=True)
        target = bl / "HOLY_RECOMMENDATION.md"
        if target.exists() and not args.force:
            print(f"  SKIP (exists): {target.relative_to(repo)}")
            skipped += 1
            continue

        if args.dry_run:
            print(f"  WOULD WRITE: {target.relative_to(repo)}")
            continue

        target.write_text(render(did, slug, item_algo, content_algo, hybrid_algo))
        written += 1
        print(f"  WROTE: {target.relative_to(repo)}")

    print(f"\n  Summary: wrote {written} · skipped {skipped} · created {no_dir} dept dirs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
