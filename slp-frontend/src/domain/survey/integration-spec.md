# Wave 11 — Survey / Questionnaire / Form / Feedback Module
## Integration Specification

---

### 1. Domain Bounded Context

**Context name:** `survey`  
**Root aggregates:** `Survey`, `SurveyResponse`, `SurveyAnalytics`  
**Supporting entities:** `Question`, `SurveyMcpRegistry`

#### State machine — Survey lifecycle

```
draft ──publish()──► active ──pause()──► paused
  │                    │                   │
  │               close()/expire        resume()
  │                    │                   │
  │                    ▼                   │
  │                 closed ◄──────────────┘
  │                    │
  └──────────────── archive()
                       │
                       ▼
                   archived (terminal)
```

#### State machine — SurveyResponse lifecycle

```
               addAnswer()
in_progress ──────────────► in_progress
     │                            │
     │        updateCompletion()   │
     │       (status=partial)      │
     ▼                            │
  partial ◄───────────────────────┘
     │
  submit()
     │
     ▼
 submitted (terminal)
```

---

### 2. 12-Step Survey Submission Flow

```
1. Respondent opens survey link (public/invite token)
2. System checks: isActive(now) → 404 if false
3. System checks: responseLimit not reached
4. System checks: allowMultipleResponses (if false, check prior submission)
5. SurveyResponse created: status=in_progress
6. Questions served with conditional logic applied
7. Respondent answers questions; addAnswer() per question
8. updateCompletion(percent) called on each navigation step
9. saveAndResume: response persisted with status=partial if abandoned
10. Respondent submits: submit_response MCP tool called (confirmText=SUBMIT_RESPONSE)
11. SurveyResponse.submit(at) → status=submitted, completionPercent=100
12. Survey.recordResponse(completed=true) → responseCount++, completionCount++
    Analytics refresh triggered asynchronously
```

---

### 3. Question Type → Validation Matrix

| Question Type      | Min Options | Matrix Rows | ratingMin | ratingMax | Notes |
|--------------------|-------------|-------------|-----------|-----------|-------|
| single_choice      | 2           | —           | —         | —         | One selection |
| multiple_choice    | 2           | —           | —         | —         | Multiple allowed |
| checkbox           | 2           | —           | —         | —         | Same as multiple_choice |
| rating_scale       | —           | —           | required  | required  | min < max |
| matrix_grid        | 2 (cols)    | 1           | —         | —         | Cols = options |
| nps                | —           | —           | 0         | 10        | Fixed range |
| short_text         | —           | —           | —         | —         | maxLength optional |
| long_text          | —           | —           | —         | —         | maxLength optional |
| file_upload        | —           | —           | —         | —         | maxFileSizeMb > 0 |
| digital_signature  | —           | —           | —         | —         | fileUrl stored |
| date               | —           | —           | —         | —         | ISO8601 string |
| number             | —           | —           | —         | —         | Numeric value |
| email              | —           | —           | —         | —         | Format validated |
| phone              | —           | —           | —         | —         | E.164 recommended |

---

### 4. MCP Tool Coverage

| Tool               | Tier             | Key Args                              | Guard                         |
|--------------------|------------------|---------------------------------------|-------------------------------|
| list_surveys       | auto             | —                                     | —                             |
| get_survey         | auto             | surveyId                              | —                             |
| get_analytics      | staff            | surveyId                              | —                             |
| create_survey      | staff            | title, type, createdBy                | —                             |
| add_question       | staff            | surveyId, questionType, text          | —                             |
| send_invitation    | staff            | surveyId, recipientEmails             | Rate-limited 500/hr via Novu  |
| get_responses      | staff            | surveyId                              | —                             |
| export_responses   | staff            | surveyId, format                      | —                             |
| submit_response    | customer_confirm | surveyId, answers                     | confirmText=SUBMIT_RESPONSE   |
| publish_survey     | staff_approval   | surveyId, publishedBy                 | confirmApprovalId             |
| close_survey       | staff_approval   | surveyId, closedBy                    | confirmApprovalId             |
| delete_survey      | admin_destructive| surveyId, deletedBy                   | confirmText + confirmApprovalId |

---

### 5. NPS Score → Category Mapping

| NPS Range    | Category         | Action                            |
|--------------|------------------|-----------------------------------|
| 70 – 100     | excellent        | Highlight; share testimonials     |
| 30 – 69      | good             | Maintain; investigate detractors  |
| 0 – 29       | needs_improvement| Trigger follow-up surveys         |
| -100 – -1    | critical         | Escalate to management            |
| undefined    | no_data          | Prompt to add NPS question        |

