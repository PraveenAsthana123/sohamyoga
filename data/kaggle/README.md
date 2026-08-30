# Kaggle reference datasets

Downloaded 2026-08-24 to seed realistic demo/test data and (later) validate
the Ollama-driven prediction jobs already in this codebase. Raw CSVs are
gitignored (large/binary) — this file is the record of what, why, and license.

**Status: downloaded and verified only.** Nothing here is wired into either
app's database, demo hub, or a training script yet — that's separate,
deliberate follow-up work, not implied by the download itself.

| Folder | Dataset | Rows | License | Maps to |
|---|---|---|---|---|
| `telco-customer-churn/` | [Telco Customer Churn](https://www.kaggle.com/datasets/blastchar/telco-customer-churn) | 7,043 | copyright-authors (Kaggle-hosted, free to use per dataset terms) | `sohamyoga-frontend`'s `ChurnPredictionJob` — real tenure/contract/charges/churn fields to validate the model against known-labeled outcomes instead of only live (unlabeled) customer data |
| `marketing-campaign-performance/` | [Marketing Campaign Performance](https://www.kaggle.com/datasets/manishabhatt22/marketing-campaign-performance-dataset) | 200,000 | CC0-1.0 (public domain) | Campaign analytics / marketing-mix modelling — real Conversion_Rate, ROI, Clicks, Impressions, Channel_Used, Engagement_Score fields to seed the Demo Hub's campaign dashboards with realistic-but-clearly-external data (never to be presented as real SohamYoga customer results) |
| `lead-scoring/` | [Lead Scoring Dataset](https://www.kaggle.com/datasets/amritachatterjee09/lead-scoring-dataset) | 9,240 | **unknown — verify before any production/commercial use** | `LeadNurturingJob` / lead-scoring validation — real Lead Source, Converted, Total Time Spent on Website fields |

## Before using any of this beyond local experimentation

1. **Re-check the lead-scoring dataset's actual license** on its Kaggle page — "unknown" is not a green light, it's a flag to verify before anything beyond local dev use.
2. If used to seed the Demo Hub, every record must carry the same `SYNTHETIC DEMO DATA` labeling this codebase already applies to other generated tenant data (per existing policy) — this is real *external* data, not SohamYoga's own, and must never be presented as if it were.
3. If used to train/validate a model, keep it strictly separate from the live production tables — these CSVs must not be joined into `campaign_lead`/`app_user` etc.
