# Soham Yoga — Market Research & Growth Framework (Master Reference)

Consolidated source-of-truth for every market-research / market-intelligence / growth-strategy
framework provided for the admin "Market Research" module. This file is the raw reference
content; the admin module (`/admin/market-research`) is the operational implementation built
from it.

---

## 1. Market Research as a Data Pipeline

Treat market research as a pipeline, not separate spreadsheets:

`Business Question → Data Collection → Data Integration → Data Quality → Data Transformation → Data Analysis → Forecasting → Visualization → Insight → Decision → Action → Measure Result → Learn`

| Stage | Simple meaning | Yoga/Spa example | Output |
|---|---|---|---|
| 1. Business Question | What do I want to know? | Is corporate yoga a better opportunity than spa? | Research questions |
| 2. Data Collection | Get raw information | Census, Google, surveys, competitors | Raw datasets |
| 3. Data Integration | Connect different datasets | Join population + competitors + survey + pricing | Unified dataset |
| 4. Data Quality | Check reliability | Missing prices, duplicate spas, outdated population | Clean data |
| 5. Transformation | Make data comparable | Monthly price, age bands, postal areas | Analysis-ready data |
| 6. Data Analysis | Understand what happened/why | Which age group has highest demand? | Findings |
| 7. Forecasting | Predict future | Customers/revenue in 2027–2030 | Forecast |
| 8. Visualization | Make patterns visible | Maps, charts, dashboards | Dashboard |
| 9. Insight | Explain meaning | NW Calgary underserved for service X | Business insight |
| 10. Decision | Choose what to do | Launch hybrid yoga program | Decision |
| 11. Action | Execute | Run ads + free trial | Campaign |
| 12. Measurement | Did it work? | CAC, conversion, revenue | KPI |
| 13. Learning | Improve model | Seniors converted better than expected | New strategy |

### 1.1 Data Collection — categories

| Data category | Example variables | Source | Type |
|---|---|---|---|
| Population | Population by city | Statistics Canada | Secondary |
| Demographic | Age, gender | Statistics Canada | Secondary |
| Geography | Community/postal area | Calgary data | Secondary |
| Income | Household income | Census | Secondary |
| Competitor | Company/studio | Google/website | Secondary |
| Competitor price | $/class/month | Website | Secondary |
| Services | Yoga, massage, sauna | Website | Secondary |
| Reviews | Rating/review text | Google | Secondary |
| Customer demand | Interested/not interested | Survey | Primary |
| Price preference | $30/$50/$75 | Survey | Primary |
| Preferred timing | 6AM/10AM/6PM | Survey | Primary |
| Pain points | Cost/time/location | Survey/interview | Primary |
| Corporate demand | Employees/programs | HR interview | Primary |
| Search demand | Yoga/spa searches | Google Trends/keyword tools | Secondary |
| Actual behaviour | Trial/sign-up/payment | Your system | First-party |

Primary = you collect it. Secondary = someone else collected it. First-party operational data
(actual customer behavior) becomes extremely valuable post-launch.

### 1.2 Data Integration — master market table

Join five example datasets (Population, Competitors, Survey, Google/Search demand, Your
customers) on a common key (postal area / community / city / province) into one:

| Area | Population | Target age | Income | Competitors | Avg price | Survey demand | Search demand | Leads | Customers |
|---|---|---|---|---|---|---|---|---|---|
| Area A | 45K | 15K | $95K | 4 | $80 | 68% | High | 120 | 30 |

### 1.3 Data Quality dimensions

| Quality dimension | Question | Example |
|---|---|---|
| Completeness | Missing values? | 15 competitors missing prices |
| Accuracy | Is value correct? | Studio actually closed |
| Consistency | Same format? | "$50/month" vs "$50" |
| Uniqueness | Duplicate records? | Same spa listed twice |
| Timeliness | How old? | 2021 census vs 2026 estimate |
| Validity | Valid values? | Rating = 8 when scale is 1–5 |
| Traceability | Where did value come from? | Website URL |
| Reliability | How trustworthy is source? | Official census vs blog |

Never mix verified fact and AI estimate without labeling. Add fields: `source_type`,
`source_url`, `collection_date`, `verified`, `confidence_score`.

### 1.4 Data Transformation examples

Raw `"$49.99 monthly unlimited yoga"` → `{service: Yoga, plan: Unlimited, billing: Monthly,
price: 49.99, currency: CAD, online: Yes, offline: Yes}`.

Raw ages (23, 27, 31, 39, 44, 67) → bands (18–24, 25–34, 35–44, 45–54, 55–64, 65+).

### 1.5 Data Analysis — four levels

1. **Descriptive** — what happened? (competitor count, avg price, % interested, customer count)
2. **Diagnostic** — why did it happen? (women 35–44 show 70% interest but only 15% purchase — why?)
3. **Predictive** — what will happen? (regression/time-series/ML forecast: base 350, optimistic 550, conservative 220)
4. **Prescriptive** — what should we do? ("Target women 30–50 in communities A/B/C with a 6–7AM online program at $49/month")

### 1.6 Market Opportunity Scoring

`Opportunity = Population × Demand × Affordability × Growth × Conversion`, adjusted for
`Competition + CAC + Operating Cost`. Score 0–100 per area. A smaller-population area can
outrank a larger one once demand/competition/growth are weighted in.

### 1.7 Visualization — management-question mapping

| Management question | Visualization |
|---|---|
| Where are customers? | Geographic heat map |
| Which age group? | Bar chart |
| Male vs female? | Bar/stacked bar |
| What service? | Ranked bar |
| What price? | Price distribution |
| Which competitors? | Competitive matrix |
| Who is expensive? | Price-positioning chart |
| Where is unmet demand? | Demand vs supply matrix |
| Which area is best? | Opportunity heat map |
| Customer journey? | Funnel |
| Revenue over time? | Line chart |
| Actual vs forecast? | Forecast line |
| Customer sentiment? | Sentiment chart |
| Why are customers leaving? | Ranked churn reasons |
| Which service makes money? | Revenue/margin chart |
| Executive performance? | KPI cards |

### 1.8 Dashboard — 7 pages

1. **Executive** — Market Size | TAM | SAM | SOM | Customers | Revenue | Growth | Opportunity Score
2. **Geography** — Calgary → community → population → demand → competitors → customers
3. **Customer** — Age → gender → income → family → preference → price → behavior
4. **Competition** — 50 competitors → service → pricing → reviews → strengths → weaknesses → positioning
5. **Products** — Yoga | Kids Yoga | Senior Yoga | Spa | Massage | Sauna | Corporate Wellness | Meditation
6. **Marketing** — Impressions → Leads → Trials → Customers → Retention → Referral, with CAC/conversion/ROAS/CLV
7. **Forecast** — 2026→2030: Customers, Revenue, Expenses, Profit, Market share, Locations, Corporate contracts

### 1.9 Technology Architecture

```
DATA SOURCES (Google, websites, StatCan, Calgary Open Data, survey, CRM, social, GA, payments,
  competitor data, paid datasets)
  ↓
COLLECTION (API, web forms, survey, ETL, manual upload, web extraction where permitted)
  ↓
RAW DATA (CSV/Excel/JSON/DB)
  ↓
INTEGRATION (Python, SQL, Power Query, ETL tools)
  ↓
DATA WAREHOUSE (PostgreSQL/BigQuery/Snowflake/Fabric)
  ↓
QUALITY + GOVERNANCE (cleaning, dedup, validation, source tracking, metadata, privacy)
  ↓
ANALYTICS (SQL, Python, Excel, statistics, ML)
  ↓
AI (segmentation, sentiment, forecasting, recommendation, competitor intelligence, GenAI summaries)
  ↓
VISUALIZATION (Power BI / Tableau / Excel)
  ↓
DECISION (which customer? which area? which product? what price? what channel? expected revenue?)
```

The core question chain: Business question → decision needed → variables that determine it →
where to obtain them → trustworthiness → integration → analysis → visualization → action →
value generated.

---

## 2. Market Research + Forecasting Framework (17-Layer, Yoga/Spa)

| Layer | What to investigate | Data/KPI | Forecast / decision |
|---|---|---|---|
| 1. Population | Calgary/Alberta population | Population, households, age | Addressable population |
| 2. Customer segments | Women, men, couples, seniors, professionals, tourists | Segment size | Best target segment |
| 3. Income | Disposable income | Income bands | Premium vs value |
| 4. Geography | NW/NE/SW/SE/downtown | Population + competitors | Location opportunity |
| 5. Demand | Massage, facial, sauna, steam, etc. | Search/survey/bookings | Demand index |
| 6. Supply | Number of competing spas | Locations/capacity | Supply index |
| 7. Competitors | 50–100 centres | Price/services/reviews | Competitive position |
| 8. Pricing | Service/menu pricing | Avg/min/max price | Optimal pricing |
| 9. Utilization | Rooms × hours × bookings | Occupancy % | Capacity requirement |
| 10. Revenue | Customers × visits × spend | Revenue/customer | Revenue forecast |
| 11. Membership | Monthly plans | Conversion/churn | Recurring revenue |
| 12. Corporate | Employer wellness | Contracts/employees | B2B opportunity |
| 13. Tourism | Visitors/hotel guests | Tourist spend | Destination wellness |
| 14. Reviews | Google/social reviews | Sentiment/NPS | Product improvement |
| 15. Trends | New wellness formats | Growth/search signals | Emerging opportunity |
| 16. Expansion | New services | TAM/SAM/SOM | Product roadmap |
| 17. Forecasting | 1/3/5-year | Customers/revenue/cost | Investment decision |

**This 17-layer table is the seed content already implemented** in
`sohamyoga-frontend/src/domain/marketresearch/db-schema.sql` (17 `research_topic` rows × 3 tabs:
Overview / Data & KPIs / Forecast & Decision).

### 2.1 Calgary competitive landscape (evidence)

Substantial existing competitive activity: SKA Thermal Spa (Beltline), Clear Nordic Spa, Leela
Eco Spa (Beltline), Riverside Spa, Oasis Wellness Centre & Spa. Market is not limited to
traditional massage/facial spas — thermal and social-wellness formats are increasingly visible.

### 2.2 Emerging opportunities to test

| Emerging opportunity | Trend | Investment | Revenue potential | Synergy with Yoga | Priority |
|---|---|---|---|---|---|
| Thermal spa | ↑↑ | High | Very high | High | ⭐⭐⭐⭐⭐ |
| Sauna + cold plunge | ↑↑↑ | Medium-high | High | Very high | ⭐⭐⭐⭐⭐ |
| Social wellness club | ↑↑↑ | Medium-high | Recurring | Very high | ⭐⭐⭐⭐⭐ |
| Yoga + spa membership | ↑↑ | Medium | Recurring | Excellent | ⭐⭐⭐⭐⭐ |
| Corporate wellness | ↑↑ | Low-medium | High | Excellent | ⭐⭐⭐⭐⭐ |
| Massage/RMT | Stable-high | Medium | High | High | ⭐⭐⭐⭐ |
| Senior wellness | ↑ | Medium | High | Excellent | ⭐⭐⭐⭐ |
| Couples spa | ↑ | Medium | High | Medium | ⭐⭐⭐⭐ |
| Head spa | ↑↑ | Medium | High | Medium | ⭐⭐⭐⭐ |
| Mobile spa/massage | ↑ | Low | Medium-high | High | ⭐⭐⭐⭐ |
| Meditation + massage | ↑↑ | Low | High | Excellent | ⭐⭐⭐⭐⭐ |
| Breathwork + thermal | ↑↑ | Low | High | Excellent | ⭐⭐⭐⭐⭐ |
| Workplace chair massage | ↑ | Low | High B2B | Excellent | ⭐⭐⭐⭐ |
| Wellness retreat | ↑↑ | Medium-high | Premium | Excellent | ⭐⭐⭐⭐⭐ |
| Hotel/tourist wellness | ↑↑ | High | Premium | High | ⭐⭐⭐⭐ |
| AI-personalized wellness | Emerging | Medium | Scalable | Excellent | ⭐⭐⭐⭐ |

Sauna/cold-plunge/social-wellness deserves dedicated research (Calgary 2026 reporting
describes communal sauna/steam/cold-plunge as surging locally). Canada's Job Bank reports a
Calgary massage-therapist labour shortage 2023–2025 with a "Good" 2025–2027 outlook — signals
demand but also a staffing risk for a massage-heavy model.

### 2.3 Service-level forecast model (illustrative)

`Customer volume × visits/customer × price × utilization = gross service revenue`

| Product | Customers/month | Frequency | Avg. spend | Monthly revenue |
|---|---|---|---|---|
| Yoga membership | 300 | Subscription | $50 | $15,000 |
| Massage | 250 | 1.2 | $110 | $33,000 |
| Sauna/thermal | 400 | 1.5 | $45 | $27,000 |
| Facial | 150 | 1.0 | $120 | $18,000 |
| Meditation | 150 | Subscription | $30 | $4,500 |
| Corporate wellness | 10 companies | Contract | $1,000 | $10,000 |
| Private wellness | 40 | 1 | $150 | $6,000 |
| **Illustrative total** | | | | **$113,500/month** |

Not a market forecast — a financial-model shape to populate with real primary/secondary
research.

### 2.4 Most interesting combined concept

**Yoga + Recovery + Thermal + Social Wellness Centre**: Morning (yoga→meditation→breathwork),
Day (massage→facial→senior wellness), Evening (yoga→sauna→steam→cold plunge), Weekend
(couples/family + workshops), Corporate (yoga+meditation+stress-mgmt+massage), Digital (online
yoga+meditation+coaching). Revenue engines: Membership + Pay-per-visit + Treatment + Corporate
contracts + Workshops + Online subscription + Retail + Retreats.

Tourism Calgary: $582M visitor spending Q1 2026 (+7% YoY), 10.5M+ visitors and $3.3B visitor
spending in 2025 — tourist/hotel wellness is a separate TAM/SAM worth including. Calgary
requires municipal licensing for facials, sauna/steam/hot-tub, and massage — regulation is a
market-entry variable, not an afterthought.

---

## 3. Online Yoga Market Study — Master Framework

Build as Market Intelligence + Customer Research + Competitive Intelligence + Revenue
Forecasting, not just "how many yoga users are there?"

Geographic hierarchy: **Calgary → Calgary CMA → Alberta → Canada → Online global expansion**,
with separate analysis for B2C consumers, children/families, seniors, and B2B/corporate
wellness.

Calgary: ~1.307M residents (2021 Census); ~41% of Calgary's private-household population is
racialized; South Asian residents ~141,660 — a meaningful segment to *study*, not to *assume*
demand from.

### 3.1 Master 30-Domain Research Framework

| # | Research Domain | Information to Collect | Example Yoga Question | Output |
|---|---|---|---|---|
| 1 | Market population | City/province/Canada population | How many addressable people? | Population base |
| 2 | Age | Kids…65+ bands | Which age has strongest demand? | Age opportunity |
| 3 | Gender | Women, men, other/undisclosed | Who currently practices/interested? | Gender mix |
| 4 | Cultural/population groups | South Asian, Chinese, Black, Filipino, Arab, Latin American, etc. | Offerings/languages/timing different? | Segment opportunity |
| 5 | Geography | Community, postal region, quadrant, city | Where concentrated? | Heat map |
| 6 | Income | Household income ranges | Ability/willingness to pay | Price segmentation |
| 7 | Employment | Student, employee, self-employed, retired, homemaker | Best class schedules | Schedule design |
| 8 | Yoga experience | Never/beginner/intermediate/advanced | Who needs beginner programs? | Product design |
| 9 | Demand | Current + latent interest | Would they start in 30/90 days? | Demand forecast |
| 10 | Supply | Studios, instructors, gyms, online providers | How crowded? | Supply index |
| 11 | Competition | Top 20–50 competitors | What do they sell? | Competitor matrix |
| 12 | Pricing | Drop-in/monthly/package | What will they pay? | Price elasticity |
| 13 | Delivery | Online/offline/hybrid | Preferred mode? | Channel strategy |
| 14 | Timing | Morning/day/evening/weekend | When would they attend? | Schedule |
| 15 | Frequency | 1/2/3/5/7 days weekly | Desired usage | Capacity forecast |
| 16 | Yoga category | Hatha, Vinyasa, meditation, restorative, etc. | Preferred format? | Product portfolio |
| 17 | Health/wellness goal | Flexibility, stress, mobility, strength, sleep | Why buying? | Value proposition |
| 18 | Kids | Parent-child/kids yoga | Family demand? | Kids opportunity |
| 19 | Seniors | Mobility/gentle/chair yoga | Senior demand? | Senior product |
| 20 | Corporate | Employee wellness | Employer willingness to purchase | B2B market |
| 21 | Private | 1-to-1/family | Premium demand | High-value product |
| 22 | Satisfaction | CSAT/NPS | What do current customers like? | Retention |
| 23 | Barriers | Price/time/location/confidence | Why don't people join? | Conversion plan |
| 24 | Acquisition | Google, Meta, referrals, etc. | Where do customers discover yoga? | Marketing budget |
| 25 | Revenue | Users × price | Potential revenue? | Revenue forecast |
| 26 | Retention | Renewals/churn | How long will users stay? | CLV |
| 27 | Market penetration | Customers ÷ target market | Share captured? | Share |
| 28 | Growth | YoY/MoM | How fast can it grow? | Forecast |
| 29 | Product recall | Brand awareness | Do people know Soham Yoga? | Awareness KPI |
| 30 | Expansion | New city/product/segment | What launches next? | Growth roadmap |

