CREATE TABLE "guest_sessions" (
  "id" BIGSERIAL PRIMARY KEY,
  "token_hash" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "study_plans" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT,
  "guest_id" BIGINT,
  "name" TEXT NOT NULL,
  "course_code" TEXT,
  "program" TEXT,
  "config" JSONB,
  "plan_data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "study_plans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "study_plans_guest_id_fkey"
    FOREIGN KEY ("guest_id") REFERENCES "guest_sessions"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "study_plans_user_id_idx" ON "study_plans"("user_id");
CREATE INDEX "study_plans_guest_id_idx" ON "study_plans"("guest_id");
CREATE INDEX "study_plans_updated_at_idx" ON "study_plans"("updated_at");
