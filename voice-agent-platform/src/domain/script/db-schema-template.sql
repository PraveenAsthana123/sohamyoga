-- Real, minimal slice of "sample call script" (Topic M): a clonable
-- template library, not a branching-decision-tree engine -- Vapi consumes
-- one flat system prompt per assistant, so a real branching-graph editor
-- would have nowhere to actually take effect without building a session-
-- state machine this app doesn't have. A template is real, working, and
-- immediately useful: pick one, clone it into your own editable script.
CREATE TABLE script_template (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL,
  direction             call_script_direction NOT NULL,
  opening               TEXT NOT NULL,
  discovery_questions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  objection_handling    TEXT NOT NULL DEFAULT '',
  closing               TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO script_template (name, category, direction, opening, discovery_questions, objection_handling, closing) VALUES
(
  'Appointment Reminder', 'appointment_reminder', 'outbound',
  'Hi, this is calling on behalf of {{business_name}} with a reminder about your upcoming appointment.',
  '["Can you confirm you''ll be able to make it?", "Would you like to reschedule instead?"]'::jsonb,
  'If they can''t make it, offer to reschedule immediately rather than just cancelling.',
  'Great, we''ll see you then. Have a great day!'
),
(
  'New Lead Follow-up', 'lead_followup', 'outbound',
  'Hi, this is calling from {{business_name}} -- you recently asked about our services, do you have a moment?',
  '["What are you hoping to get out of this?", "Have you tried something like this before?", "What''s the best time for you to come in?"]'::jsonb,
  'If they mention price, walk through the real pricing and offer a trial rather than pushing for an immediate commitment.',
  'Thanks so much for your time -- we''ll follow up with the details by email.'
),
(
  'Payment Follow-up', 'payment_reminder', 'outbound',
  'Hi, this is a courtesy call from {{business_name}} regarding an outstanding payment on your account.',
  '["Would you like to take care of that now over the phone?", "Is there anything that''s made this difficult to pay?"]'::jsonb,
  'Never pressure or threaten -- offer a payment plan if they mention hardship, and always offer a human follow-up if they ask for one.',
  'Thank you, we appreciate you taking care of that. Have a good day.'
);