### 3.2 Geographic Assessment

| Level | Market | Research Purpose |
|---|---|---|
| L1 | Calgary community | Hyperlocal customer acquisition |
| L2 | Calgary | Primary B2C/offline market |
| L3 | Calgary CMA | Online + hybrid expansion |
| L4 | Airdrie | Expansion |
| L5 | Chestermere | Expansion |
| L6 | Cochrane | Expansion |
| L7 | Okotoks | Expansion |
| L8 | Edmonton | Alberta city expansion |
| L9 | Alberta | Online market |
| L10 | BC | Online expansion |
| L11 | Ontario | Online expansion |
| L12 | Canada | National online TAM |
| L13 | USA | Future international |
| L14 | India | Online/time-zone-specific |
| L15 | Global | Long-term digital product |

City of Calgary publishes community/geographic-level demographic profiles — useful for
selecting physical/offline target areas.

### 3.3 Population Segmentation (Calgary 2021 private-household population)

| Population segment | Calgary population | Approx. share |
|---|---|---|
| Total private-household population | 1,291,790 | 100% |
| Racialized population | 534,700 | 41% |
| South Asian | 141,660 | 11% |
| Chinese | 91,415 | 7% |
| Filipino | 84,215 | 7% |
| Black | 70,675 | 5% |
| Latin American | 31,855 | 2% |
| Arab | 30,735 | 2% |
| Southeast Asian | 26,400 | 2% |
| West Asian | 15,150 | 1% |

These are market *denominators*, not demand estimates. South Asian share varies by
community — e.g. Downtown Commercial Core ~21% vs ~11% citywide — enabling a
community-level acquisition map instead of uniform advertising.

### 3.4 Age-Based Yoga Opportunity

| Segment | Age | Possible Yoga Product |
|---|---|---|
| Kids | 5–9 | Yoga through play |
| Pre-teen | 10–12 | Flexibility/mindfulness |
| Teen | 13–17 | Stress/posture/focus |
| Young adult | 18–24 | Fitness/stress |
| Young professional | 25–34 | Morning/evening online |
| Professional/parent | 35–44 | Stress + fitness |
| Mid-life | 45–54 | Mobility + strength |
| Active mature | 55–64 | Mobility/wellness |
| Senior | 65–74 | Gentle yoga |
| Older senior | 75+ | Chair/balance/breathing |

Calgary had ~177,405 residents 65+ in 2021 (~14% of population) — senior/gentle yoga
deserves its own market assessment.

### 3.5 Service/Product Market Matrix

| Product | B2C/B2B | Online | Offline | Revenue potential |
|---|---|---|---|---|
| Daily group yoga | B2C | ✅ | ✅ | High |
| Beginner yoga | B2C | ✅ | ✅ | Very high |
| Women's yoga | B2C | ✅ | ✅ | High |
| Men's yoga | B2C | ✅ | ✅ | Medium |
| Kids yoga | B2C | ✅ | ✅ | High |
| Parent + child | B2C | ✅ | ✅ | High |
| Senior yoga | B2C | ✅ | ✅ | High |
| Chair yoga | B2C/B2B | ✅ | ✅ | Medium-high |
| Meditation | B2C | ✅ | ✅ | High |
| Pranayama | B2C | ✅ | ✅ | High |
| Stress-management | B2C/B2B | ✅ | ✅ | Very high |
| Corporate yoga | B2B | ✅ | ✅ | Very high |
| Workplace meditation | B2B | ✅ | ✅ | High |
| School yoga | B2B | ✅ | ✅ | Medium |
| Community-centre yoga | B2B/B2C | — | ✅ | Medium |
| Private yoga | B2C | ✅ | ✅ | High margin |
| Family yoga | B2C | ✅ | ✅ | High |
| Recorded classes | B2C | ✅ | — | Scalable |
| Subscription library | B2C | ✅ | — | Scalable |
| Yoga challenges | B2C | ✅ | ✅ | Acquisition |
| Retreat/workshop | B2C/B2B | — | ✅ | Premium |

### 3.6 Competitor Intelligence — 50-company dataset schema

Fields: Company, Website, City, Locations, Founded, Online classes, Offline classes, Hybrid,
Corporate, Kids, Seniors, Meditation, Drop-in $, Monthly $, Annual $, Free trial, Class/week,
Google rating, Google reviews, Instagram followers, Facebook followers, YouTube, Teachers,
Languages, Estimated customers, Estimated revenue (range, labeled estimate), Strength,
Weakness, Customer complaints, Differentiator, Market segment, Growth estimate, Competitive
threat (1–10).

Do not report private-studio revenue as fact — use labeled ranges/estimates only.

### 3.7 Competitive Intelligence Sources

Company websites, Google Maps, Google Search, Google Trends, Statistics Canada, City of
Calgary, Alberta government, LinkedIn, Instagram, Facebook, YouTube, Reddit, Yelp, Eventbrite,
ClassPass, Similarweb, SEMrush, Ahrefs, Meta Ads Library, Google Ads Keyword Planner,
IBISWorld, Statista, Euromonitor, Grand View Research, Data Bridge.

One commercial estimate: Canada's yoga market ~US$635M (2022) → ~US$1.13B by 2030 (Grand View
Research) — use as a secondary reference, not the sole basis for Calgary TAM.

### 3.8 Primary Research

Sample phasing: Pilot 30–50 → Phase 2 100–200 → Phase 3 300–500 (Calgary) → Phase 4 1,000+
(Alberta/Canada).

Stratify by: Gender, Age band, Location/postal prefix, Work status, Household type, Children,
Income band (optional), Yoga experience, Current exercise, Yoga/online/offline interest (1–10),
Corporate interest, Frequency preference, Timing, Price willingness, Goal, Barrier, Trial
willingness, Conversion likelihood, Referral likelihood.

### 3.9 Pricing research method

Don't ask "Would you pay $50?" hypothetically — test multiple price points with a
definitely-buy/maybe/no grid ($20, $30, $40, $50, $60, $75, $100), plus offer-ladder testing
($1 trial → 2-week free → $30 → $40 → $50 → $60/month) and packages.

Reference: a Calgary studio currently advertises ~$30 drop-in studio class, ~$15 livestream
drop-in, ~$12/class livestream card — illustrates the physical vs digital price gap.

### 3.10 TAM → SAM → SOM

- **TAM**: everyone theoretically addressable = Calgary adults × potential participation × annual spend
- **SAM**: adults interested × online/offline target × geographic coverage × relevant schedule × affordability
- **SOM**: customers realistically acquirable

Illustrative: 100,000 qualified potential customers × 0.5% penetration = 500 customers × $50/mo
= $25,000/mo = $300,000/yr ARR. Numbers are illustrative — survey generates real conversion
assumptions.

### 3.11 Revenue Scenario Model

| Active users | Monthly fee | Monthly revenue | Annual revenue |
|---|---|---|---|
| 50 | $50 | $2,500 | $30,000 |
| 100 | $50 | $5,000 | $60,000 |
| 250 | $50 | $12,500 | $150,000 |
| 500 | $50 | $25,000 | $300,000 |
| 1,000 | $50 | $50,000 | $600,000 |
| 2,000 | $50 | $100,000 | $1.2M |

Deduct: marketing, instructors, software, payment processing, venue, insurance,
administration, content production, taxes, churn, promotional discounts.

### 3.12 Market Penetration

`Market Penetration = Active Customers ÷ Addressable Market × 100`. E.g. 500 ÷ 100,000 = 0.5%
— far more meaningful than citing Calgary's 1.3M population alone.

### 3.13 Demand–Supply Analysis

| Segment | Population | Demand | Existing supply | Competition | Willingness to pay | Opportunity |
|---|---|---|---|---|---|---|
| Women 25–44 | TBD | High | High | High | High | 🟡 |
| Men 25–44 | TBD | Medium | Low | Low | Medium | 🟢 |
| Seniors | TBD | High | Medium | Medium | Medium | 🟢 |
| Kids | TBD | Medium | Low | Low | Medium | 🟢 |
| South Asian families | TBD | TBD via survey | Medium | Medium | TBD | Research |
| Corporate employees | TBD | High | Medium | Medium | B2B | 🟢 |
| Beginners | TBD | Very high | Medium | Medium | Medium | 🟢 |
| Online Canada | Millions | High | Very high | Very high | Low-medium | 🟡 |

Population ≠ demand: population from census, demand from surveys/search/competitor
activity/actual conversion experiments.

### 3.14 B2B Corporate Yoga Market

Funnel: Companies → HR/Benefits Manager → employee population → wellness budget → pilot →
participation → contract renewal.

Research fields: Company name, Calgary employees, Total Canada employees, Industry,
Office/hybrid/remote, HR contact, Wellness program, Benefits provider, Existing fitness
partnership, Yoga offered?, Mental wellness offering?, Estimated wellness budget, Target
employee population, Proposed class frequency, Proposed contract, Revenue potential,
Probability, Next action.

Reference: an Edmonton provider advertises six-week corporate sessions $480 (groups 3–5) to
$720 (groups 6–10) — a different B2B pricing model from individual memberships.

### 3.15 Corporate Revenue Model (packaged tiers)

Bronze (1 virtual class/week) → Silver (2/week) → Gold (3/week + meditation) → Platinum
(5/week + yoga + meditation + workshops + employee analytics). Track: contract value →
employees eligible → participants → sessions attended → satisfaction → renewal probability →
annual contract value.

### 3.16 Primary + Secondary + AI Research architecture

```
Secondary: StatCan → City Calgary → Google → competitor sites → Maps/reviews → social → market reports
Primary: Survey → Interview → Focus group → Free trial → Pricing experiment → Signup data → Retention data
  ↓
AI intelligence layer: classification, sentiment, segmentation, topic modeling, competitor
  comparison, demand prediction, price modeling, revenue forecasting, churn prediction, recommendation
  ↓
Management outputs: Excel, Power BI, Word report, PowerPoint, executive dashboard
```

### 3.17 Qualitative Research

Interview: existing yoga students, ex-students, people who stopped, people who never tried,
parents, seniors, corporate HR managers, working professionals, reluctant men, online fitness
users. Capture language like "too expensive," "no time," "don't know if I'm doing poses
correctly," "classes too advanced," "prefer Indian/traditional yoga," "want exercise not
spirituality" (or reverse), "prefer/dislike online," "need 6AM/evening." These become product
requirements.

### 3.18 Quantitative Research

Metrics: % interested, % willing to trial, % willing to pay, average acceptable price,
preferred time, preferred frequency, online/offline ratio, conversion rate, retention rate,
referral rate, NPS, CAC, CLV, market penetration.

### 3.19 Customer Funnel

`Total population → Target population → Yoga-aware → Interested → Qualified → Lead → Free
trial → Paid customer → Active customer → 3-month retained → 12-month retained → Advocate/referral`

Measure conversion at every transition.

### 3.20 Product Expansion Research

`Yoga → Meditation → Pranayama → Stress management → Corporate wellness → Kids yoga → Senior
mobility → Family yoga → Workshops → Recorded courses → Teacher training → Retreats → Digital
subscription`

### 3.21 Market Opportunity Score

`OpportunityScore = MarketSize × Demand × WillingnessToPay × Growth × Accessibility ÷
Competition`, each factor scored 1–10. Illustrative: Generic Calgary yoga 6.5, Beginner yoga
8.5, Morning online yoga 9.0, Corporate yoga 9.2, Senior yoga 8.7, Kids yoga 7.8, Men's
beginner yoga 8.0, Canada-wide generic online yoga 5.5.

### 3.22 The bigger system

Population Intelligence → Customer Intelligence → Competitor Intelligence → Demand
Intelligence → Pricing Intelligence → Product Intelligence → Geographic Intelligence →
Corporate Intelligence → Marketing Intelligence → Sentiment Intelligence → Revenue
Intelligence → Forecasting → Market Opportunity → Executive Decision Dashboard.

Core question: *Which Calgary demographic + geography + age + delivery mode + class time +
price combination gives Soham Yoga the highest probability of acquisition, retention and
profit?*

---

## 4. Market Research Tool Stack (by data lifecycle stage)

| Stage | Tool | Free/Paid | Main purpose | Priority |
|---|---|---|---|---|
| Market data | Statistics Canada | Free | Population, age, income, demographics | 🔴 |
| | Calgary Open Data | Free | Community/geographic data | 🔴 |
| | Google Trends | Free | Demand/search trends | 🔴 |
| | Google Keyword Planner | Free/Ads account | Keyword/search demand | 🔴 |
| | Statista | Paid | Market statistics | 🟡 |
| | IBISWorld | Paid | Industry/competitor research | 🟡 |
| | Euromonitor Passport | Paid | Consumer/industry intelligence | 🟡 |
| Competitors | Google Maps | Free | Locations, ratings, reviews | 🔴 |
| | Google Search | Free | Competitor discovery | 🔴 |
| | Similarweb | Free/Paid | Website/traffic intelligence | 🟡 |
| | Semrush | Paid | SEO/competitor intelligence | 🟡 |
| | Ahrefs | Paid | SEO/keywords/backlinks | 🟡 |
| | Meta Ads Library | Free | Competitor advertising | 🟢 |
| Primary research | Google Forms | Free | Customer survey | 🔴 |
| | Microsoft Forms | Free/Paid | Surveys | 🔴 |
| | SurveyMonkey | Free/Paid | Advanced surveys | 🟡 |
| | Qualtrics | Paid | Enterprise research | 🟡 |
| | Typeform | Free/Paid | Customer-friendly surveys | 🟢 |
| Web collection | Python | Free | Automated collection/processing | 🔴 |
| | Beautiful Soup | Free | HTML extraction | 🟢 |
| | Scrapy | Free | Large web extraction | 🟢 |
| | Playwright | Free | Browser automation | 🟢 |
| | Apify | Paid/usage | Managed web data collection | 🟡 |
| Integration | n8n | Open source/Paid | Workflow automation | 🔴 |
| | Airbyte | Open source/Paid | Data integration | 🔴 |
| | Apache NiFi | Open source | Data flows | 🟢 |
| | Fivetran | Paid | Managed enterprise connectors | 🟡 |
| | Azure Data Factory | Paid | Cloud ETL | 🟡 |
| Transformation | Power Query | Included | Cleaning/integration | 🔴 |
| | Python/Pandas | Free | Advanced processing | 🔴 |
| | SQL | Free | Query/transformation | 🔴 |
| | dbt | Free/Paid | Analytics transformations | 🟢 |
| Storage | Excel | Paid | Small research datasets | 🔴 |
| | PostgreSQL | Free | Central database | 🔴 |
| | Google BigQuery | Usage based | Cloud analytics | 🟡 |
| | Snowflake | Paid | Enterprise warehouse | 🟡 |
| | Microsoft Fabric | Paid | Integrated Microsoft analytics | 🟡 |
| Analysis | Excel | Paid | Basic analysis | 🔴 |
| | Python | Free | Statistical/ML analysis | 🔴 |
| | R | Free | Statistical research | 🟢 |
| | SPSS | Paid | Statistical analysis | 🟡 |
| Visualization | Power BI | Free/Paid | Business dashboards | 🔴 |
| | Tableau | Paid | Advanced visualization | 🟡 |
| | Looker Studio | Free | Web dashboards | 🟢 |
| | Excel | Paid | Charts/pivots | 🔴 |
| GIS | QGIS | Free | Geographic market analysis | 🔴 |
| | ArcGIS | Paid | Advanced location intelligence | 🟡 |
| | Google Maps | Free/Paid | Location visualization | 🔴 |
| Forecasting/ML | Python/scikit-learn | Free | Demand/customer prediction | 🔴 |
| | XGBoost | Free | Predictive models | 🟢 |
| | Prophet | Free | Time-series forecasting | 🟢 |
| GenAI | ChatGPT | Free/Paid | Research/synthesis/analysis | 🔴 |
| | Claude | Free/Paid | Documents/research | 🟡 |
| | Gemini | Free/Paid | Google ecosystem | 🟡 |
| | Ollama | Free | Local/private LLM | 🟢 |
| CRM | HubSpot | Free/Paid | Leads/customers | 🔴 |
| | Zoho CRM | Paid | CRM/marketing | 🟡 |
| | Salesforce | Paid | Enterprise CRM | 🟡 |
| Marketing | Google Ads | Paid | Search acquisition | 🔴 |
| | Meta Ads | Paid | Facebook/Instagram | 🔴 |
| | Mailchimp | Free/Paid | Email campaigns | 🟡 |
| Reporting | PowerPoint | Paid | Executive presentation | 🔴 |
| | Word | Paid | Research report | 🔴 |
| | Excel | Paid | Data/model | 🔴 |
| | Power BI | Free/Paid | Live dashboard | 🔴 |

