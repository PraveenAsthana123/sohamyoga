-- =============================================================================
-- Real asana (pose) library — the "validated knowledge unit" / curriculum
-- layer for AI-assisted yoga coaching. The asana table (migration 043) has
-- had a complete, real schema (Sanskrit/English names, difficulty,
-- contraindications, goal/style links) since early this session, but zero
-- rows — meanwhile AiCoachJob.ts has been asking Ollama to freely generate
-- "focus_poses"/"avoid_poses" as open text, with nothing to check them
-- against. That's exactly the failure mode called out explicitly:
-- "Don't allow an LLM to invent your curriculum every time" — this seeds
-- the real, validated pose data so the job can be constrained to choose
-- from it rather than generate names unconstrained.
--
-- 15 real, well-documented foundational asanas spanning all four real
-- difficulty levels (ref_difficulty_level) — traditional poses, not
-- invented. Contraindications are genuine, commonly-cited cautions for
-- each pose (e.g. inversions + high blood pressure), not fabricated.
-- =============================================================================

DO $$
DECLARE
  v_tenant_id UUID := '16fb3a23-5370-4572-bc93-2076534a4e99';
  v_id UUID;
BEGIN
  -- Tadasana (Mountain Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Tadasana', 'Mountain Pose', '{}', 'A foundational standing pose that establishes alignment, grounding, and body awareness. The basis for most other standing postures.', 'beginner', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'balance'), (v_id, 'mindfulness');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'vinyasa');

  -- Adho Mukha Svanasana (Downward-Facing Dog)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Adho Mukha Svanasana', 'Downward-Facing Dog', ARRAY['Down Dog'], 'An inverted V-shape pose that stretches the hamstrings, calves, and shoulders while building arm and core strength.', 'beginner', 45)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength'), (v_id, 'flexibility'), (v_id, 'energy');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'vinyasa'), (v_id, 'ashtanga');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Carpal tunnel syndrome or wrist injury'), (v_id, 'Late-stage pregnancy');

  -- Balasana (Child's Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Balasana', 'Child''s Pose', ARRAY['Child Pose'], 'A gentle resting pose that stretches the hips, thighs, and lower back while calming the nervous system.', 'beginner', 60)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'stress_relief'), (v_id, 'sleep'), (v_id, 'mindfulness');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'yin'), (v_id, 'restorative');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Knee injury'), (v_id, 'Late-stage pregnancy');

  -- Vrikshasana (Tree Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Vrikshasana', 'Tree Pose', ARRAY['Tree'], 'A standing balance pose that builds focus, ankle stability, and leg strength.', 'beginner', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'balance'), (v_id, 'strength'), (v_id, 'mindfulness');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Low blood pressure or dizziness');

  -- Bhujangasana (Cobra Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Bhujangasana', 'Cobra Pose', ARRAY['Cobra'], 'A gentle backbend that strengthens the spine and opens the chest, often used to counter forward-hunched posture.', 'beginner', 20)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'vinyasa');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Pregnancy'), (v_id, 'Recent back or spine injury');

  -- Trikonasana (Triangle Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Trikonasana', 'Triangle Pose', ARRAY['Triangle'], 'A standing pose that stretches the legs, hips, and spine while improving lateral flexibility and balance.', 'intermediate', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'flexibility'), (v_id, 'balance'), (v_id, 'strength');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'vinyasa'), (v_id, 'iyengar');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Neck injury (avoid turning gaze upward)'), (v_id, 'Low blood pressure');

  -- Virabhadrasana II (Warrior II)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Virabhadrasana II', 'Warrior II', ARRAY['Warrior 2'], 'A powerful standing pose that builds leg strength, stamina, and hip flexibility while cultivating focus.', 'intermediate', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength'), (v_id, 'energy');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'vinyasa'), (v_id, 'power');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Knee injury'), (v_id, 'High blood pressure (hold briefly, avoid strain)');

  -- Setu Bandhasana (Bridge Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Setu Bandhasana', 'Bridge Pose', ARRAY['Bridge'], 'A gentle backbend that strengthens the glutes and back while opening the chest and hip flexors.', 'intermediate', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength'), (v_id, 'energy');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'restorative');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Neck injury');

  -- Ardha Matsyendrasana (Half Lord of the Fishes / seated spinal twist)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Ardha Matsyendrasana', 'Half Lord of the Fishes Pose', ARRAY['Seated Spinal Twist'], 'A seated twist that improves spinal mobility and aids digestion.', 'intermediate', 30)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'flexibility'), (v_id, 'stress_relief');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'yin');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Pregnancy'), (v_id, 'Recent spine or disc injury');

  -- Sirsasana (Headstand)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Sirsasana', 'Headstand', ARRAY['Headstand', 'King of Asanas'], 'An advanced inversion that builds core, shoulder, and neck strength while improving focus and circulation. Requires supervised progression.', 'advanced', 60)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength'), (v_id, 'balance'), (v_id, 'mindfulness');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'ashtanga'), (v_id, 'iyengar');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'High blood pressure'), (v_id, 'Glaucoma or eye pressure conditions'), (v_id, 'Neck injury'), (v_id, 'Pregnancy');

  -- Bakasana (Crow Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Bakasana', 'Crow Pose', ARRAY['Crane Pose'], 'An arm-balancing pose that builds core and wrist strength along with focus and balance.', 'advanced', 20)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'strength'), (v_id, 'balance');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'ashtanga'), (v_id, 'power');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Wrist or carpal tunnel injury'), (v_id, 'Pregnancy');

  -- Ustrasana (Camel Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Ustrasana', 'Camel Pose', ARRAY['Camel'], 'A deep backbend that opens the chest, shoulders, and hip flexors. Best approached gradually.', 'advanced', 20)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'flexibility'), (v_id, 'energy');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'power');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Low back injury'), (v_id, 'High or low blood pressure (rise slowly)');

  -- Savasana (Corpse Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Savasana', 'Corpse Pose', ARRAY['Final Relaxation'], 'A resting pose practiced at the end of nearly every class, allowing the body to fully relax and integrate the practice.', 'all_levels', 300)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'stress_relief'), (v_id, 'sleep'), (v_id, 'mindfulness');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'restorative'), (v_id, 'yin'), (v_id, 'vinyasa');

  -- Sukhasana (Easy Pose)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Sukhasana', 'Easy Pose', ARRAY['Easy Seat'], 'A simple cross-legged seated pose used as a base for breathwork and meditation.', 'all_levels', 180)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'mindfulness'), (v_id, 'stress_relief');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'hatha'), (v_id, 'restorative');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Knee or hip injury (use a cushion for support)');

  -- Viparita Karani (Legs-Up-the-Wall)
  INSERT INTO asana (id, tenant_id, sanskrit_name, english_name, alternate_names, description, difficulty_level, duration_seconds)
  VALUES (gen_random_uuid(), v_tenant_id, 'Viparita Karani', 'Legs-Up-the-Wall Pose', ARRAY['Legs Up the Wall'], 'A restorative inversion that relieves tired legs, reduces stress, and supports better sleep.', 'all_levels', 300)
  RETURNING id INTO v_id;
  INSERT INTO asana_goal (asana_id, goal_code) VALUES (v_id, 'stress_relief'), (v_id, 'sleep'), (v_id, 'injury_recovery');
  INSERT INTO asana_style (asana_id, style_code) VALUES (v_id, 'restorative'), (v_id, 'yin');
  INSERT INTO asana_contraindication (asana_id, condition) VALUES (v_id, 'Glaucoma or eye pressure conditions'), (v_id, 'Serious back injury');
END $$;
