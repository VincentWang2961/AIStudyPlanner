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