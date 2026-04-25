-- =========================================================
-- seed.sql for BIGSERIAL-based study planner schema
-- =========================================================
-- This seed is designed to test:
--   - foreign keys
--   - composite keys
--   - course/specialisation relationships
--   - prerequisite / corequisite / incompatibility tables
--   - study plans and semester allocations
--   - planner-oriented sample data
-- =========================================================

BEGIN;

-- =========================================================
-- OPTIONAL RESET
-- =========================================================

TRUNCATE TABLE
  study_plan_units,
  study_plan_semesters,
  study_plans,
  user_completed_units,
  unit_incompatibilities,
  unit_corequisites,
  unit_prerequisites,
  course_requirements,
  unit_offerings,
  plan_preferences,
  users,
  group_units,
  course_groups,
  course_units,
  specialisations,
  units,
  courses
RESTART IDENTITY CASCADE;

-- =========================================================
-- 1. COURSES
-- =========================================================

INSERT INTO courses (
  code, title, major_code, min_points, max_points, time_limit_years, specialisations, extracted_rules
) VALUES
(
  '62510',
  'Master of Information Technology',
  'MIT',
  96,
  96,
  5,
  '["SP-APCMP","SP-ARTIN","SP-SOFSY"]'::jsonb,
  '{"notes":["course-level core units","specialisation-based choice units","capstone planning"]}'::jsonb
),
(
  '41680',
  'Master of Commerce',
  'MCOM',
  96,
  96,
  5,
  '[]'::jsonb,
  '{"notes":["commerce sample data for planner testing"]}'::jsonb
),
(
  'BP059',
  'Bachelor of Mathematics',
  'BMATH',
  144,
  144,
  8,
  '["MJD-EMATH"]'::jsonb,
  '{"notes":["mathematics sample data for planner testing"]}'::jsonb
);

-- =========================================================
-- 2. SPECIALISATIONS
-- =========================================================

INSERT INTO specialisations (
  course_code, code, name, created_at, updated_at
) VALUES
('62510', 'SP-APCMP', 'Applied Computing', NOW(), NOW()),
('62510', 'SP-ARTIN', 'Artificial Intelligence', NOW(), NOW()),
('62510', 'SP-SOFSY', 'Software Systems', NOW(), NOW()),
('BP059', 'MJD-EMATH', 'Mathematics', NOW(), NOW());

-- =========================================================
-- 3. UNITS
-- =========================================================

