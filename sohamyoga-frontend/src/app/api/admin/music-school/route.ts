import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS ms_student (
  id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, phone TEXT, parent_name TEXT, parent_phone TEXT, parent_email TEXT,
  date_of_birth DATE, instrument TEXT NOT NULL,
  skill_level TEXT DEFAULT 'beginner' CHECK (skill_level IN ('beginner','elementary','intermediate','advanced','performance')),
  lesson_type TEXT DEFAULT 'private' CHECK (lesson_type IN ('private','group','masterclass','online')),
  lesson_duration INTEGER DEFAULT 30 CHECK (lesson_duration IN (30,45,60,90)),
  teacher TEXT, monthly_rate DECIMAL(10,2), enrolled_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','withdrawn')),
  exam_track TEXT, rcm_level TEXT, next_exam_date DATE,
  practice_goal_minutes INTEGER DEFAULT 30,
  emergency_contact TEXT, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ms_lesson (
  id SERIAL PRIMARY KEY, student_id INTEGER REFERENCES ms_student(id),
  lesson_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
  teacher TEXT NOT NULL, status TEXT DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','student_absent','teacher_absent','cancelled','makeup')),
  repertoire TEXT[], technique_focus TEXT, homework_assigned TEXT,
  attendance_noted BOOLEAN DEFAULT false, makeup_scheduled DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ms_recital (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, event_date TIMESTAMPTZ NOT NULL,
  venue TEXT, description TEXT, ticket_price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'planning' CHECK (status IN ('planning','rehearsal','confirmed','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ms_recital_performer (
  id SERIAL PRIMARY KEY, recital_id INTEGER REFERENCES ms_recital(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES ms_student(id),
  piece_title TEXT NOT NULL, composer TEXT, performance_order INTEGER,
  duration_minutes INTEGER DEFAULT 3, confirmed BOOLEAN DEFAULT false
);
`;

export async function GET(req: NextRequest): Promise<Response> {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(INIT_SQL);

    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];

    const [activeStudents, lessonsToday, teacherAbsentMtd, upcomingRecitals, rcmExams] = await Promise.all([
      client.query(`SELECT COUNT(*) AS cnt FROM ms_student WHERE status='active'`),
      client.query(`SELECT COUNT(*) AS cnt FROM ms_lesson WHERE lesson_date=$1 AND status='scheduled'`, [today]),
      client.query(`SELECT COUNT(*) AS cnt FROM ms_lesson WHERE DATE_TRUNC('month',lesson_date)=DATE_TRUNC('month',NOW()) AND status='teacher_absent'`),
      client.query(`SELECT id,title,event_date,venue,status FROM ms_recital WHERE event_date>NOW() ORDER BY event_date LIMIT 5`),
      client.query(`SELECT s.id,s.first_name,s.last_name,s.instrument,s.rcm_level,s.next_exam_date FROM ms_student s WHERE s.next_exam_date BETWEEN $1 AND $2 ORDER BY s.next_exam_date`, [today, in30]),
    ]);

    return Response.json({
      active_students: Number(activeStudents.rows[0].cnt),
      lessons_today: Number(lessonsToday.rows[0].cnt),
      teacher_absent_mtd: Number(teacherAbsentMtd.rows[0].cnt),
      upcoming_recitals: upcomingRecitals.rows,
      rcm_exams_30d: rcmExams.rows,
    });
  } finally {
    client.release();
  }
}
