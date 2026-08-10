# SohamYoga — Downloads & Open-Source Integrations

This folder holds all downloaded open-source repos, datasets, and assets
that power the SohamYoga platform. Nothing in here is pushed to GitHub
(covered by root .gitignore).

## What to download (run clone-all.sh)

| Folder           | Repo                              | Purpose                          |
|------------------|-----------------------------------|----------------------------------|
| frappe/          | frappe/frappe + frappe/erpnext    | ERP backbone: billing, HR, CRM   |
| frappe-education/| frappe/education                  | Course, student, LMS base        |
| calcom/          | calcom/cal.com                    | Booking calendar sync            |
| chatwoot/        | chatwoot/chatwoot                 | Live chat + inbox                |
| keycloak/        | keycloak/keycloak                 | SSO & identity                   |
| posthog/         | PostHog/posthog                   | Analytics + session replay       |
| listmonk/        | knadh/listmonk                    | Newsletter & email campaigns     |
| formbricks/      | formbricks/formbricks             | Surveys & dosha quiz forms       |
| livekit/         | livekit/livekit                   | Live streaming for online classes|
| ghost/           | TryGhost/Ghost                    | Blog CMS                         |

## Useful datasets (auto-downloaded by download-datasets.sh)

- yoga_poses_dataset.zip     — 82 asana images + labels (Kaggle)
- yoga_cues_v1.json          — structured cue library

## Folder structure

downloads/
  frappe/           ← git clone
  calcom/           ← git clone
  chatwoot/         ← git clone
  keycloak/         ← git clone
  posthog/          ← git clone
  listmonk/         ← git clone
  formbricks/       ← git clone
  livekit/          ← git clone
  ghost/            ← git clone
  datasets/         ← downloaded data files
    yoga_poses/
    asana_library/