INSERT INTO units (
  code, title, curriculum_type, source_id, status, availabilities,
  prerequisites_raw, prerequisites_parsed,
  corequisites_raw, corequisites_parsed,
  incompatibilities_raw, incompatibilities_parsed
) VALUES
-- MIT core / planning test units
(
  'CITS1003',
  'Introduction to Cybersecurity',
  'Unit',
  'SRC-CITS1003',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS1401',
  'Computational Thinking with Python',
  'Unit',
  'SRC-CITS1401',
  'Active',
  'S1,S2',
  'MATH1721 or equivalent',
  '{"type":"or","rules":[{"type":"unit","code":"MATH1721"},{"type":"unit","code":"MATX1721"}]}'::jsonb,
  'Nil',
  NULL,
  'CITS2401',
  '["CITS2401"]'::jsonb
),
(
  'CITS1402',
  'Relational Database Management Systems',
  'Unit',
  'SRC-CITS1402',
  'Active',
  'S1,S2',
  'MATH1720 or equivalent',
  '{"type":"or","rules":[{"type":"unit","code":"MATH1720"},{"type":"unit","code":"MATX1720"}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS2002',
  'Systems Programming',
  'Unit',
  'SRC-CITS2002',
  'Active',
  'S2',
  'CITS1401 or CITX1401 or CITS2401',
  '{"type":"or","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITX1401"},{"type":"unit","code":"CITS2401"}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS2005',
  'Object Oriented Programming',
  'Unit',
  'SRC-CITS2005',
  'Active',
  'S1',
  'CITS1401 or CITX1401 or CITS2401',
  '{"type":"or","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITX1401"},{"type":"unit","code":"CITS2401"}]}'::jsonb,
  'Nil',
  NULL,
  'CITX1001',
  '["CITX1001"]'::jsonb
),
(
  'CITS4009',
  'Fundamentals of Data Science',
  'Unit',
  'SRC-CITS4009',
  'Active',
  'S2',
  'Minimum 96 points in eligible courses',
  '{"type":"points_requirement","minimumPoints":96,"inCourses":["62510","62530","62560","62550","72530"]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS4012',
  'Natural Language Processing',
  'Unit',
  'SRC-CITS4012',
  'Active',
  'S2',
  'CITS1401 or CITX1401 or CITS2401',
  '{"type":"or","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITX1401"},{"type":"unit","code":"CITS2401"}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS4407',
  'Open Source Tools and Scripting',
  'Unit',
  'SRC-CITS4407',
  'Active',
  'S1',
  'Enrolment in certain courses only',
  '{"type":"course_restriction","inCourses":["62530","72530","42630"]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS5206',
  'Information Technology Capstone Project',
  'Unit',
  'SRC-CITS5206',
  'Active',
  'S1,S2',
  'Minimum 66 points in 62510',
  '{"type":"points_requirement","minimumPoints":66,"inCourses":["62510"]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS5503',
  'Cloud Computing',
  'Unit',
  'SRC-CITS5503',
  'Active',
  'S2',
  'CITS2002 or CITS2005 or CITS2200 or CITS2402 or (CITS1401 and CITS4009)',
  '{"type":"or","rules":[{"type":"unit","code":"CITS2002"},{"type":"unit","code":"CITS2005"},{"type":"unit","code":"CITS2200"},{"type":"unit","code":"CITS2402"},{"type":"and","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITS4009"}]}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS5504',
  'Data Warehousing',
  'Unit',
  'SRC-CITS5504',
  'Active',
  'S1',
  'CITS1401 and CITS1402; or BUSN5101 and INMT5526',
  '{"type":"or","rules":[{"type":"and","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITS1402"}]},{"type":"and","rules":[{"type":"unit","code":"BUSN5101"},{"type":"unit","code":"INMT5526"}]}]}'::jsonb,
  'Nil',
  NULL,
  'CITS3401',
  '["CITS3401"]'::jsonb
),
(
  'CITS5508',
  'Machine Learning',
  'Unit',
  'SRC-CITS5508',
  'Active',
  'S1',
  'CITS1401 or CITX1401 or CITS2401; or BUSN5101 and BUSN5002',
  '{"type":"or","rules":[{"type":"unit","code":"CITS1401"},{"type":"unit","code":"CITX1401"},{"type":"unit","code":"CITS2401"},{"type":"and","rules":[{"type":"unit","code":"BUSN5101"},{"type":"unit","code":"BUSN5002"}]}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'CITS5017',
  'Deep Learning',
  'Unit',
  'SRC-CITS5017',
  'Active',
  'S2',
  'CITS5508',
  '{"type":"unit","code":"CITS5508"}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'PHIL4100',
  'Ethics and Critical Thinking',
  'Unit',
  'SRC-PHIL4100',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),

