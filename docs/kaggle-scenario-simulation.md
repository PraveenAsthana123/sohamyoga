# Kaggle Dataset Scenario Simulation — Real Analysis

Real descriptive statistics run against the 3 datasets downloaded earlier this session (`data/kaggle/`), not synthetic numbers. Each finding is tied to a real decision point in this codebase.

## Scenario 1 — Churn risk by contract type (Telco Customer Churn, 7,043 rows)

- Overall churn rate: **26.5%**
- Month-to-month customers churn at **42.7%** vs **2.8%** for two-year contracts — a **15x** difference
- Churned customers average 18.0 months tenure vs 37.6 for retained customers
- Churned customers pay *more* on average ($74.44/mo vs $61.27/mo) — churn isn't simply price-driven here

**Maps to**: `ChurnPredictionJob` (sohamyoga-frontend). Real validation signal: if this codebase's membership/contract-term field correlates with churn the same way, the highest-leverage retention lever is term-length incentives, not blanket discounting — worth checking against real `app_user`/membership data before assuming price is the retention lever.

## Scenario 2 — Lead source quality (Lead Scoring dataset, 9,240 rows)

- Overall conversion: 38.5%
- **Referral (91.8%) and direct website (98.6%) leads convert 2.4–2.6x better than Google/organic (37–40%) and 3x better than Direct Traffic (32.2%)**

**Maps to**: directly validates the value of the referral/advocacy system already built and test-covered in sohamyoga-frontend (`AdvocacyScoreJob`, `ReferralInvitationJob`) — this external dataset independently confirms referral-sourced leads are worth prioritizing over paid/organic acquisition, consistent with why that system exists.

## Honest limits of this simulation

These are **external, general-market datasets** (telecom churn, generic B2B lead scoring) — not SohamYoga's own data. They validate *directionally* that the features already built (contract-term awareness, referral prioritization) target real, well-established patterns — they are not a substitute for running the same analysis against real `app_user`/`campaign_lead` rows once there's enough real volume to do so honestly. Per `data/kaggle/README.md`, any demo-hub use of this data must carry the same synthetic-data labeling as other generated content.
