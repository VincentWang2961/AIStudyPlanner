CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  major_code TEXT,
  min_points INTEGER,
  max_points INTEGER,
  time_limit_years INTEGER,
  specialisations JSONB DEFAULT '[]'::jsonb,
  extracted_rules JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS units (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  curriculum_type TEXT,
  source_id TEXT,
  status TEXT,
  availabilities TEXT,
  prerequisites_raw TEXT,
  prerequisites_parsed JSONB,
  corequisites_raw TEXT,
  corequisites_parsed JSONB,
  incompatibilities_raw TEXT,
  incompatibilities_parsed JSONB
);

CREATE TABLE IF NOT EXISTS course_units (
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  PRIMARY KEY (course_code, unit_code)
);

CREATE TABLE IF NOT EXISTS course_groups (
  id BIGSERIAL PRIMARY KEY,
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  group_code TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_text TEXT,
  rule_json JSONB,
  UNIQUE (course_code, group_code)
);

CREATE TABLE IF NOT EXISTS group_units (
  group_id BIGINT NOT NULL REFERENCES course_groups(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  PRIMARY KEY (group_id, unit_code)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS specialisations (
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_code, code)
);

-- Add academic profile fields to the existing users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS course_code TEXT,
  ADD COLUMN IF NOT EXISTS specialisation_code TEXT,
  ADD COLUMN IF NOT EXISTS start_year INTEGER,
  ADD COLUMN IF NOT EXISTS start_semester TEXT;

ALTER TABLE users
  ADD CONSTRAINT users_course_fk
  FOREIGN KEY (course_code)
  REFERENCES courses(code)
  ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT users_specialisation_fk
  FOREIGN KEY (course_code, specialisation_code)
  REFERENCES specialisations(course_code, code)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS plan_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  finish_as_soon_as_possible BOOLEAN NOT NULL DEFAULT FALSE,
  prefer_balanced_workload BOOLEAN NOT NULL DEFAULT FALSE,
  allow_part_time BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_max_units_per_semester INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_offerings (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  academic_year INTEGER,
  semester TEXT NOT NULL,
  campus TEXT,
  teaching_mode TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_requirements (
  id BIGSERIAL PRIMARY KEY,
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  specialisation_code TEXT,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL,
  recommended_year INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_requirements_specialisation_fk
    FOREIGN KEY (course_code, specialisation_code)
    REFERENCES specialisations(course_code, code)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS unit_prerequisites (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  prerequisite_unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_code, prerequisite_unit_code)
);

CREATE TABLE IF NOT EXISTS unit_corequisites (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  corequisite_unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_code, corequisite_unit_code)
);

CREATE TABLE IF NOT EXISTS unit_incompatibilities (
  id BIGSERIAL PRIMARY KEY,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  incompatible_unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (unit_code, incompatible_unit_code)
);

CREATE TABLE IF NOT EXISTS user_completed_units (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  completion_year INTEGER,
  completion_semester TEXT,
  grade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, unit_code)
);

CREATE TABLE IF NOT EXISTS study_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  course_code TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  specialisation_code TEXT,
  title TEXT,
  start_year INTEGER NOT NULL,
  start_semester TEXT NOT NULL,
  max_units_per_semester INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT study_plans_user_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT study_plans_specialisation_fk
    FOREIGN KEY (course_code, specialisation_code)
    REFERENCES specialisations(course_code, code)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS study_plan_semesters (
  id BIGSERIAL PRIMARY KEY,
  study_plan_id BIGINT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  sequence_no INTEGER NOT NULL,
  year INTEGER NOT NULL,
  semester TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_plan_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS study_plan_units (
  id BIGSERIAL PRIMARY KEY,
  study_plan_semester_id BIGINT NOT NULL REFERENCES study_plan_semesters(id) ON DELETE CASCADE,
  unit_code TEXT NOT NULL REFERENCES units(code) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'auto',
  placement_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_plan_semester_id, unit_code)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