---

### 6. Conditional Logic Operators

| Operator     | Use Case                                    |
|--------------|---------------------------------------------|
| equals       | Show Q5 if Q2 = "No"                        |
| not_equals   | Show upsell if membership ≠ "premium"       |
| contains     | Show allergy form if diet contains "vegan"  |
| greater_than | Show advanced options if rating > 7         |
| less_than    | Show support contact if NPS < 6             |

---

### 7. Cross-Wave Integration Map

| Wave | Module      | Integration Point                              |
|------|-------------|------------------------------------------------|
| 1    | Teacher     | Teacher evaluation surveys; IRB questionnaires |
| 2    | Scheduling  | Post-class feedback forms (automated trigger)  |
| 3    | Membership  | Onboarding questionnaire, renewal NPS          |
| 4    | Wellness    | Health assessment forms (SOAP, PRO)            |
| 5    | Community   | Community pulse polls                          |
| 6    | Gamification| Engagement quizzes with reward triggers        |
| 7    | Campaign    | Campaign effectiveness surveys                 |
| 8    | Booking     | Pre-class health intake, post-booking feedback |
| 9    | Referral    | Referrer satisfaction NPS                      |
| 10   | Student     | Progress assessments, learning quizzes         |

---

### 8. Survey Type → Yoga Use Cases

| Survey Type   | Yoga Use Case                                     |
|---------------|---------------------------------------------------|
| survey        | General satisfaction; facility feedback           |
| questionnaire | IRB/IEC research questionnaire; health history    |
| form          | New member intake; waiver collection              |
| quiz          | Yoga knowledge test; chakra awareness quiz        |
| assessment    | Flexibility benchmark; health risk assessment     |
| poll          | Class time preference; workshop topic vote        |
| nps           | Net Promoter Score; teacher satisfaction          |
| feedback      | Post-class feedback; retreat evaluation           |

---

### 9. Database Tables (12)

| Table                    | Purpose                                     |
|--------------------------|---------------------------------------------|
| survey                   | Master survey record + settings             |
| survey_question          | Individual questions with type & constraints|
| survey_question_option   | Choice options + matrix columns/rows        |
| survey_question_logic    | Conditional show/skip rules                 |
| survey_response          | Per-respondent response session             |
| survey_answer            | Individual answers within a response        |
| survey_analytics         | Aggregated survey-level analytics           |
| survey_question_summary  | Per-question aggregated stats               |
| survey_invitation        | Email invitation tracking                   |
| survey_export            | CSV/Excel/SPSS export records               |
| survey_audit             | Full audit trail                            |
| survey_notification      | Novu notification log                       |

---

### 10. External System Ports

| System         | Integration                                          |
|----------------|------------------------------------------------------|
| Novu           | Invitations, completion confirmations, export-ready  |
| PostHog        | Response events, drop-off funnels, NPS trends        |
| Formbricks     | Open-source survey engine (clone: wave 11)           |
| LimeSurvey     | IRB/research questionnaire baseline (import only)    |
| SurveyJS       | JSON-based question renderer for front-end           |
| MinIO / S3     | File upload storage for file_upload / signature      |
| Keycloak       | respondent_id resolution; invite_only auth           |
| n8n            | Post-submission workflow automation                  |

---

### 11. IRB / IEC Research Questionnaire Notes

For Praveen Asthana's Epilepsy EEG AI Governance study:
- Survey type = `questionnaire` with `visibility = invite_only`
- `requireLogin = true`; respondentId mapped to study participant ID
- Responses exported in SPSS format for statistical analysis
- `allowMultipleResponses = false` to prevent duplicate submissions
- `saveAndResume = true` to allow multi-session completion
- Audit trail mandatory (survey_audit table)
- IRB: GGU — all data de-identified before export
- IEC: ICMR 2023 guidelines; DPDP Act 2023 compliance

---

### 12. Analytics Refresh Strategy

```
Trigger: survey_response submitted
  → POST /api/survey/{id}/analytics/refresh (internal)
  → SurveyAnalytics.refresh(total, completed, partial, avgTime)
  → QuestionSummary recalculated for each answered question
  → NPS score recalculated: (promoters - detractors) / total × 100
  → Stored in survey_analytics + survey_question_summary
  → PostHog event: survey_completed {surveyId, completionTime, npsScore}
```
