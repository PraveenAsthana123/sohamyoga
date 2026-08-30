// Customer 360 — Module 22 (CRM, Customer 360, CDP & Master Customer Data
// Management). This is a LIVE READ-AGGREGATION across tables that already
// exist and are already written to by real flows elsewhere in the app —
// customer, student, campaign_lead, journey_touchpoint, booking,
// service_review, event_registration, survey_response, and (conditionally)
// form_submission. It deliberately does NOT create a denormalized
// "customer_360" table: that would go stale the moment any of those source
// tables changed, defeating the point of a 360 view.
//
// form_submission note: `data` is admin-defined arbitrary JSONB (a form can
// name its email field anything), so we cannot assume a `data->>'email'`
// key exists. Instead we join to the form's own field definitions
// (form_definition.fields, an array of {key,label,type,required}) and only
// match a submission when it has a field whose *declared type* is 'email'
// and whose value equals the looked-up address. That is a reliable,
// non-guessing match — forms with no email-type field are honestly never
// matched rather than silently guessed at.
import { query } from '@/lib/postgres';

export type TimelineSource =
  | 'journey_touchpoint'
  | 'booking'
  | 'booking_checkin'
  | 'event_registration'
  | 'service_review'
  | 'survey_response'
  | 'campaign_lead'
  | 'form_submission';

export interface Customer360TimelineEntry {
  source: TimelineSource;
  sourceTable: string;
  type: string;
  occurredAt: string;
  label: string;
  detail: Record<string, unknown>;
}

export interface Customer360Identity {
  displayName: string | null;
  email: string;
  phone: string | null;
}

export interface Customer360Result {
  email: string;
  found: boolean;
  identity: Customer360Identity | null;
  customer: {
    id: string; tier: string; loyaltyPoints: number; lifetimeSpendCad: number;
    emailOptIn: boolean; smsOptIn: boolean; createdAt: string;
  } | null;
  student: {
    id: string; status: string; journeyPhase: string; experienceLevel: string; enrolledAt: string;
  } | null;
  leads: Array<{ id: string; sourcePlatform: string | null; funnelStage: string; convertedAt: string | null; createdAt: string }>;
  stats: {
    lifetimeSpendCad: number | null;
    loyaltyPoints: number | null;
    totalBookings: number;
    avgReviewRating: number | null;
    reviewCount: number;
    funnelStage: string | null;
    totalEventRegistrations: number;
    totalSurveyResponses: number;
    totalTouchpoints: number;
  };
  timeline: Customer360TimelineEntry[];
  formSubmissions: { included: boolean; note: string };
}

function emptyStats(): Customer360Result['stats'] {
  return {
    lifetimeSpendCad: null, loyaltyPoints: null, totalBookings: 0, avgReviewRating: null,
    reviewCount: 0, funnelStage: null, totalEventRegistrations: 0, totalSurveyResponses: 0, totalTouchpoints: 0,
  };
}

