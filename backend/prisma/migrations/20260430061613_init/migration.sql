-- CreateTable
CREATE TABLE "course_groups" (
    "id" BIGSERIAL NOT NULL,
    "course_code" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule_text" TEXT,
    "rule_json" JSONB,

    CONSTRAINT "course_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_units" (
    "course_code" TEXT NOT NULL,
    "unit_code" TEXT NOT NULL,

    CONSTRAINT "course_units_pkey" PRIMARY KEY ("course_code","unit_code")
);

-- CreateTable
CREATE TABLE "courses" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "major_code" TEXT,
    "min_points" INTEGER,
    "max_points" INTEGER,
    "time_limit_years" INTEGER,
    "specialisations" JSONB DEFAULT '[]',
    "extracted_rules" JSONB DEFAULT '[]',

    CONSTRAINT "courses_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "group_units" (
    "group_id" BIGINT NOT NULL,
    "unit_code" TEXT NOT NULL,

    CONSTRAINT "group_units_pkey" PRIMARY KEY ("group_id","unit_code")
);

-- CreateTable
CREATE TABLE "units" (
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "curriculum_type" TEXT,
    "source_id" TEXT,
    "status" TEXT,
    "availabilities" TEXT,
    "prerequisites_raw" TEXT,
    "prerequisites_parsed" JSONB,
    "corequisites_raw" TEXT,
    "corequisites_parsed" JSONB,
    "incompatibilities_raw" TEXT,
    "incompatibilities_parsed" JSONB,

    CONSTRAINT "units_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_groups_course_code_group_code_key" ON "course_groups"("course_code", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "course_groups" ADD CONSTRAINT "course_groups_course_code_fkey" FOREIGN KEY ("course_code") REFERENCES "courses"("code") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_units" ADD CONSTRAINT "course_units_course_code_fkey" FOREIGN KEY ("course_code") REFERENCES "courses"("code") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "course_units" ADD CONSTRAINT "course_units_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "units"("code") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "group_units" ADD CONSTRAINT "group_units_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "course_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "group_units" ADD CONSTRAINT "group_units_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "units"("code") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
