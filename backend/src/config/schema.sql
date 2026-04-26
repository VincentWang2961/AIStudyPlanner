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

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