export async function getCustomer360(tenantId: string, rawEmail: string): Promise<Customer360Result> {
  const email = rawEmail.trim().toLowerCase();

  const [
    customerRes, studentRes, leadRes, touchpointRes,
    bookingRes, reviewRes, eventRegRes, surveyRes, formSubmissionRes,
  ] = await Promise.all([
    query<{ id: string; display_name: string; email: string; phone: string | null; tier: string; loyalty_points: number; lifetime_spend_cad: string; email_opt_in: boolean; sms_opt_in: boolean; created_at: string }>(
      `SELECT id, display_name, email, phone, tier, loyalty_points, lifetime_spend_cad, email_opt_in, sms_opt_in, created_at
       FROM customer WHERE tenant_id = $1 AND LOWER(email) = $2`,
      [tenantId, email],
    ),
    query<{ id: string; display_name: string; email: string; phone: string | null; status: string; journey_phase: string; experience_level: string; enrolled_at: string }>(
      `SELECT id, display_name, email, phone, status, journey_phase, experience_level, enrolled_at
       FROM student WHERE tenant_id = $1 AND LOWER(email) = $2`,
      [tenantId, email],
    ),
    query<{ id: string; first_name: string | null; last_name: string | null; email: string; phone: string | null; source_platform: string | null; funnel_stage: string; converted_at: string | null; created_at: string }>(
      `SELECT id, first_name, last_name, email, phone, source_platform, funnel_stage, converted_at, created_at
       FROM campaign_lead WHERE tenant_id = $1 AND LOWER(email) = $2 ORDER BY created_at DESC`,
      [tenantId, email],
    ),
    query<{ id: string; touchpoint_type: string; source_module: string; occurred_at: string; metadata: Record<string, unknown> }>(
      `SELECT id, touchpoint_type::text, source_module, occurred_at, metadata
       FROM journey_touchpoint WHERE tenant_id = $1 AND LOWER(contact_identifier) = $2 ORDER BY occurred_at ASC`,
      [tenantId, email],
    ),
    query<{ id: string; status: string; channel: string; booked_at: string; checked_in_at: string | null; cancelled_at: string | null; class_name: string; teacher_name: string; session_date: string; start_time: string }>(
      `SELECT b.id, b.status, b.channel, b.booked_at, b.checked_in_at, b.cancelled_at,
              cs.class_name, cs.teacher_name, cs.session_date, cs.start_time
       FROM booking b
       JOIN student s ON s.id = b.student_id
       JOIN class_session cs ON cs.id = b.class_session_id
       WHERE b.tenant_id = $1 AND LOWER(s.email) = $2
       ORDER BY b.booked_at ASC`,
      [tenantId, email],
    ),
    query<{ id: string; star_rating: number; comment: string; status: string; staff_response: string | null; created_at: string; class_name: string; session_date: string }>(
      `SELECT sr.id, sr.star_rating, sr.comment, sr.status::text, sr.staff_response, sr.created_at,
              cs.class_name, cs.session_date
       FROM service_review sr
       JOIN booking b ON b.id = sr.booking_id
       JOIN class_session cs ON cs.id = b.class_session_id
       WHERE sr.tenant_id = $1 AND LOWER(sr.reviewer_email) = $2
       ORDER BY sr.created_at ASC`,
      [tenantId, email],
    ),
    query<{ id: string; name: string; status: string; registered_at: string; checked_in_at: string | null; cancelled_at: string | null; event_title: string; event_starts_at: string }>(
      `SELECT er.id, er.name, er.status::text, er.registered_at, er.checked_in_at, er.cancelled_at,
              e.title AS event_title, e.starts_at AS event_starts_at
       FROM event_registration er
       JOIN event e ON e.id = er.event_id
       WHERE e.tenant_id = $1 AND LOWER(er.email) = $2
       ORDER BY er.registered_at ASC`,
      [tenantId, email],
    ),
    // survey_response has no tenant_id column at all (the survey module
    // predates multi-tenancy and was never retrofitted) — matched by email only.
    query<{ id: string; status: string; started_at: string; submitted_at: string | null; survey_title: string; nps_score: string | null; nps_text: string | null }>(
      `SELECT sr.id, sr.status, sr.started_at, sr.submitted_at, sv.title AS survey_title,
              (SELECT sa.value_number FROM survey_answer sa WHERE sa.response_id = sr.id AND sa.question_type = 'nps' LIMIT 1) AS nps_score,
              (SELECT sa.value_text FROM survey_answer sa WHERE sa.response_id = sr.id AND sa.question_type = 'nps' LIMIT 1) AS nps_text
       FROM survey_response sr
       JOIN survey sv ON sv.id = sr.survey_id
       WHERE LOWER(sr.respondent_email) = $1
       ORDER BY COALESCE(sr.submitted_at, sr.started_at) ASC`,
      [email],
    ),
    // Reliable email match: only matches a submission when the form itself
    // declares a field of type 'email' whose value equals the looked-up
    // address — never guesses a JSONB key name.
    query<{ id: string; form_id: string; form_name: string; created_at: string; matched_field_label: string }>(
      `SELECT fs.id, fs.form_id, fd.name AS form_name, fs.created_at, (field->>'label') AS matched_field_label
       FROM form_submission fs
       JOIN form_definition fd ON fd.id = fs.form_id
       CROSS JOIN LATERAL jsonb_array_elements(fd.fields) AS field
       WHERE fd.tenant_id = $1
         AND (field->>'type') = 'email'
         AND LOWER(fs.data ->> (field->>'key')) = $2
       ORDER BY fs.created_at ASC`,
      [tenantId, email],
    ),
  ]);

  const customer = customerRes.rows[0] ?? null;
  const student = studentRes.rows[0] ?? null;
  const leads = leadRes.rows;
  const found = Boolean(
    customer || student || leads.length || touchpointRes.rows.length || bookingRes.rows.length ||
    reviewRes.rows.length || eventRegRes.rows.length || surveyRes.rows.length || formSubmissionRes.rows.length,
  );

  if (!found) {
    return {
      email, found: false, identity: null, customer: null, student: null, leads: [],
      stats: emptyStats(), timeline: [],
      formSubmissions: { included: true, note: 'No form submissions matched — none found (or no form with a declared email field matched this address).' },
    };
  }

  // Identity resolution: prefer the richest real record first.
  const latestLead = leads[0];
  const identity: Customer360Identity = {
    displayName:
      customer?.display_name ??
      student?.display_name ??
      (latestLead ? [latestLead.first_name, latestLead.last_name].filter(Boolean).join(' ') || null : null) ??
      eventRegRes.rows[0]?.name ??
      null,
    email: customer?.email ?? student?.email ?? latestLead?.email ?? email,
    phone: customer?.phone ?? student?.phone ?? latestLead?.phone ?? null,
  };

  const timeline: Customer360TimelineEntry[] = [];

  for (const t of touchpointRes.rows) {
    timeline.push({
      source: 'journey_touchpoint', sourceTable: 'journey_touchpoint', type: t.touchpoint_type,
      occurredAt: t.occurred_at,
      label: `Journey touchpoint: ${t.touchpoint_type.replace(/_/g, ' ')} (via ${t.source_module})`,
      detail: t.metadata ?? {},
    });
  }
  for (const b of bookingRes.rows) {
    timeline.push({
      source: 'booking', sourceTable: 'booking', type: 'booking',
      occurredAt: b.booked_at,
      label: `Booked "${b.class_name}" with ${b.teacher_name} on ${b.session_date} (${b.status})`,
      detail: { status: b.status, channel: b.channel, sessionDate: b.session_date, startTime: b.start_time },
    });
    if (b.checked_in_at) {
      timeline.push({
        source: 'booking_checkin', sourceTable: 'booking', type: 'checked_in',
        occurredAt: b.checked_in_at,
        label: `Checked in to "${b.class_name}"`,
        detail: { sessionDate: b.session_date },
      });
    }
  }
  for (const r of reviewRes.rows) {
    timeline.push({
      source: 'service_review', sourceTable: 'service_review', type: 'review',
      occurredAt: r.created_at,
      label: `Left a ${r.star_rating}-star review for "${r.class_name}" (${r.status})`,
      detail: { starRating: r.star_rating, comment: r.comment, staffResponse: r.staff_response },
    });
  }
  for (const e of eventRegRes.rows) {
    timeline.push({
      source: 'event_registration', sourceTable: 'event_registration', type: 'event_registration',
      occurredAt: e.registered_at,
      label: `Registered for "${e.event_title}" (${e.status})`,
      detail: { status: e.status, eventStartsAt: e.event_starts_at, checkedInAt: e.checked_in_at, cancelledAt: e.cancelled_at },
    });
  }
  for (const s of surveyRes.rows) {
    const when = s.submitted_at ?? s.started_at;
    timeline.push({
      source: 'survey_response', sourceTable: 'survey_response', type: 'survey_response',
      occurredAt: when,
      label: s.nps_score != null
        ? `Responded to "${s.survey_title}" — NPS ${s.nps_score}`
        : `Responded to "${s.survey_title}" (${s.status})`,
      detail: { status: s.status, npsScore: s.nps_score, npsText: s.nps_text },
    });
  }
  for (const l of leads) {
    timeline.push({
      source: 'campaign_lead', sourceTable: 'campaign_lead', type: 'campaign_lead',
      occurredAt: l.created_at,
      label: `Became a lead via ${l.source_platform ?? 'unknown source'} (stage: ${l.funnel_stage})`,
      detail: { funnelStage: l.funnel_stage, sourcePlatform: l.source_platform, convertedAt: l.converted_at },
    });
  }
  for (const f of formSubmissionRes.rows) {
    timeline.push({
      source: 'form_submission', sourceTable: 'form_submission', type: 'form_submission',
      occurredAt: f.created_at,
      label: `Submitted form "${f.form_name}"`,
      detail: { formId: f.form_id, matchedFieldLabel: f.matched_field_label },
    });
  }

  timeline.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const avgReviewRating = reviewRes.rows.length
    ? reviewRes.rows.reduce((sum, r) => sum + r.star_rating, 0) / reviewRes.rows.length
    : null;

  return {
    email, found: true, identity,
    customer: customer ? {
      id: customer.id, tier: customer.tier, loyaltyPoints: customer.loyalty_points,
      lifetimeSpendCad: Number(customer.lifetime_spend_cad), emailOptIn: customer.email_opt_in,
      smsOptIn: customer.sms_opt_in, createdAt: customer.created_at,
    } : null,
    student: student ? {
      id: student.id, status: student.status, journeyPhase: student.journey_phase,
      experienceLevel: student.experience_level, enrolledAt: student.enrolled_at,
    } : null,
    leads: leads.map(l => ({ id: l.id, sourcePlatform: l.source_platform, funnelStage: l.funnel_stage, convertedAt: l.converted_at, createdAt: l.created_at })),
    stats: {
      lifetimeSpendCad: customer ? Number(customer.lifetime_spend_cad) : null,
      loyaltyPoints: customer ? customer.loyalty_points : null,
      totalBookings: bookingRes.rows.length,
      avgReviewRating: avgReviewRating != null ? Math.round(avgReviewRating * 100) / 100 : null,
      reviewCount: reviewRes.rows.length,
      funnelStage: latestLead?.funnel_stage ?? null,
      totalEventRegistrations: eventRegRes.rows.length,
      totalSurveyResponses: surveyRes.rows.length,
      totalTouchpoints: touchpointRes.rows.length,
    },
    timeline,
    formSubmissions: {
      included: true,
      note: 'Matched via each form\'s own declared email-type field (form_definition.fields), not a guessed JSONB key — forms without an email field are honestly never matched.',
    },
  };
}