### 4.1 Practical low-cost stack

`Statistics Canada + Calgary Open Data + Google Trends + Google Maps + competitor websites +
Google Forms → Python + Playwright for collection → n8n for automation → PostgreSQL for
central storage → Python/Pandas + SQL for cleaning/integration → Power BI + QGIS for
visualization → Python/scikit-learn for forecasting → ChatGPT/Ollama for AI-assisted
qualitative analysis and research synthesis → HubSpot for lead/customer data.`

`Collect → Integrate → Clean → Store → Analyze → Predict → Visualize → Report → Act → Measure.`

Don't start with Snowflake, Fivetran, Qualtrics, Tableau, Salesforce and multiple paid
market-data subscriptions simultaneously for a small studio — add only when volume/scale
justifies the cost.

---

## 5. Master Market Research Workflow (70-step, end-to-end)

| # | Workflow / Phase | Key activities | Yoga/Spa example | Main output | Typical tools |
|---|---|---|---|---|---|
| 1 | Business Problem | Define decision/problem | Should we expand online yoga or spa? | Problem statement | Word, ChatGPT |
| 2 | Research Objectives | Define what must be learned | Market size, price, demand, competition | Objectives | Word |
| 3 | Research Questions | Convert objectives into questions | Who will buy? Where? At what price? | RQ matrix | Excel |
| 4 | Scope Definition | Geography/product/customer/time | Calgary → Alberta → Canada | Scope | Excel |
| 5 | Market Definition | Define exact market | Yoga, wellness, spa, corporate | Market taxonomy | Excel |
| 6 | Customer Segmentation | Age, geography, lifestyle, needs | Kids/seniors/professionals | Segments | Excel, Python |
| 7 | Stakeholder Mapping | Identify decision makers/users | Customer, parent, HR, employer | Stakeholder map | Miro |
| 8 | Hypothesis Development | Define assumptions to test | 6AM online yoga has demand | Hypotheses | Excel |
| 9 | Research Design | Primary + secondary + qual + quant | Survey + census + competitors | Research plan | Word |
| 10 | Secondary Research | Existing market information | StatCan, Calgary data | Secondary dataset | Web, Excel |
| 11 | Population Research | Population/demographics | Calgary population | Market denominator | Statistics Canada |
| 12 | Economic Research | Income/spending/growth | Household income | Economic profile | StatCan |
| 13 | Industry Research | Industry size/growth/trends | Canadian wellness market | Industry profile | IBISWorld, Statista |
| 14 | Trend Research | Emerging demand | Cold plunge, corporate wellness | Trend map | Google Trends |
| 15 | Competitor Discovery | Find 20–100 competitors | Yoga studios/spas | Competitor database | Google Maps |
| 16 | Competitor Profiling | Products, locations, ratings | Services offered | Competitor profiles | Websites |
| 17 | Pricing Intelligence | Compare prices/packages | $20 drop-in/$50 monthly | Price matrix | Excel |
| 18 | Product Intelligence | Compare features/services | Yoga, massage, sauna | Feature matrix | Excel |
| 19 | Review Mining | Analyze customer reviews | Complaints/praise | Pain-point database | Python, AI |
| 20 | Social Intelligence | Analyze social activity | Instagram engagement | Social intelligence | Social platforms |
| 21 | Search Intelligence | Keywords/search volume | "Yoga Calgary" | Demand indicators | Google Trends |
| 22 | Primary Research Design | Build survey/interview | 30–50 questions | Questionnaire | Forms |
| 23 | Pilot Survey | Test questions | 30–50 people | Validated survey | Google Forms |
| 24 | Customer Survey | Larger quantitative survey | 300–500 people | Primary dataset | Forms/Qualtrics |
| 25 | Customer Interviews | Deep qualitative research | Why don't people join yoga? | Interview themes | Teams/Zoom |
| 26 | Focus Groups | Group discussions | Parents/seniors | Qualitative findings | Zoom |
| 27 | B2B Research | Interview organizations | HR/corporate wellness | B2B dataset | LinkedIn/CRM |
| 28 | Data Ingestion | Bring data together | Survey + census + competitors | Raw repository | Python/n8n |
| 29 | Data Integration | Join datasets | Geography/service keys | Master dataset | SQL |
| 30 | Data Cleaning | Missing/duplicate/error checks | Duplicate studio | Clean dataset | Python/Power Query |
| 31 | Data Validation | Verify sources/values | Confirm competitor price | Validated data | Python/manual QA |
| 32 | Data Enrichment | Add derived variables | Price category/demand score | Enriched dataset | Python |
| 33 | Descriptive Analysis | What exists? | Average monthly price | Statistics | Excel/Python |
| 34 | Diagnostic Analysis | Why? | Why conversion is low | Root causes | Python/AI |
| 35 | Qualitative Analysis | Themes/sentiment | Price/time concerns | Theme matrix | AI/NLP |
| 36 | Customer Segmentation (analysis) | Cluster customers | Budget/premium/senior | Personas | Python |
| 37 | Demand Analysis | Estimate demand | Interested customers | Demand estimate | Python |
| 38 | Supply Analysis | Existing capacity | Studios/classes | Supply estimate | Excel |
| 39 | Demand–Supply Gap | Find underserved markets | High demand/low supply | Gap analysis | Power BI |
| 40 | Market Size | Estimate total market | Calgary yoga spend | Market value | Excel/Python |
| 41 | TAM | Total addressable market | All qualified consumers | TAM | Excel |
| 42 | SAM | Serviceable market | People you can serve | SAM | Excel |
| 43 | SOM | Obtainable market | Realistically acquired users | SOM | Excel |
| 44 | Market Penetration | Current share | Customers ÷ target population | Penetration % | Power BI |
| 45 | Market Growth | Historical/future growth | YoY demand | CAGR | Excel |
| 46 | Opportunity Scoring | Rank segments | Corporate vs kids vs seniors | 0–100 score | Python |
| 47 | Location Analysis | Geographic attractiveness | NW vs NE vs SW Calgary | Heat map | QGIS |
| 48 | Product-Market Fit | Match product to demand | Senior gentle yoga | PMF score | Survey/analytics |
| 49 | Pricing Analysis | Willingness-to-pay | $30/$50/$70 | Optimal price | Python |
| 50 | Competitive Positioning | Compare business | Price vs service quality | Positioning map | Power BI |
| 51 | Emerging Opportunity | Identify future products | Thermal/social wellness | Opportunity pipeline | AI + Trends |
| 52 | Revenue Forecast | Users × price × frequency | 500 × $50 | Revenue | Excel/Python |
| 53 | Cost Forecast | Fixed/variable costs | Rent, instructor, ads | Cost model | Excel |
| 54 | Profit Forecast | Revenue − cost | Monthly contribution | P&L forecast | Excel |
| 55 | CAC Analysis | Acquisition cost | Marketing ÷ customers | CAC | CRM |
| 56 | CLV Analysis | Customer lifetime value | Revenue over retention | CLV | Python |
| 57 | Scenario Analysis | Conservative/base/aggressive | 200/500/1,000 users | Scenarios | Excel |
| 58 | Sensitivity Analysis | Change assumptions | Price ±10% | Risk ranges | Excel |
| 59 | Risk Analysis | Market/business risks | Competition/staffing | Risk register | Excel |
| 60 | Business Case | Consolidate economics | Invest/not invest | Business case | Word/Excel |
| 61 | Visualization | Create charts/maps | Demand heat map | Visual analysis | Power BI/QGIS |
| 62 | Executive Dashboard | Management KPIs | TAM/SAM/SOM/revenue | Dashboard | Power BI |
| 63 | Research Report | Document evidence | Market assessment | Report | Word |
| 64 | Executive Presentation | Communicate recommendation | Go/no-go | Presentation | PowerPoint |
| 65 | Decision | Select opportunity | Launch corporate yoga | Decision record | Management |
| 66 | Market Experiment | Test recommendation | 2-week free trial | Real-world evidence | CRM/Ads |
| 67 | Measure Actuals | Track performance | Leads/trials/paid | Actual KPIs | Power BI |
| 68 | Forecast vs Actual | Validate assumptions | Predicted 100 vs actual 72 | Variance | Power BI |
| 69 | Learn & Adjust | Improve strategy/model | Change price/time | Optimization | Analytics |
| 70 | Continuous Intelligence | Repeat monitoring | Competitor price changes | Market alerts | n8n/AI |

One-line summary: `Problem → Objective → Scope → Hypothesis → Secondary Research →
Competitor Research → Primary Research → Data Collection → Integration → Quality → Analysis →
Segmentation → Demand/Supply → TAM/SAM/SOM → Opportunity → Pricing → Forecast → Risk →
Visualization → Business Case → Decision → Pilot → Actual Results → Learn → Continuous
Monitoring`

### 5.1 Three loops

- **Research loop**: Collect → Integrate → Validate → Analyze → Visualize → Insight
- **Business loop**: Insight → Decision → Campaign/Product → Customer → Revenue → KPI → Feedback
- **Learning loop**: Forecast → Actual → Variance → Root Cause → Update assumptions → Retrain/recalculate → New forecast

Goal state: a Market Intelligence Engine where Yoga, Spa, Corporate Wellness, Kids Yoga,
Senior Wellness, online programs, new locations, and emerging products are all scored using
the same framework.

---

## 6. New-Player Market Entry Framework ("Should I enter?")

For a **new** player planning to start a yoga centre. Answers one investment question: *Should
I enter this market, where, whom to target, what to offer, what to charge, can it be
profitable?*

| # | Component | What you need to determine | Key data to collect | Final output |
|---|---|---|---|---|
| 1 | Market Definition | Exactly what business are you entering? | Yoga, meditation, wellness, online/offline | Market boundary |
| 2 | Geographic Market | Where should you operate? | City, communities, postal codes, commute | Geographic market |
| 3 | Population Analysis | How many potential customers exist? | Population, households, growth | Population base |
| 4 | Demographic Analysis | Who lives there? | Age, household, gender, income, family structure | Demographic profile |
| 5 | Lifestyle/Psychographic Analysis | Why would they practice yoga? | Wellness interest, motivation, attitudes | Personas |
| 6 | Customer Segmentation | Which groups should be targeted? | Beginner, professional, senior, kids, families | Segment matrix |
| 7 | Needs/Pain-Point Research | What problem are customers solving? | Stress, flexibility, fitness, mobility, community | Need hierarchy |
| 8 | Demand Analysis | Is there enough demand? | Surveys, search demand, inquiries, trials | Demand score |
| 9 | Supply Analysis | How much yoga supply already exists? | Studios, gyms, instructors, online options | Supply score |
| 10 | Competitor Analysis | Who are you competing against? | 20–50 competitors | Competitor database |
| 11 | Product Analysis | What should you sell? | Class types, duration, frequency | Product portfolio |
| 12 | Pricing Research | What will people pay? | Drop-in, memberships, packages | Pricing model |
| 13 | Location Analysis | Where should the centre physically be? | Rent, parking, transit, population, competitors | Location score |
| 14 | Online Market Analysis | Should online/hybrid be offered? | Online preference, geographic reach | Channel strategy |
| 15 | Corporate/B2B Market | Can employers become customers? | Companies, employees, wellness needs | B2B opportunity |
| 16 | Market Size | What's the dollar opportunity? | Population × demand × spending | Market value |
| 17 | TAM/SAM/SOM | What portion can be realistically captured? | Eligible/accessible/acquirable customers | TAM/SAM/SOM |
| 18 | Revenue Forecast | How much could you make? | Customers × price × frequency | 1/3/5-year forecast |
| 19 | Cost & Break-even | How many customers required? | Rent, instructor, utilities, marketing | Break-even point |
| 20 | Entry Decision | Should you launch? | All preceding evidence | Go / pilot / no-go |

### 6.1 Market definition sub-markets

Traditional yoga | Fitness yoga | Meditation | Pranayama | Hot yoga | Gentle yoga | Senior yoga
| Kids yoga | Prenatal/postnatal | Corporate yoga | Private yoga | Online yoga | Hybrid yoga |
Yoga + wellness | Yoga + spa — each is a different competitive market.

### 6.2 Customer segmentation dimensions

| Dimension | Segments to investigate |
|---|---|
| Age | Kids / teens / 18–24 / 25–34 / 35–44 / 45–54 / 55–64 / 65+ |
| Experience | Never tried / beginner / intermediate / advanced |
| Employment | Student / professional / self-employed / retired |
| Family | Single / couple / parents / families |
| Income | Low / middle / upper-middle / premium |
| Goal | Fitness / flexibility / stress / sleep / mindfulness / social |
| Delivery | Online / offline / hybrid |
| Schedule | Morning / daytime / evening / weekend |
| Frequency | 1 / 2 / 3 / 5+ days weekly |
| Buying | Drop-in / monthly / annual / private |
| B2B | SME / corporation / school / community organization |

Demographic variables help size a segment but should not be used to infer yoga demand
directly (ethnicity/gender/age) — validate via primary research.

### 6.3 Competitor intelligence (20–50 competitors)

