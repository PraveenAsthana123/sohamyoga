# Goal: Auto-route incoming insurance claim FNOL

When a customer submits an FNOL (First Notice of Loss), the system should:
1. Classify the claim into severity tier (S1 simple · S2 moderate · S3 complex)
2. Route to the appropriate adjuster pool based on severity + skill
3. Return decision under 500ms p95
4. Be auditable per §38.3 + §90 G12
5. Be fair across protected cohorts per §76
