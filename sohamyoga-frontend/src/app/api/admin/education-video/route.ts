export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getPool } from '@/lib/postgres';

async function ensureTables() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ev_courses (
        course_id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        instructor VARCHAR(128) NOT NULL,
        category VARCHAR(64) NOT NULL,
        level VARCHAR(32) NOT NULL,
        lesson_count INT NOT NULL DEFAULT 0,
        enrolled_count INT NOT NULL DEFAULT 0,
        completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ev_lessons (
        lesson_id VARCHAR(64) PRIMARY KEY,
        course_id VARCHAR(64) NOT NULL,
        title VARCHAR(256) NOT NULL,
        duration_min INT NOT NULL DEFAULT 0,
        video_url VARCHAR(256),
        has_quiz BOOLEAN NOT NULL DEFAULT FALSE,
        has_transcript BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(32) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS ev_quizzes (
        quiz_id VARCHAR(64) PRIMARY KEY,
        course_id VARCHAR(64) NOT NULL,
        lesson_id VARCHAR(64),
        title VARCHAR(256) NOT NULL,
        question_count INT NOT NULL DEFAULT 0,
        pass_score INT NOT NULL DEFAULT 70,
        avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
        attempt_count INT NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ev_certificates (
        cert_id VARCHAR(64) PRIMARY KEY,
        course_id VARCHAR(64) NOT NULL,
        template_name VARCHAR(128) NOT NULL,
        auto_issue BOOLEAN NOT NULL DEFAULT TRUE,
        issued_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const courses = [
      ['crs-001','Foundation Yoga','Priya Sharma','Yoga','Beginner',3,142,78.5,true],
      ['crs-002','Morning Meditation','Amit Patel','Meditation','Beginner',3,98,65.2,true],
      ['crs-003','Advanced Vinyasa','Deepa Nair','Yoga','Advanced',3,47,42.1,true],
      ['crs-004','Stress Relief Wellness','Sunita Rao','Wellness','Intermediate',3,213,88.3,true],
      ['crs-005','HIIT & Strength','Vikram Singh','Fitness','Intermediate',3,76,55.0,false],
      ['crs-006','Plant-Based Nutrition','Meera Kapoor','Nutrition','Beginner',3,123,72.8,true],
    ];
    for (const [id,title,instructor,cat,level,lc,ec,cr,pub] of courses) {
      await client.query(
        `INSERT INTO ev_courses VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) ON CONFLICT DO NOTHING`,
        [id,title,instructor,cat,level,lc,ec,cr,pub]
      );
    }

    const lessons = [
      ['les-001','crs-001','Sun Salutation Basics',25,'https://vimeo.com/****001',true,true,'published'],
      ['les-002','crs-001','Standing Poses',30,'https://vimeo.com/****002',false,true,'published'],
      ['les-003','crs-001','Cool Down & Savasana',20,'https://vimeo.com/****003',false,false,'published'],
      ['les-004','crs-002','Breath Awareness',15,'https://vimeo.com/****004',true,true,'published'],
      ['les-005','crs-002','Body Scan Meditation',20,'https://vimeo.com/****005',false,false,'published'],
      ['les-006','crs-002','Visualization Practice',18,'https://vimeo.com/****006',false,true,'published'],
      ['les-007','crs-003','Flow Sequencing',45,'https://vimeo.com/****007',true,true,'published'],
      ['les-008','crs-003','Arm Balances',40,'https://vimeo.com/****008',false,false,'processing'],
      ['les-009','crs-003','Inversions',35,'https://vimeo.com/****009',false,false,'draft'],
      ['les-010','crs-004','Stress Physiology',22,'https://vimeo.com/****010',true,true,'published'],
      ['les-011','crs-004','Restorative Yoga',35,'https://vimeo.com/****011',false,true,'published'],
      ['les-012','crs-004','Sleep Hygiene',18,'https://vimeo.com/****012',false,false,'published'],
      ['les-013','crs-005','Warm-Up Protocol',12,'https://vimeo.com/****013',true,false,'published'],
      ['les-014','crs-005','Core Strength Circuit',28,'https://vimeo.com/****014',false,false,'draft'],
      ['les-015','crs-005','Cool Down & Recovery',15,'https://vimeo.com/****015',false,false,'draft'],
      ['les-016','crs-006','Whole Food Principles',20,'https://vimeo.com/****016',true,true,'published'],
      ['les-017','crs-006','Meal Planning',25,'https://vimeo.com/****017',false,true,'published'],
      ['les-018','crs-006','Recipes & Shopping',22,'https://vimeo.com/****018',false,false,'published'],
    ];
    for (const [id,cid,title,dur,url,hq,ht,status] of lessons) {
      await client.query(
        `INSERT INTO ev_lessons VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT DO NOTHING`,
        [id,cid,title,dur,url,hq,ht,status]
      );
    }

    const quizzes = [
      ['qz-001','crs-001','les-001','Yoga Foundations Quiz',10,70,74.2,89],
      ['qz-002','crs-002','les-004','Meditation Basics Quiz',8,65,71.5,62],
      ['qz-003','crs-003','les-007','Advanced Flow Quiz',12,80,68.3,31],
      ['qz-004','crs-004','les-010','Stress & Wellness Quiz',10,70,82.1,145],
      ['qz-005','crs-005','les-013','HIIT Safety Quiz',6,75,79.4,43],
      ['qz-006','crs-006','les-016','Nutrition Knowledge Quiz',10,70,85.2,91],
    ];
    for (const [id,cid,lid,title,qc,ps,as,ac] of quizzes) {
      await client.query(
        `INSERT INTO ev_quizzes VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [id,cid,lid,title,qc,ps,as,ac]
      );
    }

    const certs = [
      ['cert-001','crs-001','Yoga Foundation Certificate',true,112],
      ['cert-002','crs-002','Mindfulness Practitioner Certificate',true,67],
      ['cert-003','crs-003','Advanced Yoga Certificate',true,18],
      ['cert-004','crs-004','Wellness Champion Certificate',true,189],
      ['cert-005','crs-005','Fitness Basics Certificate',false,32],
      ['cert-006','crs-006','Plant-Based Nutrition Certificate',true,88],
    ];
    for (const [id,cid,tn,ai,ic] of certs) {
      await client.query(
        `INSERT INTO ev_certificates VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT DO NOTHING`,
        [id,cid,tn,ai,ic]
      );
    }
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [courses, lessons, quizzes, certificates] = await Promise.all([
      client.query('SELECT * FROM ev_courses ORDER BY created_at DESC'),
      client.query('SELECT * FROM ev_lessons ORDER BY created_at DESC'),
      client.query('SELECT * FROM ev_quizzes ORDER BY quiz_id'),
      client.query('SELECT * FROM ev_certificates ORDER BY created_at DESC'),
    ]);
    const topCourses = courses.rows
      .sort((a, b) => Number(b.completion_rate) - Number(a.completion_rate))
      .slice(0, 5)
      .map(c => ({ title: c.title, completion_rate: c.completion_rate }));
    const avgWatch = lessons.rows.reduce((s, l) => s + Number(l.duration_min), 0) /
      (lessons.rows.length || 1);
    return NextResponse.json({
      courses: courses.rows,
      lessons: lessons.rows,
      quizzes: quizzes.rows,
      certificates: certificates.rows,
      analytics: { top_courses: topCourses, avg_watch_time_min: Math.round(avgWatch) },
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.action === 'create_course') {
      const id = `crs-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO ev_courses (course_id,title,instructor,category,level,is_published)
         VALUES ($1,$2,$3,$4,$5,false) RETURNING *`,
        [id, body.title, body.instructor, body.category, body.level]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.action === 'create_lesson') {
      const id = `les-${Date.now()}`;
      const r = await client.query(
        `INSERT INTO ev_lessons (lesson_id,course_id,title,duration_min,video_url,status)
         VALUES ($1,$2,$3,$4,$5,'draft') RETURNING *`,
        [id, body.course_id, body.title, body.duration_min || 0, body.video_url || null]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAdmin(req);
  if (authErr) return authErr;
  await ensureTables();
  const body = await req.json();
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (body.type === 'course') {
      const r = await client.query(
        `UPDATE ev_courses SET is_published=$1 WHERE course_id=$2 RETURNING *`,
        [body.is_published, body.course_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    if (body.type === 'lesson') {
      const r = await client.query(
        `UPDATE ev_lessons SET status=$1 WHERE lesson_id=$2 RETURNING *`,
        [body.status, body.lesson_id]
      );
      return NextResponse.json(r.rows[0]);
    }
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } finally {
    client.release();
  }
}