Fields: Name → address → distance → website → services → price → class schedule → teachers →
online/offline → memberships → promotions → Google rating → review volume → positive
themes → complaints → Instagram/social activity → target customer → positioning →
differentiator. Then find the white space (e.g. "25 studios exist, but only 3 provide 6AM
classes").

### 6.4 Demand vs supply matrix

| | Low Supply | High Supply |
|---|---|---|
| **High Demand** | 🟢 Best opportunity | 🟡 Competitive |
| **Low Demand** | 🟡 Emerging/niche | 🔴 Weak opportunity |

Example hypotheses: Senior morning yoga (moderate/high demand + low supply); Corporate yoga
(high organizational demand + fragmented supply) — hypotheses until validated.

### 6.5 Location research

Collect per candidate: population within 1/3/5/10km → target-age population → household
income → residential density → office population → competitors → competitor distance → rent →
parking → transit → visibility → foot traffic → room capacity → accessibility → neighbourhood
growth.

`Location Opportunity Score = (Population + Target Customers + Income + Demand + Accessibility
+ Growth) − (Competition + Rent + Acquisition Difficulty)`. Rank candidate locations instead of
choosing emotionally.

### 6.6 Product research matrix

Test independently: General yoga, Beginner, Kids, Senior, Meditation, Corporate, Private,
Online, Hybrid — score each on Demand / Competition / Price / Margin / Retention /
Opportunity.

### 6.7 Pricing research ladder

Free trial → introductory offer → drop-in → 5-class package → 10-class package → monthly →
quarterly → annual → family → senior → student → private → corporate. Test WTP directly
(e.g. $29→$39→$49→$59→$69→$79/month) rather than copying competitors.

### 6.8 Marketing research (acquisition channels)

Google Search | Google Maps | Instagram | Facebook | YouTube | TikTok | Community groups |
WhatsApp | Schools | Corporations | Referral | Influencers | Flyers | Events | Free workshops.
Measure: Impressions → clicks → leads → trials → attendance → paid → retention → referral.
Business economics depend heavily on CAC.

### 6.9 Financial feasibility

Revenue = `Members × Average Monthly Revenue` + Drop-ins + Private + Corporate + Workshops +
Online + Retail. Costs = Rent + Utilities + Instructor + Insurance + Software + Marketing +
Equipment + Cleaning + Payment Fees + Administration. Calculate: gross margin, contribution
margin, CAC, CLV, monthly burn, break-even members, break-even month, profit, ROI, payback
period.

### 6.10 Scenario forecasting

Build Worst case / Conservative / Base / Growth / Aggressive scenarios (Members, Price,
Revenue, Cost, Profit) plus stress tests: Rent +20%, Members −20%, Price −10%, Marketing cost
+30%, Instructor cost +20%, Churn +25%. If the business still works under reasonable downside
scenarios, the case is stronger.

### 6.11 Regulatory feasibility

Calgary lists yoga studios among businesses requiring municipal licensing; land-use approval
is required. Check location requirements before signing a lease. (Reference: City of Calgary
yoga/fitness business requirements.)

### 6.12 New-Player Market Entry Scorecard

| Dimension | Weight | Score (/10) | Weighted Score |
|---|---|---|---|
| Market size | 10% | | |
| Population growth | 5% | | |
| Customer demand | 15% | | |
| Unmet need | 10% | | |
| Competition | 10% | | |
| Pricing power | 5% | | |
| Location attractiveness | 10% | | |
| Customer acquisition | 5% | | |
| Retention potential | 5% | | |
| Revenue potential | 10% | | |
| Margin | 5% | | |
| Break-even | 5% | | |
| Regulatory feasibility | 2.5% | | |
| Expansion potential | 2.5% | | |
| **TOTAL** | **100%** | | **/100** |

Decision bands: 80–100 Strong opportunity | 65–79 Opportunity, optimize | 50–64 Pilot before
investing heavily | <50 Reconsider market/product/location.

Complete architecture: `Market → Population → Customer → Need → Demand → Supply →
Competition → Location → Product → Price → Channel → Marketing → B2B → TAM/SAM/SOM → Revenue
→ Cost → Break-even → Risk → Forecast → Opportunity Score → Pilot → GO/NO-GO → Launch →
Measure → Expand`

Biggest new-entrant mistake: spending heavily on a studio before validating customer ×
location × product × price × schedule — validate those four first, then commit to lease/
larger capital.

---

## 7. Existing Yoga Centre Growth Research Framework ("Why aren't customers coming?")

For an **existing, low-customer** studio: *Why are customers not coming, where are we losing
them, what can we change, and which changes will increase customers, retention, revenue and
profit?*

| # | Research component | Main question | What to measure | Target output |
|---|---|---|---|---|
| 1 | Current Business Baseline | Where are we today? | Customers, classes, revenue, cost | AS-IS baseline |
| 2 | Market Potential | Is sufficient demand available? | Population, target segments, yoga demand | Market opportunity |
| 3 | Market Penetration | How much market have we captured? | Customers ÷ addressable market | Penetration % |
| 4 | Customer Database Analysis | Who actually comes? | Age, location, frequency, plan | Customer profile |
| 5 | Active Customer Analysis | Who is currently engaged? | Active 30/60/90-day customers | Active base |
| 6 | Inactive Customer Analysis | Who stopped coming? | Last visit, previous frequency | Win-back pool |
| 7 | Lost Customer Research | Why did they leave? | Price, timing, quality, location, instructor | Churn reasons |
| 8 | Non-Customer Research | Why don't prospects join? | Awareness, trust, price, schedule | Acquisition barriers |
| 9 | Lead Analysis | Are inquiries converting? | Leads, source, response | Lead quality |
| 10 | Lead-to-Trial Conversion | Are leads trying? | Trial bookings / leads | Conversion % |
| 11 | Trial-to-Paid Conversion | Do trials become customers? | Paid / trial customers | Conversion % |
| 12 | Retention Analysis | Do customers stay? | 30/60/90/180-day retention | Retention rate |
| 13 | Churn Analysis | How many leave? | Cancellations/inactivity | Churn rate |
| 14 | Attendance Analysis | Which classes work? | Attendance by class/day/time | Schedule optimization |
| 15 | Capacity Analysis | Are classes underused? | Seats available vs occupied | Utilization % |
| 16 | Instructor Analysis | Does instructor affect demand? | Attendance/retention by instructor | Instructor score |
| 17 | Schedule Research | Are times wrong? | Morning/evening/weekend demand | New timetable |
| 18 | Service Analysis | Are we offering the right yoga? | Demand/service/class utilization | Portfolio optimization |
| 19 | New-Service Research | What else could customers buy? | Meditation, kids, seniors etc. | Expansion opportunities |
| 20 | Pricing Research | Is price helping/hurting? | Competitors + willingness-to-pay | Price architecture |
| 21 | Package Analysis | Are packages appropriate? | Drop-in/package/membership sales | Package redesign |
| 22 | Competitor Analysis | Why are people choosing others? | Price, schedule, reviews, experience | Competitive gaps |
| 23 | Customer Experience | What happens from discovery onward? | Friction at every touchpoint | CX improvement |
| 24 | Satisfaction | Are customers happy? | CSAT | Satisfaction score |
| 25 | NPS | Will they recommend? | Promoters/passives/detractors | NPS |
| 26 | Review/Sentiment Analysis | What are people saying? | Reviews/comments/themes | Sentiment |
| 27 | Brand Awareness | Does the local market know you? | Awareness/recall | Brand score |
| 28 | Website Analysis | Is the website converting? | Visitors, booking clicks, conversion | Web funnel |
| 29 | Google/Maps Analysis | Can customers find you? | Search visibility, reviews, actions | Local visibility |
| 30 | Social Media Analysis | Does content create customers? | Reach → leads → trials → paid | Social ROI |
| 31 | Marketing Channel Analysis | Which channel works? | Leads/customers by source | Channel ROI |
| 32 | CAC | What does one customer cost? | Marketing ÷ acquired customers | CAC |
| 33 | Referral Analysis | Are customers bringing others? | Referral leads/conversions | Referral rate |
| 34 | Loyalty Research | Can customers become advocates? | Frequency, milestones, rewards | Loyalty model |
| 35 | Community Research | Can local partnerships grow reach? | Schools/businesses/communities | Partnership pipeline |
| 36 | Corporate Yoga | Can B2B increase revenue? | Companies, HR demand, contracts | Corporate pipeline |
| 37 | Kids/Family Market | Is there family demand? | Parents, children, schedules | New segment |
| 38 | Senior Market | Is there older-adult demand? | Gentle/chair yoga demand | Senior program |
| 39 | Online Yoga | Can geography be removed? | Online interest | Digital market |
| 40 | Hybrid Yoga | Do customers want both? | Online + physical preference | Hybrid model |
| 41 | Private Classes | Premium opportunity? | 1:1 demand/price | Premium revenue |
| 42 | Workshops/Events | Additional revenue? | Demand/attendance | Event revenue |
| 43 | Cross-Sell Analysis | What else can customers buy? | Yoga → meditation etc. | ARPU growth |
| 44 | Revenue per Customer | Are customers spending enough? | Revenue ÷ customers | ARPU |
| 45 | Customer Lifetime Value | What is each customer worth? | ARPU × lifetime | CLV |
| 46 | Revenue Leakage | Where is money being lost? | Empty seats, churn, discounts | Leakage value |
| 47 | Cost Analysis | Where can cost improve? | Rent, instructors, marketing | Cost optimization |
| 48 | Profitability by Service | Which services make money? | Revenue − direct cost | Contribution margin |
| 49 | Forecasting | What happens after changes? | Customers/revenue/cost | 12/36-month forecast |
| 50 | Growth Experimentation | What should we test first? | Offer/time/price/channel | Experiment backlog |
| 51 | Dashboard/KPI | Are changes working? | Weekly/monthly metrics | Management dashboard |
| 52 | Continuous Improvement | What do we change next? | Actual vs target | Growth loop |

### 7.1 Build the customer funnel first

Example decomposition:

```
10,000 people see Soham Yoga
  ↓ 10%
1,000 visit website/social profile
  ↓ 30%
300 inquire
  ↓ 50%
150 register for free trial
  ↓ 67%
100 attend
  ↓ 30%
30 purchase
  ↓ 67%
20 remain after 3 months
  ↓ 50%
10 remain after 12 months
```

This turns "we need more marketing" into "trial-to-paid conversion is only 30% — understand
why before spending more on lead acquisition."

### 7.2 Customer lifecycle research

`Unknown person → Aware → Interested → Lead → Trial registration → Trial attendance → First
payment → Repeat attendance → Membership → Retained customer → Loyal customer → Advocate →
Referral`, and separately: `Customer → Reduced attendance → At-risk → Inactive → Cancelled →
Lost → Win-back`. KPIs needed at every arrow.

### 7.3 Segment the existing customer database first

| Segment | Question |
|---|---|
| Never attended | Why register but not come? |
| Trial only | Why didn't they buy? |
| One-month customer | Why leave quickly? |
| 2–3 month customer | What caused churn? |
| 6+ month customer | Why do they stay? |
| High-frequency | What makes them loyal? |
| Low-frequency | What's preventing attendance? |
| Inactive | What would bring them back? |
| Referred customer | Who referred them? |
| Premium customer | Why will they pay more? |

### 7.4 Service expansion research

`Existing Yoga → Beginner → Advanced → Meditation → Pranayama → Stress-management → Kids →
Family → Seniors → Chair yoga → Private → Online → Hybrid → Corporate → Workshops → Retreats →
Wellness programs`. Score each: `Demand × Willingness-to-pay × Margin × Retention ×
Cross-sell potential ÷ Competition`.

### 7.5 Revenue decomposition

`Revenue = Customers × Frequency × Average Spend`. Growth levers: more leads, better lead
conversion, more trial attendance, better trial→paid, more memberships, higher retention,
lower churn, higher attendance frequency, higher ARPU, cross-selling, upselling, referrals,
new services, corporate contracts, online customers.

### 7.6 Pricing and membership research

Audit: Free trial → introductory offer → drop-in → 5-class → 10-class → monthly → quarterly →
annual → family → student → senior → corporate → private. Analyze actual attendance,
memberships, flexible pricing and retention, not owner intuition about class value. Mindbody
platform data: 90-day retention 54% for intro-offer purchasers vs 35% without — validate
against own studio data, don't assume it transfers.

### 7.7 Retention research program

Measure 30/60/90/180/365-day retention, churn, attendance frequency, days since last class,
membership renewal, referral rate. Early-warning rule: `Normal customer → attendance declining
→ at-risk → intervention → recovered/lost`. Loyalty journey: first class → second booking →
membership → attendance milestones → referral → renewal.

### 7.8 B2B (corporate)

`Target companies → HR contact → meeting → free corporate trial → proposal → contract →
employees → attendance → satisfaction → renewal → expansion`. Start with a minimum offer, a
small set of target companies, run trials, use the first success as a case study.

### 7.9 Growth KPI Tree

```
North Star: Profitable Active Customers
  ↓
Acquisition: Leads, Cost/lead, CAC, Trial registrations, Trial attendance
  ↓
Conversion: Lead→Trial, Trial→Paid, Paid→Membership
  ↓
Engagement: Classes/customer/month, Occupancy, Frequency, No-show %
  ↓
Retention: 30/90/180/365-day retention, Churn, Renewal, Reactivation
  ↓
Revenue: MRR, Revenue/customer, Revenue/class, Revenue/instructor, Revenue/service, CLV
  ↓
Growth: New customers, Referrals, Corporate contracts, Online customers, New-service revenue
  ↓
Profitability: Contribution margin, Marketing ROI, CAC:CLV, Operating profit
```

Reference: Calgary Hot Yoga case (2026 vendor study) — online/app/website sales share rose
from ~30% to ~60% of total revenue after improving digital purchasing/management (single
vendor-reported case, not a benchmark — signals booking/payment friction belongs in the
research scope).

Complete growth research architecture: `Current Performance → Customer Data → Lost Customers
→ Non-Customers → Competitors → Demand → Customer Experience → Product → Schedule → Price →
Marketing → Conversion → Retention → Loyalty → Referral → Cross-sell → New Services →
Corporate → Online → Revenue → Cost → Profit → Forecast → Experiments → KPI Dashboard →
Continuous Optimization`

Top 5 diagnoses to prioritize for a low-customer studio: (1) awareness/acquisition, (2) trial
conversion, (3) schedule/product fit, (4) retention/churn, (5) pricing/value perception. Don't
increase ad spend until you know which one is failing — it just feeds a leaky funnel faster.

---

## 8. Master Competitor Analysis — Yoga Centre (70 components)

| # | Component | What to collect / compare | Why it matters |
|---|---|---|---|
| 1 | Competitor Name | Business name | Identification |
| 2 | Competitor Type | Direct / indirect / substitute | Understand real competition |
| 3 | Business Model | Independent/franchise/gym/community/online | Positioning |
| 4 | Years in Business | Opening year | Market maturity |
| 5 | Number of Locations | 1/2/5/10+ | Scale |
| 6 | Location | Address/community | Geographic competition |
| 7 | Distance From You | km/minutes | Local threat |
| 8 | Catchment Area | 1/3/5/10 km | Customer overlap |
| 9 | Parking | Free/paid/none | Convenience |
| 10 | Transit Access | Bus/train/walking | Accessibility |
| 11 | Opening Hours | Earliest/latest | Convenience gap |
| 12 | Class Schedule | 6AM/9AM/noon/evening/weekend | Schedule opportunity |
| 13 | Classes per Week | Number | Supply |
| 14 | Yoga Types | Hatha/Vinyasa/Yin/hot/etc. | Product comparison |
| 15 | Beginner Program | Yes/no | New-customer acquisition |
| 16 | Kids Yoga | Yes/no | Expansion opportunity |
| 17 | Senior Yoga | Yes/no | Segment opportunity |
| 18 | Family Yoga | Yes/no | Family opportunity |
| 19 | Prenatal/Postnatal | Yes/no | Niche opportunity |
| 20 | Meditation | Yes/no | Cross-sell |
| 21 | Pranayama | Yes/no | Differentiation |
| 22 | Corporate Yoga | Yes/no | B2B competition |
| 23 | Private Sessions | Yes/no | Premium revenue |
| 24 | Online Classes | Live/recorded | Digital competition |
| 25 | Hybrid Offering | Online + physical | Convenience |
| 26 | Workshops | Type/frequency | Additional revenue |
| 27 | Retreats | Yes/no | Premium product |
| 28 | Drop-in Price | $ | Pricing benchmark |
| 29 | Monthly Membership | $ | Core price |
| 30 | Annual Membership | $ | Retention strategy |
| 31 | Class Packs | 5/10/20 | Flexibility |
| 32 | Free Trial | Yes/no/duration | Acquisition |
| 33 | Intro Offer | Price/duration | Conversion strategy |
| 34 | Discounts | Student/senior/family | Segment pricing |
| 35 | Referral Program | Reward/value | Organic acquisition |
| 36 | Loyalty Program | Points/rewards | Retention |
| 37 | Class Capacity | Mats/class | Revenue capacity |
| 38 | Estimated Fill Rate | Empty/50%/80%/full | Actual demand signal |
| 39 | Google Rating | 1–5 | Reputation |
| 40 | Google Review Count | Number | Social proof |
| 41 | Review Velocity | New reviews/month | Growth signal |
| 42 | Positive Review Themes | Instructor/community/etc. | Strengths |
| 43 | Negative Review Themes | Price/parking/etc. | Opportunity |
| 44 | Website Quality | 1–10 | Digital experience |
| 45 | Online Booking | Yes/no | Conversion friction |
| 46 | Mobile Booking | App/mobile web | Convenience |
| 47 | Google Visibility | Search/Maps position | Discoverability |
| 48 | Instagram | Followers/engagement | Awareness |
| 49 | Facebook | Followers/engagement | Community |
| 50 | YouTube | Content/views | Content marketing |
| 51 | Email Marketing | Newsletter/offers | Retention |
| 52 | WhatsApp/SMS | Used/not used | Customer engagement |
| 53 | Paid Advertising | Google/Meta/etc. | Acquisition |
| 54 | Content Frequency | Posts/week | Marketing activity |
| 55 | Instructor Count | Number | Capacity |
| 56 | Instructor Quality | Credentials/experience | Differentiation |
| 57 | Languages | English/Hindi/etc. | Accessibility |
| 58 | Studio Experience | Cleanliness/design/ambience | Customer experience |
| 59 | Community Experience | Events/social connection | Retention |
| 60 | Target Customer | Premium/budget/family/etc. | Positioning |
| 61 | Brand Positioning | Traditional/fitness/spiritual/etc. | Brand gap |
| 62 | Unique Selling Proposition | Why choose them? | Differentiation |
| 63 | Main Strength | Best competitive advantage | Threat |
| 64 | Main Weakness | Major gap | Opportunity |
| 65 | Estimated Customers | Range | Market-share estimate |
| 66 | Estimated Revenue | Range, clearly labeled estimate | Commercial scale |
| 67 | Growth Signal | Growing/stable/declining | Future threat |
| 68 | Technology | Booking/CRM/payment | Operational maturity |
| 69 | Competitive Threat | 1–10 | Prioritization |
| 70 | Opportunity for You | Specific gap | Action |

Don't analyze all competitors equally — map all nearby, classify, deep-dive on the ~8–10
strongest direct competitors.

### 8.1 Competitor classification

| Type | Example | Threat |
|---|---|---|
| Direct | Another local yoga studio | 🔴 Very high |
| Near-direct | Pilates/hot yoga/meditation studio | 🟠 High |
| Indirect | Gym offering yoga | 🟡 Medium |
| Digital | Online yoga platform/app | 🟡 Medium |
| Substitute | Home workout/YouTube/fitness app | 🟢–🟡 |

Yoga/Pilates market is highly fragmented — one 2026 database estimates 93.6% of businesses
with websites operate a single location, so a small studio often competes against many other
small operators, not chains.

### 8.2 Competitor vs Your Centre comparison (example)

| Dimension | Your Centre | Comp A | Comp B | Comp C | Best Market Offer | Your Gap |
|---|---|---|---|---|---|---|
| Monthly price | $50 | $80 | $120 | $65 | $65 | 🟢 Advantage |
| Free trial | 2 weeks | 1 class | None | 1 week | 2 weeks | 🟢 |
| Morning | 6AM | 6AM | 7AM | None | 6AM | 🟢 |
| Evening | ❌ | ✅ | ✅ | ✅ | ✅ | 🔴 |
| Weekend | ❌ | ✅ | ✅ | ✅ | ✅ | 🔴 |
| Kids | ❌ | ❌ | ✅ | ❌ | ✅ | 🟡 |
| Seniors | ❌ | ✅ | ❌ | ❌ | ✅ | 🟡 |
| Corporate | ❌ | ✅ | ❌ | ✅ | ✅ | 🔴 |
| Online | ✅ | ❌ | ✅ | ✅ | ✅ | 🟢 |
| Google reviews | 20 | 350 | 210 | 170 | 350 | 🔴 |
| Booking | Manual | App | App | Web | App | 🔴 |
| Referral | ❌ | ✅ | ✅ | ❌ | ✅ | 🔴 |

### 8.3 Competitor Opportunity Matrix

Score every gap: `Customer Demand × Competitor Weakness × Your Capability × Revenue Potential
× Margin × Ease of Launch`. Candidate opportunities in priority order: 6AM yoga → evening yoga
→ weekend yoga → beginners → seniors → kids → family → corporate → meditation → online →
hybrid → private classes. Schedule gaps (underserved early-morning/late-evening windows) are
particularly valuable — more competitors doesn't automatically mean no opportunity.

### 8.4 Ten gap analyses

Price Gap • Service Gap • Schedule Gap • Customer Experience Gap • Review Gap • Digital Gap
(website/booking/payment/app/automation) • Marketing Gap (Google/social dominance) •
Retention Gap (memberships/loyalty/community/referral) • Revenue Gap
(corporate/private/workshops/online/memberships) • White-Space Analysis (what nobody serves
well). Capacity signals (schedule density, review velocity, social engagement, visible class
availability) are directional estimates, not verified customer counts.

### 8.5 Competitive score formula

`CompetitiveScore = 15%Product + 15%Price + 10%Schedule + 10%Location + 10%Reputation +
10%Digital + 10%CustomerExperience + 10%Marketing + 5%Innovation + 5%Retention`

Output chain: `Competitor ranking → Your ranking → Gap → Opportunity → Recommended action →
Expected customer impact → Expected revenue impact → Priority`. The objective is competitor
intelligence → growth action, not competitor analysis for its own sake.

---

## 9. Master Pricing, Promotion & Referral Analysis

### 9.1 Pricing strategies (20)

| # | Analysis | What to test | Example for Yoga | Main KPI |
|---|---|---|---|---|
| 1 | Competitor pricing | Market min/avg/max | $30–$120/month | Price index |
| 2 | Cost-based pricing | Cost + required margin | Cost/member | Margin |
| 3 | Value-based pricing | Customer perceived value | Unlimited daily yoga | WTP |
| 4 | Penetration pricing | Low entry price | $29 introductory | Acquisition |
| 5 | Premium pricing | Premium experience | $99/month | ARPU |
| 6 | Psychological pricing | $49 vs $50 | $49/month | Conversion |
| 7 | Tiered pricing | Basic/Plus/Premium | $39/$59/$89 | Tier mix |
| 8 | Usage pricing | Pay per class | $10/class | Utilization |
| 9 | Unlimited pricing | Unlimited attendance | $59/month | Attendance |
| 10 | Class packs | 5/10/20 classes | $50/$90/$160 | Pack sales |
| 11 | Family pricing | Multiple family members | $99/family | Family acquisition |
| 12 | Kids pricing | Separate child plan | $35/month | Kids revenue |
| 13 | Senior pricing | Senior offer | $39/month | Senior acquisition |
| 14 | Student pricing | Discounted plan | $35/month | Student acquisition |
| 15 | Corporate pricing | B2B package | $500–$2,000/month | Contract value |
| 16 | Private pricing | 1:1 premium | $70/session | Margin |
| 17 | Online pricing | Digital-only | $29/month | Digital subscribers |
| 18 | Hybrid pricing | Studio + online | $69/month | ARPU |
| 19 | Annual pricing | Prepaid annual | 10 months price for 12 | Cash flow |
| 20 | Dynamic pricing | Off-peak incentives | Daytime discount | Capacity utilization |

### 9.2 Promotion analysis (17)

Measure whether promoted trials become *profitable retained customers*, not just whether they
generated sign-ups.

| Promotion | Example | What to measure |
|---|---|---|
| Free trial | 7 days free | Trial→paid |
| Extended trial | 2 weeks free | Trial→paid + abuse |
| $1 trial | First week $1 | Conversion |
| First month discount | $25 first month | Month-2 retention |
| 50% launch offer | First month 50% off | CAC |
| Buy 2 get 1 | 3-month package | Cash collection |
| Annual discount | Pay 10, get 12 | Annual retention |
| Couple offer | Join together | Household acquisition |
| Family package | Parent + kids | Family ARPU |
| Senior offer | Special hours | Off-peak utilization |
| Student offer | Student pricing | New segment |
| Birthday offer | Free class | Engagement |
| Bring-a-friend | Guest free | Referral |
| Reactivation offer | Return for $X | Win-back rate |
| Corporate trial | Free workplace session | B2B conversion |
| Seasonal | New Year etc. | Seasonal revenue |
| Challenge | 30-day yoga | Engagement/retention |

Critical formula: `Promotion Profit = Customer Lifetime Revenue − Promotion Cost −
Acquisition Cost − Service Cost`. 200 trials → 5 retained can be worse than 50 trials → 25
retained.

### 9.3 Referral marketing

**Simple referral**: `Customer A → Customer B → Reward A` (e.g. $10 credit / free week / free
class / points). Track: invitations → leads → trials → paid → 90-day retained → referral
revenue.

**Chain referral (not MLM)**: each customer rewarded only for their *own direct* referral —
`A brings B → A earns. B brings C → B earns. A doesn't earn from C.` Network can expand
indefinitely without becoming multi-level compensation.

**Ambassador Program**:

| Result | Potential reward |
|---|---|
| 1 successful referral | $10 credit |
| 3 | Free month |
| 5 | Ambassador status |
| 10 | Special membership |
| 25 | Community recognition/reward |

Model rewards against CLV so payout never exceeds acquired-customer value.

**Amway/MLM-style model — explicitly not recommended as the default.** In an MLM structure
compensation can flow from activity multiple levels below the recruiter. Competition Bureau of
Canada distinguishes legitimate MLM from prohibited pyramid selling — issues include
compensation for recruitment itself, inventory purchase requirements, no reasonable buy-back,
and required purchases to participate. Preferred model: **"Refer genuine paying customers,
receive a clearly defined reward"** — not "recruit recruiters for downstream commissions."

**Customer Growth Flywheel** (preferred over MLM):
`Free Trial → Paid Customer → Great Experience → Regular Attendance → 90-Day Retention →
Loyal Member → Referral → New Trial Customer → Paid Customer → (repeat)`

Referral economics example: `CLV = $50 × 10 months = $500`. Referral cost $25 → `25/500 = 5%`
— attractive, but only pay when tied to a real outcome: `Referral → Trial attended → Paid →
30 days remained → reward released`.

### 9.4 Growth Marketing Matrix

| Strategy | Customer Growth | Revenue | Cost | Viral Potential | Risk | Priority |
|---|---|---|---|---|---|---|
| Free trial | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Medium | Low | Low | 🔴 |
| Bring friend | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Low | High | Low | 🔴 |
| Direct referral | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Low | High | Low | 🔴 |
| Ambassador | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | High | Low-Med | 🔴 |
| Family plan | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Low | Medium | Low | 🔴 |
| Loyalty points | ⭐⭐⭐ | ⭐⭐⭐⭐ | Medium | Medium | Low | 🟠 |
| Corporate referral | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Low | Medium | Low | 🔴 |
| Influencer affiliate | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Variable | High | Medium | 🟠 |
| Multi-level commission | ⭐⭐⭐⭐⭐ | ? | Complex | Very high | High | 🔴 Caution |
| Paid advertising | ⭐⭐⭐⭐ | ⭐⭐⭐ | High | Low | Medium | 🟠 |

For every pricing/promotion/referral strategy capture: `Offer → Target Segment → List Price →
Discount → Acquisition Cost → Leads → Trials → Paid Customers → Conversion → Attendance →
30/90/180-day Retention → Churn → ARPU → CLV → Referral Rate → Revenue → Gross Margin →
Promotion Cost → ROI`. Optimize for *profitable long-term customers*, not raw sign-up count.

---

## 10. Influencer Marketing Strategy — Yoga Centre

System: `Find Influencer → Validate Audience → Match Segment → Design Offer → Create Content →
Track Lead → Trial → Paid Member → Retention → Revenue → ROI → Scale`

| # | Component | What to analyze/do | Yoga example | KPI |
|---|---|---|---|---|
| 1 | Objective | Define expected business outcome | 50 new members | Paid customers |
| 2 | Target customer | Define desired audience | Calgary women 25–45 | Audience match % |
| 3 | Geographic fit | Local audience concentration | Calgary/nearby | Local follower % |
| 4 | Influencer discovery | Find relevant creators | Yoga/wellness/local lifestyle | Candidates |
| 5 | Influencer classification | Nano/micro/macro | 2K–20K followers | Tier |
| 6 | Audience analysis | Who follows them? | Age/location/interests | Fit score |
| 7 | Authenticity | Check suspicious followers | Genuine engagement | Quality score |
| 8 | Engagement | Likes/comments/shares | Engagement rate | ER |
| 9 | Content quality | Evaluate videos/posts | Yoga/reels/live | Content score |
| 10 | Brand fit | Values/style alignment | Wellness/community | Fit |
| 11 | Reputation | Check history/comments | Brand safety | Risk |
| 12 | Competitor relationships | Existing yoga sponsors | Conflicts | Conflict score |
| 13 | Commercial terms | Fee/barter/commission | $X/post | Cost |
| 14 | Offer design | Give audience a reason | Free week | Lead conversion |
| 15 | Promo code | Unique attribution | e.g. NAME10 | Code conversions |
| 16 | Tracking link | Unique URL/UTM | Influencer-specific page | Clicks |
| 17 | Landing page | Dedicated conversion page | Free trial registration | CVR |
| 18 | Content plan | Reel/story/live/etc. | "First yoga class" | Engagement |
| 19 | Campaign | Execute | 30-day campaign | Reach |
| 20 | Lead tracking | Capture inquiries | CRM | Leads |
| 21 | Trial tracking | Measure trial bookings | Free-class registrations | Trials |
| 22 | Sales tracking | Paid conversion | Membership purchases | Customers |
| 23 | Retention | Customer quality | 30/90/180 days | Retention |
| 24 | Revenue | Attributed revenue | Membership revenue | Revenue |
| 25 | ROI | Revenue/profit vs spend | Campaign economics | ROI |
| 26 | Optimization | Stop/scale/change | Increase top creator | ROAS |

### 10.1 Influencer tiers (local value, not just size)

| Type | Approx. following | Best use | Local Yoga Value |
|---|---|---|---|
| Customer advocate | <1K | Authentic referrals | ⭐⭐⭐⭐⭐ |
| Nano influencer | 1K–10K | Local/community | ⭐⭐⭐⭐⭐ |
| Micro influencer | 10K–50K | Targeted reach | ⭐⭐⭐⭐⭐ |
| Mid-tier | 50K–250K | Regional awareness | ⭐⭐⭐ |
| Macro | 250K–1M | Large awareness | ⭐⭐ |
| Celebrity | 1M+ | Brand awareness | ⭐ |

Prioritize relevance + geography + trust + conversion over raw follower count for local
penetration.

### 10.2 Categories to investigate

Yoga instructors, fitness creators, wellness creators, meditation creators, local Calgary
lifestyle creators, mothers/parenting creators, senior wellness creators, corporate
wellness/HR creators, nutrition creators, physiotherapy/fitness professionals, community
leaders, student creators, family creators, local business creators. Match by product: mom
creator→kids/family; corporate professional→corporate wellness; senior wellness
creator→gentle yoga; fitness creator→yoga/flexibility; local lifestyle creator→general
awareness.

### 10.3 Scoring model

`InfluencerScore = AudienceFit + GeographicFit + Engagement + Trust + ContentQuality +
ConversionPotential − Cost − FakeAudienceRisk − BrandRisk`

| Influencer | Followers | Local % | Engagement | Audience fit | Cost | Score |
|---|---|---|---|---|---|---|
| A | 5K | 85% | 8% | 9/10 | $100 | 92 |
| B | 25K | 60% | 5% | 8/10 | $400 | 81 |
| C | 150K | 10% | 2% | 5/10 | $1,500 | 48 |

### 10.4 Compensation models

Fixed Fee (studio carries conversion risk) • Barter (free membership↔content, good for small
creators) • Affiliate (commission on purchase, better-aligned) • Hybrid (small fee + commission)
• Ambassador (ongoing membership + content + referral commission + events).

### 10.5 Influencer referral engine

Unique identifier per creator (e.g. `YOGA-ANNA`). Track: `Views → Profile Visit → Link Click →
Landing Page → Trial Registration → Trial Attendance → Paid Membership → 90-day Retention →
Revenue`. Economics example: cost $300 → 60 leads → 30 trials → 15 paid → `CAC = 300/15 = $20`;
15 × $500 CLV = $7,500 revenue. Use **contribution profit**, not gross revenue, for final ROI
decisions. Attribute separately: influencer-acquired vs customer-referral-acquired, to see
whether an influencer starts a self-sustaining network or only produces one-off sales.

### 10.6 Content strategy

Document experiences rather than "Join Soham Yoga" ads: before first class → first class
experience → instructor interaction → 7-day journey → routine change → community experience →
invitation/free trial. Formats: 15-min morning challenge, beginner challenge, couples yoga,
parent-child yoga, office stretching challenge, 30-day consistency challenge, live sessions,
behind-the-scenes, instructor Q&A, customer story. Avoid unsupported medical/therapeutic
claims.

### 10.7 Local penetration test

`20 nano influencers × 2,000 local followers` vs `1 macro influencer × 200,000 mostly
non-local followers` — the former can yield ~40,000 highly localized exposures across 20
distinct communities with reusable, measurable creator content. Test rather than assume.

### 10.8 Customer/employee influencers & B2B influencers

Identify high-satisfaction, high-attendance, socially active customers → invite into a Soham
Ambassador Program (free class / membership credit / workshop access / referral reward /
recognition) — reward genuine acquisition or agreed promotional work transparently, no hidden
endorsements. B2B "influencer" = organizational decision influence, not followers: HR Manager,
Benefits Manager, People & Culture Leader, Wellness Coordinator, Office Manager, Community
Leader.

### 10.9 Influencer Dashboard KPIs

Followers, Local audience %, Engagement %, Reach, Video completion, Link clicks, Leads,
Cost/lead, Trials, Trial attendance, Paid customers, CAC, 30/90-day retention, Revenue, CLV,
Referral customers, Contribution profit, ROI. Final ranking = retained customers and
contribution profit per marketing dollar, not follower count.

Combined growth engine: `Influencer → Awareness → Trial → Membership → Retention → Customer
Ambassador → Referral → Family/Friends → Community → More awareness → More customers → More
revenue.`

---

## 11. Market Penetration Strategy — Master Framework (30 strategies)

For an existing low-customer centre: **sell more of your existing services to the existing
geographic market** before spending heavily on new locations.

| # | Penetration strategy | What you change | Example | Primary KPI | Priority |
|---|---|---|---|---|---|
| 1 | Awareness penetration | More people discover you | Local campaigns | Reach/share of search | 🔴 |
| 2 | Geographic penetration | Target nearby communities | 3/5/10-km radius | Customers/community | 🔴 |
| 3 | Google Maps penetration | Improve local discovery | Reviews/profile/content | Maps actions | 🔴 |
| 4 | SEO penetration | Capture search demand | "Yoga near me" pages | Organic leads | 🔴 |
| 5 | Social penetration | Increase local exposure | Instagram/Facebook/YouTube | Qualified leads | 🟠 |
| 6 | Community penetration | Enter local networks | Associations/events | Community leads | 🔴 |
| 7 | Trial penetration | Reduce entry barrier | Free/$1/7-day trial | Trial registrations | 🔴 |
| 8 | Trial attendance | Get registrants to show | Reminder/WhatsApp | Show rate | 🔴 |
| 9 | Conversion penetration | Convert trials | Intro membership | Trial→paid % | 🔴 |
| 10 | Price penetration | Reduce pricing friction | Entry-level plan | Conversion | 🟠 |
| 11 | Schedule penetration | Capture more time segments | Morning/evening/weekend | Occupancy | 🔴 |
| 12 | Beginner penetration | Convert non-yogis | Beginner program | New-to-yoga customers | 🔴 |
| 13 | Family penetration | Acquire households | Family membership | Members/household | 🟠 |
| 14 | Senior penetration | Reach older customers | Gentle/chair yoga | Senior members | 🟠 |
| 15 | Professional penetration | Target workers | Before/after-work classes | Professional members | 🔴 |
| 16 | Corporate penetration | Acquire groups | Employer program | Contracts/employees | 🔴 |
| 17 | Online penetration | Expand beyond local travel | Live online classes | Digital members | 🟠 |
| 18 | Hybrid penetration | Remove attendance friction | Studio + online | Usage/member | 🟠 |
| 19 | Referral penetration | Customers acquire customers | Member-get-member | Referral conversion | 🔴 |
| 20 | Partner penetration | Borrow another audience | Schools/condos/businesses | Partner leads | 🔴 |
| 21 | Retention penetration | Keep customers longer | Engagement program | 90-day retention | 🔴 |
| 22 | Frequency penetration | Increase usage | 2→4 classes/week | Visits/member | 🟠 |
| 23 | Win-back penetration | Recover lost customers | Reactivation campaign | Reactivation % | 🔴 |
| 24 | Review penetration | Increase social proof | Review request program | Reviews/month | 🟠 |
| 25 | Loyalty penetration | Strengthen relationship | Points/milestones | Renewal % | 🟠 |
| 26 | Referral flywheel | Compound acquisition | Member→friend→member | Viral coefficient | 🔴 |
| 27 | Competitive switching | Win competitor customers | Better value/convenience | Switchers/month | 🟠 |
| 28 | Cross-sell penetration | Sell more to existing users | Yoga + meditation | ARPU | 🟠 |
| 29 | Capacity penetration | Fill empty classes | Off-peak promotion | Seat utilization | 🔴 |
| 30 | Brand penetration | Become locally recognizable | Consistent positioning | Unaided awareness | 🟠 |

### 11.1 Baseline calculation

`Market Penetration = Active Customers ÷ Addressable Customers × 100`. E.g. 100 active /
20,000 addressable = 0.5%. Set measurable targets: 0.5%→1%→2%→3%→5%.

### 11.2 Geographic penetration table

| Area | Target population | Existing customers | Penetration | Competitors | Opportunity |
|---|---|---|---|---|---|
| A | 5,000 | 100 | 2.0% | 3 | Medium |
| B | 8,000 | 40 | 0.5% | 1 | High |
| C | 12,000 | 25 | 0.21% | 2 | Very high |
| D | 6,000 | 150 | 2.5% | 5 | Low |

### 11.3 Segment penetration

Break down by age (kids through 65+) and customer type (beginners, experienced, professionals,
families, seniors, students, corporate). Example: overall 0.5% while women 35–50 = 2.8%, men
35–50 = 0.15%, seniors = 0.1%, corporate = 0.02% — reveals specific growth targets.

### 11.4 Funnel penetration (often more actionable than population penetration)

`Market population → (Awareness %) → Aware → (Interest %) → Interested → (Lead %) → Lead →
(Trial %) → Trial → (Attendance %) → Attended → (Paid conversion %) → Paid → (90-day
retention %) → Retained → (Referral %) → Advocates`

| Funnel | Current | Target |
|---|---|---|
| Awareness | 10% | 25% |
| Lead conversion | 3% | 6% |
| Trial booking | 30% | 50% |
| Trial attendance | 60% | 80% |
| Trial→Paid | 25% | 45% |
| 90-day retention | 55% | 75% |
| Referral | 10% | 25% |

Small improvements compound across the whole funnel — often more effective than 10× more ad
spend.

### 11.5 Competitor / price / schedule / referral / partnership / corporate / win-back / share-of-wallet penetration

- **Competitor**: map competitor strength → your response (better schedule→add evening/weekend; better booking→one-click; better reviews→review-generation program; premium facility→compete on community/value instead; expensive→compete on value; cheap→differentiate, don't necessarily undercut).
- **Price**: test intro offers ($1 first week / $19 first month → regular price), measure `Incremental Profit = New Customer CLV − CAC − Promotion Cost`.
- **Schedule**: test 6AM/7AM/9AM/12PM/4PM/6PM/7PM/8PM × weekday/weekend; `Class Utilization = Attendees ÷ Available Spaces × 100`; full classes→add capacity, low-demand→reposition, demand-but-no-class→penetration opportunity.
- **Referral**: `Referral Penetration = Customers Making Referrals ÷ Active Customers`; `Referral Conversion = Paid Referral Customers ÷ Referral Leads`.
- **Partnership (B2B2C)**: condo/community associations, schools, companies, senior organizations, hotels, community centres, physiotherapy/wellness partners — one relationship can reach hundreds.
- **Corporate funnel**: 100 target companies → 50 contacts → 25 conversations → 10 demos → 5 proposals → 3 contracts → 300 employees exposed → 100 regular participants — 3 B2B customers can generate 100 end users.
- **Win-back**: segment Trial-never-paid / Cancelled <3mo / Inactive 30/60/90+ days / Former loyal — ask why they stopped; solve the actual reason ("we changed the evening schedule you asked for") rather than just discounting.
- **Share-of-wallet**: `ARPU = Total Revenue ÷ Active Customers`; grow via meditation/workshop/family/private/online add-ons rather than only adding new customers.

### 11.6 Penetration Growth Engine

`Local Awareness → Low-friction Trial → Great First Experience → Paid Membership → Frequent
Attendance → Habit → Retention → Community → Referral → Friends/Family → New Customers →
Corporate/Partnership Exposure → More Awareness → (repeat)`

### 11.7 Market Penetration Dashboard

Track weekly/monthly: Addressable market, Active customers, Penetration %, New leads, Trials,
Trial attendance %, Trial→Paid %, New members, CAC, Class utilization, 90-day retention,
Churn, Referrals, Referral conversion, Reactivated customers, ARPU, CLV, Monthly revenue, MRR
growth, Corporate contracts — each with Current / Target / Gap / Trend / Action.

Sequence: `Research → Diagnose → Segment → Penetrate → Retain → Refer → Cross-sell → B2B →
Expand → Disrupt`.

---

## 12. Market Disruption Strategy Matrix (30 strategies)

Not "lower the fee" — change the value proposition, accessibility, delivery model, customer
experience, or economics enough that customers have a compelling reason to switch or start.

`Current market → Find friction → Find underserved customer → Remove friction → Create
dramatically better value → Test → Scale → Build defensibility`

| # | Disruption strategy | Current market problem | Disruptive move | Revenue model | Potential |
|---|---|---|---|---|---|
| 1 | Price disruption | Yoga perceived expensive | Affordable membership | Subscription | ⭐⭐⭐⭐ |
| 2 | Free-entry model | Customer uncertain | Free introductory period | Free → paid | ⭐⭐⭐⭐⭐ |
| 3 | Micro-pricing | Monthly commitment | $1/$5 trial or low-cost session | Usage | ⭐⭐⭐⭐ |
| 4 | Unlimited model | Pay/class expensive | Unlimited classes | Subscription | ⭐⭐⭐⭐⭐ |
| 5 | Family membership | Individual pricing | One household plan | Family subscription | ⭐⭐⭐⭐⭐ |
| 6 | Online-first | Geography limits customers | Live digital classes | Subscription | ⭐⭐⭐⭐⭐ |
| 7 | Hybrid | Online/offline trade-off | One membership for both | Subscription | ⭐⭐⭐⭐⭐ |
| 8 | 24/7 digital yoga | Fixed schedule | Recorded/on-demand library | Digital subscription | ⭐⭐⭐⭐ |
| 9 | Micro classes | People lack an hour | 10/15/20-minute sessions | Subscription | ⭐⭐⭐⭐⭐ |
| 10 | 6 AM positioning | Before-work gap | Daily early morning | Membership | ⭐⭐⭐⭐ |
| 11 | Lunch yoga | Office-worker gap | 20–30 min lunchtime | B2B/B2C | ⭐⭐⭐⭐ |
| 12 | Late evening | Working customers excluded | 8/9 PM sessions | Membership | ⭐⭐⭐⭐ |
| 13 | Beginner-first | Newcomers intimidated | Zero-experience program | Membership | ⭐⭐⭐⭐⭐ |
| 14 | Senior-first | Mainstream classes unsuitable | Gentle/chair yoga | Subscription | ⭐⭐⭐⭐⭐ |
| 15 | Kids ecosystem | Few structured programs | Kids yoga + mindfulness | Family/subscription | ⭐⭐⭐⭐ |
| 16 | Corporate yoga | Companies need wellness | Workplace programs | B2B contracts | ⭐⭐⭐⭐⭐ |
| 17 | Community model | Yoga transactional | Community + social events | Membership | ⭐⭐⭐⭐ |
| 18 | Outcome-based programs | Generic yoga | Goal-oriented programs | Premium programs | ⭐⭐⭐⭐⭐ |
| 19 | Yoga + meditation | Fragmented wellness | Integrated membership | Subscription | ⭐⭐⭐⭐⭐ |
| 20 | Yoga + spa/recovery | Services fragmented | Wellness ecosystem | Premium membership | ⭐⭐⭐⭐⭐ |
| 21 | Personalization | Same class for everyone | Personalized pathways | Premium | ⭐⭐⭐⭐⭐ |
| 22 | AI personalization | Instructor can't personalize at scale | AI-supported recommendations | Premium/digital | ⭐⭐⭐⭐ |
| 23 | Gamification | Poor consistency | Streaks/badges/challenges | Retention-driven | ⭐⭐⭐⭐ |
| 24 | Referral flywheel | High CAC | Member→member growth | Referral | ⭐⭐⭐⭐⭐ |
| 25 | Ambassador model | Weak advocacy | Reward direct referrals | Acquisition | ⭐⭐⭐⭐ |
| 26 | Multilingual | Language accessibility | Multiple language classes | Segment membership | ⭐⭐⭐⭐ |
| 27 | Mobile yoga | Customer must travel | Instructor goes to customer | Premium/B2B | ⭐⭐⭐ |
| 28 | Pop-up yoga | Lease/capital cost | Parks/offices/community halls | Low-asset | ⭐⭐⭐⭐ |
| 29 | Partnership model | Expensive acquisition | Schools/condos/employers/hotels | B2B2C | ⭐⭐⭐⭐⭐ |
| 30 | Platform model | One instructor limits scale | Instructor marketplace | Commission | ⭐⭐⭐⭐⭐ |

Key notes:

- **Don't lead with price alone** — combine lower price with convenience/differentiation/community/personalization (value disruption, not discounting).
- **Convenience disruption** may beat price disruption: offer 15/30/45/60-min options at 6AM/noon/6PM/8PM/on-demand — "yoga that fits your life" instead of the reverse.
- **Beginner disruption**: convert non-consumers (never tried, feel unfit, intimidated) via a structured zero-experience 8-week onboarding rather than fighting competitors for existing yogis.
- **Family disruption**: change the buying unit from individual to household (Family Wellness Membership).
- **Corporate disruption**: one employer contract can represent dozens/hundreds of end users.
- **Outcome disruption**: sell defined programs (e.g. "8-Week Beginner Confidence Program") not "60-minute class." Avoid medical/cure claims.
- **Business-model / asset-light disruption**: extend beyond one studio via online, corporate offices, condos, schools, parks, hotels — partnership-based distribution instead of pure CAPEX expansion.
- **Referral disruption**: build the customer flywheel (see §9.3), not MLM.
- **AI / data disruption**: onboarding → goals/experience/preferred time → AI recommendation → schedule reminder → personalized progression → churn-risk detection → next-best offer; and a Customer 360 (website+Google+social+CRM+booking+attendance+payment+survey+reviews) feeding lead score, conversion score, churn risk, CLV, next-best service, price response, referral likelihood.

### 12.1 Blue Ocean / White-Space matrix (illustrative — replace with real research)

| Customer Need | Demand | Competitor supply | Gap | Ability to deliver | Revenue | Disruption score |
|---|---|---|---|---|---|---|
| Generic yoga | High | Very high | Low | High | Medium | 45 |
| Beginners | High | Medium | High | High | High | 85 |
| 6 AM online | High | Low | High | High | High | 90 |
| Seniors | Medium-high | Low | High | High | High | 88 |
| Family | Medium-high | Low | High | High | High | 86 |
| Corporate | High | Medium | High | Medium | Very high | 91 |
| Micro-classes | High | Low | Very high | High | High | 93 |

### 12.2 ERRC framework

- **Eliminate**: long contracts, complex packages, registration friction
- **Reduce**: price, travel, class duration, commitment
- **Raise**: convenience, beginner support, community, availability, personalization
- **Create**: micro-yoga, family ecosystem, corporate subscription, hybrid membership, personalized digital journey

### 12.3 Disruption scoring

`DS = Demand × Differentiation × Scalability × Retention × Margin`, adjusted down for
`Competition + Cost + Complexity + Regulatory Risk`. Bands: 90–100 potential disruptive bet |
75–89 strong growth experiment | 60–74 incremental innovation | <60 low priority.

Recommended approach: build a **portfolio**, not one big bet — Acquisition disruption +
Product disruption + Pricing disruption + Convenience disruption + Retention disruption +
Distribution disruption + B2B disruption + Digital disruption. End-state flywheel:
`Non-customer → Low-friction trial → Personalized beginner experience → Membership → Habit →
Community → Retention → Cross-sell → Referral → New customer → Corporate/Family expansion →
recurring revenue.`

---

## 13. Top-Tier Growth Strategy Architecture (65 strategies)

For a low-customer centre, the missing question isn't "what other marketing can we do" — it's
*where exactly is growth constrained*: awareness, trust, product-market fit, conversion,
retention, capacity, monetization, distribution, or economics?

| # | Strategy | Core question | Example | Primary KPI | Priority |
|---|---|---|---|---|---|
| 1 | Market Penetration | How do we capture more existing demand? | Local campaigns | Market share | 🔴 |
| 2 | Competitive Strategy | Why choose us? | Better convenience/value | Win rate | 🔴 |
| 3 | Differentiation | What can customers get only here? | Beginner-first yoga | Preference | 🔴 |
| 4 | Positioning | What should the brand stand for? | Everyday accessible yoga | Brand recall | 🔴 |
| 5 | Pricing | What should customers pay? | Tiered membership | ARPU | 🔴 |
| 6 | Promotion | What triggers first purchase? | Intro offer | Conversion | 🔴 |
| 7 | Referral | Can customers acquire customers? | Member-get-member | Referral rate | 🔴 |
| 8 | Influencer | Who already has audience trust? | Local nano creators | Influencer CAC | 🟠 |
| 9 | Disruption | Can we change market rules? | Micro/hybrid classes | New demand | 🟠 |
| 10 | Product-Market Fit | Are we solving a real need? | Schedule/product survey | PMF score | 🔴 |
| 11 | Non-Customer Strategy | Why aren't people practicing yoga? | Beginner anxiety | New-to-yoga % | 🔴 |
| 12 | Segmentation | Which customers matter most? | Professional/senior/family | Segment CLV | 🔴 |
| 13 | Micro-Segmentation | Which combinations perform? | Women 35–50 + 6AM + online | Conversion | 🟠 |
| 14 | Jobs-to-be-Done | What are customers really hiring yoga for? | Routine/relaxation/community | Need fit | 🔴 |
| 15 | Customer Journey | Where does friction occur? | Search→trial→payment | Drop-off | 🔴 |
| 16 | CRO | How do we convert more existing traffic? | Simplify booking | CVR | 🔴 |
| 17 | Onboarding | What happens in first 30 days? | Beginner pathway | 30-day retention | 🔴 |
| 18 | Activation | What behavior predicts staying? | 3 classes first 10 days | Activation % | 🔴 |
| 19 | Habit Formation | How do we make attendance routine? | Streak/calendar | Frequency | 🔴 |
| 20 | Retention | Why do members stay? | Engagement program | Retention | 🔴 |
| 21 | Churn Prevention | Who is about to leave? | Attendance decline alerts | Churn | 🔴 |
| 22 | Win-Back | Can old customers return? | Personalized reactivation | Reactivation % | 🔴 |
| 23 | Loyalty | How do we deepen relationships? | Milestones/rewards | Renewal | 🟠 |
| 24 | Community | Can customers form social bonds? | Events/challenges | Engagement | 🔴 |
| 25 | Social Proof | How do we reduce trust barriers? | Reviews/testimonials | Trial CVR | 🔴 |
| 26 | Reputation | What does the market think? | Review management | Rating/sentiment | 🔴 |
| 27 | Local SEO | Can high-intent customers find us? | Google Business Profile | Local leads | 🔴 |
| 28 | Content Strategy | Can education create demand? | Beginner videos | Organic leads | 🟠 |
| 29 | Video Strategy | Can customers experience before buying? | Short class samples | Video→trial | 🟠 |
| 30 | Search Strategy | Capture existing intent | Search campaigns | Search CAC | 🔴 |
| 31 | Paid Acquisition | Can we buy profitable customers? | Google/Meta ads | CAC/CLV | 🟠 |
| 32 | Remarketing | Convert interested non-buyers | Retarget visitors | ROAS | 🟠 |
| 33 | Lifecycle Marketing | Communicate by customer stage | Email/SMS/WhatsApp | Conversion | 🔴 |
| 34 | Partnership Strategy | Who already owns our audience? | Condos/schools | Partner customers | 🔴 |
| 35 | B2B2C | Reach groups through organizations | Employer→employees | Users/partner | 🔴 |
| 36 | Corporate Wellness | Can companies pay? | Employee yoga | Contract value | 🔴 |
| 37 | Channel Strategy | Where should services be distributed? | Studio+online+office | Channel revenue | 🔴 |
| 38 | Asset-Light Growth | Grow without another lease | Pop-ups/community halls | ROIC | 🟠 |
| 39 | Geographic Expansion | Where next? | Adjacent communities | Location ROI | 🟡 |
| 40 | Product Expansion | What else can existing users buy? | Meditation | New-product revenue | 🟠 |
| 41 | Cross-Sell | Increase products/customer | Yoga→meditation | Products/customer | 🔴 |
| 42 | Upsell | Move customers upward | Group→private | ARPU | 🟠 |
| 43 | Bundling | Increase perceived value | Yoga+meditation | Bundle uptake | 🟠 |
| 44 | Family/Household | Acquire multiple users together | Family membership | Household ARPU | 🔴 |
| 45 | Subscription Strategy | Build predictable revenue | Monthly/annual | MRR/ARR | 🔴 |
| 46 | Annual Prepay | Improve cash flow/retention | Pay 10/get 12 | Annual conversion | 🟠 |
| 47 | Capacity/Yield Management | Monetize empty seats | Off-peak offers | Utilization | 🔴 |
| 48 | Unit Economics | Is each customer profitable? | CLV:CAC | Contribution | 🔴 |
| 49 | Revenue Management | Optimize revenue/class | Schedule/price/capacity | Rev/class | 🔴 |
| 50 | Experimentation | What actually works? | A/B tests | Incremental lift | 🔴 |
| 51 | Growth Analytics | Why are KPIs moving? | Cohort/funnel analysis | Growth rate | 🔴 |
| 52 | Attribution | Which channel caused purchase? | UTM/referral codes | CAC/channel | 🔴 |
| 53 | Cohort Analysis | Which customer groups survive? | Jan vs Feb members | Cohort retention | 🔴 |
| 54 | Voice of Customer | What are customers telling us? | Surveys/interviews | Pain themes | 🔴 |
| 55 | Sentiment Analysis | What is hidden in reviews/comments? | NLP analysis | Sentiment | 🟠 |
| 56 | Forecasting | What will happen next? | Customer/revenue forecast | Forecast accuracy | 🔴 |
| 57 | AI Personalization | Can experience differ per customer? | Next-best class | Engagement | 🟠 |
| 58 | Churn Prediction | Can we intervene before loss? | Risk score | Saved customers | 🟠 |
| 59 | Recommendation Engine | What should each customer do next? | Class recommendation | Conversion | 🟡 |
| 60 | Automation | What repetitive work can disappear? | Lead follow-up | Response time | 🔴 |
| 61 | Blue Ocean | Where is competition irrelevant? | Underserved niche | New-market revenue | 🟠 |
| 62 | Network Effects | Does each customer create more value/users? | Community/referral | Viral coefficient | 🟡 |
| 63 | Platform Strategy | Can multiple instructors/services scale? | Wellness marketplace | GMV | 🟡 |
| 64 | Ecosystem Strategy | Can yoga become an entry point? | Yoga→wellness ecosystem | Ecosystem CLV | 🟡 |
| 65 | Strategic Moat | Why can't competitors easily copy you? | Community/data/brand | Defensibility | 🔴 |

### 13.1 The eight strategies most often missing

1. **Non-customer strategy** — the bigger opportunity is often people doing *no* yoga at all; ask why not (cost/time/flexibility/intimidation/schedule/preference/belief) and remove those specific barriers instead of only fighting competitors for existing yogis.
2. **Activation strategy** — identify the early behavior that predicts long-term retention (e.g. ≥3 sessions in first 14 days) and optimize onboarding toward that behavior, not just toward "sell membership."
3. **Cohort strategy** — compare monthly cohorts and acquisition channels (referral vs Google Ads vs influencer vs corporate vs organic) by 30/90/180-day retention; a channel with fewer but stickier customers can beat one with more but leakier ones.
4. **Customer profitability segmentation** — classify by CLV×CAC quadrant (High CLV/Low CAC = ⭐⭐⭐⭐⭐ down to Low CLV/High CAC = 🔴) and allocate marketing dollars accordingly.
5. **Capacity/yield strategy** — unused mats are perishable inventory (e.g. 6AM 95% full vs 10AM 20% vs 4PM 10%); monetize off-peak via senior/parent daytime programs, corporate remote sessions, private training, community partnerships.
6. **Revenue architecture** — build multiple engines (membership + drop-in + private + family + kids + senior + corporate + online + workshops + events + retreats + partnerships) instead of depending on one customer type.
7. **Distribution strategy** — reverse distribution so yoga goes to the customer (online, corporate office, condo, community centre, school, hotel, park, events) instead of requiring travel to one studio.
8. **Strategic moat** — price isn't a moat (copyable tomorrow); durable moats are brand, community, customer relationships, instructor network, corporate contracts, partner network, content library, customer data, personalization, referral network, operational excellence.

### 13.2 Top-1% Growth Architecture — 10 engines

1. **Market Intelligence Engine** — Population → demand → competitors → emerging opportunities. *Where should we compete?*
2. **Acquisition Engine** — SEO → Google → social → influencers → partnerships → referrals. *How do we acquire customers efficiently?*
3. **Conversion Engine** — Lead → trial → attendance → paid. *Where are prospects disappearing?*
4. **Activation Engine** — Paid → first 3/5 sessions → habit. *How do we keep the customer?*
5. **Retention Engine** — Engagement → attendance monitoring → churn prevention → renewal.
6. **Referral Engine** — Happy member → advocate → referral → new member. *Direct-referral/ambassador based, not multi-level.*
7. **Monetization Engine** — Pricing → subscription → cross-sell → upsell → ARPU. *How do we increase revenue per customer?*
8. **B2B Engine** — Companies → HR → pilot → contract → employees → renewal. *One relationship, hundreds of users.*
9. **Intelligence Engine** — Customer 360 → segmentation → forecasting → AI → next-best-action.
10. **Experimentation Engine** — Hypothesis → A/B test → measure incremental lift → scale winner → stop loser.

**Growth Control Tower** above all 10 (North-star: Active paying members, MRR/ARR, 90-day
retention, Contribution margin), supported by: Leads → CAC → Trials → Conversion → Activation
→ Attendance → Churn → ARPU → CLV → Referral → NPS → Utilization → Revenue/Class → Marketing
ROI.

Core shift: **optimize the entire customer economic system, not "marketing."** Excellent
marketing can still fail against poor product-market fit, weak onboarding, low retention,
wrong schedule, empty capacity, or bad unit economics — a top-tier growth strategy diagnoses
and improves all of them simultaneously.

---

## 14. FINAL Master Yoga Centre Growth Framework (200 components, consolidated)

The definitive, consolidated framework — treat as a **business growth operating system**, not
a marketing plan. Organized into categories A–V.

| # | Component / Strategy | Core question | What you analyze / do | Primary KPI |
|---|---|---|---|---|
| **A** | **MARKET INTELLIGENCE** | | | |
| 1 | Market Definition | What market are we actually in? | Yoga/wellness/meditation/fitness | Market boundary |
| 2 | Market Size | How large is it? | Customers + market value | $ market |
| 3 | TAM | Total possible market? | Total eligible population | TAM |
| 4 | SAM | What can we serve? | Geography/service/channel | SAM |
| 5 | SOM | What can we realistically win? | Reach × conversion | SOM |
| 6 | Population Analysis | Who lives in market? | Population/households | Population |
| 7 | Demographics | Who could buy? | Age, household, income etc. | Segment size |
| 8 | Geographic Analysis | Where are customers? | Community/postal area | Heat map |
| 9 | Market Growth | Is market expanding? | Historical/projected growth | CAGR |
| 10 | Demand Analysis | What do people want? | Survey/search/actual behavior | Demand index |
| 11 | Supply Analysis | What is available? | Studios/classes/instructors | Supply index |
| 12 | Demand-Supply Gap | Where is unmet demand? | Demand minus supply | Gap score |
| 13 | Trend Analysis | What is changing? | Wellness/online/hybrid trends | Trend score |
| 14 | Emerging Opportunities | What's coming next? | New products/behaviors | Opportunity score |
| 15 | Market Forecast | Where will market go? | 1/3/5-year forecast | Forecast |
| **B** | **CUSTOMER INTELLIGENCE** | | | |
| 16 | Customer Segmentation | Who are our customers? | Age/need/value/behavior | Segment |
| 17 | Micro-Segmentation | Which precise groups work? | Age × location × time × service | Conversion |
| 18 | Psychographics | Why do they buy? | Attitudes/lifestyle | Persona |
| 19 | Jobs-to-be-Done | What are they actually buying? | Routine/community/flexibility | Need fit |
| 20 | Customer Needs | What do they want? | Survey/interviews | Need score |
| 21 | Pain Points | What's stopping them? | Cost/time/confidence/etc. | Barrier score |
| 22 | Non-Customer Research | Why don't people practice? | Non-user interviews | New market |
| 23 | Voice of Customer | What are people telling us? | Survey/interview/reviews | VOC |
| 24 | Sentiment | How do customers feel? | Reviews/comments | Sentiment |
| 25 | Customer 360 | What do we know per customer? | CRM+booking+payment+attendance | 360 profile |
| **C** | **COMPETITIVE INTELLIGENCE** | | | |
| 26 | Competitor Discovery | Who competes with us? | 20–50 competitors | Competitor DB |
| 27 | Direct Competitors | Same service/market | Yoga studios | Threat |
| 28 | Indirect Competitors | Alternative solutions | Gyms/Pilates | Threat |
| 29 | Digital Competitors | Online substitutes | Apps/YouTube | Threat |
| 30 | Product Comparison | What do they offer? | Service matrix | Product gap |
| 31 | Price Comparison | What do they charge? | Drop-in/membership | Price index |
| 32 | Schedule Comparison | When do they operate? | Morning/evening/weekend | Schedule gap |
| 33 | Location Comparison | Where are they? | Distance/catchment | Geographic gap |
| 34 | Review Analysis | Why do customers like/hate them? | Review themes | Opportunity |
| 35 | Digital Comparison | How strong online? | SEO/social/booking | Digital score |
| 36 | SWOT | Where do we stand? | S/W/O/T | Strategic position |
| 37 | White-Space Analysis | What isn't being served? | Customer need vs supply | White space |
| 38 | Competitive Switching | Why would someone switch? | Switching triggers | Win rate |
| **D** | **PRODUCT & SERVICE STRATEGY** | | | |
| 39 | Product-Market Fit | Are we offering what customers want? | Demand vs offering | PMF |
| 40 | General Yoga | Core offering | Demand/utilization | Revenue |
| 41 | Beginner Yoga | Convert non-users | Structured program | Conversion |
| 42 | Kids Yoga | Family expansion | Parent demand | Customers |
| 43 | Family Yoga | Household acquisition | Family membership | Household ARPU |
| 44 | Senior Yoga | Older market | Gentle/chair | Senior members |
| 45 | Meditation | Adjacent product | Customer demand | Cross-sell |
| 46 | Pranayama | Adjacent product | Demand | Revenue |
| 47 | Private Yoga | Premium segment | 1:1 | Margin |
| 48 | Corporate Yoga | B2B product | Employer demand | Contracts |
| 49 | Online Yoga | Remove geography | Live classes | Digital members |
| 50 | Hybrid Yoga | Studio + online | Flexibility | Retention |
| 51 | Micro Classes | Time-poor users | 15/20/30 min | Usage |
| 52 | Workshops | Premium/education | Special events | Event revenue |
| 53 | Retreats | Premium experience | Weekend programs | Premium revenue |
| 54 | Wellness Expansion | Adjacent categories | Spa/recovery etc. | New revenue |
| **E** | **PRICING STRATEGY** | | | |
| 55 | Competitor Pricing | Market benchmark | Min/avg/max | Price index |
| 56 | Cost-Based Pricing | Minimum viable price? | Cost + margin | Margin |
| 57 | Value Pricing | What is value worth? | Willingness-to-pay | WTP |
| 58 | Penetration Pricing | Lower entry barrier | Intro price | Acquisition |
| 59 | Premium Pricing | High-value customers | Premium packages | ARPU |
| 60 | Tiered Pricing | Different budgets | Basic/Plus/Premium | Tier mix |
| 61 | Drop-in Pricing | Pay per visit | Single class | Revenue |
| 62 | Subscription | Recurring revenue | Monthly | MRR |
| 63 | Annual Membership | Retention/cash flow | Annual prepaid | ARR |
| 64 | Family Pricing | Household economics | Family package | ARPU |
| 65 | Corporate Pricing | B2B contracts | Company packages | ACV |
| 66 | Dynamic/Off-Peak | Fill empty capacity | Daytime discount | Utilization |
| **F** | **PROMOTION STRATEGY** | | | |
| 67 | Free Trial | Remove first barrier | 1 class/week/etc. | Trial→paid |
| 68 | $1 Trial | Commitment test | Intro session | Conversion |
| 69 | Intro Offer | Encourage first purchase | First-month offer | Conversion |
| 70 | Seasonal Campaign | Exploit demand periods | New Year etc. | Revenue |
| 71 | Family Promotion | Acquire household | Family trial | Household acquisition |
| 72 | Corporate Trial | B2B acquisition | Workplace demo | Contract conversion |
| 73 | Reactivation Offer | Recover lost users | Come-back campaign | Win-back |
| 74 | Challenge Marketing | Build habit | 21/30-day challenge | Retention |
| **G** | **CUSTOMER ACQUISITION** | | | |
| 75 | Local SEO | Be discoverable | Local search | Organic leads |
| 76 | Google Maps | Capture "near me" | Profile/reviews | Map actions |
| 77 | Google Ads | Capture intent | Search campaigns | CAC |
| 78 | Meta Ads | Create awareness | FB/Instagram | CAC |
| 79 | Social Media | Build community | Content | Leads |
| 80 | Video Marketing | Demonstrate experience | Reels/YouTube | Video→trial |
| 81 | Content Marketing | Educate market | Blogs/videos | Organic leads |
| 82 | Email | Lifecycle communication | Campaigns | Conversion |
| 83 | SMS/WhatsApp | Fast engagement | Reminders/offers | Response |
| 84 | Remarketing | Recover interested users | Retargeting | ROAS |
| **H** | **INFLUENCER STRATEGY** | | | |
| 85 | Nano Influencers | Local trust | 1K–10K audience | CAC |
| 86 | Micro Influencers | Larger targeted audience | 10K–50K | CAC |
| 87 | Local Lifestyle | Geographic reach | Calgary/local creators | Leads |
| 88 | Wellness Influencers | Relevant audience | Wellness content | Conversion |
| 89 | Parent Influencers | Family products | Kids/family | Customers |
| 90 | Corporate Influencers | B2B access | HR/wellness leaders | Contracts |
| 91 | Influencer Affiliate | Pay for results | Unique code | CPA |
| 92 | Ambassador | Long-term creator | Monthly relationship | CLV |
| **I** | **REFERRAL & NETWORK GROWTH** | | | |
| 93 | Member Referral | Member brings member | Direct reward | Referral % |
| 94 | Bring-a-Friend | Reduce referral friction | Guest class | Conversion |
| 95 | Ambassador Referral | Strong advocates | Reward program | Customers |
| 96 | Referral Chain | Each customer refers directly | A→B→C→D | Viral coefficient |
| 97 | Loyalty Referral | Reward advocates | Points/credits | Referral CLV |
| 98 | Partner Referral | Businesses refer users | Cross-referrals | Leads |
| **J** | **PARTNERSHIP & DISTRIBUTION** | | | |
| 99 | Community Partnerships | Access communities | Associations | Leads |
| 100 | Condo Partnerships | Reach residents | Condo sessions | Customers |
| 101 | School Partnerships | Families/kids | Programs | Contracts |
| 102 | Corporate Partnerships | Employees | Workplace wellness | Contracts |
| 103 | Hotel Partnerships | Travelers | Guest yoga | Revenue |
| 104 | Wellness Partnerships | Complementary businesses | Cross-referrals | Customers |
| 105 | Pop-Up Strategy | Test markets cheaply | Parks/community halls | CAC |
| 106 | B2B2C | Partner owns audience | Company→employees | Users/partner |
| **K** | **CONVERSION STRATEGY** | | | |
| 107 | Lead Management | Are leads followed up? | CRM | Lead→trial |
| 108 | Booking Optimization | Remove friction | Simple booking | CVR |
| 109 | Trial Attendance | Ensure show-up | Reminders | Show rate |
| 110 | Trial→Paid | Convert experience | Follow-up/offer | Conversion |
| 111 | CRO | Optimize pages/process | A/B tests | CVR |
| 112 | Social Proof | Reduce uncertainty | Testimonials | Conversion |
| 113 | Trust Strategy | Build confidence | Credentials/transparency | Trust |
| **L** | **ACTIVATION & ONBOARDING** | | | |
| 114 | New Member Onboarding | First experience | Orientation | Activation |
| 115 | First-7-Day Strategy | Build momentum | Early attendance | 7-day activation |
| 116 | First-30-Day Strategy | Build habit | Structured journey | 30-day retention |
| 117 | Beginner Pathway | Reduce intimidation | Levels | Completion |
| 118 | Habit Formation | Make yoga routine | Streaks/reminders | Frequency |
| **M** | **RETENTION & LOYALTY** | | | |
| 119 | Retention Strategy | Keep members | Engagement | Retention |
| 120 | Churn Analysis | Why leave? | Cancellation reasons | Churn |
| 121 | Churn Prediction | Who may leave? | Attendance decline | Risk score |
| 122 | Intervention | Save at-risk members | Personalized outreach | Saved customers |
| 123 | Win-Back | Recover lost users | Campaign | Reactivation |
| 124 | Loyalty | Reward long-term behavior | Milestones | Renewal |
| 125 | Community Building | Increase belonging | Events/groups | Engagement |
| 126 | NPS | Advocacy | Survey | NPS |
| 127 | CSAT | Satisfaction | Feedback | CSAT |
| **N** | **MARKET PENETRATION** | | | |
| 128 | Geographic Penetration | Capture local areas | Community campaigns | Share |
| 129 | Segment Penetration | Capture underserved group | Seniors/families | Segment share |
| 130 | Schedule Penetration | Capture new time slots | Evening/weekend | Utilization |
| 131 | Competitor Penetration | Win switchers | Switching offer | Win rate |
| 132 | Digital Penetration | Expand online | Digital membership | Subscribers |
| 133 | Household Penetration | Multiple family members | Family plan | Members/household |
| 134 | Corporate Penetration | Organizations | Company contracts | Employees |
| 135 | Share-of-Wallet | More spend/member | Cross-sell | ARPU |
| **O** | **MARKET DISRUPTION** | | | |
| 136 | Price Disruption | Change economics | Affordable membership | Acquisition |
| 137 | Convenience Disruption | Save time | Micro/online | Adoption |
| 138 | Beginner Disruption | Create new consumers | Zero-experience yoga | New customers |
| 139 | Family Disruption | Change buying unit | Household membership | ARPU |
| 140 | Digital Disruption | Remove geography | Online platform | Scale |
| 141 | Outcome Disruption | Sell outcomes/programs | 30-day consistency | Completion |
| 142 | Asset-Light Disruption | Reduce capital | Partnerships/popups | ROIC |
| 143 | AI Disruption | Personalize at scale | Recommendations | Engagement |
| 144 | Data Disruption | Decisions from evidence | Customer 360 | ROI |
| **P** | **REVENUE GROWTH** | | | |
| 145 | Subscription Revenue | Predictability | Monthly membership | MRR |
| 146 | Cross-Sell | More products/customer | Meditation | ARPU |
| 147 | Upsell | Higher-value package | Private yoga | ARPU |
| 148 | Bundling | Increase perceived value | Yoga+meditation | Bundle sales |
| 149 | Corporate Revenue | B2B | Contracts | ACV |
| 150 | Digital Revenue | Online | Subscription | Digital MRR |
| 151 | Workshop Revenue | Events | Workshops | Revenue |
| 152 | Family Revenue | Household | Family plans | Household LTV |
| 153 | Revenue Per Customer | Monetization | Total rev/customers | ARPU |
| 154 | Revenue Per Class | Class economics | Revenue/session | RPC |
| **Q** | **UNIT ECONOMICS** | | | |
| 155 | CAC | Cost to acquire | Marketing/new customers | CAC |
| 156 | CLV | Customer value | Margin over lifetime | CLV |
| 157 | CLV:CAC | Growth sustainability | CLV ÷ CAC | Ratio |
| 158 | Contribution Margin | True customer economics | Revenue-variable cost | Margin |
| 159 | Break-even | Minimum customers | Fixed costs/contribution | Members |
| 160 | Payback Period | Recover CAC when? | CAC/contribution | Months |
| 161 | Capacity Utilization | Use available mats | Occupied/capacity | % |
| 162 | Revenue Leakage | Where money is lost | Empty seats/churn | $ leakage |
| **R** | **GROWTH ANALYTICS** | | | |
| 163 | Funnel Analysis | Where do users drop? | Awareness→paid | Conversion |
| 164 | Cohort Analysis | Which groups stay? | Monthly cohorts | Retention |
| 165 | Channel Analysis | Which acquisition works? | Google/referral/etc. | CAC/channel |
| 166 | Attribution | Who caused sale? | UTM/codes | Revenue/channel |
| 167 | Customer Profitability | Which customers create value? | CLV-CAC | Profit |
| 168 | Service Profitability | Which service wins? | Revenue-cost | Margin |
| 169 | Instructor Analysis | Who drives engagement? | Attendance/retention | Performance |
| 170 | Schedule Analysis | Which slots work? | Utilization | Occupancy |
| **S** | **FORECASTING** | | | |
| 171 | Customer Forecast | Future memberships | 12/36/60 months | Members |
| 172 | Revenue Forecast | Future revenue | Scenario model | Revenue |
| 173 | Churn Forecast | Expected losses | Cohort model | Churn |
| 174 | Demand Forecast | Future service demand | Trends/history | Demand |
| 175 | Capacity Forecast | When capacity runs out | Attendance | Capacity |
| 176 | Scenario Analysis | What if? | Worst/base/best | Range |
| 177 | Sensitivity Analysis | Which assumption matters? | Price/CAC/churn | Sensitivity |
| **T** | **EXPERIMENTATION** | | | |
| 178 | Hypothesis | What do we believe? | Evening class improves conversion | Hypothesis |
| 179 | A/B Testing | Which works better? | $49 vs $59 | Lift |
| 180 | Pricing Test | Test WTP | Multiple prices | Conversion |
| 181 | Offer Test | Trial formats | Free vs $1 | CAC |
| 182 | Schedule Test | Time preferences | 6AM vs 7AM | Attendance |
| 183 | Channel Test | Marketing efficiency | Google vs Meta | CAC |
| 184 | Service Pilot | Validate before scale | Senior program | PMF |
| **U** | **AI & AUTOMATION** | | | |
| 185 | Lead Scoring | Who will convert? | AI score | Conversion |
| 186 | Churn Prediction | Who will leave? | ML risk | Retention |
| 187 | Next-Best-Offer | What to sell next? | Recommendation | ARPU |
| 188 | Personalization | Different journey/customer | Class recommendations | Engagement |
| 189 | Sentiment AI | Analyze reviews | NLP | Sentiment |
| 190 | Forecasting AI | Predict demand/revenue | ML | Accuracy |
| 191 | Marketing Automation | Automate journeys | n8n/CRM | Productivity |
| 192 | GenAI Content | Scale content | Posts/email | Cost/content |
| **V** | **STRATEGIC GROWTH** | | | |
| 193 | Blue Ocean | Create uncontested space | New segment/model | New revenue |
| 194 | Network Effects | Customers generate growth | Community/referrals | Viral coefficient |
| 195 | Ecosystem Strategy | Extend beyond yoga | Wellness ecosystem | Ecosystem CLV |
| 196 | Platform Strategy | Scale providers/customers | Instructor platform | GMV |
| 197 | Geographic Expansion | New locations | City/community | Location ROI |
| 198 | Product Expansion | New categories | Wellness services | New revenue |
| 199 | Strategic Moat | Why can't others copy us? | Brand/community/data | Defensibility |
| 200 | Exit/Scale Strategy | What's the long-term model? | Franchise/platform/licensing | Enterprise value |

### 14.1 The 200 components → 10 engines

1. **Market Intelligence Engine** — Population → Demographics → Demand → Supply →
   Competitors → Trends → TAM/SAM/SOM → Opportunity → Forecast. *Where should we compete?*
2. **Customer Intelligence Engine** — Customer 360 → Segmentation → Needs → Pain →
   Jobs-to-be-Done → Sentiment → Non-customers → CLV. *Whom should we serve, and why?*
3. **Acquisition Engine** — SEO + Google Maps + Ads + Social + Content + Influencers +
   Community + Partnerships + Referral. *How do we acquire customers efficiently?*
4. **Conversion Engine** — Lead → Trial → Attendance → Paid → Membership. *Where do
   prospects disappear?*
5. **Activation & Retention Engine** — Onboarding → First 7 days → First 30 days → Habit →
   Engagement → Churn prediction → Intervention → Renewal. *How do we keep the customer?*
6. **Monetization Engine** — Pricing → Subscription → Bundle → Upsell → Cross-sell → Family →
   Corporate → Online. *How do we increase revenue per customer?*
7. **Referral & Network Engine** — Happy Customer → Advocate → Referral → Friend → Trial →
   Customer → New Advocate. Direct-referral/ambassador based, not multi-level recruiting
   commissions.
8. **B2B & Distribution Engine** — Corporate + Schools + Condos + Community Centres + Hotels +
   Partnerships + Online. *How can one relationship give access to hundreds of customers?*
9. **AI & Analytics Engine** — Data Collection → Integration → Customer 360 → Analytics →
   Prediction → Recommendation → Automation. *What should we do next, for which customer, and
   why?*
10. **Experimentation & Growth Engine** — Hypothesis → Experiment → A/B Test → Measure →
    Learn → Scale/Stop. *What actually causes incremental growth?*

**Growth Control Tower** (~15 executive KPIs, not 200):

| Business dimension | North-star KPI |
|---|---|
| Customers | Active paying members |
| Growth | Net new customers/month |
| Market | Market penetration % |
| Acquisition | CAC |
| Trial | Trial attendance % |
| Conversion | Trial→Paid % |
| Activation | 30-day activation |
| Engagement | Classes/member/month |
| Capacity | Class utilization % |
| Retention | 90-day retention |
| Churn | Monthly churn % |
| Advocacy | Referral rate |
| Monetization | ARPU |
| Economics | CLV:CAC |
| Revenue | MRR |
| Profitability | Contribution margin |

### 14.2 Customer growth mathematics

`Ending Customers = Starting Customers + New + Referral + Reactivated − Churned`

`Revenue = Active Customers × ARPU + B2B + Private + Workshops + Digital + Other`

Four fundamental growth levers:

1. **Acquire more customers** — SEO + ads + influencer + partnership + referral
2. **Convert more of what you already acquire** — website + trial + follow-up + onboarding
3. **Lose fewer customers** — engagement + habit + community + churn intervention
4. **Earn more per retained customer** — cross-sell + upsell + family + private + corporate + digital

"Run more Facebook ads" is not a complete growth strategy on its own.

### 14.3 Data architecture behind the framework

```
External Data (Population, Competitors, Prices, Google, Search, Social, Reviews, Market reports)
Primary Research (Survey, Interview, Focus group, Customer feedback, Lost-customer survey)
Internal Data (CRM, Booking, Attendance, Payments, Website, Marketing, Referral, Customer service)
  ↓
DATA COLLECTION → DATA INTEGRATION → DATA QUALITY → CUSTOMER 360
  ↓
ANALYSIS: Descriptive (what happened?) → Diagnostic (why?) → Predictive (what will happen?)
  → Prescriptive (what should we do?)
  ↓
AI: Segmentation, Lead scoring, Churn prediction, Demand forecast, Sentiment, Next-best-action
  ↓
VISUALIZATION: Power BI / dashboards / geographic maps
  ↓
DECISION: Customer → Product → Price → Time → Channel → Offer
  ↓
ACTION: Campaign / Call / Referral / New Class / Partnership
  ↓
RESULT: Customer / Revenue / Retention / Profit
  ↓
FEEDBACK: Model learns → Next action
```

### 14.4 Final growth flywheel

```
MARKET INTELLIGENCE
  ↓ Find high-value segment
  ↓ Create differentiated offer
  ↓ Generate awareness
  ↓ Lead → Trial → Great first experience → Paid membership
  ↓ Activation → Habit → Retention → Community
  ↓ Cross-sell / Upsell
  ↓ Referral / Ambassador → Friends + Family
  ↓ Corporate + Partnerships
  ↓ More customers → More first-party data
  ↓ Better AI/analytics → Better personalization
  ↓ Higher retention + CLV → Higher profitability
  ↓ Reinvest into growth
  ↺ (repeat)
```

**Full chain**: Market Research → Market Intelligence → Customer Intelligence → Competitive
Intelligence → Product-Market Fit → Pricing → Acquisition → Conversion → Activation →
Retention → Referral → Monetization → B2B → Penetration → Disruption → AI/Analytics →
Experimentation → Forecasting → Profitable Growth → Strategic Moat.

**Execution priority**: Don't run all 200 components simultaneously. Establish the baseline,
identify the single largest constraint, run controlled growth experiments against that
constraint, and scale only what improves *retained customers and contribution profit* — not
vanity metrics (followers, impressions, raw trial registrations).

---

## Appendix: How this maps to the admin module

The already-built `/admin/market-research` module (17 topics × 3 tabs: Overview / Data & KPIs
/ Forecast & Decision, seeded from §2) covers only the first and smallest framework in this
document. Sections 3, 5–14 above (30-domain framework, 70-step workflow, 20-component
new-entrant framework, 52-component existing-centre growth framework, 70-component competitor
framework, pricing/promotion/referral, influencer strategy, 30-strategy disruption matrix,
30-strategy penetration framework, 65-strategy top-tier growth architecture, and the final
200-component consolidated framework) are **not yet reflected** in the module and are the
subject of the follow-up implementation plan.