-- supporting / placeholder units for prerequisite and incompatibility testing
(
  'CITS3401',
  'Data Warehousing (old unit placeholder)',
  'Unit',
  'SRC-CITS3401',
  'Inactive',
  'Not offered',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'CITS5504',
  '["CITS5504"]'::jsonb
),
(
  'BUSN5101',
  'Business Statistics',
  'Unit',
  'SRC-BUSN5101',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'BUSN5002',
  'Foundations of Business Analytics',
  'Unit',
  'SRC-BUSN5002',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'INMT5526',
  'Business Intelligence',
  'Unit',
  'SRC-INMT5526',
  'Active',
  'S1,S2',
  'BUSN5101 or BUSN5002 or CITS1401',
  '{"type":"or","rules":[{"type":"unit","code":"BUSN5101"},{"type":"unit","code":"BUSN5002"},{"type":"unit","code":"CITS1401"}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),

-- Commerce sample units
(
  'BUSN5100',
  'Applied Professional Business Communications',
  'Unit',
  'SRC-BUSN5100',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'MGMT5504',
  'Data Analysis and Decision Making',
  'Unit',
  'SRC-MGMT5504',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'MGMT5513',
  '["MGMT5513"]'::jsonb
),
(
  'ACCT5432',
  'Introductory Financial Accounting',
  'Unit',
  'SRC-ACCT5432',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'FINA5533',
  'Finance Essentials',
  'Unit',
  'SRC-FINA5533',
  'Active',
  'S1,S2',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'FINA5432,FINA5635',
  '["FINA5432","FINA5635"]'::jsonb
),
(
  'FINA5631',
  'International Financial Analysis',
  'Unit',
  'SRC-FINA5631',
  'Active',
  'S1,S2',
  'ACCT5432 or equivalent',
  '{"type":"unit","code":"ACCT5432"}'::jsonb,
  'FINA5533',
  '{"type":"unit","code":"FINA5533"}'::jsonb,
  'Nil',
  NULL
),
(
  'SVLG5003',
  'Wicked Problems',
  'Unit',
  'SRC-SVLG5003',
  'Active',
  'NS,S1,S2',
  'Any bachelor degree; approval required',
  '{"type":"natural_language_rule","text":"any bachelor degree; approval required"}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'FINA5432',
  'Introduction to Finance (placeholder)',
  'Unit',
  'SRC-FINA5432',
  'Inactive',
  'Not offered',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'FINA5635',
  'Corporate Finance (placeholder)',
  'Unit',
  'SRC-FINA5635',
  'Inactive',
  'Not offered',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'MGMT5513',
  'Advanced Data Analysis (placeholder)',
  'Unit',
  'SRC-MGMT5513',
  'Inactive',
  'Not offered',
  'Nil',
  NULL,
  'Nil',
  NULL,
  'Nil',
  NULL
),

-- Mathematics sample units
(
  'MATH1011',
  'Multivariable Calculus',
  'Unit',
  'SRC-MATH1011',
  'Active',
  'S1,S2',
  'Mathematics Specialist ATAR or equivalent',
  '{"type":"natural_language_rule","text":"Mathematics Specialist ATAR or equivalent"}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'MATH1012',
  'Mathematical Theory and Methods',
  'Unit',
  'SRC-MATH1012',
  'Active',
  'S1,S2',
  'Mathematics Specialist ATAR or equivalent',
  '{"type":"natural_language_rule","text":"Mathematics Specialist ATAR or equivalent"}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
),
(
  'STAT2062',
  'Fundamentals of Probability with Applications',
  'Unit',
  'SRC-STAT2062',
  'Active',
  'S2',
  '(MATH1011 or MATX1011) and (MATH1012 or MATX1012)',
  '{"type":"and","rules":[{"type":"or","rules":[{"type":"unit","code":"MATH1011"},{"type":"unit","code":"MATX1011"}]},{"type":"or","rules":[{"type":"unit","code":"MATH1012"},{"type":"unit","code":"MATX1012"}]}]}'::jsonb,
  'Nil',
  NULL,
  'Nil',
  NULL
);

-- =========================================================
-- 4. COURSE_UNITS
-- =========================================================

INSERT INTO course_units (course_code, unit_code) VALUES
('62510', 'CITS1003'),
('62510', 'CITS1401'),
('62510', 'CITS1402'),
('62510', 'CITS2002'),
('62510', 'CITS2005'),
('62510', 'CITS4009'),
('62510', 'CITS4012'),
('62510', 'CITS4407'),
('62510', 'CITS5206'),
('62510', 'CITS5503'),
('62510', 'CITS5504'),
('62510', 'CITS5508'),
('62510', 'CITS5017'),
('62510', 'PHIL4100'),

('41680', 'BUSN5100'),
('41680', 'MGMT5504'),
('41680', 'ACCT5432'),
('41680', 'FINA5533'),
('41680', 'FINA5631'),
('41680', 'SVLG5003'),

('BP059', 'MATH1011'),
('BP059', 'MATH1012'),
('BP059', 'STAT2062');

-- =========================================================
-- 5. COURSE_GROUPS
-- =========================================================

INSERT INTO course_groups (
  id, course_code, group_code, name, rule_text, rule_json
) VALUES
(1, '62510', 'SP-APCMP-UNGROUPED', 'Applied Computing choice set', 'Group for Applied Computing specialisation', '{"specialisation":"SP-APCMP"}'::jsonb),
(2, '62510', 'SP-ARTIN-UNGROUPED', 'Artificial Intelligence choice set', 'Group for Artificial Intelligence specialisation', '{"specialisation":"SP-ARTIN"}'::jsonb),
(3, '62510', 'SP-SOFSY-UNGROUPED', 'Software Systems choice set', 'Group for Software Systems specialisation', '{"specialisation":"SP-SOFSY"}'::jsonb),
(4, '41680', 'COMMERCE-CORE', 'Commerce sample group', 'Sample commerce group for testing', '{"groupType":"sample"}'::jsonb),
(5, 'BP059', 'MATH-CORE', 'Mathematics core group', 'Sample mathematics group for testing', '{"groupType":"sample"}'::jsonb);

-- =========================================================
-- 6. GROUP_UNITS
-- =========================================================

INSERT INTO group_units (group_id, unit_code) VALUES
(1, 'CITS4009'),
(1, 'CITS5504'),
(1, 'CITS5508'),

(2, 'CITS4012'),
(2, 'CITS5508'),
(2, 'CITS5017'),

(3, 'CITS4407'),
(3, 'CITS5503'),
(3, 'CITS2005'),

(4, 'BUSN5100'),
(4, 'MGMT5504'),
(4, 'FINA5533'),

(5, 'MATH1011'),
(5, 'MATH1012'),
(5, 'STAT2062');

-- =========================================================
-- 7. USERS
-- =========================================================

INSERT INTO users (
  id, email, name, course_code, specialisation_code, start_year, start_semester, created_at, updated_at
) VALUES
(1, 'yosuke.mit@example.com', 'Yosuke MIT Test User', '62510', 'SP-ARTIN', 2026, 'S1', NOW(), NOW()),
(2, 'commerce.user@example.com', 'Commerce Test User', '41680', NULL, 2026, 'S1', NOW(), NOW()),
(3, 'math.user@example.com', 'Math Test User', 'BP059', 'MJD-EMATH', 2026, 'S1', NOW(), NOW());

-- =========================================================
-- 8. PLAN_PREFERENCES
-- =========================================================

INSERT INTO plan_preferences (
  id, user_id, finish_as_soon_as_possible, prefer_balanced_workload,
  allow_part_time, preferred_max_units_per_semester, notes, created_at, updated_at
) VALUES
(1, 1, FALSE, TRUE,  FALSE, 2, 'Prefer balanced AI-focused study load.', NOW(), NOW()),
(2, 2, TRUE,  FALSE, TRUE,  3, 'Try to finish sooner if offerings allow.', NOW(), NOW()),
(3, 3, FALSE, TRUE,  FALSE, 2, 'Keep mathematics study load balanced.', NOW(), NOW());

-- =========================================================
-- 9. UNIT_OFFERINGS
-- =========================================================

INSERT INTO unit_offerings (
  id, unit_code, academic_year, semester, campus, teaching_mode, is_available, created_at, updated_at
) VALUES
(1,  'CITS1401', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(2,  'CITS1401', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(3,  'CITS1402', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(4,  'CITS1402', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(5,  'CITS5508', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(6,  'CITS5017', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(7,  'CITS5504', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(8,  'CITS5503', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(9,  'CITS5206', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(10, 'PHIL4100', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(11, 'PHIL4100', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(12, 'BUSN5100', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(13, 'MGMT5504', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(14, 'FINA5533', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(15, 'FINA5631', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(16, 'SVLG5003', 2026, 'NS', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(17, 'MATH1011', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(18, 'MATH1012', 2026, 'S1', 'Crawley', 'On-campus', TRUE, NOW(), NOW()),
(19, 'STAT2062', 2026, 'S2', 'Crawley', 'On-campus', TRUE, NOW(), NOW());

-- =========================================================
-- 10. COURSE_REQUIREMENTS
-- =========================================================

INSERT INTO course_requirements (
  id, course_code, specialisation_code, unit_code, requirement_type, recommended_year, created_at, updated_at
) VALUES
(1,  '62510', NULL,        'CITS1003', 'core',               1, NOW(), NOW()),
(2,  '62510', NULL,        'CITS1401', 'core',               1, NOW(), NOW()),
(3,  '62510', NULL,        'CITS1402', 'core',               1, NOW(), NOW()),
(4,  '62510', NULL,        'PHIL4100', 'core',               1, NOW(), NOW()),
(5,  '62510', NULL,        'CITS5206', 'capstone',           2, NOW(), NOW()),

(6,  '62510', 'SP-APCMP',  'CITS4009', 'specialisation_core', 1, NOW(), NOW()),
(7,  '62510', 'SP-APCMP',  'CITS5504', 'elective',            2, NOW(), NOW()),

(8,  '62510', 'SP-ARTIN',  'CITS5508', 'specialisation_core', 1, NOW(), NOW()),
(9,  '62510', 'SP-ARTIN',  'CITS5017', 'specialisation_core', 2, NOW(), NOW()),
(10, '62510', 'SP-ARTIN',  'CITS4012', 'elective',            2, NOW(), NOW()),

(11, '62510', 'SP-SOFSY',  'CITS5503', 'specialisation_core', 2, NOW(), NOW()),
(12, '62510', 'SP-SOFSY',  'CITS4407', 'elective',            2, NOW(), NOW()),

(13, '41680', NULL,        'BUSN5100', 'core',                1, NOW(), NOW()),
(14, '41680', NULL,        'MGMT5504', 'core',                1, NOW(), NOW()),
(15, '41680', NULL,        'FINA5533', 'elective',            1, NOW(), NOW()),
(16, '41680', NULL,        'SVLG5003', 'option',              1, NOW(), NOW()),

(17, 'BP059', 'MJD-EMATH', 'MATH1011', 'core',                1, NOW(), NOW()),
(18, 'BP059', 'MJD-EMATH', 'MATH1012', 'core',                1, NOW(), NOW()),
(19, 'BP059', 'MJD-EMATH', 'STAT2062', 'core',                2, NOW(), NOW());

-- =========================================================
-- 11. UNIT_PREREQUISITES
-- =========================================================

INSERT INTO unit_prerequisites (
  id, unit_code, prerequisite_unit_code, created_at
) VALUES
(1,  'CITS2002', 'CITS1401', NOW()),
(2,  'CITS2005', 'CITS1401', NOW()),
(3,  'CITS5504', 'CITS1401', NOW()),
(4,  'CITS5504', 'CITS1402', NOW()),
(5,  'CITS5508', 'CITS1401', NOW()),
(6,  'CITS5017', 'CITS5508', NOW()),
(7,  'INMT5526', 'CITS1401', NOW()),
(8,  'FINA5631', 'ACCT5432', NOW()),
(9,  'STAT2062', 'MATH1011', NOW()),
(10, 'STAT2062', 'MATH1012', NOW());

-- =========================================================
-- 12. UNIT_COREQUISITES
-- =========================================================

INSERT INTO unit_corequisites (
  id, unit_code, corequisite_unit_code, created_at
) VALUES
(1, 'FINA5631', 'FINA5533', NOW());

-- =========================================================
-- 13. UNIT_INCOMPATIBILITIES
-- =========================================================

INSERT INTO unit_incompatibilities (
  id, unit_code, incompatible_unit_code, created_at
) VALUES
(1, 'CITS5504', 'CITS3401', NOW()),
(2, 'FINA5533', 'FINA5432', NOW()),
(3, 'FINA5533', 'FINA5635', NOW()),
(4, 'MGMT5504', 'MGMT5513', NOW());

-- =========================================================
-- 14. USER_COMPLETED_UNITS
-- =========================================================

INSERT INTO user_completed_units (
  id, user_id, unit_code, completion_year, completion_semester, grade, created_at
) VALUES
(1, 1, 'CITS1401', 2026, 'S1', 'HD', NOW()),
(2, 1, 'CITS1402', 2026, 'S1', 'D',  NOW()),
(3, 1, 'CITS5508', 2026, 'S2', 'CR', NOW()),

(4, 2, 'BUSN5100', 2026, 'S1', 'P',  NOW()),
(5, 2, 'ACCT5432', 2026, 'S1', 'D',  NOW()),
(6, 2, 'FINA5533', 2026, 'S1', 'CR', NOW()),

(7, 3, 'MATH1011', 2026, 'S1', 'D',  NOW()),
(8, 3, 'MATH1012', 2026, 'S1', 'D',  NOW());

-- =========================================================
-- 15. STUDY_PLANS
-- =========================================================

INSERT INTO study_plans (
  id, user_id, course_code, specialisation_code, title,
  start_year, start_semester, max_units_per_semester, status, created_at, updated_at
) VALUES
(1, 1, '62510', 'SP-ARTIN',  'MIT AI Study Plan',         2026, 'S1', 2, 'active',   NOW(), NOW()),
(2, 2, '41680', NULL,        'Commerce Draft Plan',       2026, 'S1', 3, 'draft',    NOW(), NOW()),
(3, 3, 'BP059', 'MJD-EMATH', 'Mathematics Archived Plan', 2026, 'S1', 2, 'archived', NOW(), NOW());

-- =========================================================
-- 16. STUDY_PLAN_SEMESTERS
-- =========================================================

INSERT INTO study_plan_semesters (
  id, study_plan_id, sequence_no, year, semester, created_at, updated_at
) VALUES
(1, 1, 1, 2026, 'S1', NOW(), NOW()),
(2, 1, 2, 2026, 'S2', NOW(), NOW()),
(3, 1, 3, 2027, 'S1', NOW(), NOW()),

(4, 2, 1, 2026, 'S1', NOW(), NOW()),
(5, 2, 2, 2026, 'S2', NOW(), NOW()),

(6, 3, 1, 2026, 'S1', NOW(), NOW()),
(7, 3, 2, 2026, 'S2', NOW(), NOW());

-- =========================================================
-- 17. STUDY_PLAN_UNITS
-- =========================================================

INSERT INTO study_plan_units (
  id, study_plan_semester_id, unit_code, source, placement_status, created_at, updated_at
) VALUES
(1, 1, 'CITS1003', 'auto',   'valid',   NOW(), NOW()),
(2, 1, 'PHIL4100', 'manual', 'valid',   NOW(), NOW()),
(3, 2, 'CITS5017', 'auto',   'valid',   NOW(), NOW()),
(4, 3, 'CITS5206', 'auto',   'warning', NOW(), NOW()),

(5, 4, 'BUSN5100', 'auto',   'valid',   NOW(), NOW()),
(6, 4, 'SVLG5003', 'manual', 'pending', NOW(), NOW()),
(7, 5, 'FINA5631', 'auto',   'valid',   NOW(), NOW()),

(8, 6, 'MATH1011', 'auto',   'valid',   NOW(), NOW()),
(9, 6, 'MATH1012', 'auto',   'valid',   NOW(), NOW()),
(10, 7, 'STAT2062', 'auto',  'valid',   NOW(), NOW());

-- =========================================================
-- 18. FIX SEQUENCES AFTER EXPLICIT BIGSERIAL INSERTS
-- =========================================================

SELECT setval('course_groups_id_seq',           COALESCE((SELECT MAX(id) FROM course_groups), 1), true);
SELECT setval('users_id_seq',                   COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval('plan_preferences_id_seq',        COALESCE((SELECT MAX(id) FROM plan_preferences), 1), true);
SELECT setval('unit_offerings_id_seq',          COALESCE((SELECT MAX(id) FROM unit_offerings), 1), true);
SELECT setval('course_requirements_id_seq',     COALESCE((SELECT MAX(id) FROM course_requirements), 1), true);
SELECT setval('unit_prerequisites_id_seq',      COALESCE((SELECT MAX(id) FROM unit_prerequisites), 1), true);
SELECT setval('unit_corequisites_id_seq',       COALESCE((SELECT MAX(id) FROM unit_corequisites), 1), true);
SELECT setval('unit_incompatibilities_id_seq',  COALESCE((SELECT MAX(id) FROM unit_incompatibilities), 1), true);
SELECT setval('user_completed_units_id_seq',    COALESCE((SELECT MAX(id) FROM user_completed_units), 1), true);
SELECT setval('study_plans_id_seq',             COALESCE((SELECT MAX(id) FROM study_plans), 1), true);
SELECT setval('study_plan_semesters_id_seq',    COALESCE((SELECT MAX(id) FROM study_plan_semesters), 1), true);
SELECT setval('study_plan_units_id_seq',        COALESCE((SELECT MAX(id) FROM study_plan_units), 1), true);

COMMIT;